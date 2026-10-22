import { z } from "zod";
import { formatTokenAmount } from "./format";
import { fetchJson } from "./http";
import { addressSchema, hashSchema, type TokenMovement } from "./schemas";

const quantityString = z
  .union([z.string(), z.number()])
  .nullable()
  .optional()
  .transform((value) => (value === null || value === undefined ? null : String(value)));

const addressRefSchema = z
  .object({ hash: addressSchema.nullable().optional() })
  .nullable()
  .optional()
  .transform((value) => value?.hash ?? null);

const userOperationSchema = z.object({
  hash: hashSchema,
  sender: addressRefSchema,
  status: z.boolean().nullable().optional().default(null),
  transaction_hash: hashSchema.nullable().optional().default(null),
  block_number: quantityString,
  timestamp: z.string().nullable().optional().default(null),
  gas_used: quantityString,
  fee: quantityString,
  gas_price: quantityString,
  call_data: z.string().nullable().optional().default(null),
  execute_target: z.string().nullable().optional().default(null),
  execute_call_data: z.string().nullable().optional().default(null),
  decoded_call_data: z
    .object({
      method_call: z.string().nullable().optional().default(null),
      method_id: z.string().nullable().optional().default(null),
    })
    .nullable()
    .optional()
    .default(null),
  raw: z
    .object({ call_data: z.string().nullable().optional().default(null) })
    .nullable()
    .optional()
    .default(null),
});

const tokenTransferSchema = z.object({
  token: z
    .object({
      address: addressSchema,
      symbol: z.string().nullable().optional().default(null),
      name: z.string().nullable().optional().default(null),
      decimals: z.coerce.number().int().min(0).max(36),
    })
    .nullable()
    .optional(),
  total: z.object({
    value: z.union([z.string(), z.number()]).transform(String),
  }),
  from: addressRefSchema,
  to: addressRefSchema,
  log_index: z.union([z.string(), z.number()]).nullable().optional(),
});

const transactionSchema = z.object({
  hash: hashSchema,
  from: addressRefSchema,
  to: addressRefSchema,
  value: quantityString,
  gas_used: quantityString,
  gas_price: quantityString,
  status: z.string().nullable().optional().default(null),
  result: z.string().nullable().optional().default(null),
  timestamp: z.string().nullable().optional().default(null),
  block_number: quantityString,
  method: z.string().nullable().optional().default(null),
  raw_input: z.string().nullable().optional().default(null),
  token_transfers: z.array(tokenTransferSchema).optional().default([]),
});

const userOperationListResponseSchema = z.object({
  items: z.array(z.unknown()).default([]),
});

const transactionListResponseSchema = z.object({
  items: z.array(z.unknown()).default([]),
});

const userOperationListItemSchema = z.object({
  hash: hashSchema,
  address: addressRefSchema,
  status: z.boolean().nullable().optional().default(null),
  transaction_hash: hashSchema.nullable().optional().default(null),
  block_number: quantityString,
  timestamp: z.string().nullable().optional().default(null),
  fee: quantityString,
});

const transactionListItemSchema = z.object({
  hash: hashSchema,
  from: addressRefSchema,
  to: addressRefSchema,
  value: quantityString,
  status: z.string().nullable().optional().default(null),
  result: z.string().nullable().optional().default(null),
  timestamp: z.string().nullable().optional().default(null),
  block_number: quantityString,
  method: z.string().nullable().optional().default(null),
});

export interface ExplorerUserOperation {
  hash: string;
  sender: string | null;
  success: boolean | null;
  outerTransactionHash: string | null;
  blockNumber: string | null;
  timestamp: string | null;
  gasUsed: string | null;
  feeWei: string | null;
  gasPriceWei: string | null;
  callData: string | null;
  executeTarget: string | null;
  executeCallData: string | null;
  decodedMethodCall: string | null;
}

export interface ExplorerTransaction {
  hash: string;
  from: string | null;
  to: string | null;
  valueWei: string | null;
  status: "success" | "failed" | "pending";
  timestamp: string | null;
  blockNumber: string | null;
  methodLabel: string | null;
  input: string | null;
  tokenMovements: TokenMovement[];
}

export interface ExplorerCandidate {
  hash: string;
  kind: "transaction" | "user_operation";
  sender: string | null;
  target: string | null;
  methodLabel: string | null;
  valueWei: string | null;
  status: "success" | "failed" | "pending";
  timestamp: string | null;
  blockNumber: string | null;
  outerTransactionHash: string | null;
}

const hexToDecimal = (value: string | null): string | null => {
  if (value === null) return null;
  try {
    if (value.startsWith("0x")) return BigInt(value).toString();
    if (/^\d+$/.test(value)) return value;
    return null;
  } catch {
    return null;
  }
};

const normalizeTimestamp = (value: string | null): string | null => {
  if (value === null) return null;
  return Number.isNaN(Date.parse(value)) ? null : value;
};

const normalizeTokenMovements = (
  transfers: z.infer<typeof tokenTransferSchema>[],
): TokenMovement[] => {
  const seen = new Set<string>();
  const movements: TokenMovement[] = [];
  for (const transfer of transfers) {
    const token = transfer.token;
    const from = transfer.from;
    const to = transfer.to;
    if (!token || !from || !to) continue;
    const amountRaw = transfer.total.value;
    if (!/^(0|[1-9]\d*)$/.test(amountRaw)) continue;
    const logIndex =
      transfer.log_index === null || transfer.log_index === undefined
        ? null
        : String(transfer.log_index);
    const key = [
      token.address.toLowerCase(),
      amountRaw,
      from.toLowerCase(),
      to.toLowerCase(),
      logIndex,
    ].join(":");
    if (seen.has(key)) continue;
    seen.add(key);
    movements.push({
      tokenAddress: token.address,
      symbol: token.symbol?.slice(0, 32) ?? null,
      name: token.name?.slice(0, 80) ?? null,
      decimals: token.decimals,
      amountRaw,
      amountFormatted: formatTokenAmount(
        amountRaw,
        token.decimals,
        token.symbol?.slice(0, 32) ?? null,
      ),
      from,
      to,
      logIndex,
    });
    if (movements.length >= 25) break;
  }
  return movements;
};

const transactionStatus = (
  status: string | null,
  result: string | null,
): "success" | "failed" | "pending" => {
  const value = (result ?? status ?? "").toLowerCase();
  if (value === "ok" || value === "success") return "success";
  if (value === "error" || value === "failed" || value === "reverted") {
    return "failed";
  }
  return "pending";
};

export class ExplorerClient {
  private readonly baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl.replace(/\/$/, "");
  }

  async getUserOperation(
    hash: string,
  ): Promise<ExplorerUserOperation | null> {
    const data = await fetchJson(
      `${this.baseUrl}/proxy/account-abstraction/operations/${hash}`,
    );
    if (data === null) return null;
    const parsed = userOperationSchema.safeParse(data);
    if (!parsed.success) {
      throw new Error("BOT Scan returned an unexpected UserOperation shape.");
    }
    const item = parsed.data;
    if (item.hash.toLowerCase() !== hash.toLowerCase()) {
      throw new Error("BOT Scan returned a different UserOperation.");
    }
    return {
      hash: item.hash,
      sender: item.sender,
      success: item.status,
      outerTransactionHash: item.transaction_hash,
      blockNumber: hexToDecimal(item.block_number),
      timestamp: normalizeTimestamp(item.timestamp),
      gasUsed: hexToDecimal(item.gas_used),
      feeWei: hexToDecimal(item.fee),
      gasPriceWei: hexToDecimal(item.gas_price),
      callData:
        item.call_data ?? item.raw?.call_data ?? null,
      executeTarget: item.execute_target,
      executeCallData: item.execute_call_data,
      decodedMethodCall: item.decoded_call_data?.method_call ?? null,
    };
  }

  async getTransaction(hash: string): Promise<ExplorerTransaction | null> {
    const data = await fetchJson(`${this.baseUrl}/transactions/${hash}`);
    if (data === null) return null;
    const parsed = transactionSchema.safeParse(data);
    if (!parsed.success) {
      throw new Error("BOT Scan returned an unexpected transaction shape.");
    }
    const item = parsed.data;
    return {
      hash: item.hash,
      from: item.from,
      to: item.to,
      valueWei: hexToDecimal(item.value),
      status: transactionStatus(item.status, item.result),
      timestamp: normalizeTimestamp(item.timestamp),
      blockNumber: hexToDecimal(item.block_number),
      methodLabel: item.method,
      input: item.raw_input,
      tokenMovements: normalizeTokenMovements(item.token_transfers),
    };
  }

  async listUserOperations(
    sender: string,
    limit = 12,
  ): Promise<ExplorerCandidate[]> {
    const url = new URL(
      `${this.baseUrl}/proxy/account-abstraction/operations`,
    );
    url.searchParams.set("sender", sender);
    url.searchParams.set("limit", String(Math.min(Math.max(limit, 1), 25)));
    const data = await fetchJson(url.toString());
    const response = userOperationListResponseSchema.safeParse(data);
    if (!response.success) {
      throw new Error("BOT Scan returned an unexpected UserOperation list.");
    }
    const candidates: ExplorerCandidate[] = [];
    for (const raw of response.data.items) {
      const parsed = userOperationListItemSchema.safeParse(raw);
      if (!parsed.success) continue;
      const item = parsed.data;
      if (item.address && item.address.toLowerCase() !== sender.toLowerCase()) {
        continue;
      }
      candidates.push({
        hash: item.hash,
        kind: "user_operation",
        sender: item.address,
        target: null,
        methodLabel: "Smart account UserOperation",
        valueWei: null,
        status:
          item.status === null ? "pending" : item.status ? "success" : "failed",
        timestamp: normalizeTimestamp(item.timestamp),
        blockNumber: hexToDecimal(item.block_number),
        outerTransactionHash: item.transaction_hash,
      });
      if (candidates.length >= limit) break;
    }
    return candidates;
  }

  async listAddressTransactions(
    address: string,
    limit = 12,
  ): Promise<ExplorerCandidate[]> {
    const url = new URL(
      `${this.baseUrl}/addresses/${address}/transactions`,
    );
    url.searchParams.set("limit", String(Math.min(Math.max(limit, 1), 25)));
    const data = await fetchJson(url.toString());
    const response = transactionListResponseSchema.safeParse(data);
    if (!response.success) {
      throw new Error("BOT Scan returned an unexpected transaction list.");
    }
    const candidates: ExplorerCandidate[] = [];
    for (const raw of response.data.items) {
      const parsed = transactionListItemSchema.safeParse(raw);
      if (!parsed.success) continue;
      const item = parsed.data;
      if (!item.from || item.from.toLowerCase() !== address.toLowerCase()) {
        continue;
      }
      candidates.push({
        hash: item.hash,
        kind: "transaction",
        sender: item.from,
        target: item.to,
        methodLabel: item.method,
        valueWei: hexToDecimal(item.value),
        status: transactionStatus(item.status, item.result),
        timestamp: normalizeTimestamp(item.timestamp),
        blockNumber: hexToDecimal(item.block_number),
        outerTransactionHash: null,
      });
      if (candidates.length >= limit) break;
    }
    return candidates;
  }
}
