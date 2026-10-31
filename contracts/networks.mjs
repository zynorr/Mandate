export const NETWORKS = {
  677: {
    chainId: 677,
    name: "BOT Chain Mainnet",
    nativeCurrency: { name: "BOT", symbol: "BOT", decimals: 18 },
    explorerName: "BOT Scan",
    explorerUrl: "https://scan.botchain.ai",
    rpcUrl: "https://rpc.botchain.ai",
    isMainnet: true,
  },
  968: {
    chainId: 968,
    name: "BOT Chain Bohr Testnet",
    nativeCurrency: { name: "BOT", symbol: "BOT", decimals: 18 },
    explorerName: "BOT Scan",
    explorerUrl: "https://scan.bohr.life",
    rpcUrl: "https://rpc.bohr.life",
    isMainnet: false,
  },
};

export function networkFor(chainId) {
  return NETWORKS[chainId] ?? null;
}

export function resolveDeploymentTarget(env) {
  const raw = env.BOT_CHAIN_ID;
  const chainId = raw === undefined || raw === "" ? 968 : Number(raw);
  const network = networkFor(chainId);
  if (!network) {
    throw new Error(
      `Unsupported BOT_CHAIN_ID ${raw}. Use 677 (BOT Chain mainnet) or 968 (BOT Chain testnet).`,
    );
  }
  const rpcUrl = env.BOT_RPC_URL ?? network.rpcUrl;
  if (network.isMainnet && rpcUrl !== network.rpcUrl) {
    throw new Error(
      `Custom RPC URLs are disabled for mainnet deployment. Use the configured BOT Chain mainnet RPC.`,
    );
  }
  return { network, rpcUrl };
}

export function requireMainnetConfirmation(network, env) {
  if (network.isMainnet && env.DEPLOY_CONFIRM_MAINNET !== "1") {
    throw new Error(
      `Refusing to send a mainnet transaction on ${network.name}. Set DEPLOY_CONFIRM_MAINNET=1 in the shell to confirm this is intentional.`,
    );
  }
}
