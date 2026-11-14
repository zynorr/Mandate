import "server-only";

import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { z } from "zod";
import {
  BOT_MAINNET,
  BOT_MAINNET_CHAIN_ID,
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
  networkFor(Number(process.env.BOT_CHAIN_ID)) ?? BOT_MAINNET;

const optionalSecret = z.string().trim().min(1).optional();

const envSchema = z.object({
  BOT_CHAIN_ID: z.coerce.number().int().default(BOT_MAINNET_CHAIN_ID),
  BOT_RPC_URL: z.string().url().default(defaultNetwork.rpcUrl),
  BOT_BUNDLER_URL: z.string().url().default(defaultNetwork.bundlerUrl),
  BOT_EXPLORER_URL: z.string().url().default(defaultNetwork.explorerUrl),
  BOT_EXPLORER_API_URL: z.string().url().default(defaultNetwork.explorerApiUrl),
  BOT_ENTRYPOINT_ADDRESS: z
    .string()
    .regex(/^0x[0-9a-fA-F]{40}$/)
    .default(defaultNetwork.entryPointAddress),
  MANDATE_DATABASE_URL: optionalSecret,
  MANDATE_DATABASE_AUTH_TOKEN: optionalSecret,
  MANDATE_DATABASE_PATH: optionalSecret,
  MANDATE_SEED_DEMO: booleanString.default(true),
  MANDATE_ANCHOR_REGISTRY_ADDRESS: z
    .string()
    .regex(/^0x[0-9a-fA-F]{40}$/)
    .optional(),
  MANDATE_AUTH_MODE: z.enum(["github", "local"]).optional(),
  MANDATE_AUTH_SECRET: optionalSecret,
  MANDATE_PUBLIC_URL: z.string().url().optional(),
  GITHUB_CLIENT_ID: optionalSecret,
  GITHUB_CLIENT_SECRET: optionalSecret,
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

function isHostedRuntime(): boolean {
  return process.env.VERCEL === "1" || Boolean(process.env.NOW_REGION);
}

interface DatabaseConfig {
  url: string | null;
  authToken: string | null;
  localPath: string | null;
  mode: "local" | "remote" | "unconfigured";
  error: string | null;
}

function resolveDatabaseConfig(input: {
  url?: string;
  authToken?: string;
  databasePath?: string;
}): DatabaseConfig {
  if (input.url) {
    if (input.url.startsWith("file:")) {
      const rawPath = input.url.slice("file:".length);
      const absoluteUrl =
        rawPath.startsWith("//") || /^\/[A-Za-z]:/.test(rawPath);
      const localPath = absoluteUrl
        ? fileURLToPath(input.url)
        : path.resolve(
            /* turbopackIgnore: true */
            repositoryRoot(),
            rawPath,
          );
      return {
        url: pathToFileURL(localPath).toString(),
        authToken: null,
        localPath,
        mode: "local",
        error: null,
      };
    }
    return {
      url: input.url,
      authToken: input.authToken ?? null,
      localPath: null,
      mode: "remote",
      error: null,
    };
  }

  if (isHostedRuntime()) {
    return {
      url: null,
      authToken: null,
      localPath: null,
      mode: "unconfigured",
      error:
        "MANDATE_DATABASE_URL is required on hosted deployments. The hosted filesystem is ephemeral, so use a Turso/libSQL database URL.",
    };
  }

  const root = repositoryRoot();
  const localPath = input.databasePath
    ? path.isAbsolute(input.databasePath)
      ? input.databasePath
      : path.resolve(/* turbopackIgnore: true */ root, input.databasePath)
    : path.join(root, "data", "mandate.db");

  return {
    url: pathToFileURL(localPath).toString(),
    authToken: null,
    localPath,
    mode: "local",
    error: null,
  };
}

export interface AuthConfig {
  mode: "github" | "local";
  error: string | null;
  githubClientId: string | null;
  githubClientSecret: string | null;
  secret: string | null;
  publicUrl: string | null;
}

function resolveAuthConfig(input: {
  mode?: "github" | "local";
  secret?: string;
  publicUrl?: string;
  githubClientId?: string;
  githubClientSecret?: string;
  database: DatabaseConfig;
}): AuthConfig {
  const hosted = isHostedRuntime() || input.database.mode === "remote";
  const hasGithubCredentials = Boolean(
    input.githubClientId && input.githubClientSecret,
  );
  const mode =
    input.mode ?? (hasGithubCredentials || hosted ? "github" : "local");
  let error: string | null = null;

  if (mode === "local" && hosted) {
    error =
      "Local auth mode cannot be used with a hosted database. Configure GitHub OAuth instead.";
  }
  if (mode === "github") {
    if (!input.githubClientId || !input.githubClientSecret) {
      error =
        "GitHub OAuth is not configured. Set GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET.";
    } else if (!input.secret) {
      error =
        "MANDATE_AUTH_SECRET is required. Use a random value of at least 32 characters.";
    } else if (input.secret.length < 32) {
      error = "MANDATE_AUTH_SECRET must be at least 32 characters.";
    }
  }

  if (input.publicUrl) {
    const parsed = new URL(input.publicUrl);
    const localHost =
      parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1";
    if (hosted && parsed.protocol !== "https:" && !localHost) {
      error = "MANDATE_PUBLIC_URL must use HTTPS for a hosted deployment.";
    }
  }

  return {
    mode,
    error,
    githubClientId: input.githubClientId ?? null,
    githubClientSecret: input.githubClientSecret ?? null,
    secret: input.secret ?? null,
    publicUrl: input.publicUrl?.replace(/\/+$/, "") ?? null,
  };
}

export interface AppConfig {
  chainId: KnownChainId;
  networkName: string;
  rpcUrl: string;
  bundlerUrl: string;
  explorerUrl: string;
  explorerApiUrl: string;
  entryPointAddress: string;
  databaseUrl: string | null;
  databaseAuthToken: string | null;
  databaseLocalPath: string | null;
  databaseMode: "local" | "remote" | "unconfigured";
  databaseError: string | null;
  seedDemo: boolean;
  anchorRegistryAddress: `0x${string}` | null;
  auth: AuthConfig;
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

  const database = resolveDatabaseConfig({
    url: parsed.data.MANDATE_DATABASE_URL,
    authToken: parsed.data.MANDATE_DATABASE_AUTH_TOKEN,
    databasePath: parsed.data.MANDATE_DATABASE_PATH,
  });
  const auth = resolveAuthConfig({
    mode: parsed.data.MANDATE_AUTH_MODE,
    secret: parsed.data.MANDATE_AUTH_SECRET,
    publicUrl: parsed.data.MANDATE_PUBLIC_URL,
    githubClientId: parsed.data.GITHUB_CLIENT_ID,
    githubClientSecret: parsed.data.GITHUB_CLIENT_SECRET,
    database,
  });

  cached = {
    chainId: parsed.data.BOT_CHAIN_ID,
    networkName: networkName(parsed.data.BOT_CHAIN_ID),
    rpcUrl: parsed.data.BOT_RPC_URL,
    bundlerUrl: parsed.data.BOT_BUNDLER_URL,
    explorerUrl: parsed.data.BOT_EXPLORER_URL,
    explorerApiUrl: parsed.data.BOT_EXPLORER_API_URL,
    entryPointAddress: parsed.data.BOT_ENTRYPOINT_ADDRESS,
    databaseUrl: database.url,
    databaseAuthToken: database.authToken,
    databaseLocalPath: database.localPath,
    databaseMode: database.mode,
    databaseError: database.error,
    seedDemo: parsed.data.MANDATE_SEED_DEMO,
    anchorRegistryAddress:
      (parsed.data.MANDATE_ANCHOR_REGISTRY_ADDRESS as
        | `0x${string}`
        | undefined) ?? null,
    auth,
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
