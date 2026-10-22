import "server-only";

import {
  ExplorerClient,
  discoveryCandidateSchema,
  type DiscoveryCandidate,
  type ExplorerCandidate,
} from "@mandate/chain";
import { getChainConfig } from "./config";
import { listEvidence, type AppAgent } from "./repo";

export interface DiscoveryResult {
  scannedAt: string;
  candidates: DiscoveryCandidate[];
  errors: string[];
}

export async function discoverAgentActivity(
  agent: AppAgent,
  limitPerSource = 12,
): Promise<DiscoveryResult> {
  const config = getChainConfig();
  const explorer = new ExplorerClient(config.explorerApiUrl);
  const errors: string[] = [];
  const [operations, transactions] = await Promise.allSettled([
    explorer.listUserOperations(agent.smartAccount, limitPerSource),
    explorer.listAddressTransactions(agent.smartAccount, limitPerSource),
  ]);

  const rawCandidates: ExplorerCandidate[] = [];
  if (operations.status === "fulfilled") {
    rawCandidates.push(...operations.value);
  } else {
    errors.push(
      operations.reason instanceof Error
        ? `UserOperations: ${operations.reason.message}`
        : "UserOperations could not be scanned.",
    );
  }
  if (transactions.status === "fulfilled") {
    rawCandidates.push(...transactions.value);
  } else {
    errors.push(
      transactions.reason instanceof Error
        ? `Transactions: ${transactions.reason.message}`
        : "Transactions could not be scanned.",
    );
  }

  const existing = new Set(
    listEvidence({ agentId: agent.id, limit: 1000 }).map(
      (record) => `${record.kind}:${record.hash}`,
    ),
  );
  const seen = new Set<string>();
  const candidates: DiscoveryCandidate[] = [];
  for (const candidate of rawCandidates) {
    const key = `${candidate.kind}:${candidate.hash}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const parsed = discoveryCandidateSchema.safeParse({
      key,
      kind: candidate.kind,
      hash: candidate.hash,
      outerTransactionHash: candidate.outerTransactionHash,
      target: candidate.target,
      methodLabel: candidate.methodLabel,
      valueWei: candidate.valueWei,
      chainStatus: candidate.status,
      timestamp: candidate.timestamp,
      blockNumber: candidate.blockNumber,
      alreadyAttached: existing.has(key),
    });
    if (parsed.success) candidates.push(parsed.data);
  }

  candidates.sort((a, b) => {
    const aTime = a.timestamp ? Date.parse(a.timestamp) : 0;
    const bTime = b.timestamp ? Date.parse(b.timestamp) : 0;
    return bTime - aTime;
  });

  return {
    scannedAt: new Date().toISOString(),
    candidates,
    errors,
  };
}
