import "server-only";

import { z } from "zod";
import {
  RpcClient,
  fetchJson,
} from "@mandate/chain";
import { getChainConfig } from "./config";

export type SourceCheck = {
  id: string;
  label: string;
  status: "ok" | "down";
  detail: string;
  latencyMs: number;
};

export type SourceHealth = {
  status: "ok" | "degraded" | "down";
  checkedAt: string;
  checks: SourceCheck[];
};

const rpcEnvelopeSchema = z.object({
  result: z.unknown().optional(),
  error: z.object({ message: z.string().optional() }).optional(),
});

async function timed(
  id: string,
  label: string,
  check: () => Promise<string>,
): Promise<SourceCheck> {
  const started = performance.now();
  try {
    const detail = await check();
    return {
      id,
      label,
      status: "ok",
      detail,
      latencyMs: Math.round(performance.now() - started),
    };
  } catch (error) {
    return {
      id,
      label,
      status: "down",
      detail:
        error instanceof Error ? error.message : "The source did not respond.",
      latencyMs: Math.round(performance.now() - started),
    };
  }
}

async function bundlerCall(method: string, params: unknown[]) {
  const config = getChainConfig();
  const data = await fetchJson(
    config.bundlerUrl,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
    },
    10_000,
  );
  const parsed = rpcEnvelopeSchema.safeParse(data);
  if (!parsed.success) throw new Error("Unexpected Bundler response.");
  if (parsed.data.error) {
    throw new Error(parsed.data.error.message ?? "Bundler request failed.");
  }
  return parsed.data.result;
}

export async function readSourceHealth(): Promise<SourceHealth> {
  const config = getChainConfig();
  const rpc = new RpcClient(config.rpcUrl);

  const checks = await Promise.all([
    timed("rpc", "BOT RPC", async () => {
      const chainId = await rpc.getChainId();
      if (chainId !== config.chainId) {
        throw new Error(`Unexpected chain ID ${chainId}.`);
      }
      return `Chain ID ${chainId} verified.`;
    }),
    timed("bundler", "ERC-4337 Bundler", async () => {
      const result = await bundlerCall("eth_supportedEntryPoints", []);
      const parsed = z.array(z.string()).safeParse(result);
      if (!parsed.success) throw new Error("Unexpected entry-point response.");
      const entryPoint = parsed.data.find(
        (item) =>
          item.toLowerCase() === config.entryPointAddress.toLowerCase(),
      );
      if (!entryPoint) {
        throw new Error("EntryPoint v0.7 is not advertised.");
      }
      return `EntryPoint ${entryPoint} is advertised.`;
    }),
    timed("explorer", "BOT Scan API", async () => {
      const stats = await fetchJson(
        `${config.explorerApiUrl.replace(/\/$/, "")}/stats`,
        {},
        10_000,
      );
      if (stats === null || typeof stats !== "object") {
        throw new Error("Unexpected explorer stats response.");
      }
      return "Explorer v2 API responded.";
    }),
    timed("aa-index", "Account-abstraction index", async () => {
      const url = new URL(
        `${config.explorerApiUrl.replace(
          /\/$/,
          "",
        )}/proxy/account-abstraction/operations`,
      );
      url.searchParams.set("limit", "1");
      const data = await fetchJson(url.toString(), {}, 10_000);
      const parsed = z.object({ items: z.array(z.unknown()) }).safeParse(data);
      if (!parsed.success) {
        throw new Error("Unexpected UserOperation list response.");
      }
      return "UserOperation index responded.";
    }),
  ]);

  const rpcDown = checks[0]?.status === "down";
  const othersDown = checks.slice(1).some((check) => check.status === "down");
  const status: SourceHealth["status"] = rpcDown
    ? "down"
    : othersDown
      ? "degraded"
      : "ok";

  return {
    status,
    checkedAt: new Date().toISOString(),
    checks,
  };
}
