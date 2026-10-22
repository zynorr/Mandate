import "server-only";

import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { getAppConfig } from "./config";
import { seedDemoWorkspace } from "./seed";

const schema = `
CREATE TABLE IF NOT EXISTS meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS agents (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  smart_account TEXT NOT NULL,
  is_demo INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS policies (
  id TEXT PRIMARY KEY,
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

CREATE UNIQUE INDEX IF NOT EXISTS agents_smart_account_idx\n  ON agents(smart_account);\n\nCREATE INDEX IF NOT EXISTS policies_agent_idx
  ON policies(agent_id, version DESC);

CREATE TABLE IF NOT EXISTS intents (
  id TEXT PRIMARY KEY,
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
  __mandateDb?: Database.Database;
};

export function getDb(): Database.Database {
  const globalDb = globalThis as DbGlobal;
  if (globalDb.__mandateDb) return globalDb.__mandateDb;

  const config = getAppConfig();
  fs.mkdirSync(path.dirname(config.databasePath), { recursive: true });
  const db = new Database(config.databasePath);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  db.pragma("busy_timeout = 5000");
  db.exec(schema);
  db.pragma("user_version = 1");

  if (config.seedDemo) {
    seedDemoWorkspace(db);
  }

  globalDb.__mandateDb = db;
  return db;
}
