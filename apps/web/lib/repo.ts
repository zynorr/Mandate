import "server-only";

import { randomUUID } from "node:crypto";
import type { Client, Transaction } from "@libsql/client";
import {
  agentDraftSchema,
  computeIntentFingerprint,
  computePolicyHash,
  evidenceRecordSchema,
  evaluationSchema,
  intentDraftSchema,
  intentRecordSchema,
  observedActionSchema,
  policyDraftSchema,
  policyRecordSchema,
  type AgentDraft,
  type AgentRecord,
  type EvidenceRecord,
  type EvidenceVerdict,
  type IntentDraft,
  type IntentRecord,
  type PolicyDraft,
  type PolicyRecord,
} from "@mandate/chain";
import { getDb } from "./db";

export class AppError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AppError";
  }
}

export type AppAgent = AgentRecord & {
  isDemo: boolean;
  policyCount: number;
  evidenceCount: number;
  attentionCount: number;
  latestPolicyVersion: number | null;
};

export type AppPolicy = PolicyRecord & { agentId: string };

export type AppEvidence = EvidenceRecord & {
  agentName: string;
  agentIsDemo: boolean;
  agentSmartAccount: string;
  intentTitle: string | null;
};

export type ActivityItem = {
  id: string;
  agentId: string | null;
  agentName: string | null;
  agentIsDemo: boolean;
  kind: string;
  summary: string;
  createdAt: string;
};

export type LedgerSummary = {
  agentCount: number;
  evidenceCount: number;
  attentionCount: number;
  matchedCount: number;
  sampleCount: number;
  verdictCounts: Record<EvidenceVerdict, number>;
};

type Queryable = Client | Transaction;

type AgentRow = {
  id: string;
  name: string;
  description: string;
  smart_account: string;
  is_demo: number;
  created_at: string;
  updated_at: string;
  policy_count: number;
  evidence_count: number;
  attention_count: number;
  latest_policy_version: number | null;
};

type PolicyRow = {
  id: string;
  agent_id: string;
  version: number;
  name: string;
  chain_id: number;
  allowed_targets: string;
  allowed_methods: string;
  max_native_per_action_wei: string;
  max_native_per_day_wei: string | null;
  expires_at: string | null;
  notes: string;
  hash: string;
  created_at: string;
};

type IntentRow = {
  id: string;
  agent_id: string;
  policy_id: string;
  policy_version: number;
  policy_hash: string;
  chain_id: number;
  title: string;
  rationale: string;
  target: string;
  method_selector: string;
  value_wei: string;
  approved_by: string;
  fingerprint: string;
  created_at: string;
};

type EvidenceRow = {
  id: string;
  agent_id: string;
  intent_id: string | null;
  policy_id: string;
  policy_version: number;
  policy_hash: string;
  kind: string;
  hash: string;
  source: string;
  observed_json: string;
  evaluation_json: string;
  attached_at: string;
  fetched_at: string;
  agent_name: string;
  agent_is_demo: number;
  agent_smart_account: string;
  intent_title: string | null;
};

const attentionVerdicts: EvidenceVerdict[] = [
  "out_of_policy",
  "failed",
  "needs_review",
  "unattributed",
];

const parseJson = (value: string): unknown => {
  try {
    return JSON.parse(value);
  } catch {
    throw new AppError("A stored record could not be read.");
  }
};

const rowToAgent = (row: AgentRow): AppAgent => {
  const record = agentDraftSchema.parse({
    name: row.name,
    description: row.description,
    smartAccount: row.smart_account,
  });
  const base: AgentRecord = {
    ...record,
    id: row.id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
  return {
    ...base,
    isDemo: row.is_demo === 1,
    policyCount: row.policy_count,
    evidenceCount: row.evidence_count,
    attentionCount: row.attention_count,
    latestPolicyVersion: row.latest_policy_version,
  };
};

const rowToPolicy = (row: PolicyRow): AppPolicy => {
  const record = policyRecordSchema.parse({
    id: row.id,
    name: row.name,
    chainId: row.chain_id,
    allowedTargets: parseJson(row.allowed_targets),
    allowedMethods: parseJson(row.allowed_methods),
    maxNativeValuePerActionWei: row.max_native_per_action_wei,
    maxNativeValuePerDayWei: row.max_native_per_day_wei,
    expiresAt: row.expires_at,
    notes: row.notes,
    version: row.version,
    hash: row.hash,
    createdAt: row.created_at,
  });
  return { ...record, agentId: row.agent_id };
};

const rowToIntent = (row: IntentRow): IntentRecord =>
  intentRecordSchema.parse({
    id: row.id,
    agentId: row.agent_id,
    policyId: row.policy_id,
    policyVersion: row.policy_version,
    policyHash: row.policy_hash,
    chainId: row.chain_id,
    title: row.title,
    rationale: row.rationale,
    target: row.target,
    methodSelector: row.method_selector,
    valueWei: row.value_wei,
    approvedBy: row.approved_by,
    fingerprint: row.fingerprint,
    createdAt: row.created_at,
  });

const rowToEvidence = (row: EvidenceRow): AppEvidence => {
  const observed = observedActionSchema.parse(parseJson(row.observed_json));
  const evaluation = evaluationSchema.parse(parseJson(row.evaluation_json));
  const record = evidenceRecordSchema.parse({
    id: row.id,
    agentId: row.agent_id,
    intentId: row.intent_id,
    policyId: row.policy_id,
    policyVersion: row.policy_version,
    policyHash: row.policy_hash,
    kind: row.kind,
    hash: row.hash,
    source: row.source,
    observed,
    evaluation,
    attachedAt: row.attached_at,
    fetchedAt: row.fetched_at,
  });
  return {
    ...record,
    agentName: row.agent_name,
    agentIsDemo: row.agent_is_demo === 1,
    agentSmartAccount: row.agent_smart_account,
    intentTitle: row.intent_title,
  };
};

const agentSelect = `
  SELECT
    a.*,
    (SELECT COUNT(*) FROM policies p WHERE p.agent_id = a.id) AS policy_count,
    (SELECT COUNT(*) FROM evidence e WHERE e.agent_id = a.id) AS evidence_count,
    (
      SELECT COUNT(*) FROM evidence e
      WHERE e.agent_id = a.id
        AND json_extract(e.evaluation_json, '$.verdict') IN
          ('out_of_policy', 'failed', 'needs_review', 'unattributed')
    ) AS attention_count,
    (SELECT MAX(p.version) FROM policies p WHERE p.agent_id = a.id) AS latest_policy_version
  FROM agents a
`;

const evidenceSelect = `
  SELECT
    e.*,
    a.name AS agent_name,
    a.is_demo AS agent_is_demo,
    a.smart_account AS agent_smart_account,
    i.title AS intent_title
  FROM evidence e
  JOIN agents a ON a.id = e.agent_id
  LEFT JOIN intents i ON i.id = e.intent_id
`;

async function runInTransaction<T>(
  fn: (tx: Transaction) => Promise<T>,
): Promise<T> {
  const db = await getDb();
  const tx = await db.transaction("write");
  try {
    const result = await fn(tx);
    await tx.commit();
    return result;
  } catch (error) {
    if (!tx.closed) {
      try {
        await tx.rollback();
      } catch {
        // Preserve the original failure.
      }
    }
    throw error;
  }
}

export async function listAgents(ownerId: string): Promise<AppAgent[]> {
  const db = await getDb();
  const result = await db.execute({
    sql: `${agentSelect} WHERE a.owner_id = ? ORDER BY a.is_demo ASC, a.created_at DESC`,
    args: [ownerId],
  });
  return (result.rows as unknown as AgentRow[]).map(rowToAgent);
}

export async function getAgent(
  ownerId: string,
  id: string,
): Promise<AppAgent | null> {
  const db = await getDb();
  const result = await db.execute({
    sql: `${agentSelect} WHERE a.owner_id = ? AND a.id = ?`,
    args: [ownerId, id],
  });
  const row = result.rows[0] as unknown as AgentRow | undefined;
  return row ? rowToAgent(row) : null;
}

export async function createAgent(
  ownerId: string,
  input: AgentDraft,
): Promise<AppAgent> {
  const draft = agentDraftSchema.parse(input);
  const db = await getDb();
  const existing = await db.execute({
    sql: "SELECT id FROM agents WHERE owner_id = ? AND lower(smart_account) = lower(?)",
    args: [ownerId, draft.smartAccount],
  });
  if (existing.rows.length > 0) {
    throw new AppError("An agent already uses this smart account.");
  }

  const now = new Date().toISOString();
  const id = randomUUID();
  await runInTransaction(async (tx) => {
    await tx.execute({
      sql: "INSERT INTO agents (id, owner_id, name, description, smart_account, is_demo, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 0, ?, ?)",
      args: [id, ownerId, draft.name, draft.description, draft.smartAccount, now, now],
    });
    await insertActivityWith(tx, {
      ownerId,
      id: randomUUID(),
      agentId: id,
      kind: "agent.created",
      summary: `Agent ${draft.name} registered with smart account ${draft.smartAccount}.`,
      detail: { smartAccount: draft.smartAccount },
      createdAt: now,
    });
  });

  const agent = await getAgent(ownerId, id);
  if (!agent) throw new AppError("The agent could not be created.");
  return agent;
}

export async function listPolicies(
  ownerId: string,
  agentId: string,
): Promise<AppPolicy[]> {
  const db = await getDb();
  const result = await db.execute({
    sql: `SELECT p.* FROM policies p
      JOIN agents a ON a.id = p.agent_id
      WHERE a.owner_id = ? AND p.agent_id = ?
      ORDER BY p.version DESC`,
    args: [ownerId, agentId],
  });
  return (result.rows as unknown as PolicyRow[]).map(rowToPolicy);
}

export async function getCurrentPolicy(
  ownerId: string,
  agentId: string,
): Promise<AppPolicy | null> {
  const db = await getDb();
  const result = await db.execute({
    sql: `SELECT p.* FROM policies p
      JOIN agents a ON a.id = p.agent_id
      WHERE a.owner_id = ? AND p.agent_id = ?
      ORDER BY p.version DESC LIMIT 1`,
    args: [ownerId, agentId],
  });
  const row = result.rows[0] as unknown as PolicyRow | undefined;
  return row ? rowToPolicy(row) : null;
}

export async function getPolicy(
  ownerId: string,
  id: string,
): Promise<AppPolicy | null> {
  const db = await getDb();
  const result = await db.execute({
    sql: `SELECT p.* FROM policies p
      JOIN agents a ON a.id = p.agent_id
      WHERE a.owner_id = ? AND p.id = ?`,
    args: [ownerId, id],
  });
  const row = result.rows[0] as unknown as PolicyRow | undefined;
  return row ? rowToPolicy(row) : null;
}

export async function createPolicyVersion(
  ownerId: string,
  agentId: string,
  input: PolicyDraft,
): Promise<AppPolicy> {
  const agent = await getAgent(ownerId, agentId);
  if (!agent) throw new AppError("Agent not found.");
  const draft = policyDraftSchema.parse(input);
  const db = await getDb();
  const latest = await db.execute({
    sql: "SELECT COALESCE(MAX(version), 0) AS version FROM policies WHERE owner_id = ? AND agent_id = ?",
    args: [ownerId, agentId],
  });
  const version = Number(latest.rows[0]?.version ?? 0) + 1;
  const id = randomUUID();
  const createdAt = new Date().toISOString();
  const hash = computePolicyHash({ ...draft, version });

  await runInTransaction(async (tx) => {
    await tx.execute({
      sql: "INSERT INTO policies (id, owner_id, agent_id, version, name, chain_id, allowed_targets, allowed_methods, max_native_per_action_wei, max_native_per_day_wei, expires_at, notes, hash, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      args: [
        id,
        ownerId,
        agentId,
        version,
        draft.name,
        draft.chainId,
        JSON.stringify(draft.allowedTargets),
        JSON.stringify(draft.allowedMethods),
        draft.maxNativeValuePerActionWei,
        draft.maxNativeValuePerDayWei,
        draft.expiresAt,
        draft.notes,
        hash,
        createdAt,
      ],
    });
    await insertActivityWith(tx, {
      ownerId,
      id: randomUUID(),
      agentId,
      kind: "policy.published",
      summary: `Policy v${version} published for ${agent.name}.`,
      detail: { policyId: id, version, hash },
      createdAt,
    });
  });

  const policy = await getPolicy(ownerId, id);
  if (!policy) throw new AppError("The policy could not be created.");
  return policy;
}

export async function listIntents(
  ownerId: string,
  agentId: string,
): Promise<IntentRecord[]> {
  const db = await getDb();
  const result = await db.execute({
    sql: `SELECT i.* FROM intents i
      JOIN agents a ON a.id = i.agent_id
      WHERE a.owner_id = ? AND i.agent_id = ?
      ORDER BY i.created_at DESC`,
    args: [ownerId, agentId],
  });
  return (result.rows as unknown as IntentRow[]).map(rowToIntent);
}

export async function getIntent(
  ownerId: string,
  id: string,
): Promise<IntentRecord | null> {
  const db = await getDb();
  const result = await db.execute({
    sql: `SELECT i.* FROM intents i
      JOIN agents a ON a.id = i.agent_id
      WHERE a.owner_id = ? AND i.id = ?`,
    args: [ownerId, id],
  });
  const row = result.rows[0] as unknown as IntentRow | undefined;
  return row ? rowToIntent(row) : null;
}

export async function createIntent(
  ownerId: string,
  agentId: string,
  policyId: string,
  input: IntentDraft,
): Promise<IntentRecord> {
  const agent = await getAgent(ownerId, agentId);
  if (!agent) throw new AppError("Agent not found.");
  const policy = await getPolicy(ownerId, policyId);
  if (!policy || policy.agentId !== agentId) {
    throw new AppError("Choose a policy that belongs to this agent.");
  }
  const draft = intentDraftSchema.parse(input);
  const id = randomUUID();
  const createdAt = new Date().toISOString();
  const base = {
    id,
    agentId,
    policyId,
    policyVersion: policy.version,
    policyHash: policy.hash,
    chainId: policy.chainId,
    ...draft,
    createdAt,
  };
  const fingerprint = computeIntentFingerprint(base);

  await runInTransaction(async (tx) => {
    await tx.execute({
      sql: "INSERT INTO intents (id, owner_id, agent_id, policy_id, policy_version, policy_hash, chain_id, title, rationale, target, method_selector, value_wei, approved_by, fingerprint, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      args: [
        id,
        ownerId,
        agentId,
        policyId,
        policy.version,
        policy.hash,
        base.chainId,
        base.title,
        base.rationale,
        base.target,
        base.methodSelector,
        base.valueWei,
        base.approvedBy,
        fingerprint,
        createdAt,
      ],
    });
    await insertActivityWith(tx, {
      ownerId,
      id: randomUUID(),
      agentId,
      kind: "intent.approved",
      summary: `Intent approved: ${draft.title}.`,
      detail: { intentId: id, policyVersion: policy.version, fingerprint },
      createdAt,
    });
  });

  const intent = await getIntent(ownerId, id);
  if (!intent) throw new AppError("The intent could not be approved.");
  return intent;
}

export async function listEvidence(options: {
  ownerId: string;
  agentId?: string;
  verdict?: string;
  limit?: number;
}): Promise<AppEvidence[]> {
  const limit = Math.min(Math.max(options.limit ?? 500, 1), 1000);
  const db = await getDb();
  const result = options.agentId
    ? await db.execute({
        sql: `${evidenceSelect} WHERE a.owner_id = ? AND e.agent_id = ? ORDER BY e.attached_at DESC LIMIT ?`,
        args: [options.ownerId, options.agentId, limit],
      })
    : await db.execute({
        sql: `${evidenceSelect} WHERE a.owner_id = ? ORDER BY e.attached_at DESC LIMIT ?`,
        args: [options.ownerId, limit],
      });
  const evidence = (result.rows as unknown as EvidenceRow[]).map(rowToEvidence);
  if (options.verdict) {
    return evidence.filter(
      (record) => record.evaluation.verdict === options.verdict,
    );
  }
  return evidence;
}

export async function getEvidence(
  ownerId: string,
  id: string,
): Promise<AppEvidence | null> {
  const db = await getDb();
  const result = await db.execute({
    sql: `${evidenceSelect} WHERE a.owner_id = ? AND e.id = ?`,
    args: [ownerId, id],
  });
  const row = result.rows[0] as unknown as EvidenceRow | undefined;
  return row ? rowToEvidence(row) : null;
}

export async function getEvidenceByHash(
  ownerId: string,
  agentId: string,
  kind: string,
  hash: string,
): Promise<AppEvidence | null> {
  const db = await getDb();
  const result = await db.execute({
    sql: `${evidenceSelect} WHERE a.owner_id = ? AND e.agent_id = ? AND e.kind = ? AND e.hash = ?`,
    args: [ownerId, agentId, kind, hash],
  });
  const row = result.rows[0] as unknown as EvidenceRow | undefined;
  return row ? rowToEvidence(row) : null;
}

export async function listEvidenceForIntent(
  ownerId: string,
  intentId: string,
): Promise<AppEvidence[]> {
  const db = await getDb();
  const result = await db.execute({
    sql: `${evidenceSelect} WHERE a.owner_id = ? AND e.intent_id = ? ORDER BY e.attached_at DESC`,
    args: [ownerId, intentId],
  });
  return (result.rows as unknown as EvidenceRow[]).map(rowToEvidence);
}

export async function listEvidenceForPolicy(
  ownerId: string,
  policyId: string,
): Promise<AppEvidence[]> {
  const db = await getDb();
  const result = await db.execute({
    sql: `${evidenceSelect} WHERE a.owner_id = ? AND e.policy_id = ? ORDER BY e.attached_at DESC`,
    args: [ownerId, policyId],
  });
  return (result.rows as unknown as EvidenceRow[]).map(rowToEvidence);
}

export async function insertEvidence(
  ownerId: string,
  record: EvidenceRecord,
): Promise<void> {
  const parsed = evidenceRecordSchema.parse(record);
  const existing = await getEvidenceByHash(
    ownerId,
    parsed.agentId,
    parsed.kind,
    parsed.hash,
  );
  if (existing) {
    throw new AppError("This evidence is already attached to the agent.");
  }
  const agent = await getAgent(ownerId, parsed.agentId);
  if (!agent) throw new AppError("Agent not found.");
  const policy = await getPolicy(ownerId, parsed.policyId);
  if (!policy || policy.agentId !== parsed.agentId) {
    throw new AppError("The evidence policy does not belong to this agent.");
  }
  if (parsed.intentId) {
    const intent = await getIntent(ownerId, parsed.intentId);
    if (!intent || intent.agentId !== parsed.agentId) {
      throw new AppError("The evidence intent does not belong to this agent.");
    }
  }

  await runInTransaction(async (tx) => {
    await tx.execute({
      sql: "INSERT INTO evidence (id, owner_id, agent_id, intent_id, policy_id, policy_version, policy_hash, kind, hash, source, observed_json, evaluation_json, attached_at, fetched_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      args: [
        parsed.id,
        ownerId,
        parsed.agentId,
        parsed.intentId,
        parsed.policyId,
        parsed.policyVersion,
        parsed.policyHash,
        parsed.kind,
        parsed.hash,
        parsed.source,
        JSON.stringify(parsed.observed),
        JSON.stringify(parsed.evaluation),
        parsed.attachedAt,
        parsed.fetchedAt,
      ],
    });
    await insertActivityWith(tx, {
      ownerId,
      id: randomUUID(),
      agentId: parsed.agentId,
      kind: "evidence.attached",
      summary: `${
        parsed.kind === "user_operation" ? "UserOperation" : "Transaction"
      } evidence attached with verdict ${parsed.evaluation.verdict}.`,
      detail: {
        evidenceId: parsed.id,
        verdict: parsed.evaluation.verdict,
        source: parsed.source,
      },
      createdAt: new Date().toISOString(),
    });
  });
}

export async function priorNativeValueInUtcDay(
  ownerId: string,
  agentId: string,
  at: Date,
): Promise<string> {
  const start = new Date(
    Date.UTC(at.getUTCFullYear(), at.getUTCMonth(), at.getUTCDate()),
  );
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  const db = await getDb();
  const result = await db.execute({
    sql: `SELECT e.observed_json FROM evidence e
      JOIN agents a ON a.id = e.agent_id
      WHERE a.owner_id = ? AND e.agent_id = ? AND e.source = 'live'
        AND e.attached_at >= ? AND e.attached_at < ?`,
    args: [ownerId, agentId, start.toISOString(), end.toISOString()],
  });
  let total = 0n;
  for (const row of result.rows) {
    const parsed = observedActionSchema.safeParse(
      parseJson(String(row.observed_json)),
    );
    if (!parsed.success) continue;
    if (parsed.data.chainStatus !== "success") continue;
    if (parsed.data.valueWei === null) continue;
    total += BigInt(parsed.data.valueWei);
  }
  return total.toString();
}

export async function getLedgerSummary(
  ownerId: string,
): Promise<LedgerSummary> {
  const agents = await listAgents(ownerId);
  const evidence = await listEvidence({ ownerId, limit: 1000 });
  const verdictCounts = {
    matched: 0,
    out_of_policy: 0,
    failed: 0,
    unattributed: 0,
    needs_review: 0,
    pending: 0,
  } satisfies Record<EvidenceVerdict, number>;
  for (const record of evidence) {
    verdictCounts[record.evaluation.verdict] += 1;
  }
  return {
    agentCount: agents.length,
    evidenceCount: evidence.length,
    attentionCount: evidence.filter((record) =>
      attentionVerdicts.includes(record.evaluation.verdict),
    ).length,
    matchedCount: verdictCounts.matched,
    sampleCount: evidence.filter((record) => record.source === "sample").length,
    verdictCounts,
  };
}

export async function listAttentionEvidence(
  ownerId: string,
  limit = 6,
): Promise<AppEvidence[]> {
  return (await listEvidence({ ownerId, limit: 1000 }))
    .filter((record) => attentionVerdicts.includes(record.evaluation.verdict))
    .slice(0, limit);
}

async function insertActivityWith(
  db: Queryable,
  input: {
    ownerId: string;
    id: string;
    agentId: string | null;
    kind: string;
    summary: string;
    detail: Record<string, unknown>;
    createdAt: string;
  },
): Promise<void> {
  await db.execute({
    sql: "INSERT INTO activity (id, owner_id, agent_id, kind, summary, detail_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
    args: [
      input.id,
      input.ownerId,
      input.agentId,
      input.kind,
      input.summary.slice(0, 400),
      JSON.stringify(input.detail).slice(0, 4000),
      input.createdAt,
    ],
  });
}

export async function insertActivity(input: {
  ownerId: string;
  id: string;
  agentId: string | null;
  kind: string;
  summary: string;
  detail: Record<string, unknown>;
  createdAt: string;
}): Promise<void> {
  const db = await getDb();
  await insertActivityWith(db, input);
}

export async function listActivity(options: {
  ownerId: string;
  agentId?: string;
  limit?: number;
}): Promise<ActivityItem[]> {
  const limit = Math.min(Math.max(options.limit ?? 60, 1), 200);
  const db = await getDb();
  const result = options.agentId
    ? await db.execute({
        sql: `SELECT act.*, a.name AS agent_name, a.is_demo AS agent_is_demo
          FROM activity act
          LEFT JOIN agents a ON a.id = act.agent_id AND a.owner_id = act.owner_id
          WHERE act.owner_id = ? AND act.agent_id = ?
          ORDER BY act.created_at DESC LIMIT ?`,
        args: [options.ownerId, options.agentId, limit],
      })
    : await db.execute({
        sql: `SELECT act.*, a.name AS agent_name, a.is_demo AS agent_is_demo
          FROM activity act
          LEFT JOIN agents a ON a.id = act.agent_id AND a.owner_id = act.owner_id
          WHERE act.owner_id = ?
          ORDER BY act.created_at DESC LIMIT ?`,
        args: [options.ownerId, limit],
      });
  return (
    result.rows as unknown as Array<{
      id: string;
      agent_id: string | null;
      kind: string;
      summary: string;
      created_at: string;
      agent_name: string | null;
      agent_is_demo: number | null;
    }>
  ).map((row) => ({
    id: row.id,
    agentId: row.agent_id,
    agentName: row.agent_name,
    agentIsDemo: row.agent_is_demo === 1,
    kind: row.kind,
    summary: row.summary,
    createdAt: row.created_at,
  }));
}
