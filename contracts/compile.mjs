import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import solc from "solc";

const contractsDir = path.dirname(fileURLToPath(import.meta.url));
const sourceName = "MandateAnchorRegistry.sol";
const sourcePath = path.join(contractsDir, sourceName);
const source = fs.readFileSync(sourcePath, "utf8");

const input = {
  language: "Solidity",
  sources: {
    [sourceName]: { content: source },
  },
  settings: {
    optimizer: { enabled: true, runs: 200 },
    evmVersion: "paris",
    metadata: { bytecodeHash: "none", appendCBOR: false },
    outputSelection: {
      "*": {
        "*": ["abi", "evm.bytecode.object", "evm.deployedBytecode.object"],
      },
    },
  },
};

const output = JSON.parse(solc.compile(JSON.stringify(input)));
const errors = (output.errors ?? []).filter(
  (error) => error.severity === "error",
);
if (errors.length > 0) {
  for (const error of errors) {
    console.error(error.formattedMessage ?? error.message);
  }
  process.exit(1);
}

const compiled = output.contracts?.[sourceName]?.MandateAnchorRegistry;
if (!compiled) {
  throw new Error("MandateAnchorRegistry artifact was not produced");
}

const bytecode = `0x${compiled.evm.bytecode.object}`;
const deployedBytecode = `0x${compiled.evm.deployedBytecode.object}`;
const runtimeBytes = (deployedBytecode.length - 2) / 2;
if (bytecode === "0x" || deployedBytecode === "0x") {
  throw new Error("MandateAnchorRegistry bytecode is empty");
}
if (runtimeBytes > 24576) {
  throw new Error(`Runtime bytecode is too large: ${runtimeBytes} bytes`);
}

const artifact = {
  contractName: "MandateAnchorRegistry",
  sourceName,
  compiler: solc.version(),
  sourceHash: `0x${createHash("sha256").update(source).digest("hex")}`,
  abi: compiled.abi,
  bytecode,
  deployedBytecode,
  runtimeBytes,
};

const artifactsDir = path.join(contractsDir, "artifacts");
fs.mkdirSync(artifactsDir, { recursive: true });
const artifactPath = path.join(artifactsDir, "MandateAnchorRegistry.json");
fs.writeFileSync(artifactPath, `${JSON.stringify(artifact, null, 2)}\n`);

console.log(
  JSON.stringify({
    artifact: path.relative(process.cwd(), artifactPath),
    compiler: artifact.compiler,
    sourceHash: artifact.sourceHash,
    runtimeBytes,
  }),
);
