import { BOT_TESTNET_CHAIN_ID, NATIVE_TRANSFER_LABEL } from "./constants";
import {
  formatDateTime,
  formatNativeValue,
  describeMethod,
  shortenAddress,
} from "./format";
import { contentHash } from "./hash";
import type {
  EvidenceCheck,
  EvidenceEvaluation,
  IntentRecord,
  ObservedAction,
  PolicyDraft,
  PolicyRecord,
} from "./schemas";

export function computePolicyHash(
  policy: PolicyDraft & { version: number },
): `0x${string}` {
  return contentHash({
    chainId: policy.chainId,
    name: policy.name,
    allowedTargets: policy.allowedTargets.map((target) => target.toLowerCase()).sort(),
    allowedMethods: [...policy.allowedMethods].sort(),
    maxNativeValuePerActionWei: policy.maxNativeValuePerActionWei,
    maxNativeValuePerDayWei: policy.maxNativeValuePerDayWei,
    expiresAt: policy.expiresAt,
    notes: policy.notes,
    version: policy.version,
  });
}

export function computeIntentFingerprint(
  intent: Omit<IntentRecord, "fingerprint">,
): `0x${string}` {
  return contentHash({
    title: intent.title,
    rationale: intent.rationale,
    target: intent.target.toLowerCase(),
    methodSelector: intent.methodSelector,
    valueWei: intent.valueWei,
    approvedBy: intent.approvedBy,
    agentId: intent.agentId,
    policyId: intent.policyId,
    policyHash: intent.policyHash,
    chainId: intent.chainId,
    createdAt: intent.createdAt,
  });
}

export interface EvaluateEvidenceInput {
  policy: PolicyRecord;
  intent: IntentRecord | null;
  observed: ObservedAction;
  agentAccount: string;
  priorNativeValueTodayWei?: string;
  now?: Date;
}

const stateFor = (
  available: boolean,
  passes: boolean,
): EvidenceCheck["state"] => {
  if (!available) return "unavailable";
  return passes ? "pass" : "fail";
};

const intentCheck = (
  key: string,
  label: string,
  expected: string,
  observed: string,
  available: boolean,
  passes: boolean,
): EvidenceCheck => ({
  key,
  label,
  expected,
  observed,
  state: stateFor(available, passes),
});

function buildIntentChecks(
  intent: IntentRecord | null,
  observed: ObservedAction,
): EvidenceCheck[] {
  if (intent === null) {
    return [
      {
        key: "intent",
        label: "Approved intent",
        expected: "An approved intent is linked",
        observed: "No intent linked",
        state: "not_applicable",
      },
    ];
  }

  return [
    intentCheck(
      "intent.target",
      "Intent target",
      shortenAddress(intent.target),
      observed.target ? shortenAddress(observed.target) : "Unavailable",
      observed.target !== null,
      observed.target?.toLowerCase() === intent.target.toLowerCase(),
    ),
    intentCheck(
      "intent.method",
      "Intent method",
      describeMethod(intent.methodSelector),
      describeMethod(observed.methodSelector, observed.methodLabel),
      observed.methodSelector !== null,
      observed.methodSelector === intent.methodSelector,
    ),
    intentCheck(
      "intent.value",
      "Intent native value",
      formatNativeValue(intent.valueWei),
      formatNativeValue(observed.valueWei),
      observed.valueWei !== null,
      observed.valueWei === intent.valueWei,
    ),
  ];
}

function buildPolicyChecks(
  policy: PolicyRecord,
  observed: ObservedAction,
  agentAccount: string,
  priorNativeValueTodayWei: string,
  now: Date,
): EvidenceCheck[] {
  const checks: EvidenceCheck[] = [];
  const targetKnown = observed.target !== null;
  const valueKnown = observed.valueWei !== null;
  const methodKnown = observed.methodSelector !== null;
  const targetAllowed =
    observed.target !== null &&
    policy.allowedTargets.some(
      (target) => target.toLowerCase() === observed.target?.toLowerCase(),
    );
  const methodAllowed =
    observed.methodSelector !== null &&
    policy.allowedMethods.includes(observed.methodSelector);

  checks.push({
    key: "policy.account",
    label: "Registered smart account",
    expected: shortenAddress(agentAccount),
    observed: shortenAddress(observed.sender),
    state:
      observed.sender.toLowerCase() === agentAccount.toLowerCase()
        ? "pass"
        : "fail",
  });

  checks.push({
    key: "policy.chain",
    label: "Chain",
    expected: `BOT Chain testnet · ${BOT_TESTNET_CHAIN_ID}`,
    observed: `Chain ${observed.chainId}`,
    state:
      observed.chainId === BOT_TESTNET_CHAIN_ID ? "pass" : "fail",
  });

  checks.push({
    key: "policy.expiry",
    label: "Policy expiry",
    expected: policy.expiresAt
      ? `Before ${formatDateTime(policy.expiresAt)}`
      : "No expiry",
    observed: formatDateTime(observed.confirmedAt ?? now.toISOString()),
    state:
      policy.expiresAt === null
        ? "pass"
        : Date.parse(observed.confirmedAt ?? now.toISOString()) <
            Date.parse(policy.expiresAt)
          ? "pass"
          : "fail",
  });

  checks.push({
    key: "policy.target",
    label: "Allowed target",
    expected: `${policy.allowedTargets.length} approved target${
      policy.allowedTargets.length === 1 ? "" : "s"
    }`,
    observed: observed.target
      ? shortenAddress(observed.target)
      : "Unavailable",
    state: stateFor(targetKnown, targetAllowed),
    detail: policy.allowedTargets.join(", "),
  });

  checks.push({
    key: "policy.method",
    label: "Allowed method",
    expected: policy.allowedMethods
      .map((selector) => describeMethod(selector))
      .join(", "),
    observed: methodKnown
      ? describeMethod(observed.methodSelector, observed.methodLabel)
      : "Unavailable",
    state: stateFor(methodKnown, methodAllowed),
  });

  const underActionCap =
    valueKnown &&
    BigInt(observed.valueWei ?? "0") <=
      BigInt(policy.maxNativeValuePerActionWei);
  checks.push({
    key: "policy.action_cap",
    label: "Native value per action",
    expected: `≤ ${formatNativeValue(policy.maxNativeValuePerActionWei)}`,
    observed: formatNativeValue(observed.valueWei),
    state: stateFor(valueKnown, underActionCap),
  });

  if (policy.maxNativeValuePerDayWei === null) {
    checks.push({
      key: "policy.daily_cap",
      label: "Daily native cap",
      expected: "No daily cap configured",
      observed: formatNativeValue(observed.valueWei),
      state: "not_applicable",
    });
  } else {
    const total =
      BigInt(priorNativeValueTodayWei) + BigInt(observed.valueWei ?? "0");
    const underDailyCap =
      valueKnown && total <= BigInt(policy.maxNativeValuePerDayWei);
    checks.push({
      key: "policy.daily_cap",
      label: "Daily native cap",
      expected: `≤ ${formatNativeValue(policy.maxNativeValuePerDayWei)}`,
      observed: `${formatNativeValue(total.toString())} including this action`,
      state: stateFor(valueKnown, underDailyCap),
      detail: `${formatNativeValue(
        priorNativeValueTodayWei,
      )} already recorded in this UTC day.`,
    });
  }

  return checks;
}

export function evaluateEvidence(
  input: EvaluateEvidenceInput,
): EvidenceEvaluation {
  const {
    policy,
    intent,
    observed,
    agentAccount,
    priorNativeValueTodayWei = "0",
    now = new Date(),
  } = input;

  const checks = buildIntentChecks(intent, observed);
  const policyChecks = buildPolicyChecks(
    policy,
    observed,
    agentAccount,
    priorNativeValueTodayWei,
    now,
  );

  const intentFail = checks.some((check) => check.state === "fail");
  const intentUnavailable = checks.some(
    (check) => check.state === "unavailable",
  );
  const policyFail = policyChecks.some((check) => check.state === "fail");
  const policyUnavailable = policyChecks.some(
    (check) => check.state === "unavailable",
  );

  const intentMatch = !intent
    ? "no_intent"
    : intentFail
      ? "mismatch"
      : intentUnavailable
        ? "unavailable"
        : "match";

  const policyResult = policyFail
    ? "violation"
    : policyUnavailable
      ? "unavailable"
      : "within_policy";

  const coverageNotes = [...observed.coverageNotes];
  if (intent === null) {
    coverageNotes.push(
      "No approved intent is linked. This action is recorded for review, not treated as authorized.",
    );
  }
  if (policyResult === "unavailable") {
    coverageNotes.push(
      "One or more policy comparisons could not be completed from the available evidence.",
    );
  }

  const verdict: EvidenceEvaluation["verdict"] =
    observed.chainStatus === "pending"
      ? "pending"
      : observed.chainStatus === "failed"
        ? "failed"
        : intent === null
          ? "unattributed"
          : intentMatch === "mismatch" || policyResult === "violation"
            ? "out_of_policy"
            : observed.coverage === "partial" ||
                intentMatch === "unavailable" ||
                policyResult === "unavailable"
              ? "needs_review"
              : "matched";

  return {
    verdict,
    intentMatch,
    policyResult,
    chainResult:
      observed.chainStatus === "success"
        ? "success"
        : observed.chainStatus === "failed"
          ? "failed"
          : "pending",
    coverage: observed.coverage,
    checks,
    policyChecks,
    coverageNotes: [...new Set(coverageNotes)],
    evaluatedAt: now.toISOString(),
  };
}

export function describeVerdict(verdict: EvidenceEvaluation["verdict"]): string {
  switch (verdict) {
    case "matched":
      return "Matches the approved intent and recorded policy.";
    case "out_of_policy":
      return "The action belongs to the account, but differs from the approved intent or policy.";
    case "failed":
      return "The chain reports that this action did not succeed.";
    case "unattributed":
      return "No approved intent is linked to this action.";
    case "needs_review":
      return "Available evidence is incomplete, so authorization cannot be confirmed.";
    case "pending":
      return "The action is not yet confirmed on chain.";
  }
}

export function isNativeTransferSelector(selector: string | null): boolean {
  return selector === "0x00000000" || selector === NATIVE_TRANSFER_LABEL;
}
