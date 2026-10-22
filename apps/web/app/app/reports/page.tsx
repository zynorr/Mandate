import Link from "next/link";
import { shortenAddress } from "@mandate/chain";
import { ArrowRightIcon, DownloadIcon, ReportIcon } from "@/components/icons";
import {
  EmptyState,
  Note,
  PageHeader,
  SampleBadge,
} from "@/components/ui";
import { listAgents } from "@/lib/repo";

export const metadata = {
  title: "Reports",
};

export default function ReportsPage() {
  const agents = listAgents();

  return (
    <>
      <PageHeader
        eyebrow="Exports"
        title="Evidence reports"
        description="Download an agent's policies, intents, and evidence record. Reports include coverage counts, review detail, and limitations."
      />

      {agents.length === 0 ? (
        <EmptyState
          icon={<ReportIcon size={20} />}
          title="No reports available"
          body="Register an agent and attach evidence before exporting a report."
          action={
            <Link href="/app/agents/new" className="button button-ghost button-small">
              Register agent
            </Link>
          }
        />
      ) : (
        <div className="stack">
          {agents.map((agent) => (
            <article key={agent.id} className="report-row">
              <div>
                <div className="agent-name-line">
                  <h3>{agent.name}</h3>
                  <SampleBadge isDemo={agent.isDemo} />
                </div>
                <p>
                  {shortenAddress(agent.smartAccount)} ·{" "}
                  {agent.evidenceCount}{" "}
                  {agent.evidenceCount === 1
                    ? "evidence record"
                    : "evidence records"}{" "}
                  · {agent.policyCount}{" "}
                  {agent.policyCount === 1
                    ? "policy version"
                    : "policy versions"}
                </p>
              </div>
              <div className="report-actions">
                <a
                  href={`/api/reports/${agent.id}?format=json&download=1`}
                  className="button button-ghost button-small"
                >
                  <DownloadIcon size={14} />
                  JSON
                </a>
                <a
                  href={`/api/reports/${agent.id}?format=md&download=1`}
                  className="button button-ghost button-small"
                >
                  <DownloadIcon size={14} />
                  Markdown
                </a>
                <Link
                  href={`/app/agents/${agent.id}`}
                  className="button button-ink button-small"
                >
                  Open agent
                  <ArrowRightIcon size={14} />
                </Link>
              </div>
            </article>
          ))}
        </div>
      )}

      <div className="stack-lg-spaced">
        <Note>
          <strong>What the fingerprint means.</strong> Each report includes a
          SHA-256 content fingerprint. It identifies the report contents; it is
          not a wallet signature and does not prove authorship.{" "}
          <Link href="/app/anchors" className="small-link">
            Check an anchored report
          </Link>
          .
        </Note>
        <Note tone="warning">
          <strong>What reports include.</strong> Sample records stay labeled,
          partial coverage stays visible, and token movements remain
          informational.
        </Note>
      </div>
    </>
  );
}
