export const BOT_MAINNET_CHAIN_ID = 677 as const;
export const BOT_TESTNET_CHAIN_ID = 968 as const;

export interface BotNetwork {
  chainId: number;
  name: string;
  rpcUrl: string;
  bundlerUrl: string;
  explorerUrl: string;
  explorerApiUrl: string;
  entryPointAddress: `0x${string}`;
}

export const BOT_MAINNET = {
  chainId: BOT_MAINNET_CHAIN_ID,
  name: "BOT Chain Mainnet",
  rpcUrl: "https://rpc.botchain.ai",
  bundlerUrl: "https://bundler.botchain.ai/rpc/",
  explorerUrl: "https://scan.botchain.ai",
  explorerApiUrl: "https://scan.botchain.ai/api/v2",
  entryPointAddress: "0x0000000071727De22E5E9d8BAf0edAc6f37da032",
} as const satisfies BotNetwork;

export const BOT_TESTNET = {
  chainId: BOT_TESTNET_CHAIN_ID,
  name: "BOT Chain Bohr Testnet",
  rpcUrl: "https://rpc.bohr.life",
  bundlerUrl: "https://bundler.bohr.life/rpc/",
  explorerUrl: "https://scan.bohr.life",
  explorerApiUrl: "https://scan.bohr.life/api/v2",
  entryPointAddress: "0x0000000071727De22E5E9d8BAf0edAc6f37da032",
} as const satisfies BotNetwork;

export const BOT_NETWORKS: Record<number, BotNetwork> = {
  [BOT_MAINNET_CHAIN_ID]: BOT_MAINNET,
  [BOT_TESTNET_CHAIN_ID]: BOT_TESTNET,
};

export const KNOWN_CHAIN_IDS = [
  BOT_MAINNET_CHAIN_ID,
  BOT_TESTNET_CHAIN_ID,
] as const;

export type KnownChainId = (typeof KNOWN_CHAIN_IDS)[number];

export function isKnownChainId(chainId: number): chainId is KnownChainId {
  return KNOWN_CHAIN_IDS.includes(chainId as KnownChainId);
}

export function networkFor(chainId: number): BotNetwork | null {
  return isKnownChainId(chainId) ? BOT_NETWORKS[chainId] ?? null : null;
}

export function networkName(chainId: number): string {
  return networkFor(chainId)?.name ?? `Chain ${chainId}`;
}

export function networkLabel(chainId: number): string {
  switch (chainId) {
    case BOT_MAINNET_CHAIN_ID:
      return "BOT Chain mainnet";
    case BOT_TESTNET_CHAIN_ID:
      return "BOT Chain testnet";
    default:
      return `Chain ${chainId}`;
  }
}

export const OFFICIAL_LINKS = {
  botChain: "https://www.botchain.ai/en/",
  explorer: "https://scan.botchain.ai",
  docs: "https://dev-docs.botchain.ai/",
} as const;

export const NATIVE_TRANSFER_SELECTOR = "0x00000000";
export const NATIVE_TRANSFER_LABEL = "Native transfer";

export const KNOWN_METHODS: Record<string, string> = {
  [NATIVE_TRANSFER_SELECTOR]: NATIVE_TRANSFER_LABEL,
  "0xa9059cbb": "transfer(address,uint256)",
  "0x095ea7b3": "approve(address,uint256)",
  "0x23b872dd": "transferFrom(address,address,uint256)",
  "0x39509351": "increaseAllowance(address,uint256)",
  "0xa22cb465": "setApprovalForAll(address,bool)",
  "0x2e1a7d4d": "withdraw(uint256)",
  "0xd0e30db0": "deposit()",
  "0x70a08231": "balanceOf(address)",
  "0x6352211e": "ownerOf(uint256)",
  "0x42842e0e": "safeTransferFrom(address,address,uint256)",
  "0xb88d4fde": "safeTransferFrom(address,address,uint256,bytes)",
  "0x6a761202": "execTransaction(...)",
  "0x468721a7": "execute(address,uint256,bytes,uint8)",
  "0xb61d27f6": "execute(address,uint256,bytes)",
  "0x47e1da2a": "executeBatch(address[],uint256[],bytes[])",
  "0xe9ae5c53": "execute(bytes32,bytes)",
};

export const SAMPLE_USER_OPERATION_HASH =
  "0xcab1d7788d6c6109c769700f29c338fae29dec0e8ecf7b28514a8b61681fc41e";
export const SAMPLE_USER_OPERATION_TX_HASH =
  "0x3a90085d766fd4bbf90a2bc563ef4033c96fdb0c3b376dee183cdd1febf991e8";
export const SAMPLE_SMART_ACCOUNT =
  "0xa682DB3Da0F37853CaB81F7aC538E067F72CF252";
