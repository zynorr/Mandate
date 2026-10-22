import { z } from "zod";
import { ChainSourceError, fetchJson } from "./http";
import { hashSchema } from "./schemas";

const rpcEnvelopeSchema = z.object({
  jsonrpc: z.string().optional(),
  id: z.union([z.number(), z.string()]).optional(),
  result: z.unknown().optional(),
  error: z
    .object({
      code: z.number().optional(),
      message: z.string().optional(),
    })
    .optional(),
});

const quantitySchema = z
  .string()
  .regex(/^0x[0-9a-fA-F]+$/)
  .nullable();

const receiptSchema = z.object({
  transactionHash: hashSchema,
  blockHash: hashSchema.nullable(),
  blockNumber: quantitySchema,
  from: z.string(),
  to: z.string().nullable(),
  gasUsed: z.string(),
  effectiveGasPrice: z.string().nullable().optional(),
  status: z.string(),
});

const transactionSchema = z.object({
  hash: hashSchema,
  from: z.string(),
  to: z.string().nullable(),
  value: z.string(),
  input: z.string(),
  blockNumber: quantitySchema,
});

const blockSchema = z.object({
  number: quantitySchema,
  timestamp: quantitySchema,
});

export interface RpcReceipt {
  transactionHash: string;
  blockNumber: string | null;
  blockHash: string | null;
  from: string;
  to: string | null;
  gasUsedWei: string;
  effectiveGasPriceWei: string | null;
  success: boolean;
}

export interface RpcTransaction {
  hash: string;
  from: string;
  to: string | null;
  valueWei: string;
  input: string;
  blockNumber: string | null;
}

const hexToDecimal = (value: string | null): string | null => {
  if (value === null) return null;
  try {
    return BigInt(value).toString();
  } catch {
    return null;
  }
};

async function rpcRequest(
  url: string,
  method: string,
  params: unknown[],
  timeoutMs = 15_000,
): Promise<unknown> {
  const data = await fetchJson(
    url,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: Date.now(), method, params }),
    },
    timeoutMs,
  );
  const parsed = rpcEnvelopeSchema.safeParse(data);
  if (!parsed.success) {
    throw new ChainSourceError("The RPC endpoint returned an unexpected response.");
  }
  if (parsed.data.error) {
    throw new ChainSourceError(
      `RPC error: ${parsed.data.error.message ?? "unknown error"}.`,
    );
  }
  return parsed.data.result;
}

export class RpcClient {
  private readonly url: string;

  constructor(url: string) {
    this.url = url;
  }

  async getChainId(): Promise<number> {
    const result = await rpcRequest(this.url, "eth_chainId", []);
    const parsed = z.string().regex(/^0x[0-9a-fA-F]+$/).safeParse(result);
    if (!parsed.success) {
      throw new ChainSourceError("The RPC endpoint did not return a chain ID.");
    }
    return Number(BigInt(parsed.data));
  }

  async getTransaction(hash: string): Promise<RpcTransaction | null> {
    const result = await rpcRequest(this.url, "eth_getTransactionByHash", [hash]);
    if (result === null) return null;
    const parsed = transactionSchema.safeParse(result);
    if (!parsed.success) {
      throw new ChainSourceError("The RPC endpoint returned an unexpected transaction.");
    }
    const item = parsed.data;
    return {
      hash: item.hash,
      from: item.from,
      to: item.to,
      valueWei: hexToDecimal(item.value) ?? "0",
      input: item.input,
      blockNumber: hexToDecimal(item.blockNumber),
    };
  }

  async getTransactionReceipt(hash: string): Promise<RpcReceipt | null> {
    const result = await rpcRequest(this.url, "eth_getTransactionReceipt", [hash]);
    if (result === null) return null;
    const parsed = receiptSchema.safeParse(result);
    if (!parsed.success) {
      throw new ChainSourceError("The RPC endpoint returned an unexpected receipt.");
    }
    const item = parsed.data;
    if (item.status !== "0x0" && item.status !== "0x1") {
      throw new ChainSourceError("The receipt has an unknown status value.");
    }
    return {
      transactionHash: item.transactionHash,
      blockNumber: hexToDecimal(item.blockNumber),
      blockHash: item.blockHash,
      from: item.from,
      to: item.to,
      gasUsedWei: BigInt(item.gasUsed).toString(),
      effectiveGasPriceWei: hexToDecimal(item.effectiveGasPrice ?? null),
      success: item.status === "0x1",
    };
  }

  async getBlockTimestamp(blockNumber: string): Promise<string | null> {
    const hex = `0x${BigInt(blockNumber).toString(16)}`;
    const result = await rpcRequest(this.url, "eth_getBlockByNumber", [hex, false]);
    if (result === null) return null;
    const parsed = blockSchema.safeParse(result);
    if (!parsed.success) return null;
    const timestamp = hexToDecimal(parsed.data.timestamp);
    if (timestamp === null) return null;
    return new Date(Number(timestamp) * 1000).toISOString();
  }
}
