import {
  createPublicClient,
  http,
  parseAbi,
  type Address,
  type Hex,
} from "viem";

export const anchorRegistryAbi = parseAbi([
  "function getAnchor(bytes32 contentHash) view returns (address recorder, uint64 timestamp, uint8 kind, bool exists)",
  "function totalAnchors() view returns (uint256)",
  "event Anchored(bytes32 indexed contentHash, uint8 indexed kind, address indexed recorder, uint64 timestamp)",
]);

export const anchorKindNames = [
  "policy",
  "intent",
  "report",
  "evidence",
] as const;

export type AnchorKindName = (typeof anchorKindNames)[number];

export type AnchorLookup =
  | {
      state: "anchored";
      recorder: Address;
      timestamp: string;
      kind: AnchorKindName | "unknown";
    }
  | { state: "missing" }
  | { state: "unavailable" };

export interface AnchorLookupInput {
  registryAddress: Address;
  rpcUrl: string;
  contentHash: Hex;
}

const anchorClient = (rpcUrl: string) =>
  createPublicClient({
    transport: http(rpcUrl, { timeout: 8_000, retryCount: 1 }),
  });

export function anchorKindName(kind: number): AnchorKindName | "unknown" {
  return anchorKindNames[kind] ?? "unknown";
}

export async function lookupAnchor({
  registryAddress,
  rpcUrl,
  contentHash,
}: AnchorLookupInput): Promise<AnchorLookup> {
  try {
    const [recorder, timestamp, kind, exists] =
      await anchorClient(rpcUrl).readContract({
        address: registryAddress,
        abi: anchorRegistryAbi,
        functionName: "getAnchor",
        args: [contentHash],
      });
    if (!exists) return { state: "missing" };
    return {
      state: "anchored",
      recorder,
      timestamp: new Date(Number(timestamp) * 1000).toISOString(),
      kind: anchorKindName(Number(kind)),
    };
  } catch {
    return { state: "unavailable" };
  }
}

export async function readAnchorCount(
  registryAddress: Address,
  rpcUrl: string,
): Promise<bigint | null> {
  try {
    return await anchorClient(rpcUrl).readContract({
      address: registryAddress,
      abi: anchorRegistryAbi,
      functionName: "totalAnchors",
    });
  } catch {
    return null;
  }
}
