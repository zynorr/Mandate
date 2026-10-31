import "server-only";

import { randomUUID } from "node:crypto";
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

export function listAgents(): AppAgent[] {
  const rows = getDb()
    .prepare(`${agentSelect} ORDER BY a.is_demo ASC, a.created_at DESC`)
    .all() as AgentRow[];
  return rows.map(rowToAgent);
}

export function getAgent(id: string): AppAgent | null {
  const row = getDb()
    .prepare(`${agentSelect} WHERE a.id = ?`)
    .get(id) as AgentRow | undefined;
  return row ? rowToAgent(row) : null;
}

export function createAgent(input: AgentDraft): AppAgent {
  const draft = agentDraftSchema.parse(input);
  const db = getDb();
  const existing = db
    .prepare("SELECT id FROM agents WHERE lower(smart_account) = lower(?)")
    .get(draft.smartAccount) as { id: string } | undefined;
  if (existing) {
    throw new AppError("An agent already uses this smart account.");
  }
  const now = new Date().toISOString();
  const id = randomUUID();
  const insert = db.transaction(() => {
    db.prepare(
      "INSERT INTO agents (id, name, description, smart_account, is_demo, created_at, updated_at) VALUES (?, ?, ?, ?, 0, ?, ?)",
    ).run(id, draft.name, draft.description, draft.smartAccount, now, now);
    insertActivity({
      id: randomUUID(),
      agentId: id,
      kind: "agent.created",
      summary: `Agent ${draft.name} registered with smart account ${draft.smartAccount}.`,
      detail: { smartAccount: draft.smartAccount },
      createdAt: now,
    });
  });
  insert();
  const agent = getAgent(id);
  if (!agent) throw new AppError("The agent could not be created.");
  return agent;
}

export function listPolicies(agentId: string): AppPolicy[] {
  const rows = getDb()
    .prepare("SELECT * FROM policies WHERE agent_id = ? ORDER BY version DESC")
    .all(agentId) as PolicyRow[];
  return rows.map(rowToPolicy);
}

export function getCurrentPolicy(agentId: string): AppPolicy | null {
  const row = getDb()
    .prepare(
      "SELECT * FROM policies WHERE agent_id = ? ORDER BY version DESC LIMIT 1",
    )
    .get(agentId) as PolicyRow | undefined;
  return row ? rowToPolicy(row) : null;
}

export function getPolicy(id: string): AppPolicy | null {
  const row = getDb()
    .prepare("SELECT * FROM policies WHERE id = ?")
    .get(id) as PolicyRow | undefined;
  return row ? rowToPolicy(row) : null;
}

export function createPolicyVersion(
  agentId: string,
  input: PolicyDraft,
): AppPolicy {
  const agent = getAgent(agentId);
  if (!agent) throw new AppError("Agent not found.");
  const draft = policyDraftSchema.parse(input);
  const db = getDb();
  const latest = db
    .prepare(
      "SELECT COALESCE(MAX(version), 0) AS version FROM policies WHERE agent_id = ?",
    )
    .get(agentId) as { version: number };
  const version = latest.version + 1;
  const id = randomUUID();
  const createdAt = new Date().toISOString();
  const hash = computePolicyHash({ ...draft, version });

  const insert = db.transaction(() => {
    db.prepare(
      "INSERT INTO policies (id, agent_id, version, name, chain_id, allowed_targets, allowed_methods, max_native_per_action_wei, max_native_per_day_wei, expires_at, notes, hash, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    ).run(
      id,
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
    );
    insertActivity({
      id: randomUUID(),
      agentId,
      kind: "policy.published",
      summary: `Policy v${version} published for ${agent.name}.`,
      detail: { policyId: id, version, hash },
      createdAt,
    });
  });
  insert();
  const policy = getPolicy(id);
  if (!policy) throw new AppError("The policy could not be created.");
  return policy;
}

export function listIntents(agentId: string): IntentRecord[] {
  const rows = getDb()
    .prepare("SELECT * FROM intents WHERE agent_id = ? ORDER BY created_at DESC")
    .all(agentId) as IntentRow[];
  return rows.map(rowToIntent);
}

export function getIntent(id: string): IntentRecord | null {
  const row = getDb()
    .prepare("SELECT * FROM intents WHERE id = ?")
    .get(id) as IntentRow | undefined;
  return row ? rowToIntent(row) : null;
}

export function createIntent(
  agentId: string,
  policyId: string,
  input: IntentDraft,
): IntentRecord {
  const agent = getAgent(agentId);
  if (!agent) throw new AppError("Agent not found.");
  const policy = getPolicy(policyId);
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
  const insert = getDb().transaction(() => {
    getDb()
      .prepare(
        "INSERT INTO intents (id, agent_id, policy_id, policy_version, policy_hash, chain_id, title, rationale, target, method_selector, value_wei, approved_by, fingerprint, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      )
      .run(
        id,
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
      );
    insertActivity({
      id: randomUUID(),
      agentId,
      kind: "intent.approved",
      summary: `Intent approved: ${draft.title}.`,
      detail: { intentId: id, policyVersion: policy.version, fingerprint },
      createdAt,
    });
  });
  insert();
  const intent = getIntent(id);
  if (!intent) throw new AppError("The intent could not be approved.");
  return intent;
}

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

export function listEvidence(options?: {
  agentId?: string;
  verdict?: string;
  limit?: number;
}): AppEvidence[] {
  const limit = Math.min(Math.max(options?.limit ?? 500, 1), 1000);
  const rows = options?.agentId
    ? (getDb()
        .prepare(
          `${evidenceSelect} WHERE e.agent_id = ? ORDER BY e.attached_at DESC LIMIT ?`,
        )
        .all(options.agentId, limit) as EvidenceRow[])
    : (getDb()
        .prepare(
          `${evidenceSelect} ORDER BY e.attached_at DESC LIMIT ?`,
        )
        .all(limit) as EvidenceRow[]);
  const evidence = rows.map(rowToEvidence);
  if (options?.verdict) {
    return evidence.filter(
      (record) => record.evaluation.verdict === options.verdict,
    );
  }
  return evidence;
}

export function getEvidence(id: string): AppEvidence | null {
  const row = getDb()
    .prepare(`${evidenceSelect} WHERE e.id = ?`)
    .get(id) as EvidenceRow | undefined;
  return row ? rowToEvidence(row) : null;
}

export function getEvidenceByHash(
  agentId: string,
  kind: string,
  hash: string,
): AppEvidence | null {
  const row = getDb()
    .prepare(
      `${evidenceSelect} WHERE e.agent_id = ? AND e.kind = ? AND e.hash = ?`,
    )
    .get(agentId, kind, hash) as EvidenceRow | undefined;
  return row ? rowToEvidence(row) : null;
}

export function listEvidenceForIntent(intentId: string): AppEvidence[] {
  const rows = getDb()
    .prepare(
      `${evidenceSelect} WHERE e.intent_id = ? ORDER BY e.attached_at DESC`,
    )
    .all(intentId) as EvidenceRow[];
  return rows.map(rowToEvidence);
}

export function listEvidenceForPolicy(policyId: string): AppEvidence[] {
  const rows = getDb()
    .prepare(
      `${evidenceSelect} WHERE e.policy_id = ? ORDER BY e.attached_at DESC`,
    )
    .all(policyId) as EvidenceRow[];
  return rows.map(rowToEvidence);
}

export function insertEvidence(record: EvidenceRecord): void {
  const parsed = evidenceRecordSchema.parse(record);
  const db = getDb();
  const existing = getEvidenceByHash(
    parsed.agentId,
    parsed.kind,
    parsed.hash,
  );
  if (existing) {
    throw new AppError("This evidence is already attached to the agent.");
  }
  const agent = getAgent(parsed.agentId);
  if (!agent) throw new AppError("Agent not found.");
  const insert = db.transaction(() => {
    db.prepare(
      "INSERT INTO evidence (id, agent_id, intent_id, policy_id, policy_version, policy_hash, kind, hash, source, observed_json, evaluation_json, attached_at, fetched_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    ).run(
      parsed.id,
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
    );
    insertActivity({
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
  insert();
}

export function priorNativeValueInUtcDay(
  agentId: string,
  at: Date,
): string {
  const start = new Date(
    Date.UTC(at.getUTCFullYear(), at.getUTCMonth(), at.getUTCDate()),
  );
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  const rows = getDb()
    .prepare(
      "SELECT observed_json FROM evidence WHERE agent_id = ? AND source = 'live' AND attached_at >= ? AND attached_at < ?",
    )
    .all(agentId, start.toISOString(), end.toISOString()) as Array<{
    observed_json: string;
  }>;
  let total = 0n;
  for (const row of rows) {
    const parsed = observedActionSchema.safeParse(parseJson(row.observed_json));
    if (!parsed.success) continue;
    if (parsed.data.chainStatus !== "success") continue;
    if (parsed.data.valueWei === null) continue;
    total += BigInt(parsed.data.valueWei);
  }
  return total.toString();
}

export function getLedgerSummary(): LedgerSummary {
  const agents = listAgents();
  const evidence = listEvidence({ limit: 1000 });
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

export function listAttentionEvidence(limit = 6): AppEvidence[] {
  return listEvidence({ limit: 1000 })
    .filter((record) =>
      attentionVerdicts.includes(record.evaluation.verdict),
    )
    .slice(0, limit);
}

export function insertActivity(input: {
  id: string;
  agentId: string | null;
  kind: string;
  summary: string;
  detail: Record<string, unknown>;
  createdAt: string;
}): void {
  getDb()
    .prepare(
      "INSERT INTO activity (id, agent_id, kind, summary, detail_json, created_at) VALUES (?, ?, ?, ?, ?, ?)",
    )
    .run(
      input.id,
      input.agentId,
      input.kind,
      input.summary.slice(0, 400),
      JSON.stringify(input.detail).slice(0, 4000),
      input.createdAt,
    );
}

export function listActivity(
  options?: { agentId?: string; limit?: number },
): ActivityItem[] {
  const limit = Math.min(Math.max(options?.limit ?? 60, 1), 200);
  const rows = options?.agentId
    ? (getDb()
        .prepare(
          "SELECT act.*, a.name AS agent_name, a.is_demo AS agent_is_demo FROM activity act LEFT JOIN agents a ON a.id = act.agent_id WHERE act.agent_id = ? ORDER BY act.created_at DESC LIMIT ?",
        )
        .all(options.agentId, limit) as Array<{
        id: string;
        agent_id: string | null;
        kind: string;
        summary: string;
        created_at: string;
        agent_name: string | null;
        agent_is_demo: number | null;
      }>)
    : (getDb()
        .prepare(
          "SELECT act.*, a.name AS agent_name, a.is_demo AS agent_is_demo FROM activity act LEFT JOIN agents a ON a.id = act.agent_id ORDER BY act.created_at DESC LIMIT ?",
        )
        .all(limit) as Array<{
        id: string;
        agent_id: string | null;
        kind: string;
        summary: string;
        created_at: string;
        agent_name: string | null;
        agent_is_demo: number | null;
      }>);
  return rows.map((row) => ({
    id: row.id,
    agentId: row.agent_id,
    agentName: row.agent_name,
    agentIsDemo: row.agent_is_demo === 1,
    kind: row.kind,
    summary: row.summary,
    createdAt: row.created_at,
  }));
}
