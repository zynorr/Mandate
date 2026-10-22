import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createPublicClient, createWalletClient, formatEther, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";

const contractsDir = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(contractsDir, "..");
const envPath = path.join(rootDir, ".env.deploy.local");
const artifactPath = path.join(
  contractsDir,
  "artifacts",
  "MandateAnchorRegistry.json",
);
const deploymentPath = path.join(contractsDir, "deployments", "968.json");

const readEnvFile = (filePath) => {
  if (!fs.existsSync(filePath)) return {};
  const values = {};
  for (const line of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (match) values[match[1]] = match[2].trim();
  }
  return values;
};

const fileEnv = readEnvFile(envPath);
const privateKey = process.env.DEPLOYER_PRIVATE_KEY ?? fileEnv.DEPLOYER_PRIVATE_KEY;
const rpcUrl =
  process.env.BOT_RPC_URL ?? fileEnv.BOT_RPC_URL ?? "https://rpc.bohr.life";

if (!privateKey?.match(/^0x[0-9a-fA-F]{64}$/)) {
  throw new Error("DEPLOYER_PRIVATE_KEY is missing or malformed");
}
if (!fs.existsSync(artifactPath)) {
  throw new Error("Compile the contract before deploying");
}

const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf8"));
const chain = {
  id: 968,
  name: "BOT Chain Bohr Testnet",
  nativeCurrency: { name: "BOT", symbol: "BOT", decimals: 18 },
  rpcUrls: { default: { http: [rpcUrl] } },
  blockExplorers: {
    default: { name: "BOT Scan", url: "https://scan.bohr.life" },
  },
};
const account = privateKeyToAccount(privateKey);
const publicClient = createPublicClient({ chain, transport: http(rpcUrl) });
const walletClient = createWalletClient({
  account,
  chain,
  transport: http(rpcUrl),
});

const chainId = await publicClient.getChainId();
if (chainId !== 968) {
  throw new Error(`Refusing deployment on chain ${chainId}; expected 968`);
}

if (fs.existsSync(deploymentPath)) {
  const existing = JSON.parse(fs.readFileSync(deploymentPath, "utf8"));
  if (existing.address) {
    const code = await publicClient.getCode({ address: existing.address });
    if (code && code !== "0x") {
      console.log(
        JSON.stringify(
          {
            alreadyDeployed: true,
            ...existing,
            explorer: `${chain.blockExplorers.default.url}/address/${existing.address}`,
          },
          null,
          2,
        ),
      );
      process.exit(0);
    }
  }
}

const balance = await publicClient.getBalance({ address: account.address });
if (balance === 0n) {
  throw new Error(`Deployer ${account.address} has no testnet BOT`);
}

const hash = await walletClient.deployContract({
  abi: artifact.abi,
  bytecode: artifact.bytecode,
  args: [],
});
const receipt = await publicClient.waitForTransactionReceipt({ hash });
if (receipt.status !== "success" || !receipt.contractAddress) {
  throw new Error(`Deployment failed: ${hash}`);
}

const code = await publicClient.getCode({ address: receipt.contractAddress });
if (!code || code === "0x") {
  throw new Error("Deployment receipt succeeded but no contract code exists");
}

const deployment = {
  contractName: artifact.contractName,
  chainId,
  address: receipt.contractAddress,
  transactionHash: receipt.transactionHash,
  blockNumber: receipt.blockNumber.toString(),
  deployer: account.address,
  deployerBalanceBOT: formatEther(balance),
  deployedAt: new Date().toISOString(),
  compiler: artifact.compiler,
  sourceHash: artifact.sourceHash,
  runtimeBytes: artifact.runtimeBytes,
};

fs.mkdirSync(path.dirname(deploymentPath), { recursive: true });
fs.writeFileSync(deploymentPath, `${JSON.stringify(deployment, null, 2)}\n`);

console.log(
  JSON.stringify(
    {
      ...deployment,
      explorer: `${chain.blockExplorers.default.url}/address/${deployment.address}`,
      transaction: `${chain.blockExplorers.default.url}/tx/${deployment.transactionHash}`,
    },
    null,
    2,
  ),
);
