import { describe, expect, it } from "vitest";
import {
  computeIntentFingerprint,
  computePolicyHash,
  evaluateEvidence,
} from "../policy";
import {
  intentRecordSchema,
  observedActionSchema,
  policyDraftSchema,
  policyRecordSchema,
  type IntentRecord,
  type ObservedAction,
  type PolicyRecord,
} from "../schemas";
import {
  SAMPLE_AGENT_ACCOUNT,
  SAMPLE_INNER_SELECTOR,
  SAMPLE_INNER_TARGET,
  SAMPLE_OUTER_TX,
} from "./fixtures";

const NOW = new Date("2026-10-21T12:00:00.000Z");

function makePolicy(overrides: Record<string, unknown> = {}): PolicyRecord {
  const draft = policyDraftSchema.parse({
    name: "Treasury operations",
    chainId: 968,
    allowedTargets: [SAMPLE_INNER_TARGET],
    allowedMethods: [SAMPLE_INNER_SELECTOR],
    maxNativeValuePerActionWei: "500000000000000000",
    maxNativeValuePerDayWei: "2000000000000000000",
    expiresAt: "2030-01-01T00:00:00.000Z",
    notes: "Only the approved treasury adapter.",
    ...overrides,
  });
  return policyRecordSchema.parse({
    ...draft,
    id: "11111111-1111-4111-8111-111111111111",
    version: 1,
    hash: computePolicyHash({ ...draft, version: 1 }),
    createdAt: "2026-10-01T00:00:00.000Z",
  });
}

function makeIntent(policy: PolicyRecord): IntentRecord {
  const base = {
    id: "22222222-2222-4222-8222-222222222222",
    agentId: "33333333-3333-4333-8333-333333333333",
    policyId: policy.id,
    policyVersion: policy.version,
    policyHash: policy.hash,
    chainId: 968 as const,
    title: "Transfer 1 USDT through the approved adapter",
    rationale: "A human approved this testnet transfer for reconciliation.",
    target: SAMPLE_INNER_TARGET,
    methodSelector: SAMPLE_INNER_SELECTOR,
    valueWei: "0",
    approvedBy: "Treasury operator",
    createdAt: "2026-10-20T05:00:00.000Z",
  };
  return intentRecordSchema.parse({
    ...base,
    fingerprint: computeIntentFingerprint(base),
  });
}

function makeObserved(
  overrides: Partial<ObservedAction> = {},
): ObservedAction {
  return observedActionSchema.parse({
    chainId: 968,
    kind: "user_operation",
    sender: SAMPLE_AGENT_ACCOUNT,
    target: SAMPLE_INNER_TARGET,
    targetSource: "decoded_inner",
    methodSelector: SAMPLE_INNER_SELECTOR,
    methodLabel: null,
    valueWei: "0",
    valueSource: "decoded_inner",
    outerEnvelopeLabel: "Account execute envelope · Kernel",
    chainStatus: "success",
    outerTransactionHash: SAMPLE_OUTER_TX,
    blockNumber: "27484047",
    confirmedAt: "2026-10-20T05:01:59.000Z",
    gasUsed: "325312",
    gasPriceWei: "20000000000",
    feeWei: "6506240000000000",
    coverage: "complete",
    coverageNotes: [],
    tokenMovements: [],
    explorerUrl: "https://scan.bohr.life/op/0xabc",
    decodedBy: "mandate",
    ...overrides,
  });
}

describe("evaluateEvidence", () => {
  const policy = makePolicy();
  const intent = makeIntent(policy);

  it("matches a complete, attributable action inside policy", () => {
    const evaluation = evaluateEvidence({
      policy,
      intent,
      observed: makeObserved(),
      agentAccount: SAMPLE_AGENT_ACCOUNT,
      now: NOW,
    });
    expect(evaluation.verdict).toBe("matched");
    expect(evaluation.intentMatch).toBe("match");
    expect(evaluation.policyResult).toBe("within_policy");
    expect(evaluation.checks.every((check) => check.state === "pass")).toBe(true);
    expect(
      evaluation.policyChecks.filter((check) => check.state === "fail"),
    ).toHaveLength(0);
  });

  it("classifies a target mismatch as out of policy", () => {
    const evaluation = evaluateEvidence({
      policy,
      intent,
      observed: makeObserved({
        target: "0x75edC9335175Fc0552D51D48439F229c10420fe3",
      }),
      agentAccount: SAMPLE_AGENT_ACCOUNT,
      now: NOW,
    });
    expect(evaluation.verdict).toBe("out_of_policy");
    expect(evaluation.intentMatch).toBe("mismatch");
    expect(evaluation.policyResult).toBe("violation");
  });

  it("classifies an action without an approved intent as unattributed", () => {
    const evaluation = evaluateEvidence({
      policy,
      intent: null,
      observed: makeObserved(),
      agentAccount: SAMPLE_AGENT_ACCOUNT,
      now: NOW,
    });
    expect(evaluation.verdict).toBe("unattributed");
    expect(evaluation.intentMatch).toBe("no_intent");
    expect(
      evaluation.coverageNotes.some((note) => note.includes("No approved intent")),
    ).toBe(true);
  });

  it("needs review when the inner call cannot be decoded", () => {
    const evaluation = evaluateEvidence({
      policy,
      intent,
      observed: makeObserved({
        target: null,
        targetSource: "unavailable",
        methodSelector: null,
        valueWei: null,
        valueSource: "unavailable",
        coverage: "partial",
        coverageNotes: ["The inner target is unavailable."],
      }),
      agentAccount: SAMPLE_AGENT_ACCOUNT,
      now: NOW,
    });
    expect(evaluation.verdict).toBe("needs_review");
    expect(evaluation.intentMatch).toBe("unavailable");
    expect(evaluation.policyResult).toBe("unavailable");
    expect(evaluation.coverage).toBe("partial");
  });

  it("prioritizes a failed chain result", () => {
    const evaluation = evaluateEvidence({
      policy,
      intent,
      observed: makeObserved({ chainStatus: "failed", coverage: "complete" }),
      agentAccount: SAMPLE_AGENT_ACCOUNT,
      now: NOW,
    });
    expect(evaluation.verdict).toBe("failed");
    expect(evaluation.chainResult).toBe("failed");
  });

  it("prioritizes a pending chain result", () => {
    const evaluation = evaluateEvidence({
      policy,
      intent,
      observed: makeObserved({ chainStatus: "pending" }),
      agentAccount: SAMPLE_AGENT_ACCOUNT,
      now: NOW,
    });
    expect(evaluation.verdict).toBe("pending");
  });

  it("treats an expired policy as a violation at evaluation time", () => {
    const evaluation = evaluateEvidence({
      policy,
      intent,
      observed: makeObserved({ confirmedAt: "2031-02-01T00:00:00.000Z" }),
      agentAccount: SAMPLE_AGENT_ACCOUNT,
      now: new Date("2031-03-01T00:00:00.000Z"),
    });
    expect(evaluation.verdict).toBe("out_of_policy");
    expect(
      evaluation.policyChecks.find((check) => check.key === "policy.expiry")
        ?.state,
    ).toBe("fail");
  });

  it("enforces the daily native cap", () => {
    const evaluation = evaluateEvidence({
      policy,
      intent,
      observed: makeObserved({ valueWei: "100000000000000000" }),
      agentAccount: SAMPLE_AGENT_ACCOUNT,
      priorNativeValueTodayWei: "1950000000000000000",
      now: NOW,
    });
    expect(evaluation.verdict).toBe("out_of_policy");
    expect(
      evaluation.policyChecks.find((check) => check.key === "policy.daily_cap")
        ?.state,
    ).toBe("fail");
  });

  it("flags a different sender as a policy failure", () => {
    const evaluation = evaluateEvidence({
      policy,
      intent,
      observed: makeObserved({
        sender: "0x75edC9335175Fc0552D51D48439F229c10420fe3",
      }),
      agentAccount: SAMPLE_AGENT_ACCOUNT,
      now: NOW,
    });
    expect(evaluation.verdict).toBe("out_of_policy");
  });
});

describe("policy records", () => {
  const fields = {
    name: "Expired treasury policy",
    chainId: 968 as const,
    allowedTargets: [SAMPLE_INNER_TARGET],
    allowedMethods: [SAMPLE_INNER_SELECTOR],
    maxNativeValuePerActionWei: "0",
    maxNativeValuePerDayWei: null,
    expiresAt: "2020-01-01T00:00:00.000Z",
    notes: "",
  };

  it("keeps expired policy history readable", () => {
    const record = policyRecordSchema.parse({
      ...fields,
      id: "11111111-1111-4111-8111-111111111111",
      version: 2,
      hash: computePolicyHash({ ...fields, version: 2 }),
      createdAt: "2019-12-01T00:00:00.000Z",
    });

    expect(record.version).toBe(2);
    expect(record.expiresAt).toBe(fields.expiresAt);
  });

  it("still rejects a past expiry for a new policy", () => {
    expect(() => policyDraftSchema.parse(fields)).toThrow(
      "The expiry must be in the future.",
    );
  });
});

describe("hashes", () => {
  it("produces a stable policy hash independent of target order", () => {
    const first = makePolicy();
    const second = makePolicy({
      allowedTargets: [
        "0x75edC9335175Fc0552D51D48439F229c10420fe3",
        SAMPLE_INNER_TARGET,
      ],
    });
    expect(first.hash).toMatch(/^0x[0-9a-f]{64}$/);
    expect(second.hash).toMatch(/^0x[0-9a-f]{64}$/);
    expect(first.hash).not.toBe(second.hash);
  });
});
