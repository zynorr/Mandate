import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createPublicClient, createWalletClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import {
  requireMainnetConfirmation,
  resolveDeploymentTarget,
} from "./networks.mjs";

const contractsDir = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(contractsDir, "..");
const envPath = path.join(rootDir, ".env.deploy.local");
const artifactPath = path.join(
  contractsDir,
  "artifacts",
  "MandateAnchorRegistry.json",
);

const kinds = {
  policy: 0,
  intent: 1,
  report: 2,
  evidence: 3,
};

const args = process.argv.slice(2);
const kindName = args[args.indexOf("--kind") + 1];
const contentHash = args[args.indexOf("--hash") + 1];
const kind = kinds[kindName];

if (kind === undefined) {
  throw new Error("Pass --kind policy|intent|report|evidence");
}
if (!contentHash?.match(/^0x[0-9a-fA-F]{64}$/)) {
  throw new Error("Pass a 32-byte --hash value");
}
if (!fs.existsSync(artifactPath) || !fs.existsSync(deploymentPath)) {
  throw new Error("Compile and deploy the registry before anchoring");
}

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
const { network, rpcUrl } = resolveDeploymentTarget({
  BOT_CHAIN_ID: process.env.BOT_CHAIN_ID ?? fileEnv.BOT_CHAIN_ID,
  BOT_RPC_URL: process.env.BOT_RPC_URL ?? fileEnv.BOT_RPC_URL,
});
const deploymentPath = path.join(
  contractsDir,
  "deployments",
  `${network.chainId}.json`,
);

if (!privateKey?.match(/^0x[0-9a-fA-F]{64}$/)) {
  throw new Error("DEPLOYER_PRIVATE_KEY is missing or malformed");
}

const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf8"));
const deployment = JSON.parse(fs.readFileSync(deploymentPath, "utf8"));
if (deployment.chainId !== network.chainId) {
  throw new Error(
    `Deployment record ${deploymentPath} is for chain ${deployment.chainId}, not ${network.name} (${network.chainId}).`,
  );
}
const chain = {
  id: network.chainId,
  name: network.name,
  nativeCurrency: network.nativeCurrency,
  rpcUrls: { default: { http: [rpcUrl] } },
  blockExplorers: {
    default: { name: network.explorerName, url: network.explorerUrl },
  },
};
const account = privateKeyToAccount(privateKey);
const publicClient = createPublicClient({ chain, transport: http(rpcUrl) });
const walletClient = createWalletClient({
  account,
  chain,
  transport: http(rpcUrl),
});

const actualChainId = await publicClient.getChainId();
if (actualChainId !== network.chainId) {
  throw new Error(
    `The RPC reports chain ${actualChainId}; expected ${network.name} (${network.chainId}). Set BOT_CHAIN_ID and BOT_RPC_URL for the intended network.`,
  );
}

const [recorder, timestamp, existingKind, exists] = await publicClient.readContract(
  {
    address: deployment.address,
    abi: artifact.abi,
    functionName: "getAnchor",
    args: [contentHash],
  },
);

if (exists) {
  console.log(
    JSON.stringify(
      {
        alreadyAnchored: true,
        address: deployment.address,
        contentHash,
        kind: Number(existingKind),
        recorder,
        timestamp: new Date(Number(timestamp) * 1000).toISOString(),
      },
      null,
      2,
    ),
  );
  process.exit(0);
}

requireMainnetConfirmation(network, process.env);

const hash = await walletClient.writeContract({
  address: deployment.address,
  abi: artifact.abi,
  functionName: "anchor",
  args: [contentHash, kind],
});
const receipt = await publicClient.waitForTransactionReceipt({ hash });
if (receipt.status !== "success") {
  throw new Error(`Anchor transaction failed: ${hash}`);
}

console.log(
  JSON.stringify(
    {
      address: deployment.address,
      contentHash,
      kind: kindName,
      recorder: account.address,
      transactionHash: receipt.transactionHash,
      blockNumber: receipt.blockNumber.toString(),
      explorer: `${chain.blockExplorers.default.url}/tx/${receipt.transactionHash}`,
    },
    null,
    2,
  ),
);
