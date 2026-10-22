import "server-only";

import {
  lookupAnchor,
  readAnchorCount,
  type AnchorLookup,
} from "@mandate/chain";
import { getAppConfig } from "./config";

export async function getAnchorLookup(
  contentHash: `0x${string}`,
): Promise<AnchorLookup | { state: "disabled" }> {
  const config = getAppConfig();
  if (!config.anchorRegistryAddress) return { state: "disabled" };
  return lookupAnchor({
    registryAddress: config.anchorRegistryAddress,
    rpcUrl: config.rpcUrl,
    contentHash,
  });
}

export async function getAnchorCount(): Promise<bigint | null> {
  const config = getAppConfig();
  if (!config.anchorRegistryAddress) return null;
  return readAnchorCount(config.anchorRegistryAddress, config.rpcUrl);
}

export function getAnchorRegistry() {
  const config = getAppConfig();
  return {
    address: config.anchorRegistryAddress,
    explorerUrl: config.explorerUrl,
  };
}
