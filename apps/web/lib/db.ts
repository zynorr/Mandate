import "server-only";

import fs from "node:fs";
import path from "node:path";
import { createClient, type Client } from "@libsql/client";
import { getAppConfig } from "./config";
import { seedDemoWorkspace } from "./seed";

const schema = `
CREATE TABLE IF NOT EXISTS meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS agents (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  smart_account TEXT NOT NULL,
  is_demo INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS policies (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL,
  agent_id TEXT NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  version INTEGER NOT NULL,
  name TEXT NOT NULL,
  chain_id INTEGER NOT NULL,
  allowed_targets TEXT NOT NULL,
  allowed_methods TEXT NOT NULL,
  max_native_per_action_wei TEXT NOT NULL,
  max_native_per_day_wei TEXT,
  expires_at TEXT,
  notes TEXT NOT NULL,
  hash TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE(agent_id, version)
);

CREATE INDEX IF NOT EXISTS policies_agent_idx
  ON policies(agent_id, version DESC);

CREATE TABLE IF NOT EXISTS intents (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL,
  agent_id TEXT NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  policy_id TEXT NOT NULL REFERENCES policies(id) ON DELETE RESTRICT,
  policy_version INTEGER NOT NULL,
  policy_hash TEXT NOT NULL,
  chain_id INTEGER NOT NULL,
  title TEXT NOT NULL,
  rationale TEXT NOT NULL,
  target TEXT NOT NULL,
  method_selector TEXT NOT NULL,
  value_wei TEXT NOT NULL,
  approved_by TEXT NOT NULL,
  fingerprint TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS intents_agent_idx
  ON intents(agent_id, created_at DESC);

CREATE TABLE IF NOT EXISTS evidence (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL,
  agent_id TEXT NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  intent_id TEXT REFERENCES intents(id) ON DELETE SET NULL,
  policy_id TEXT NOT NULL REFERENCES policies(id) ON DELETE RESTRICT,
  policy_version INTEGER NOT NULL,
  policy_hash TEXT NOT NULL,
  kind TEXT NOT NULL,
  hash TEXT NOT NULL,
  source TEXT NOT NULL,
  observed_json TEXT NOT NULL,
  evaluation_json TEXT NOT NULL,
  attached_at TEXT NOT NULL,
  fetched_at TEXT NOT NULL,
  UNIQUE(agent_id, kind, hash)
);

CREATE INDEX IF NOT EXISTS evidence_agent_idx
  ON evidence(agent_id, attached_at DESC);

CREATE INDEX IF NOT EXISTS evidence_intent_idx
  ON evidence(intent_id, attached_at DESC);

CREATE TABLE IF NOT EXISTS activity (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL,
  agent_id TEXT REFERENCES agents(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  summary TEXT NOT NULL,
  detail_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS activity_created_idx
  ON activity(created_at DESC);
`;

type DbGlobal = typeof globalThis & {
  __mandateDb?: Promise<Client>;
  __mandateSeededOwners?: Set<string>;
};

async function columnExists(
  db: Client,
  table: string,
  column: string,
): Promise<boolean> {
  const result = await db.execute(`PRAGMA table_info(${table})`);
  return result.rows.some((row) => row.name === column);
}

async function ensureOwnerColumn(db: Client, table: string): Promise<void> {
  if (await columnExists(db, table, "owner_id")) return;
  try {
    await db.execute(
      `ALTER TABLE ${table} ADD COLUMN owner_id TEXT NOT NULL DEFAULT 'local'`,
    );
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.toLowerCase().includes("duplicate column")
    ) {
      return;
    }
    throw error;
  }
}

async function migrate(db: Client): Promise<void> {
  await db.executeMultiple(schema);

  for (const table of ["agents", "policies", "intents", "evidence", "activity"]) {
    await ensureOwnerColumn(db, table);
  }

  await db.execute("DROP INDEX IF EXISTS agents_smart_account_idx");
  await db.executeMultiple(`
    CREATE UNIQUE INDEX IF NOT EXISTS agents_owner_smart_account_idx
      ON agents(owner_id, lower(smart_account));
    CREATE INDEX IF NOT EXISTS agents_owner_idx
      ON agents(owner_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS policies_owner_agent_idx
      ON policies(owner_id, agent_id, version DESC);
    CREATE INDEX IF NOT EXISTS intents_owner_agent_idx
      ON intents(owner_id, agent_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS evidence_owner_agent_idx
      ON evidence(owner_id, agent_id, attached_at DESC);
    CREATE INDEX IF NOT EXISTS activity_owner_created_idx
      ON activity(owner_id, created_at DESC);
  `);
  await db.execute("PRAGMA user_version = 2");
}

async function initDb(): Promise<Client> {
  const config = getAppConfig();
  if (!config.databaseUrl) {
    throw new Error(
      config.databaseError ??
        "No Mandate database is configured. Set MANDATE_DATABASE_URL or MANDATE_DATABASE_PATH.",
    );
  }

  if (config.databaseLocalPath) {
    fs.mkdirSync(path.dirname(config.databaseLocalPath), { recursive: true });
  }

  const db = createClient({
    url: config.databaseUrl,
    authToken: config.databaseAuthToken ?? undefined,
  });

  try {
    await migrate(db);
  } catch (error) {
    db.close();
    throw error;
  }

  return db;
}

export async function getDb(): Promise<Client> {
  const globalDb = globalThis as DbGlobal;
  if (!globalDb.__mandateDb) {
    globalDb.__mandateDb = initDb().catch((error) => {
      globalDb.__mandateDb = undefined;
      throw error;
    });
  }
  return globalDb.__mandateDb;
}

export async function ensureDemoWorkspace(ownerId: string): Promise<void> {
  const config = getAppConfig();
  if (!config.seedDemo) return;

  const globalDb = globalThis as DbGlobal;
  if (globalDb.__mandateSeededOwners?.has(ownerId)) return;

  const db = await getDb();
  await seedDemoWorkspace(db, {
    ownerId,
    chainId: config.chainId,
    explorerUrl: config.explorerUrl,
  });

  if (!globalDb.__mandateSeededOwners) {
    globalDb.__mandateSeededOwners = new Set();
  }
  globalDb.__mandateSeededOwners.add(ownerId);
}
