import Link from "next/link";
import { formatDateTime } from "@mandate/chain";
import { ArrowRightIcon, SourceIcon } from "@/components/icons";
import { PageHeader } from "@/components/ui";
import { getAppConfig } from "@/lib/config";
import { readSourceHealth } from "@/lib/source-health";

export const metadata = {
  title: "Source health",
};

const statusLabel = {
  ok: "All sources responding",
  degraded: "Partial source availability",
  down: "RPC unavailable",
} as const;

export default async function SourcesPage() {
  const config = getAppConfig();
  const health = await readSourceHealth();

  return (
    <>
      <PageHeader
        eyebrow="Network status"
        title="Source health"
        description={`Live checks for ${config.networkName} RPC, Bundler, BOT Scan, and the account-abstraction index. A failed check can reduce coverage or block attachment.`}
        actions={
          <Link href="/app/sources?check=1" className="button button-ghost">
            Check again
          </Link>
        }
      />

      <div className={`health-banner health-${health.status}`}>
        <div>
          <p className="eyebrow">Last check</p>
          <h2>{statusLabel[health.status]}</h2>
          <p className="health-time">{formatDateTime(health.checkedAt)}</p>
        </div>
        <SourceIcon size={30} />
      </div>

      <div className="source-grid">
        {health.checks.map((check) => (
          <article key={check.id} className="source-card">
            <div>
              <h3>{check.label}</h3>
              <p>{check.detail}</p>
              <p className="source-latency">{check.latencyMs} ms</p>
            </div>
            <span
              className={`source-status ${
                check.status === "ok" ? "source-ok" : "source-down"
              }`}
            >
              {check.status === "ok" ? "Responding" : "Not responding"}
            </span>
          </article>
        ))}
      </div>

      <div className="split-grid source-detail-grid">
        <div className="card">
          <div className="card-head">
            <div>
              <h2>Configured endpoints</h2>
              <p>
                {config.networkName} · chain ID {config.chainId}
              </p>
            </div>
          </div>
          <div className="card-body">
            <div className="detail-list">
              <div className="detail-row">
                <dt>RPC</dt>
                <dd className="detail-value-mono">{config.rpcUrl}</dd>
              </div>
              <div className="detail-row">
                <dt>Bundler</dt>
                <dd className="detail-value-mono">{config.bundlerUrl}</dd>
              </div>
              <div className="detail-row">
                <dt>Explorer</dt>
                <dd className="detail-value-mono">{config.explorerUrl}</dd>
              </div>
              <div className="detail-row">
                <dt>Explorer API</dt>
                <dd className="detail-value-mono">{config.explorerApiUrl}</dd>
              </div>
              <div className="detail-row">
                <dt>EntryPoint</dt>
                <dd className="detail-value-mono">{config.entryPointAddress}</dd>
              </div>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-head">
            <div>
              <h2>If a source fails</h2>
              <p>Effect on evidence</p>
            </div>
          </div>
          <div className="card-body stack">
            <p className="source-note">
              <strong>Bundler down.</strong> UserOperation data may come from
              BOT Scan instead, or remain incomplete.
            </p>
            <p className="source-note">
              <strong>Explorer down.</strong> Token movements may be unavailable.
              A record can still be attached if RPC and the Bundler provide the
              required fields.
            </p>
            <p className="source-note">
              <strong>RPC down.</strong> Live evidence attachment cannot proceed.
            </p>
            <Link href="/app/evidence" className="text-link">
              Open evidence
              <ArrowRightIcon size={13} />
            </Link>
          </div>
        </div>
      </div>

      <div className="note note-spaced">
        <strong>Endpoint scope.</strong> These are {config.networkName}{" "}
        endpoints. Evidence links use the configured explorer (
        {config.explorerUrl}).
      </div>
    </>
  );
}
