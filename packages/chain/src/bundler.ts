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

const userOperationLookupSchema = z.object({
  userOperation: z.object({
    sender: z.string(),
    callData: z.string().nullable().optional().default(null),
  }),
  entryPoint: z.string(),
  transactionHash: hashSchema.nullable(),
  blockNumber: z.string().nullable(),
});

const receiptSchema = z.object({
  userOpHash: hashSchema,
  sender: z.string(),
  success: z.boolean(),
  actualGasCost: z.string(),
  actualGasUsed: z.string(),
  receipt: z.object({
    transactionHash: hashSchema,
    blockNumber: z.string(),
    status: z.string(),
    gasUsed: z.string(),
    effectiveGasPrice: z.string().nullable().optional(),
  }),
});

export interface BundlerUserOperation {
  sender: string;
  callData: string | null;
  transactionHash: string | null;
  blockNumber: string | null;
}

export interface BundlerReceipt {
  sender: string;
  success: boolean;
  actualGasCostWei: string;
  actualGasUsed: string;
  transactionHash: string;
  blockNumber: string | null;
  transactionSuccess: boolean;
}

async function bundlerRequest(
  url: string,
  method: string,
  params: unknown[],
): Promise<unknown> {
  const data = await fetchJson(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: Date.now(), method, params }),
  });
  const parsed = rpcEnvelopeSchema.safeParse(data);
  if (!parsed.success) {
    throw new ChainSourceError("The Bundler returned an unexpected response.");
  }
  if (parsed.data.error) {
    throw new ChainSourceError(
      `Bundler error: ${parsed.data.error.message ?? "unknown error"}.`,
    );
  }
  return parsed.data.result;
}

export class BundlerClient {
  private readonly url: string;

  constructor(url: string) {
    this.url = url;
  }

  async getUserOperation(
    hash: string,
  ): Promise<BundlerUserOperation | null> {
    const result = await bundlerRequest(
      this.url,
      "eth_getUserOperationByHash",
      [hash],
    );
    if (result === null) return null;
    const parsed = userOperationLookupSchema.safeParse(result);
    if (!parsed.success) {
      throw new ChainSourceError(
        "The Bundler returned an unexpected UserOperation shape.",
      );
    }
    return {
      sender: parsed.data.userOperation.sender,
      callData: parsed.data.userOperation.callData,
      transactionHash: parsed.data.transactionHash,
      blockNumber: parsed.data.blockNumber,
    };
  }

  async getReceipt(hash: string): Promise<BundlerReceipt | null> {
    const result = await bundlerRequest(
      this.url,
      "eth_getUserOperationReceipt",
      [hash],
    );
    if (result === null) return null;
    const parsed = receiptSchema.safeParse(result);
    if (!parsed.success) {
      throw new ChainSourceError(
        "The Bundler returned an unexpected UserOperation receipt.",
      );
    }
    return {
      sender: parsed.data.sender,
      success: parsed.data.success,
      actualGasCostWei: parsed.data.actualGasCost,
      actualGasUsed: parsed.data.actualGasUsed,
      transactionHash: parsed.data.receipt.transactionHash,
      blockNumber: parsed.data.receipt.blockNumber,
      transactionSuccess: ["0x1", "success", "ok"].includes(parsed.data.receipt.status.toLowerCase()),
    };
  }
}
