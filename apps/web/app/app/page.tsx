import Link from "next/link";
import {
  formatDateTime,
  formatRelative,
  networkLabel,
  shortenHash,
  type EvidenceVerdict,
} from "@mandate/chain";
import { getAppConfig } from "@/lib/config";
import { EvidenceTable } from "@/components/evidence-table";
import {
  ArrowRightIcon,
  LedgerIcon,
  PlusIcon,
  PulseIcon,
} from "@/components/icons";
import {
  EmptyState,
  Metric,
  PageHeader,
  SectionHeading,
  SourceBadge,
  VerdictBadge,
} from "@/components/ui";
import {
  getLedgerSummary,
  listActivity,
  listAgents,
  listAttentionEvidence,
  listEvidence,
} from "@/lib/repo";

const verdictOrder: EvidenceVerdict[] = [
  "matched",
  "out_of_policy",
  "failed",
  "unattributed",
  "needs_review",
  "pending",
];

const activityLabel = (kind: string) => {
  switch (kind) {
    case "agent.created":
      return "Agent registered";
    case "policy.published":
      return "Policy published";
    case "intent.approved":
      return "Intent approved";
    case "evidence.attached":
      return "Evidence attached";
    default:
      return "Workspace activity";
  }
};

export default function WorkspaceOverviewPage() {
  const network = networkLabel(getAppConfig().chainId);
  const summary = getLedgerSummary();
  const agents = listAgents();
  const sampleAgentCount = agents.filter((agent) => agent.isDemo).length;
  const attention = listAttentionEvidence(5);
  const recentEvidence = listEvidence({ limit: 7 });
  const activity = listActivity({ limit: 6 });

  return (
    <>
      <PageHeader
        eyebrow="Workspace overview"
        title="Evidence ledger"
        description={`Track what was approved, what the smart account did on ${network}, and where the record is incomplete.`}
        actions={
          <>
            <Link href="/app/agents/new" className="button button-ghost">
              <PlusIcon size={15} />
              Register agent
            </Link>
            <Link href="/app/evidence" className="button button-ink">
              <LedgerIcon size={15} />
              Open evidence
            </Link>
          </>
        }
      />

      {summary.sampleCount > 0 ? (
        <div className="note note-spaced-sm">
          <strong>Sample workspace.</strong> {summary.sampleCount} sample{" "}
          {summary.sampleCount === 1 ? "record is" : "records are"} in this
          workspace. Every sample record is labeled and is not live evidence.
        </div>
      ) : null}

      <div className="metric-grid">
        <Metric
          label="Registered agents"
          value={summary.agentCount}
          detail={
            sampleAgentCount === 0
              ? "No sample agents"
              : `${sampleAgentCount} sample agent${sampleAgentCount === 1 ? "" : "s"}`
          }
        />
        <Metric
          label="Evidence records"
          value={summary.evidenceCount}
          detail={`${summary.sampleCount} labeled sample records`}
        />
        <Metric
          label="Needs attention"
          value={summary.attentionCount}
          detail="Out of policy, failed, unattributed, or incomplete"
          tone={summary.attentionCount > 0 ? "warning" : "positive"}
        />
        <Metric
          label="Matched"
          value={summary.matchedCount}
          detail="Intent and policy checks passed on observed fields"
          tone="positive"
        />
      </div>

      <div className="split-grid split-grid-spaced">
        <section className="stack">
          <div>
            <SectionHeading
              eyebrow="Review queue"
              title="Needs attention"
              description="Start with the records that do not cleanly match an approved intent and recorded policy."
              action={
                <Link href="/app/evidence" className="text-link">
                  Open evidence
                  <ArrowRightIcon size={14} />
                </Link>
              }
            />
            {attention.length === 0 ? (
              <EmptyState
                icon={<PulseIcon size={19} />}
                title="Nothing waiting for review"
                body="Attach evidence or approve an intent to start building the review trail."
                action={
                  <Link href="/app/agents" className="button button-ghost button-small">
                    View agents
                  </Link>
                }
              />
            ) : (
              <div className="queue">
                {attention.map((record) => (
                  <Link
                    key={record.id}
                    href={`/app/evidence/${record.id}`}
                    className="queue-item"
                  >
                    <div>
                      <div className="queue-title">
                        <VerdictBadge
                          verdict={record.evaluation.verdict}
                          compact
                        />
                        <span>{record.agentName}</span>
                        <SourceBadge source={record.source} />
                      </div>
                      <div className="queue-meta">
                        <span>{shortenHash(record.hash)}</span>
                        <span>
                          {record.observed.methodLabel ??
                            record.observed.methodSelector ??
                            "Method unavailable"}
                        </span>
                        <span>
                          {record.observed.coverage === "complete"
                            ? "Complete coverage"
                            : "Partial coverage"}
                        </span>
                      </div>
                    </div>
                    <div className="queue-right">
                      <span className="queue-time">
                        {formatRelative(record.attachedAt)}
                      </span>
                      <ArrowRightIcon size={16} />
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>

          <div>
            <SectionHeading
              eyebrow="Latest additions"
              title="Recent evidence"
              action={
                <Link href="/app/evidence" className="text-link">
                  All evidence
                  <ArrowRightIcon size={14} />
                </Link>
              }
            />
            <EvidenceTable
              records={recentEvidence}
              emptyMessage="Attach a BOT Chain transaction or UserOperation to begin."
            />
          </div>
        </section>

        <aside className="stack">
          <div className="card">
            <div className="card-head">
              <div>
                <h2>Review state</h2>
                <p>All recorded evidence</p>
              </div>
            </div>
            <div className="card-body">
              <div className="verdict-counts">
                {verdictOrder.map((verdict) => (
                  <span key={verdict} className="verdict-count">
                    <VerdictBadge verdict={verdict} compact />
                    <strong>{summary.verdictCounts[verdict]}</strong>
                  </span>
                ))}
              </div>
              <div className="form-divider spaced-y" />
              <p className="source-note">
                A matched verdict covers only the fields Mandate could observe. It
                does not prove the full transaction was safe.
              </p>
            </div>
            <div className="card-foot">
              <span>{summary.evidenceCount} total records</span>
              <Link href="/app/reports" className="text-link">
                Reports
              </Link>
            </div>
          </div>

          <div className="card">
            <div className="card-head">
              <div>
                <h2>Agents</h2>
                <p>Smart accounts under review</p>
              </div>
              <Link href="/app/agents/new" className="icon-link" aria-label="Register agent">
                +
              </Link>
            </div>
            <div className="card-body">
              {agents.length === 0 ? (
                <p className="small-muted">
                  Register a {network} smart account to start a ledger.
                </p>
              ) : (
                <div className="agent-list">
                  {agents.map((agent) => (
                    <Link
                      key={agent.id}
                      href={`/app/agents/${agent.id}`}
                      className="queue-item agent-mini"
                    >
                      <div>
                        <div className="queue-title">
                          <span>{agent.name}</span>
                          {agent.isDemo ? (
                            <span className="sample-badge">Sample</span>
                          ) : null}
                        </div>
                        <div className="queue-meta">
                          <span>
                            {agent.evidenceCount}{" "}
                            {agent.evidenceCount === 1 ? "record" : "records"}
                          </span>
                          <span>{agent.attentionCount} needing review</span>
                        </div>
                      </div>
                      <ArrowRightIcon size={16} />
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="card">
            <div className="card-head">
              <div>
                <h2>Recent activity</h2>
                <p>Workspace events</p>
              </div>
            </div>
            <div className="card-body">
              {activity.length === 0 ? (
                <p className="small-muted">No activity recorded yet.</p>
              ) : (
                <div className="timeline">
                  {activity.map((item) => (
                    <div key={item.id} className="timeline-item">
                      <span className="timeline-time">
                        {formatDateTime(item.createdAt)}
                      </span>
                      <span className="timeline-dot" aria-hidden="true" />
                      <div className="timeline-body">
                        <strong>{activityLabel(item.kind)}</strong>
                        <small>{item.summary}</small>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="card-foot">
              <span>Data stays local</span>
              <Link href="/app/activity" className="text-link">
                View activity
              </Link>
            </div>
          </div>
        </aside>
      </div>
    </>
  );
}
