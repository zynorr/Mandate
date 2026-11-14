import "server-only";

import { randomUUID } from "node:crypto";
import type { Client, Transaction } from "@libsql/client";
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
  type KnownChainId,
  type ObservedAction,
  type PolicyRecord,
} from "@mandate/chain";

export interface DemoSeedContext {
  ownerId: string;
  chainId: KnownChainId;
  explorerUrl: string;
}

const CANONICAL_SAMPLE_IDS = {
  agent: "a0000000-0000-4000-8000-000000000001",
  policy: "a0000000-0000-4000-8000-000000000002",
  vendorIntent: "a0000000-0000-4000-8000-000000000003",
  returnIntent: "a0000000-0000-4000-8000-000000000004",
  invoiceIntent: "a0000000-0000-4000-8000-000000000005",
} as const;

const SMART_ACCOUNT: `0x${string}` = "0x1111111111111111111111111111111111111111";
const APPROVED_TARGET: `0x${string}` = "0x3333333333333333333333333333333333333333";
const OTHER_TARGET: `0x${string}` = "0x4444444444444444444444444444444444444444";
const TRANSFER_SELECTOR = "0xa9059cbb";

const sampleHash = (suffix: string) => `0x${suffix.repeat(64).slice(0, 64)}`;

const observedTime = "2026-10-20T09:30:00.000Z";

function baseObserved(
  context: DemoSeedContext,
  overrides: Partial<ObservedAction> & {
    kind: ObservedAction["kind"];
    hash: string;
  },
): ObservedAction {
  const { hash, ...rest } = overrides;
  const explorerKind = rest.kind === "user_operation" ? "op" : "tx";
  return {
    chainId: context.chainId,
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
    explorerUrl: `${context.explorerUrl.replace(/\/$/, "")}/${explorerKind}/${hash}`,
    decodedBy: "mandate",
    ...rest,
  };
}

async function insertActivity(
  tx: Transaction,
  input: {
    ownerId: string;
    agentId: string | null;
    kind: string;
    summary: string;
    detail: Record<string, unknown>;
    createdAt: string;
  },
): Promise<void> {
  await tx.execute({
    sql: "INSERT INTO activity (id, owner_id, agent_id, kind, summary, detail_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
    args: [
      randomUUID(),
      input.ownerId,
      input.agentId,
      input.kind,
      input.summary.slice(0, 400),
      JSON.stringify(input.detail).slice(0, 4000),
      input.createdAt,
    ],
  });
}

export async function seedDemoWorkspace(
  db: Client,
  context: DemoSeedContext,
): Promise<boolean> {
  const marker = `demo_seed_v1:${context.ownerId}`;
  const markerBeforeWrite = await db.execute({
    sql: "SELECT value FROM meta WHERE key = ?",
    args: [marker],
  });
  if (markerBeforeWrite.rows.length > 0) return false;

  const tx = await db.transaction("write");
  try {
    const existingMarker = await tx.execute({
      sql: "SELECT value FROM meta WHERE key = ?",
      args: [marker],
    });
    if (existingMarker.rows.length > 0) {
      await tx.commit();
      return false;
    }

    const agentCount = await tx.execute({
      sql: "SELECT COUNT(*) AS count FROM agents WHERE owner_id = ?",
      args: [context.ownerId],
    });
    if (Number(agentCount.rows[0]?.count ?? 0) > 0) {
      await tx.execute({
        sql: "INSERT INTO meta (key, value) VALUES (?, 'skipped')",
        args: [marker],
      });
      await tx.commit();
      return false;
    }

    const claimed = await tx.execute({
      sql: "INSERT OR IGNORE INTO meta (key, value) VALUES (?, 'seeded')",
      args: [marker],
    });
    if (claimed.rowsAffected === 0) {
      await tx.rollback();
      return false;
    }

    // Keep the original deterministic IDs for the local owner so the
    // pre-anchored sample policy and intent fingerprints still resolve.
    // Hosted accounts get owner-specific IDs and illustrative samples.
    const canonical = context.ownerId === "local";
    const agentId = canonical
      ? CANONICAL_SAMPLE_IDS.agent
      : randomUUID();
    const policyId = canonical
      ? CANONICAL_SAMPLE_IDS.policy
      : randomUUID();
    const vendorIntentId = canonical
      ? CANONICAL_SAMPLE_IDS.vendorIntent
      : randomUUID();
    const returnIntentId = canonical
      ? CANONICAL_SAMPLE_IDS.returnIntent
      : randomUUID();
    const invoiceIntentId = canonical
      ? CANONICAL_SAMPLE_IDS.invoiceIntent
      : randomUUID();
    const now = "2026-10-20T10:00:00.000Z";

    const draft = policyDraftSchema.parse({
      name: "Vendor settlement pilot",
      chainId: context.chainId,
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
      id: policyId,
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
        agentId,
        policyId: policy.id,
        policyVersion: policy.version,
        policyHash: policy.hash,
        chainId: context.chainId,
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
      id: vendorIntentId,
      title: "Send sample vendor settlement",
      rationale:
        "Sample approval: one token transfer to the pilot vendor through the approved settlement target.",
      createdAt: "2026-10-19T14:00:00.000Z",
    });
    const returnIntent = makeIntent({
      id: returnIntentId,
      title: "Return unused sample funds",
      rationale:
        "Sample approval: return the pilot balance to the approved treasury target.",
      createdAt: "2026-10-19T15:00:00.000Z",
    });
    const invoiceIntent = makeIntent({
      id: invoiceIntentId,
      title: "Settle sample invoice 1042",
      rationale:
        "Sample approval: settle a test invoice using the approved transfer method.",
      createdAt: "2026-10-20T08:00:00.000Z",
    });

    const makeEvidence = (input: {
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
        id: randomUUID(),
        agentId,
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
      suffix: "a",
      intentId: vendorIntent.id,
      attachedAt: "2026-10-19T14:04:00.000Z",
      observed: baseObserved(context, {
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
      suffix: "c",
      intentId: returnIntent.id,
      attachedAt: "2026-10-19T16:12:00.000Z",
      observed: baseObserved(context, {
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
      suffix: "d",
      intentId: invoiceIntent.id,
      attachedAt: "2026-10-20T08:20:00.000Z",
      observed: baseObserved(context, {
        kind: "user_operation",
        hash: sampleHash("d"),
        chainStatus: "failed",
        confirmedAt: observedTime,
      }),
    });

    const unattributed = makeEvidence({
      suffix: "e",
      intentId: null,
      attachedAt: "2026-10-20T09:40:00.000Z",
      observed: baseObserved(context, {
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
      suffix: "f",
      intentId: invoiceIntent.id,
      attachedAt: "2026-10-20T09:55:00.000Z",
      observed: baseObserved(context, {
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

    await tx.execute({
      sql: "INSERT INTO agents (id, owner_id, name, description, smart_account, is_demo, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 1, ?, ?)",
      args: [
        agentId,
        context.ownerId,
        "Atlas treasury (sample)",
        "A sample agent workspace for exploring the Mandate evidence workflow.",
        SMART_ACCOUNT,
        "2026-10-18T08:00:00.000Z",
        now,
      ],
    });

    await tx.execute({
      sql: "INSERT INTO policies (id, owner_id, agent_id, version, name, chain_id, allowed_targets, allowed_methods, max_native_per_action_wei, max_native_per_day_wei, expires_at, notes, hash, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      args: [
        policy.id,
        context.ownerId,
        agentId,
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
      ],
    });

    for (const intent of [vendorIntent, returnIntent, invoiceIntent]) {
      await tx.execute({
        sql: "INSERT INTO intents (id, owner_id, agent_id, policy_id, policy_version, policy_hash, chain_id, title, rationale, target, method_selector, value_wei, approved_by, fingerprint, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        args: [
          intent.id,
          context.ownerId,
          agentId,
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
        ],
      });
    }

    for (const evidence of [
      matched,
      outOfPolicy,
      failed,
      unattributed,
      needsReview,
    ]) {
      await tx.execute({
        sql: "INSERT INTO evidence (id, owner_id, agent_id, intent_id, policy_id, policy_version, policy_hash, kind, hash, source, observed_json, evaluation_json, attached_at, fetched_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        args: [
          evidence.id,
          context.ownerId,
          agentId,
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
        ],
      });
    }

    await insertActivity(tx, {
      ownerId: context.ownerId,
      agentId,
      kind: "agent.created",
      summary: "Sample workspace created for Atlas treasury.",
      detail: { sample: true },
      createdAt: "2026-10-18T08:00:00.000Z",
    });
    await insertActivity(tx, {
      ownerId: context.ownerId,
      agentId,
      kind: "policy.published",
      summary: "Policy v1 published for Atlas treasury.",
      detail: { sample: true },
      createdAt: policy.createdAt,
    });
    await insertActivity(tx, {
      ownerId: context.ownerId,
      agentId,
      kind: "intent.approved",
      summary: "Three sample intents recorded by a sample operator.",
      detail: { sample: true },
      createdAt: "2026-10-20T08:00:00.000Z",
    });
    await insertActivity(tx, {
      ownerId: context.ownerId,
      agentId,
      kind: "evidence.attached",
      summary: "Five sample evidence records attached for review.",
      detail: { sample: true },
      createdAt: "2026-10-20T09:55:00.000Z",
    });

    await tx.commit();
    return true;
  } catch (error) {
    if (!tx.closed) {
      try {
        await tx.rollback();
      } catch {
        // Preserve the original error.
      }
    }
    throw error;
  }
}
