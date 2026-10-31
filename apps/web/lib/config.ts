import "server-only";

import path from "node:path";
import { z } from "zod";
import {
  BOT_TESTNET,
  BOT_TESTNET_CHAIN_ID,
  KNOWN_CHAIN_IDS,
  isKnownChainId,
  networkFor,
  networkName,
  type KnownChainId,
} from "@mandate/chain";

const booleanString = z
  .enum(["true", "false", "1", "0"])
  .transform((value) => value === "true" || value === "1");

const defaultNetwork =
  networkFor(Number(process.env.BOT_CHAIN_ID)) ?? BOT_TESTNET;

const envSchema = z.object({
  BOT_CHAIN_ID: z.coerce.number().int().default(BOT_TESTNET_CHAIN_ID),
  BOT_RPC_URL: z.string().url().default(defaultNetwork.rpcUrl),
  BOT_BUNDLER_URL: z.string().url().default(defaultNetwork.bundlerUrl),
  BOT_EXPLORER_URL: z.string().url().default(defaultNetwork.explorerUrl),
  BOT_EXPLORER_API_URL: z.string().url().default(defaultNetwork.explorerApiUrl),
  BOT_ENTRYPOINT_ADDRESS: z
    .string()
    .regex(/^0x[0-9a-fA-F]{40}$/)
    .default(defaultNetwork.entryPointAddress),
  MANDATE_DATABASE_PATH: z.string().trim().min(1).optional(),
  MANDATE_SEED_DEMO: booleanString.default(true),
  MANDATE_ANCHOR_REGISTRY_ADDRESS: z
    .string()
    .regex(/^0x[0-9a-fA-F]{40}$/)
    .optional(),
});

function repositoryRoot(): string {
  const cwd = process.cwd();
  if (
    path.basename(cwd) === "web" &&
    path.basename(path.dirname(cwd)) === "apps"
  ) {
    return path.resolve(cwd, "../..");
  }
  return cwd;
}

function resolveDatabasePath(value: string | undefined): string {
  if (!value) {
    if (
      process.env.VERCEL === "1" ||
      Boolean(process.env.NOW_REGION)
    ) {
      return path.join(
        process.env.TMPDIR || process.env.TEMP || "/tmp",
        "mandate.db",
      );
    }
  }
  const root = repositoryRoot();
  if (!value) return path.join(root, "data", "mandate.db");
  return path.isAbsolute(value)
    ? value
    : path.resolve(/* turbopackIgnore: true */ root, value);
}

export interface AppConfig {
  chainId: KnownChainId;
  networkName: string;
  rpcUrl: string;
  bundlerUrl: string;
  explorerUrl: string;
  explorerApiUrl: string;
  entryPointAddress: string;
  databasePath: string;
  seedDemo: boolean;
  anchorRegistryAddress: `0x${string}` | null;
}

let cached: AppConfig | null = null;

export function getAppConfig(): AppConfig {
  if (cached) return cached;
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    throw new Error(
      `Invalid environment configuration: ${parsed.error.issues
        .map((issue) => issue.path.join("."))
        .join(", ")}`,
    );
  }
  if (!isKnownChainId(parsed.data.BOT_CHAIN_ID)) {
    throw new Error(
      `Unsupported chain ID ${parsed.data.BOT_CHAIN_ID}. This build supports BOT Chain mainnet (${KNOWN_CHAIN_IDS[0]}) and testnet (${KNOWN_CHAIN_IDS[1]}).`,
    );
  }
  cached = {
    chainId: parsed.data.BOT_CHAIN_ID,
    networkName: networkName(parsed.data.BOT_CHAIN_ID),
    rpcUrl: parsed.data.BOT_RPC_URL,
    bundlerUrl: parsed.data.BOT_BUNDLER_URL,
    explorerUrl: parsed.data.BOT_EXPLORER_URL,
    explorerApiUrl: parsed.data.BOT_EXPLORER_API_URL,
    entryPointAddress: parsed.data.BOT_ENTRYPOINT_ADDRESS,
    databasePath: resolveDatabasePath(parsed.data.MANDATE_DATABASE_PATH),
    seedDemo: parsed.data.MANDATE_SEED_DEMO,
    anchorRegistryAddress:
      (parsed.data.MANDATE_ANCHOR_REGISTRY_ADDRESS as
        | `0x${string}`
        | undefined) ?? null,
  };
  return cached;
}

export function getChainConfig() {
  const config = getAppConfig();
  return {
    chainId: config.chainId,
    rpcUrl: config.rpcUrl,
    bundlerUrl: config.bundlerUrl,
    explorerUrl: config.explorerUrl,
    explorerApiUrl: config.explorerApiUrl,
    entryPointAddress: config.entryPointAddress,
  };
}
