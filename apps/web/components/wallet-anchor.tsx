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
    const walletChain = await providerChainId(provider);
    if (walletChain.id !== chainId) {
      setStatus("error");
      setMessage(`Your wallet reports chain ${walletChain.id} (${walletChain.raw}). Switch MetaMask to ${networkName} (chain ID ${chainId}) and try again.`);
      return null;
    }
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
      const walletChain = await providerChainId(provider);
      if (walletChain.id !== chainId) {
        setStatus("error");
        setMessage(`Your wallet reports chain ${walletChain.id} (${walletChain.raw}). Switch MetaMask to ${networkName} (chain ID ${chainId}) and try again.`);
        return;
      }
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
          <p className="field-label">User-paid on-chain proof</p>
          <h2>Anchor this hash</h2>
          <p>{validHash ? "Connect a wallet and approve the transaction. Mandate never sees your private key." : "Connect your wallet here, then enter a hash above when you are ready to anchor."}</p>
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
