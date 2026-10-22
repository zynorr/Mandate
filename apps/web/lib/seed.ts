import "server-only";

import type Database from "better-sqlite3";
import {
  computeIntentFingerprint,
  computePolicyHash,
  evaluateEvidence,
  evidenceRecordSchema,
  intentRecordSchema,
  policyDraftSchema,
  policyRecordSchema,
  type EvidenceRecord,
  type IntentRecord,
  type ObservedAction,
  type PolicyRecord,
} from "@mandate/chain";

const AGENT_ID = "a0000000-0000-4000-8000-000000000001";
const POLICY_ID = "a0000000-0000-4000-8000-000000000002";
const INTENT_VENDOR_ID = "a0000000-0000-4000-8000-000000000003";
const INTENT_RETURN_ID = "a0000000-0000-4000-8000-000000000004";
const INTENT_INVOICE_ID = "a0000000-0000-4000-8000-000000000005";

const SMART_ACCOUNT: `0x${string}` = "0x1111111111111111111111111111111111111111";
const APPROVED_TARGET: `0x${string}` = "0x3333333333333333333333333333333333333333";
const OTHER_TARGET: `0x${string}` = "0x4444444444444444444444444444444444444444";
const TRANSFER_SELECTOR = "0xa9059cbb";

const sampleHash = (suffix: string) =>
  `0x${suffix.repeat(64).slice(0, 64)}`;

const observedTime = "2026-10-20T09:30:00.000Z";

function baseObserved(
  overrides: Partial<ObservedAction> & {
    kind: ObservedAction["kind"];
    hash: string;
  },
): ObservedAction {
  const { hash, ...rest } = overrides;
  const explorerKind = rest.kind === "user_operation" ? "op" : "tx";
  return {
    chainId: 968,
    sender: SMART_ACCOUNT,
    target: APPROVED_TARGET,
    targetSource: "decoded_inner",
    methodSelector: TRANSFER_SELECTOR,
    methodLabel: "transfer(address,uint256)",
    valueWei: "0",
    valueSource: "decoded_inner",
    outerEnvelopeLabel:
      rest.kind === "user_operation" ? "Account execute envelope · Kernel" : null,
    chainStatus: "success",
    outerTransactionHash: sampleHash("b"),
    blockNumber: "27400001",
    confirmedAt: observedTime,
    gasUsed: "148220",
    gasPriceWei: "20000000000",
    feeWei: "2964400000000000",
    coverage: "complete",
    coverageNotes: [
      "Sample record. This is not evidence fetched from BOT Chain.",
      "Token movements are informational. This policy evaluates target, method, and native value only.",
    ],
    tokenMovements: [],
    explorerUrl: `https://scan.bohr.life/${explorerKind}/${hash}`,
    decodedBy: "mandate",
    ...rest,
  };
}

export function seedDemoWorkspace(db: Database.Database): void {
  const alreadySeeded = db
    .prepare("SELECT value FROM meta WHERE key = 'demo_seed_v1'")
    .get() as { value: string } | undefined;
  if (alreadySeeded) return;

  const agentCount = db
    .prepare("SELECT COUNT(*) AS count FROM agents")
    .get() as { count: number };
  if (agentCount.count > 0) {
    db.prepare(
      "INSERT OR REPLACE INTO meta (key, value) VALUES ('demo_seed_v1', 'skipped')",
    ).run();
    return;
  }

  const now = "2026-10-20T10:00:00.000Z";

  const draft = policyDraftSchema.parse({
    name: "Vendor settlement pilot",
    chainId: 968,
    allowedTargets: [APPROVED_TARGET],
    allowedMethods: [TRANSFER_SELECTOR],
    maxNativeValuePerActionWei: "10000000000000000",
    maxNativeValuePerDayWei: "50000000000000000",
    expiresAt: "2028-12-31T00:00:00.000Z",
    notes:
      "Sample policy: only the approved settlement token and transfer method, with a small native-value ceiling.",
  });
  const policy: PolicyRecord = policyRecordSchema.parse({
    ...draft,
    id: POLICY_ID,
    version: 1,
    hash: computePolicyHash({ ...draft, version: 1 }),
    createdAt: "2026-10-18T08:00:00.000Z",
  });

  const makeIntent = (input: {
    id: string;
    title: string;
    rationale: string;
    createdAt: string;
  }): IntentRecord => {
    const base = {
      id: input.id,
      agentId: AGENT_ID,
      policyId: policy.id,
      policyVersion: policy.version,
      policyHash: policy.hash,
      chainId: 968 as const,
      title: input.title,
      rationale: input.rationale,
      target: APPROVED_TARGET,
      methodSelector: TRANSFER_SELECTOR,
      valueWei: "0",
      approvedBy: "Sample operator",
      createdAt: input.createdAt,
    };
    return intentRecordSchema.parse({
      ...base,
      fingerprint: computeIntentFingerprint(base),
    });
  };

  const vendorIntent = makeIntent({
    id: INTENT_VENDOR_ID,
    title: "Send sample vendor settlement",
    rationale:
      "Sample approval: one token transfer to the pilot vendor through the approved settlement target.",
    createdAt: "2026-10-19T14:00:00.000Z",
  });
  const returnIntent = makeIntent({
    id: INTENT_RETURN_ID,
    title: "Return unused sample funds",
    rationale:
      "Sample approval: return the pilot balance to the approved treasury target.",
    createdAt: "2026-10-19T15:00:00.000Z",
  });
  const invoiceIntent = makeIntent({
    id: INTENT_INVOICE_ID,
    title: "Settle sample invoice 1042",
    rationale:
      "Sample approval: settle a test invoice using the approved transfer method.",
    createdAt: "2026-10-20T08:00:00.000Z",
  });

  const makeEvidence = (input: {
    id: string;
    suffix: string;
    intentId: string | null;
    observed: ObservedAction;
    attachedAt: string;
  }): EvidenceRecord => {
    const evaluation = evaluateEvidence({
      policy,
      intent:
        input.intentId === null
          ? null
          : [vendorIntent, returnIntent, invoiceIntent].find(
              (intent) => intent.id === input.intentId,
            ) ?? null,
      observed: input.observed,
      agentAccount: SMART_ACCOUNT,
      now: new Date(input.attachedAt),
    });
    return evidenceRecordSchema.parse({
      id: input.id,
      agentId: AGENT_ID,
      intentId: input.intentId,
      policyId: policy.id,
      policyVersion: policy.version,
      policyHash: policy.hash,
      kind: input.observed.kind,
      hash: sampleHash(input.suffix),
      source: "sample",
      observed: input.observed,
      evaluation: {
        ...evaluation,
        coverageNotes: [
          ...evaluation.coverageNotes,
          "Sample record. This is not a live chain fetch.",
        ],
      },
      attachedAt: input.attachedAt,
      fetchedAt: input.attachedAt,
    });
  };

  const matchedHash = sampleHash("a");
  const matched = makeEvidence({
    id: "a0000000-0000-4000-8000-000000000101",
    suffix: "a",
    intentId: vendorIntent.id,
    attachedAt: "2026-10-19T14:04:00.000Z",
    observed: baseObserved({
      kind: "user_operation",
      hash: matchedHash,
      tokenMovements: [
        {
          tokenAddress: APPROVED_TARGET,
          symbol: "mUSD",
          name: "Sample settlement token",
          decimals: 6,
          amountRaw: "1000000",
          amountFormatted: "1 mUSD",
          from: SMART_ACCOUNT,
          to: OTHER_TARGET,
          logIndex: "2",
        },
      ],
    }),
  });

  const outOfPolicy = makeEvidence({
    id: "a0000000-0000-4000-8000-000000000102",
    suffix: "c",
    intentId: returnIntent.id,
    attachedAt: "2026-10-19T16:12:00.000Z",
    observed: baseObserved({
      kind: "user_operation",
      hash: sampleHash("c"),
      target: OTHER_TARGET,
      methodLabel: "transfer(address,uint256)",
      coverageNotes: [
        "The action targeted a destination outside the approved policy.",
      ],
    }),
  });

  const failed = makeEvidence({
    id: "a0000000-0000-4000-8000-000000000103",
    suffix: "d",
    intentId: invoiceIntent.id,
    attachedAt: "2026-10-20T08:20:00.000Z",
    observed: baseObserved({
      kind: "user_operation",
      hash: sampleHash("d"),
      chainStatus: "failed",
      confirmedAt: observedTime,
    }),
  });

  const unattributed = makeEvidence({
    id: "a0000000-0000-4000-8000-000000000104",
    suffix: "e",
    intentId: null,
    attachedAt: "2026-10-20T09:40:00.000Z",
    observed: baseObserved({
      kind: "transaction",
      hash: sampleHash("e"),
      outerTransactionHash: sampleHash("e"),
      methodSelector: null,
      methodLabel: null,
      target: null,
      targetSource: "unavailable",
      valueWei: null,
      valueSource: "unavailable",
      coverage: "partial",
      coverageNotes: [
        "Sample record. This is not evidence fetched from BOT Chain.",
        "The sample action has no decodable inner target.",
      ],
    }),
  });

  const needsReview = makeEvidence({
    id: "a0000000-0000-4000-8000-000000000105",
    suffix: "f",
    intentId: invoiceIntent.id,
    attachedAt: "2026-10-20T09:55:00.000Z",
    observed: baseObserved({
      kind: "user_operation",
      hash: sampleHash("f"),
      target: null,
      targetSource: "unavailable",
      methodSelector: null,
      methodLabel: null,
      valueWei: null,
      valueSource: "unavailable",
      coverage: "partial",
      coverageNotes: [
        "Sample record. This is not evidence fetched from BOT Chain.",
        "The account envelope could not be decoded, so authorization cannot be confirmed.",
      ],
    }),
  });

  const insertEverything = db.transaction(() => {
    db.prepare(
      "INSERT INTO agents (id, name, description, smart_account, is_demo, created_at, updated_at) VALUES (?, ?, ?, ?, 1, ?, ?)",
    ).run(
      AGENT_ID,
      "Atlas treasury (sample)",
      "A sample agent workspace for exploring the Mandate evidence workflow.",
      SMART_ACCOUNT,
      "2026-10-18T08:00:00.000Z",
      now,
    );

    db.prepare(
      "INSERT INTO policies (id, agent_id, version, name, chain_id, allowed_targets, allowed_methods, max_native_per_action_wei, max_native_per_day_wei, expires_at, notes, hash, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    ).run(
      policy.id,
      AGENT_ID,
      policy.version,
      policy.name,
      policy.chainId,
      JSON.stringify(policy.allowedTargets),
      JSON.stringify(policy.allowedMethods),
      policy.maxNativeValuePerActionWei,
      policy.maxNativeValuePerDayWei,
      policy.expiresAt,
      policy.notes,
      policy.hash,
      policy.createdAt,
    );

    const insertIntent = db.prepare(
      "INSERT INTO intents (id, agent_id, policy_id, policy_version, policy_hash, chain_id, title, rationale, target, method_selector, value_wei, approved_by, fingerprint, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    );
    for (const intent of [vendorIntent, returnIntent, invoiceIntent]) {
      insertIntent.run(
        intent.id,
        AGENT_ID,
        intent.policyId,
        intent.policyVersion,
        intent.policyHash,
        intent.chainId,
        intent.title,
        intent.rationale,
        intent.target,
        intent.methodSelector,
        intent.valueWei,
        intent.approvedBy,
        intent.fingerprint,
        intent.createdAt,
      );
    }

    const insertEvidence = db.prepare(
      "INSERT INTO evidence (id, agent_id, intent_id, policy_id, policy_version, policy_hash, kind, hash, source, observed_json, evaluation_json, attached_at, fetched_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    );
    for (const evidence of [
      matched,
      outOfPolicy,
      failed,
      unattributed,
      needsReview,
    ]) {
      insertEvidence.run(
        evidence.id,
        AGENT_ID,
        evidence.intentId,
        evidence.policyId,
        evidence.policyVersion,
        evidence.policyHash,
        evidence.kind,
        evidence.hash,
        evidence.source,
        JSON.stringify(evidence.observed),
        JSON.stringify(evidence.evaluation),
        evidence.attachedAt,
        evidence.fetchedAt,
      );
    }

    const insertActivity = db.prepare(
      "INSERT INTO activity (id, agent_id, kind, summary, detail_json, created_at) VALUES (?, ?, ?, ?, ?, ?)",
    );
    const activities = [
      {
        id: "a0000000-0000-4000-8000-000000000201",
        kind: "agent.created",
        summary: "Sample workspace created for Atlas treasury.",
        at: "2026-10-18T08:00:00.000Z",
      },
      {
        id: "a0000000-0000-4000-8000-000000000202",
        kind: "policy.published",
        summary: "Policy v1 published for Atlas treasury.",
        at: policy.createdAt,
      },
      {
        id: "a0000000-0000-4000-8000-000000000203",
        kind: "intent.approved",
        summary: "Three sample intents recorded by a sample operator.",
        at: "2026-10-20T08:00:00.000Z",
      },
      {
        id: "a0000000-0000-4000-8000-000000000204",
        kind: "evidence.attached",
        summary: "Five sample evidence records attached for review.",
        at: "2026-10-20T09:55:00.000Z",
      },
    ];
    for (const activity of activities) {
      insertActivity.run(
        activity.id,
        AGENT_ID,
        activity.kind,
        activity.summary,
        JSON.stringify({ sample: true }),
        activity.at,
      );
    }

    db.prepare(
      "INSERT INTO meta (key, value) VALUES ('demo_seed_v1', 'seeded')",
    ).run();
  });

  insertEverything();
}
