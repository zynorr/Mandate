import { getAddress, isAddress, type Address } from "viem";
import { BundlerClient, type BundlerReceipt } from "./bundler";
import {
  KNOWN_CHAIN_IDS,
  KNOWN_METHODS,
  NATIVE_TRANSFER_SELECTOR,
  isKnownChainId,
  networkLabel,
  type KnownChainId,
} from "./constants";
import { decodeAccountCalldata, decodeDirectTransaction } from "./decode";
import {
  ExplorerClient,
  type ExplorerTransaction,
  type ExplorerUserOperation,
} from "./explorer";
import { shortenAddress } from "./format";
import { ChainSourceError } from "./http";
import { RpcClient, type RpcReceipt, type RpcTransaction } from "./rpc";
import type {
  EvidenceKind,
  ObservedAction,
  TokenMovement,
} from "./schemas";

export interface ChainConfig {
  chainId: KnownChainId;
  rpcUrl: string;
  bundlerUrl: string;
  explorerUrl: string;
  explorerApiUrl: string;
  entryPointAddress: string;
}

export interface FetchEvidenceInput {
  kind: EvidenceKind;
  hash: string;
  agentAccount: string;
  config: ChainConfig;
}

export interface FetchedEvidence {
  kind: EvidenceKind;
  hash: string;
  observed: ObservedAction;
  fetchedAt: string;
}

export class EvidenceAttributionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EvidenceAttributionError";
  }
}

const safeAddress = (value: string | null | undefined): Address | null => {
  if (!value || !isAddress(value, { strict: false })) return null;
  return getAddress(value);
};

const selectorOf = (calldata: string | null): string | null => {
  if (!calldata || calldata === "0x" || calldata.length < 10) return null;
  if (!/^0x[0-9a-fA-F]+$/.test(calldata)) return null;
  return calldata.slice(0, 10).toLowerCase();
};

const uniqueNotes = (notes: string[]): string[] => {
  return [...new Set(notes.filter((note) => note.trim().length > 0))].slice(0, 12);
};

const tokenNote =
  "Token movements are informational. This policy evaluates target, method, and native value only.";

const parseSettled = <T>(
  result: PromiseSettledResult<T>,
): { value: T | null; error: unknown | null } => {
  if (result.status === "fulfilled") {
    return { value: result.value, error: null };
  }
  return { value: null, error: result.reason };
};

const outerStatus = (
  receipt: RpcReceipt | null,
): "success" | "failed" | "pending" => {
  if (receipt === null) return "pending";
  return receipt.success ? "success" : "failed";
};

function chainError(error: unknown): string {
  if (error instanceof Error) return error.message;
  return "The source could not be read.";
}

async function verifyNetwork(
  config: ChainConfig,
  rpc: RpcClient,
): Promise<void> {
  if (!isKnownChainId(config.chainId)) {
    throw new Error(
      `This build supports BOT Chain mainnet (${KNOWN_CHAIN_IDS[0]}) and testnet (${KNOWN_CHAIN_IDS[1]}) only.`,
    );
  }
  let actualChainId: number;
  try {
    actualChainId = await rpc.getChainId();
  } catch (error) {
    throw new Error(
      `Could not verify the RPC chain. ${chainError(error)}`,
    );
  }
  if (actualChainId !== config.chainId) {
    throw new Error(
      `The RPC is on chain ${actualChainId}; this workspace is configured for ${networkLabel(config.chainId)} (${config.chainId}).`,
    );
  }
}

function tokenMovementsFrom(
  explorerTransaction: ExplorerTransaction | null,
): TokenMovement[] {
  return explorerTransaction?.tokenMovements.slice(0, 25) ?? [];
}

function notesForSourceGaps(input: {
  explorerOperation: ExplorerUserOperation | null;
  explorerOperationError: unknown;
  bundlerReceipt: BundlerReceipt | null;
  bundlerReceiptError: unknown;
  explorerTransactionError: unknown;
  outerReceipt: RpcReceipt | null;
  outerReceiptError: unknown;
}): string[] {
  const notes: string[] = [];
  if (input.explorerOperation === null && input.explorerOperationError) {
    notes.push("BOT Scan's UserOperation detail could not be read.");
  }
  if (input.bundlerReceipt === null && input.bundlerReceiptError) {
    notes.push("The Bundler receipt could not be read.");
  }
  if (
    input.outerReceipt === null &&
    input.outerReceiptError === null &&
    input.explorerOperation?.success === true
  ) {
    notes.push(
      "The outer transaction receipt is unavailable, so confirmation is reported from the explorer and bundler sources only.",
    );
  }
  if (input.outerReceiptError) {
    notes.push("The outer transaction receipt could not be read from the RPC.");
  }
  if (input.explorerTransactionError) {
    notes.push("BOT Scan token movements were unavailable.");
  }
  return notes;
}

async function fetchUserOperationEvidence(
  input: FetchEvidenceInput,
  config: ChainConfig,
  rpc: RpcClient,
  explorer: ExplorerClient,
  bundler: BundlerClient,
): Promise<FetchedEvidence> {
  const [operationResult, receiptResult, lookupResult] = await Promise.allSettled([
    explorer.getUserOperation(input.hash),
    bundler.getReceipt(input.hash),
    bundler.getUserOperation(input.hash),
  ]);

  const operation = parseSettled(operationResult);
  const receipt = parseSettled(receiptResult);
  const lookup = parseSettled(lookupResult);
  const explorerOperation = operation.value;
  const bundlerReceipt = receipt.value;
  const bundlerOperation = lookup.value;

  const sender =
    explorerOperation?.sender ??
    bundlerReceipt?.sender ??
    bundlerOperation?.sender ??
    null;

  if (sender === null) {
    const hadTransportError = [operation.error, receipt.error, lookup.error].some(
      (error) => error instanceof ChainSourceError,
    );
    throw new Error(
      hadTransportError
        ? "BOT Chain sources could not return this UserOperation. Check the hash and try again."
        : `UserOperation not found on ${networkLabel(config.chainId)}. Check the 32-byte hash and try again.`,
    );
  }

  const normalizedSender = safeAddress(sender);
  if (normalizedSender === null) {
    throw new Error("The source returned an invalid UserOperation sender.");
  }
  if (
    normalizedSender.toLowerCase() !== input.agentAccount.toLowerCase()
  ) {
    throw new EvidenceAttributionError(
      `This UserOperation was sent by ${shortenAddress(
        normalizedSender,
      )}, not by the registered smart account ${shortenAddress(
        input.agentAccount,
      )}.`,
    );
  }

  const callData =
    explorerOperation?.callData ?? bundlerOperation?.callData ?? null;
  const outerTransactionHash =
    explorerOperation?.outerTransactionHash ??
    bundlerReceipt?.transactionHash ??
    bundlerOperation?.transactionHash ??
    null;

  const [outerReceiptResult, explorerTransactionResult] = await Promise.allSettled([
    outerTransactionHash
      ? rpc.getTransactionReceipt(outerTransactionHash)
      : Promise.resolve(null),
    outerTransactionHash
      ? explorer.getTransaction(outerTransactionHash)
      : Promise.resolve(null),
  ]);
  const outerReceipt = parseSettled(outerReceiptResult);
  const explorerTransaction = parseSettled(explorerTransactionResult);

  let chainStatus: "success" | "failed" | "pending";
  if (bundlerReceipt) {
    chainStatus =
      bundlerReceipt.success && bundlerReceipt.transactionSuccess
        ? "success"
        : "failed";
  } else if (explorerOperation?.success === false) {
    chainStatus = "failed";
  } else if (explorerOperation?.success === true && outerReceipt.value) {
    chainStatus = outerReceipt.value.success ? "success" : "failed";
  } else if (
    explorerOperation?.success === true &&
    outerTransactionHash === null
  ) {
    chainStatus = "pending";
  } else if (explorerOperation?.success === true) {
    chainStatus = "pending";
  } else {
    chainStatus = "pending";
  }

  const blockNumber =
    outerReceipt.value?.blockNumber ??
    explorerOperation?.blockNumber ??
    bundlerReceipt?.blockNumber ??
    bundlerOperation?.blockNumber ??
    null;

  let confirmedAt = explorerOperation?.timestamp ?? null;
  if (confirmedAt === null && blockNumber !== null && chainStatus !== "pending") {
    try {
      confirmedAt = await rpc.getBlockTimestamp(blockNumber);
    } catch {
      confirmedAt = null;
    }
  }

  const localDecode = decodeAccountCalldata(callData);
  const explorerTarget = safeAddress(explorerOperation?.executeTarget ?? null);
  const explorerMethod = selectorOf(
    explorerOperation?.executeCallData ?? null,
  );
  const decodeNotes: string[] = [];

  let target: Address | null = null;
  let targetSource: ObservedAction["targetSource"] = "unavailable";
  let methodSelector: string | null = null;
  let methodLabel: string | null = null;
  let valueWei: string | null = null;
  let valueSource: ObservedAction["valueSource"] = "unavailable";

  if (localDecode.kind === "decoded") {
    target = localDecode.target;
    targetSource = "decoded_inner";
    valueWei = localDecode.valueWei;
    valueSource = "decoded_inner";
    methodSelector = localDecode.methodSelector;
    methodLabel = localDecode.methodLabel;
    decodeNotes.push(...localDecode.notes);
    if (explorerTarget && explorerTarget.toLowerCase() !== target.toLowerCase()) {
      decodeNotes.push(
        "BOT Scan reports a different inner target than Mandate's decode. Mandate shows its own decode, and this conflict needs review.",
      );
    }
  } else {
    decodeNotes.push(localDecode.reason);
    if (explorerTarget) {
      target = explorerTarget;
      targetSource = "explorer_inner";
      methodSelector = explorerMethod;
      methodLabel = methodSelector ? KNOWN_METHODS[methodSelector] ?? null : null;
      decodeNotes.push(
        "The inner target and selector are shown from BOT Scan because the account envelope could not be decoded locally. The native value is unavailable.",
      );
    }
  }

  if (methodSelector === null) {
    decodeNotes.push("The inner method selector is unavailable.");
  }
  if (valueWei === null) {
    decodeNotes.push("The inner native value is unavailable.");
  }
  if (target === null) {
    decodeNotes.push("The inner target is unavailable.");
  }

  const coverage: ObservedAction["coverage"] =
    target !== null && methodSelector !== null && valueWei !== null
      ? "complete"
      : "partial";

  const outerEnvelopeSelector = selectorOf(callData);
  const outerEnvelopeLabel =
    outerEnvelopeSelector === null
      ? null
      : outerEnvelopeSelector === "0xe9ae5c53"
        ? "Account execute envelope · Kernel"
        : `Account envelope · ${
            KNOWN_METHODS[outerEnvelopeSelector] ?? outerEnvelopeSelector
          }`;

  const sourceNotes = notesForSourceGaps({
    explorerOperation,
    explorerOperationError: operation.error,
    bundlerReceipt,
    bundlerReceiptError: receipt.error,
    explorerTransactionError: explorerTransaction.error,
    outerReceipt: outerReceipt.value,
    outerReceiptError: outerReceipt.error,
  });
  if (explorerOperation === null && bundlerReceipt !== null) {
    sourceNotes.push(
      "UserOperation detail was assembled from the Bundler and RPC because BOT Scan did not return this hash.",
    );
  }
  if (explorerTransaction.value === null) {
    sourceNotes.push("Token movements could not be read from BOT Scan.");
  }

  const observed: ObservedAction = {
    chainId: config.chainId,
    kind: "user_operation",
    sender: normalizedSender,
    target,
    targetSource,
    methodSelector,
    methodLabel,
    valueWei,
    valueSource,
    outerEnvelopeLabel,
    chainStatus,
    outerTransactionHash,
    blockNumber,
    confirmedAt,
    gasUsed:
      bundlerReceipt?.actualGasUsed ??
      explorerOperation?.gasUsed ??
      null,
    gasPriceWei: explorerOperation?.gasPriceWei ?? null,
    feeWei:
      bundlerReceipt?.actualGasCostWei ?? explorerOperation?.feeWei ?? null,
    coverage,
    coverageNotes: uniqueNotes([
      tokenNote,
      ...decodeNotes,
      ...sourceNotes,
    ]),
    tokenMovements: tokenMovementsFrom(explorerTransaction.value),
    explorerUrl: `${config.explorerUrl.replace(/\/$/, "")}/op/${input.hash}`,
    decodedBy:
      localDecode.kind === "decoded"
        ? "mandate"
        : explorerTarget
          ? "explorer"
          : "rpc",
  };

  return {
    kind: "user_operation",
    hash: input.hash,
    observed,
    fetchedAt: new Date().toISOString(),
  };
}

async function fetchTransactionEvidence(
  input: FetchEvidenceInput,
  config: ChainConfig,
  rpc: RpcClient,
  explorer: ExplorerClient,
): Promise<FetchedEvidence> {
  const [transactionResult, receiptResult, explorerTransactionResult] =
    await Promise.allSettled([
      rpc.getTransaction(input.hash),
      rpc.getTransactionReceipt(input.hash),
      explorer.getTransaction(input.hash),
    ]);
  const transaction = parseSettled(transactionResult);
  const receipt = parseSettled(receiptResult);
  const explorerTransaction = parseSettled(explorerTransactionResult);

  if (transaction.value === null) {
    if (transaction.error) {
      throw new Error(
        `Could not read this transaction from the RPC. ${chainError(
          transaction.error,
        )}`,
      );
    }
    throw new Error(
      `Transaction not found on ${networkLabel(config.chainId)}. Check the 32-byte hash and try again.`,
    );
  }

  const tx: RpcTransaction = transaction.value;
  const normalizedSender = safeAddress(tx.from);
  if (normalizedSender === null) {
    throw new Error("The RPC returned an invalid transaction sender.");
  }
  if (
    normalizedSender.toLowerCase() !== input.agentAccount.toLowerCase()
  ) {
    throw new EvidenceAttributionError(
      `This transaction was sent by ${shortenAddress(
        normalizedSender,
      )}, not by the registered smart account ${shortenAddress(
        input.agentAccount,
      )}.`,
    );
  }

  if (
    tx.to &&
    tx.to.toLowerCase() === config.entryPointAddress.toLowerCase()
  ) {
    throw new Error(
      "This is a bundled EntryPoint transaction. Attach the individual UserOperation hash instead.",
    );
  }

  const decoded = decodeDirectTransaction({
    to: tx.to,
    input: tx.input,
    valueWei: tx.valueWei,
  });
  const notes: string[] = [];
  let target: Address | null = null;
  let methodSelector: string | null = null;
  let methodLabel: string | null = null;
  let targetSource: ObservedAction["targetSource"] = "unavailable";

  if (decoded.kind === "decoded") {
    target = decoded.target;
    targetSource = "outer";
    methodSelector = decoded.methodSelector;
    methodLabel = decoded.methodLabel;
    notes.push(...decoded.notes);
  } else {
    notes.push(decoded.reason);
    target = safeAddress(tx.to);
    if (target) targetSource = "outer";
    notes.push("The method selector is unavailable for this transaction.");
  }

  const chainStatus = outerStatus(receipt.value);
  const blockNumber =
    receipt.value?.blockNumber ?? explorerTransaction.value?.blockNumber ?? null;
  let confirmedAt = explorerTransaction.value?.timestamp ?? null;
  if (confirmedAt === null && blockNumber !== null && receipt.value !== null) {
    try {
      confirmedAt = await rpc.getBlockTimestamp(blockNumber);
    } catch {
      confirmedAt = null;
    }
  }

  const gasUsed = receipt.value?.gasUsedWei ?? null;
  const gasPrice = receipt.value?.effectiveGasPriceWei ?? null;
  const fee =
    gasUsed !== null && gasPrice !== null
      ? (BigInt(gasUsed) * BigInt(gasPrice)).toString()
      : null;

  const sourceNotes: string[] = [];
  if (receipt.error) {
    sourceNotes.push("The transaction receipt could not be read from the RPC.");
  }
  if (explorerTransaction.error) {
    sourceNotes.push("BOT Scan token movements were unavailable.");
  }
  if (explorerTransaction.value === null) {
    sourceNotes.push("Token movements could not be read from BOT Scan.");
  }

  const observed: ObservedAction = {
    chainId: config.chainId,
    kind: "transaction",
    sender: normalizedSender,
    target,
    targetSource,
    methodSelector,
    methodLabel,
    valueWei: tx.valueWei,
    valueSource: "outer",
    outerEnvelopeLabel: null,
    chainStatus,
    outerTransactionHash: tx.hash,
    blockNumber,
    confirmedAt,
    gasUsed,
    gasPriceWei: gasPrice,
    feeWei: fee,
    coverage:
      target !== null && methodSelector !== null ? "complete" : "partial",
    coverageNotes: uniqueNotes([tokenNote, ...notes, ...sourceNotes]),
    tokenMovements: tokenMovementsFrom(explorerTransaction.value),
    explorerUrl: `${config.explorerUrl.replace(/\/$/, "")}/tx/${input.hash}`,
    decodedBy: "rpc",
  };

  return {
    kind: "transaction",
    hash: input.hash,
    observed,
    fetchedAt: new Date().toISOString(),
  };
}

export async function fetchEvidence(
  input: FetchEvidenceInput,
): Promise<FetchedEvidence> {
  const config = input.config;
  const rpc = new RpcClient(config.rpcUrl);
  await verifyNetwork(config, rpc);
  const explorer = new ExplorerClient(config.explorerApiUrl);
  const bundler = new BundlerClient(config.bundlerUrl);

  if (input.kind === "user_operation") {
    return fetchUserOperationEvidence(input, config, rpc, explorer, bundler);
  }
  return fetchTransactionEvidence(input, config, rpc, explorer);
}

export function nativeTransferSelector(): string {
  return NATIVE_TRANSFER_SELECTOR;
}
