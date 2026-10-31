import Link from "next/link";
import { notFound } from "next/navigation";
import {
  formatDateTime,
  formatNativeValue,
  networkLabel,
  shortenAddress,
  shortenHash,
} from "@mandate/chain";
import { getAppConfig } from "@/lib/config";
import { CopyButton } from "@/components/copy-button";
import { EvidenceTable } from "@/components/evidence-table";
import {
  ArrowRightIcon,
  DownloadIcon,
  PlusIcon,
  PulseIcon,
  SearchIcon,
} from "@/components/icons";
import {
  EmptyState,
  Note,
  PageHeader,
  SampleBadge,
  SectionHeading,
} from "@/components/ui";
import { activityKindLabel } from "@/lib/labels";
import {
  getAgent,
  getCurrentPolicy,
  listActivity,
  listEvidence,
  listIntents,
  listPolicies,
} from "@/lib/repo";

export default async function AgentPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ intent?: string }>;
}) {
  const { id } = await params;
  const { intent: intentStatus } = await searchParams;
  const config = getAppConfig();
  const network = networkLabel(config.chainId);
  const agent = getAgent(id);
  if (!agent) notFound();

  const policy = getCurrentPolicy(agent.id);
  const policies = listPolicies(agent.id);
  const intents = listIntents(agent.id);
  const evidence = listEvidence({ agentId: agent.id, limit: 25 });
  const activity = listActivity({ agentId: agent.id, limit: 8 });

  return (
    <>
      <PageHeader
        eyebrow="Agent workspace"
        title={agent.name}
        description={
          agent.description ||
          `A ${network} smart account under evidence review.`
        }
        actions={
          <>
            <Link
              href={`/app/agents/${agent.id}/discover`}
              className="button button-ghost"
            >
              <SearchIcon size={15} />
              Discover
            </Link>
            <Link
              href={`/app/agents/${agent.id}/intents/new`}
              className="button button-ghost"
            >
              <PlusIcon size={15} />
              Approve intent
            </Link>
            <Link
              href={`/app/agents/${agent.id}/evidence/new`}
              className="button button-ink"
            >
              <PulseIcon size={15} />
              Attach evidence
            </Link>
          </>
        }
      />

      {intentStatus === "approved" ? (
        <div className="form-success-banner spaced" role="status">
          Intent approved and recorded with its policy snapshot.
        </div>
      ) : null}

      <div className="agent-profile">
        <div className="stack-lg">
          <section>
            <div className="agent-name-line">
              <h2>Account identity</h2>
              <SampleBadge isDemo={agent.isDemo} />
            </div>
            <div className="account-block">
              <span>{agent.smartAccount}</span>
              <CopyButton value={agent.smartAccount} label="Copy smart account" />
            </div>
            <div className="kv-inline kv-spaced">
              <span>Chain {config.chainId}</span>
              <span>Registered {formatDateTime(agent.createdAt)}</span>
              <span>
                {agent.policyCount}{" "}
                {agent.policyCount === 1 ? "policy version" : "policy versions"}
              </span>
              <span>
                {agent.evidenceCount}{" "}
                {agent.evidenceCount === 1
                  ? "evidence record"
                  : "evidence records"}
              </span>
            </div>
          </section>

          <section>
            <SectionHeading
              eyebrow="Policy"
              title="Current policy"
              description="The latest published review version. Intents keep the exact snapshot they were approved under."
              action={
                <Link
                  href={`/app/agents/${agent.id}/policy`}
                  className="text-link"
                >
                  Policy history
                  <ArrowRightIcon size={14} />
                </Link>
              }
            />
            {policy ? (
              <div className="policy-banner">
                <div>
                  <div className="agent-name-line">
                    <h2>{policy.name}</h2>
                    <span className="policy-version">v{policy.version}</span>
                  </div>
                  <div className="policy-meta">
                    <span>
                      Per action ≤{" "}
                      {formatNativeValue(policy.maxNativeValuePerActionWei)}
                    </span>
                    <span>
                      Per UTC day{" "}
                      {policy.maxNativeValuePerDayWei
                        ? `≤ ${formatNativeValue(policy.maxNativeValuePerDayWei)}`
                        : "not capped"}
                    </span>
                    <span>
                      {policy.expiresAt
                        ? `Expires ${formatDateTime(policy.expiresAt)}`
                        : "No expiry"}
                    </span>
                  </div>
                  <div className="policy-meta">
                    <span>Hash {shortenHash(policy.hash, 8)}</span>
                    <span>Published {formatDateTime(policy.createdAt)}</span>
                  </div>
                </div>
                <Link
                  href={`/app/agents/${agent.id}/policy`}
                  className="button button-ghost button-small"
                >
                  View policy
                </Link>
              </div>
            ) : (
              <Note tone="warning">
                No policy has been published. Attach evidence only after a
                policy exists.{" "}
                <Link href={`/app/agents/${agent.id}/policy`}>
                  <strong>Publish policy v1.</strong>
                </Link>
              </Note>
            )}
          </section>

          <section id="intents">
            <SectionHeading
              eyebrow="Approval trail"
              title="Approved intents"
              description="Actions recorded as approved. Evidence without a matching intent remains unattributed."
              action={
                <Link
                  href={`/app/agents/${agent.id}/intents/new`}
                  className="text-link"
                >
                  Approve intent
                  <ArrowRightIcon size={14} />
                </Link>
              }
            />
            {intents.length === 0 ? (
              <EmptyState
                title="No approved intents"
                body="Approve a target, method, and native value before attaching matching evidence."
                action={
                  <Link
                    href={`/app/agents/${agent.id}/intents/new`}
                    className="button button-ghost button-small"
                  >
                    Approve the first intent
                  </Link>
                }
              />
            ) : (
              <div className="intent-list">
                {intents.map((intent) => (
                  <article key={intent.id} className="intent-row">
                    <div>
                      <h3>{intent.title}</h3>
                      <p>{intent.rationale}</p>
                      <div className="intent-row-meta">
                        <span>Target {shortenAddress(intent.target)}</span>
                        <span>Method {intent.methodSelector}</span>
                        <span>Value {formatNativeValue(intent.valueWei)}</span>
                        <span>Policy v{intent.policyVersion}</span>
                        <span>Recorded by {intent.approvedBy}</span>
                      </div>
                      <div className="intent-row-meta">
                        <span>
                          Fingerprint{" "}
                          <Link
                            href={`/app/anchors?hash=${intent.fingerprint}`}
                            className="small-link"
                          >
                            {shortenHash(intent.fingerprint, 7)}
                          </Link>
                        </span>
                        <span>{formatDateTime(intent.createdAt)}</span>
                      </div>
                    </div>
                    <div className="intent-row-side">
                      <span className="policy-version">
                        v{intent.policyVersion}
                      </span>
                      <Link
                        href={`/app/agents/${agent.id}/evidence/new?intentId=${intent.id}`}
                        className="text-link"
                      >
                        Attach
                      </Link>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>

          <section>
            <SectionHeading
              eyebrow="Evidence"
              title="Observed actions"
              description={`Public ${network} records attached to this agent.`}
              action={
                <Link
                  href={`/app/evidence?agent=${agent.id}`}
                  className="text-link"
                >
                  Full ledger
                  <ArrowRightIcon size={14} />
                </Link>
              }
            />
            <EvidenceTable records={evidence} showAgent={false} />
          </section>
        </div>

        <aside className="stack">
          <div className="card agent-aside">
            <h2>Next review action</h2>
            {policy ? (
              <p>
                Attach a public transaction or UserOperation, or discover recent
                activity from BOT Scan.
              </p>
            ) : (
              <p>
                Publish a policy first. Without one, Mandate has no review rule to
                apply.
              </p>
            )}
            <Link
              href={
                policy
                  ? `/app/agents/${agent.id}/evidence/new`
                  : `/app/agents/${agent.id}/policy`
              }
              className="button button-ink button-small"
            >
              {policy ? "Attach evidence" : "Publish policy"}
            </Link>
            <Link
              href={`/app/agents/${agent.id}/discover`}
              className="button button-ghost button-small"
            >
              Discover activity
            </Link>
          </div>

          <div className="card agent-aside">
            <h2>Coverage</h2>
            <div className="detail-list">
              <div className="detail-row">
                <dt>Policies</dt>
                <dd>
                  {policies.length}{" "}
                  {policies.length === 1 ? "version" : "versions"}
                </dd>
              </div>
              <div className="detail-row">
                <dt>Intents</dt>
                <dd>{intents.length} approved</dd>
              </div>
              <div className="detail-row">
                <dt>Evidence</dt>
                <dd>{agent.evidenceCount} attached</dd>
              </div>
              <div className="detail-row">
                <dt>Attention</dt>
                <dd>{agent.attentionCount} needing review</dd>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-head">
              <div>
                <h2>Recent activity</h2>
                <p>Workspace events for this agent</p>
              </div>
            </div>
            <div className="card-body">
              {activity.length === 0 ? (
                <p className="small-muted">No activity yet.</p>
              ) : (
                <div className="timeline">
                  {activity.map((item) => (
                    <div key={item.id} className="timeline-item">
                      <span className="timeline-time">
                        {formatDateTime(item.createdAt)}
                      </span>
                      <span className="timeline-dot" aria-hidden="true" />
                      <div className="timeline-body">
                        <strong>{activityKindLabel(item.kind)}</strong>
                        <small>{item.summary}</small>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="card agent-aside">
            <h2>Export</h2>
            <p>
              Download a JSON or Markdown report containing this agent&apos;s
              policies, intents, and evidence ledger.
            </p>
            <Link href="/app/reports" className="button button-ghost button-small">
              <DownloadIcon size={15} />
              Open reports
            </Link>
          </div>

          {agent.isDemo ? (
            <Note tone="warning">
              This is a sample workspace. Its smart account and records are
              illustrative and are not live chain evidence.
            </Note>
          ) : null}
        </aside>
      </div>
    </>
  );
}
