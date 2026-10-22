import Link from "next/link";
import { notFound } from "next/navigation";
import {
  formatDateTime,
  formatNativeValue,
  shortenAddress,
} from "@mandate/chain";
import {
  ArrowRightIcon,
  LedgerIcon,
  PulseIcon,
  SearchIcon,
} from "@/components/icons";
import {
  ChainStatus,
  EmptyState,
  Note,
  PageHeader,
  SectionHeading,
} from "@/components/ui";
import { discoverAgentActivity } from "@/lib/discovery";
import { getAgent } from "@/lib/repo";

export const metadata = {
  title: "Discover activity",
};

export default async function DiscoverPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const agent = getAgent(id);
  if (!agent) notFound();

  const discovery = await discoverAgentActivity(agent, 15);

  return (
    <>
      <PageHeader
        eyebrow="Source scan"
        title="Recent account activity"
        description="Public UserOperations and outgoing transactions returned by BOT Scan. A candidate is not evidence until it is fetched and attached."
        actions={
          <>
            <Link
              href={`/app/agents/${agent.id}/discover?scan=1`}
              className="button button-ghost"
            >
              <SearchIcon size={15} />
              Scan again
            </Link>
            <Link
              href={`/app/agents/${agent.id}/evidence/new`}
              className="button button-ink"
            >
              Attach by hash
            </Link>
          </>
        }
      />

      <div className="kv-inline scan-meta">
        <span>Smart account {shortenAddress(agent.smartAccount)}</span>
        <span>Scanned {formatDateTime(discovery.scannedAt)}</span>
        <span>
          {discovery.candidates.length}{" "}
          {discovery.candidates.length === 1 ? "candidate" : "candidates"}
        </span>
        <span>
          {discovery.candidates.filter((item) => item.alreadyAttached).length}{" "}
          already attached
        </span>
      </div>

      {discovery.errors.length > 0 ? (
        <div className="stack-sm scan-warning">
          {discovery.errors.map((error) => (
            <Note tone="warning" key={error}>
              <strong>Partial scan.</strong> {error}
            </Note>
          ))}
        </div>
      ) : null}

      {discovery.candidates.length === 0 ? (
        <EmptyState
          icon={<PulseIcon size={20} />}
          title="No recent activity found"
          body="BOT Scan did not return UserOperations or outgoing transactions for this smart account. You can still attach a known hash directly."
          action={
            <Link
              href={`/app/agents/${agent.id}/evidence/new`}
              className="button button-ghost button-small"
            >
              Attach a hash
            </Link>
          }
        />
      ) : (
        <section>
          <SectionHeading
            eyebrow="Candidates"
            title="Public activity"
            description="A UserOperation and its outer transaction can both appear. Check the type before attaching one."
          />
          <div className="queue">
            {discovery.candidates.map((candidate) => (
              <div key={candidate.key} className="discovery-row">
                <span className="discovery-kind" aria-hidden="true">
                  {candidate.kind === "user_operation" ? (
                    <PulseIcon size={14} />
                  ) : (
                    <LedgerIcon size={14} />
                  )}
                </span>
                <div className="discovery-main">
                  <strong>{candidate.hash}</strong>
                  <p>
                    <span>
                      {candidate.kind === "user_operation"
                        ? "UserOperation"
                        : "Transaction"}
                    </span>
                    <span>{candidate.methodLabel ?? "Method unavailable"}</span>
                    <span>
                      {candidate.target
                        ? shortenAddress(candidate.target)
                        : "Target requires decode"}
                    </span>
                    <span>{formatNativeValue(candidate.valueWei)}</span>
                    <span>
                      {candidate.timestamp
                        ? formatDateTime(candidate.timestamp)
                        : "Time unavailable"}
                    </span>
                  </p>
                </div>
                <div className="discovery-side">
                  <ChainStatus status={candidate.chainStatus} />
                  {candidate.alreadyAttached ? (
                    <span className="live-badge">Attached</span>
                  ) : (
                    <Link
                      href={`/app/agents/${agent.id}/evidence/new?kind=${candidate.kind}&hash=${candidate.hash}`}
                      className="button button-ghost button-small"
                    >
                      Review
                      <ArrowRightIcon size={14} />
                    </Link>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <div className="note note-spaced">
        <strong>Scan limits.</strong> This scan only sees activity returned by
        BOT Scan. Decoding happens after you attach a record.
      </div>

      {agent.isDemo ? (
        <Note tone="warning">
          This sample agent uses an illustrative smart account. Live discovery
          may return no activity.
        </Note>
      ) : null}
    </>
  );
}
