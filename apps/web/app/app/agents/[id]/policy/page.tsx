import Link from "next/link";
import { notFound } from "next/navigation";
import {
  formatDateTime,
  formatNativeValue,
  networkLabel,
  shortenHash,
} from "@mandate/chain";
import { CopyButton } from "@/components/copy-button";
import { PolicyForm } from "@/components/forms";
import { getAppConfig } from "@/lib/config";
import { PlusIcon } from "@/components/icons";
import {
  Note,
  PageHeader,
  SampleBadge,
  SectionHeading,
} from "@/components/ui";
import { createPolicyAction } from "@/lib/actions";
import { getAgent, listPolicies } from "@/lib/repo";

const botAmount = (wei: string | null): string | undefined => {
  if (wei === null) return undefined;
  return formatNativeValue(wei).replace(/ BOT$/, "");
};

export default async function PolicyPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ published?: string }>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const network = networkLabel(getAppConfig().chainId);
  const agent = getAgent(id);
  if (!agent) notFound();

  const policies = listPolicies(agent.id);
  const current = policies[0] ?? null;

  return (
    <>
      <PageHeader
        eyebrow="Policy"
        title="Policy history"
        description={
          <>
            Policies are review rules for this agent, not on-chain permissions.
            Each publication creates a new version with a content hash.
          </>
        }
        actions={
          <>
            <Link href={`/app/agents/${agent.id}`} className="button button-ghost">
              Back to agent
            </Link>
            {current ? (
              <Link
                href={`/app/agents/${agent.id}/intents/new`}
                className="button button-ink"
              >
                <PlusIcon size={15} />
                Approve intent
              </Link>
            ) : null}
          </>
        }
      />

      {query.published ? (
        <div className="form-success-banner spaced" role="status">
          Policy version published. Existing intents keep their original
          snapshots.
        </div>
      ) : null}

      {current ? (
        <section>
          <div className="policy-banner">
            <div>
              <div className="agent-name-line">
                <h2>{current.name}</h2>
                <span className="policy-version">v{current.version}</span>
                <SampleBadge isDemo={agent.isDemo} />
              </div>
              <div className="policy-meta">
                <span>Published {formatDateTime(current.createdAt)}</span>
                <span>
                  {current.expiresAt
                    ? `Expires ${formatDateTime(current.expiresAt)}`
                    : "No expiry"}
                </span>
                <span>Chain {current.chainId}</span>
              </div>
            </div>
            <div className="inline-hash">
              <code>{shortenHash(current.hash, 10)}</code>
              <CopyButton value={current.hash} label="Copy policy hash" />
              <Link
                href={`/app/anchors?hash=${current.hash}`}
                className="small-link"
              >
                Check anchor
              </Link>
            </div>
          </div>

          <div className="card policy-card">
            <div className="card-head">
              <div>
                <h2>Current review rules</h2>
                <p>Applied to new evidence unless an intent pins an older version.</p>
              </div>
            </div>
            <div className="card-body">
              <div className="policy-columns">
                <div>
                  <p className="field-label">Allowed targets</p>
                  <div className="code-list">
                    {current.allowedTargets.map((target) => (
                      <span key={target}>{target}</span>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="field-label">Allowed method selectors</p>
                  <div className="tag-list">
                    {current.allowedMethods.map((selector) => (
                      <span key={selector} className="code-tag">
                        {selector}
                      </span>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="field-label">Native value</p>
                  <div className="detail-list">
                    <div className="detail-row">
                      <dt>Per action</dt>
                      <dd>
                        ≤{" "}
                        {formatNativeValue(
                          current.maxNativeValuePerActionWei,
                        )}
                      </dd>
                    </div>
                    <div className="detail-row">
                      <dt>Per UTC day</dt>
                      <dd>
                        {current.maxNativeValuePerDayWei
                          ? `≤ ${formatNativeValue(current.maxNativeValuePerDayWei)}`
                          : "No daily cap"}
                      </dd>
                    </div>
                  </div>
                </div>
                <div>
                  <p className="field-label">Review notes</p>
                  <p className="source-note">
                    {current.notes || "No review notes were provided."}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>
      ) : (
        <Note tone="warning">
          This agent has no policy yet. Publish one below before approving an
          intent or attaching evidence.
        </Note>
      )}

      <section className="stack-lg-spaced">
        <SectionHeading
          eyebrow="Publish"
          title={current ? "Create the next version" : "Create policy v1"}
          description="New versions do not rewrite history. Approved intents stay pinned to the version that was current when they were recorded."
        />
        <PolicyForm
          action={createPolicyAction}
          agentId={agent.id}
          defaults={
            current
              ? {
                  name: current.name,
                  allowedTargets: current.allowedTargets.join("\n"),
                  allowedMethods: current.allowedMethods.join("\n"),
                  maxNativePerAction: botAmount(
                    current.maxNativeValuePerActionWei,
                  ),
                  maxNativePerDay: botAmount(
                    current.maxNativeValuePerDayWei,
                  ),
                  expiresAt: current.expiresAt
                    ? current.expiresAt.slice(0, 16)
                    : undefined,
                  notes: current.notes,
                }
              : undefined
          }
        />
      </section>

      {policies.length > 0 ? (
        <section className="stack-lg-spaced">
          <SectionHeading
          eyebrow="History"
          title="Published versions"
          description="All policy versions recorded for this agent."
          />
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th scope="col">Version</th>
                  <th scope="col">Name</th>
                  <th scope="col">Per action</th>
                  <th scope="col">Per day</th>
                  <th scope="col">Expiry</th>
                  <th scope="col">Hash</th>
                  <th scope="col">Published</th>
                </tr>
              </thead>
              <tbody>
                {policies.map((policy) => (
                  <tr key={policy.id}>
                    <td>
                      <span className="policy-version">v{policy.version}</span>
                    </td>
                    <td>{policy.name}</td>
                    <td>{formatNativeValue(policy.maxNativeValuePerActionWei)}</td>
                    <td>
                      {policy.maxNativeValuePerDayWei
                        ? formatNativeValue(policy.maxNativeValuePerDayWei)
                        : "Not set"}
                    </td>
                    <td>
                      {policy.expiresAt
                        ? formatDateTime(policy.expiresAt)
                        : "No expiry"}
                    </td>
                    <td>
                      <span className="table-hash">
                        {shortenHash(policy.hash)}
                      </span>
                    </td>
                    <td>{formatDateTime(policy.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      <div className="note note-spaced">
        <strong>Policy boundary.</strong> Mandate checks targets, selectors,
        native value, expiry, and daily native totals. It does not enforce rules
        on-chain or inspect arbitrary internal calls.
      </div>

      {agent.isDemo ? (
        <Note tone="warning">
          This sample policy and its targets are illustrative. Use addresses from
          your own {network} workflow for live evidence.
        </Note>
      ) : null}
    </>
  );
}
