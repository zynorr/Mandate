"use client";

import { useEffect, useState } from "react";
import {
  createPublicClient,
  createWalletClient,
  custom,
  http,
  type Address,
  type Hex,
} from "viem";

type WalletProvider = {
  isMetaMask?: boolean;
  request(args: { method: string; params?: unknown[] }): Promise<unknown>;
};

declare global {
  interface Window {
    ethereum?: WalletProvider & { providers?: WalletProvider[] };
  }
}

const anchorAbi = [
  {
    type: "function",
    name: "anchor",
    stateMutability: "nonpayable",
    inputs: [
      { name: "contentHash", type: "bytes32" },
      { name: "kind", type: "uint8" },
    ],
    outputs: [],
  },
] as const;

const kinds = [
  ["policy", "Policy hash"],
  ["intent", "Intent fingerprint"],
  ["report", "Report fingerprint"],
  ["evidence", "Evidence hash"],
] as const;

const kindValues = {
  policy: 0,
  intent: 1,
  report: 2,
  evidence: 3,
} as const;

function errorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  return "The wallet request could not be completed.";
}

function providerFromWindow(): WalletProvider | null {
  const injected = window.ethereum;
  if (!injected) return null;
  return injected.providers?.find((provider) => provider.isMetaMask) ?? injected;
}

async function providerChainId(provider: {
  request(args: { method: string; params?: unknown[] }): Promise<unknown>;
}): Promise<{ id: number; raw: string }> {
  const raw = await provider.request({ method: "eth_chainId" });
  if (typeof raw !== "string" || !/^0x[0-9a-f]+$/i.test(raw)) {
    throw new Error("The wallet returned an invalid chain ID.");
  }
  return { id: Number.parseInt(raw.slice(2), 16), raw };
}

function rpcErrorCode(error: unknown): number | undefined {
  if (typeof error === "object" && error !== null && "code" in error) {
    const code = (error as { code?: unknown }).code;
    return typeof code === "number" ? code : undefined;
  }
  return undefined;
}

async function ensureWalletChain(
  provider: WalletProvider,
  input: {
    chainId: number;
    networkName: string;
    rpcUrl: string;
    explorerUrl: string;
  },
) {
  const expectedHex = `0x${input.chainId.toString(16)}`;
  const current = await providerChainId(provider);
  if (current.id === input.chainId) return current;

  try {
    await provider.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: expectedHex }],
    });
  } catch (error) {
    if (rpcErrorCode(error) !== 4902) throw error;
    await provider.request({
      method: "wallet_addEthereumChain",
      params: [
        {
          chainId: expectedHex,
          chainName: input.networkName,
          nativeCurrency: { name: "BOT", symbol: "BOT", decimals: 18 },
          rpcUrls: [input.rpcUrl],
          blockExplorerUrls: [input.explorerUrl],
        },
      ],
    });
  }

  const switched = await providerChainId(provider);
  if (switched.id !== input.chainId) {
    throw new Error(
      `MetaMask is still reporting chain ${switched.id} (${switched.raw}); expected ${input.networkName} (${input.chainId}).`,
    );
  }
  return switched;
}

export function WalletAnchor({
  contentHash,
  validHash,
  chainId,
  networkName,
  rpcUrl,
  registryAddress,
  explorerUrl,
}: {
  contentHash: string;
  validHash: boolean;
  chainId: number;
  networkName: string;
  rpcUrl: string;
  registryAddress: Address;
  explorerUrl: string;
}) {
  const [detectedProvider, setDetectedProvider] = useState<WalletProvider | null>(
    () => (typeof window === "undefined" ? null : providerFromWindow()),
  );
  const [kind, setKind] = useState<(typeof kinds)[number][0]>("report");
  const [account, setAccount] = useState<Address | null>(null);
  const [status, setStatus] = useState<"idle" | "connecting" | "sending" | "waiting" | "done" | "error">("idle");
  const [message, setMessage] = useState("");
  const [transactionHash, setTransactionHash] = useState<Hex | null>(null);

  useEffect(() => {
    const announce = (event: Event) => {
      const detail = (event as CustomEvent<{ provider?: WalletProvider; info?: { rdns?: string } }>).detail;
      if (detail?.provider && (detail.provider.isMetaMask || detail.info?.rdns?.includes("metamask"))) {
        setDetectedProvider(detail.provider);
      }
    };
    window.addEventListener("eip6963:announceProvider", announce);
    window.dispatchEvent(new Event("eip6963:requestProvider"));
    return () => window.removeEventListener("eip6963:announceProvider", announce);
  }, []);

  async function connectWallet(): Promise<Address | null> {
    const provider = detectedProvider ?? providerFromWindow();
    if (!provider) {
      setStatus("error");
      setMessage("MetaMask was not detected. Open Mandate in a browser with the MetaMask extension enabled, or use MetaMask Mobile's in-app browser.");
      return null;
    }
    const chain = {
      id: chainId,
      name: networkName,
      nativeCurrency: { name: "BOT", symbol: "BOT", decimals: 18 },
      rpcUrls: { default: { http: [rpcUrl] } },
      blockExplorers: { default: { name: "BOT Scan", url: explorerUrl } },
    } as const;
    const walletClient = createWalletClient({
      chain,
      transport: custom(provider),
    });
    const [connectedAccount] = await walletClient.requestAddresses();
    if (!connectedAccount) {
      throw new Error("MetaMask did not return an account. Approve account access and try again.");
    }
    await ensureWalletChain(provider, {
      chainId,
      networkName,
      rpcUrl,
      explorerUrl,
    });
    setAccount(connectedAccount);
    return connectedAccount;
  }

  async function connectAndAnchor() {
    const provider = detectedProvider ?? providerFromWindow();
    if (!provider) {
      setStatus("error");
      setMessage("MetaMask was not detected. Open Mandate in a browser with the MetaMask extension enabled, or use MetaMask Mobile's in-app browser.");
      return;
    }
    if (!/^0x[0-9a-fA-F]{64}$/.test(contentHash)) {
      setStatus("error");
      setMessage("Enter a valid 32-byte content hash before anchoring.");
      return;
    }

    try {
      setStatus("connecting");
      setMessage("");
      const chain = {
        id: chainId,
        name: networkName,
        nativeCurrency: { name: "BOT", symbol: "BOT", decimals: 18 },
        rpcUrls: { default: { http: [rpcUrl] } },
        blockExplorers: { default: { name: "BOT Scan", url: explorerUrl } },
      } as const;
      const walletClient = createWalletClient({
        chain,
        transport: custom(provider),
      });
      const [connectedAccount] = await walletClient.requestAddresses();
      if (!connectedAccount) {
        throw new Error("MetaMask did not return an account. Approve account access and try again.");
      }
      await ensureWalletChain(provider, {
        chainId,
        networkName,
        rpcUrl,
        explorerUrl,
      });
      setAccount(connectedAccount);
      setStatus("sending");
      const hash = await walletClient.writeContract({
        account: connectedAccount,
        address: registryAddress,
        abi: anchorAbi,
        functionName: "anchor",
        args: [contentHash as Hex, kindValues[kind]],
      });
      setTransactionHash(hash);
      setStatus("waiting");
      const publicClient = createPublicClient({ chain, transport: http(rpcUrl) });
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      if (receipt.status !== "success") throw new Error("The anchor transaction reverted.");
      setStatus("done");
      setMessage("The hash is now recorded on chain.");
    } catch (error) {
      setStatus("error");
      setMessage(errorMessage(error));
    }
  }

  async function handleWalletAction() {
    if (!validHash) {
      try {
        setStatus("connecting");
        setMessage("");
        const connected = await connectWallet();
        if (connected) {
          setStatus("done");
          setMessage("Wallet connected. Enter a valid hash above to create an anchor.");
        }
      } catch (error) {
        setStatus("error");
        setMessage(errorMessage(error));
      }
      return;
    }
    await connectAndAnchor();
  }

  const busy = status === "connecting" || status === "sending" || status === "waiting";
  return (
    <section className="card wallet-anchor-card">
      <div className="card-head">
        <div>
          <p className="field-label">Optional on-chain publishing</p>
          <h2>Publish this hash</h2>
          <p>{validHash ? "Connect a wallet only if you want to publish this hash. You approve and pay for the transaction." : "Enter a valid hash above before publishing it on chain."}</p>
        </div>
      </div>
      <div className="card-body">
        <div className="wallet-anchor-controls">
          <label className="field">
            <span className="field-label">Record type</span>
            <select value={kind} onChange={(event) => setKind(event.target.value as typeof kind)} disabled={busy}>
              {kinds.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>
          <button type="button" className="button button-ink" onClick={handleWalletAction} disabled={busy}>
            {busy ? status === "waiting" ? "Waiting for confirmation…" : "Waiting for wallet…" : validHash ? status === "done" ? "Anchor another hash" : "Connect wallet & anchor" : account ? "Wallet connected" : "Connect wallet"}
          </button>
        </div>
        <p className="form-actions-note">
          You pay the {networkName} gas fee directly from {account ? `${account.slice(0, 6)}…${account.slice(-4)}` : "your connected wallet"}.
        </p>
        {message ? <p className={status === "error" ? "wallet-anchor-message error" : "wallet-anchor-message"}>{message}</p> : null}
        {transactionHash ? <p className="small-muted"><a className="text-link" href={`${explorerUrl}/tx/${transactionHash}`} target="_blank" rel="noreferrer">View transaction on BOT Scan</a></p> : null}
      </div>
    </section>
  );
}
