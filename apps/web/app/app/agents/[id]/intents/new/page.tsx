import Link from "next/link";
import { notFound } from "next/navigation";
import { formatNativeValue } from "@mandate/chain";
import { IntentForm } from "@/components/forms";
import { ArrowRightIcon } from "@/components/icons";
import { Note, PageHeader } from "@/components/ui";
import { createIntentAction } from "@/lib/actions";
import { getAgent, listPolicies } from "@/lib/repo";

export const metadata = {
  title: "Approve intent",
};

export default async function NewIntentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const agent = getAgent(id);
  if (!agent) notFound();

  const policies = listPolicies(agent.id);
  const current = policies[0] ?? null;

  return (
    <>
      <PageHeader
        eyebrow="Approval record"
        title="Approve an intent"
        description="Record one specific action as approved. This is the reference Mandate uses when matching observed evidence."
        actions={
          <Link href={`/app/agents/${agent.id}`} className="button button-ghost">
            Back to agent
            <ArrowRightIcon size={15} />
          </Link>
        }
      />

      {current ? (
        <div className="split-grid">
          <IntentForm
            action={createIntentAction}
            agentId={agent.id}
            policies={policies.map((policy) => ({
              id: policy.id,
              name: policy.name,
              version: policy.version,
            }))}
            defaults={{
              policyId: current.id,
              target: current.allowedTargets[0],
              methodSelector: current.allowedMethods[0],
            }}
          />
          <aside className="stack">
            <div className="card">
              <div className="card-head">
                <div>
                  <h2>Pinned policy</h2>
                  <p>
                    v{current.version} · {current.name}
                  </p>
                </div>
              </div>
              <div className="card-body">
                <div className="detail-list">
                  <div className="detail-row">
                    <dt>Per action</dt>
                    <dd>
                      ≤{" "}
                      {formatNativeValue(current.maxNativeValuePerActionWei)}
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
                  <div className="detail-row">
                    <dt>Targets</dt>
                    <dd>{current.allowedTargets.length} allowed</dd>
                  </div>
                  <div className="detail-row">
                    <dt>Methods</dt>
                    <dd>{current.allowedMethods.length} allowed</dd>
                  </div>
                </div>
              </div>
            </div>
            <div className="note">
              <strong>Use exact values.</strong> Enter the target, method, and
              native value you expect. Mandate compares evidence against these
              values.
            </div>
            <Note tone="warning">
              Mandate records the approval and a fingerprint of its contents. It
              does not create a cryptographic signature.
            </Note>
          </aside>
        </div>
      ) : (
        <Note tone="warning">
          Publish a policy before approving an intent.{" "}
          <Link href={`/app/agents/${agent.id}/policy`}>
            <strong>Publish policy v1.</strong>
          </Link>
        </Note>
      )}
    </>
  );
}
