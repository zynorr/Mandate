import Link from "next/link";
import { notFound } from "next/navigation";
import {
  BOT_TESTNET_CHAIN_ID,
  SAMPLE_SMART_ACCOUNT,
  SAMPLE_USER_OPERATION_HASH,
  SAMPLE_USER_OPERATION_TX_HASH,
  networkLabel,
} from "@mandate/chain";
import { CopyButton } from "@/components/copy-button";
import { AttachEvidenceForm } from "@/components/forms";
import { ArrowRightIcon, SearchIcon } from "@/components/icons";
import { Note, PageHeader } from "@/components/ui";
import { attachEvidenceAction } from "@/lib/actions";
import { getAppConfig } from "@/lib/config";
import { getAgent, getCurrentPolicy, listIntents } from "@/lib/repo";

export const metadata = {
  title: "Attach evidence",
};

export default async function AttachEvidencePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ kind?: string; hash?: string; intentId?: string }>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const config = getAppConfig();
  const network = networkLabel(config.chainId);
  const agent = getAgent(id);
  if (!agent) notFound();

  const policy = getCurrentPolicy(agent.id);
  const intents = listIntents(agent.id);
  const selectedIntent = intents.find((intent) => intent.id === query.intentId);
  const kind =
    query.kind === "transaction" || query.kind === "user_operation"
      ? query.kind
      : undefined;

  return (
    <>
      <PageHeader
        eyebrow="Evidence"
        title="Attach chain evidence"
        description={`Fetch a public ${network} transaction or UserOperation, check that the sender matches the account, and record the comparison.`}
        actions={
          <>
            <Link
              href={`/app/agents/${agent.id}/discover`}
              className="button button-ghost"
            >
              <SearchIcon size={15} />
              Discover
            </Link>
            <Link href={`/app/agents/${agent.id}`} className="button button-ghost">
              Back to agent
              <ArrowRightIcon size={15} />
            </Link>
          </>
        }
      />

      {policy ? (
        <div className="split-grid">
          <AttachEvidenceForm
            action={attachEvidenceAction}
            agentId={agent.id}
            intents={intents.map((intent) => ({
              id: intent.id,
              title: intent.title,
              policyVersion: intent.policyVersion,
            }))}
            defaults={{
              kind,
              hash: query.hash,
              intentId: selectedIntent?.id,
            }}
          />
          <aside className="stack">
            <div className="card">
              <div className="card-head">
                <div>
                  <h2>What happens on attach</h2>
                  <p>Read-only chain lookups</p>
                </div>
              </div>
              <div className="card-body">
                <div className="timeline">
                  <div className="timeline-item">
                    <span className="timeline-time">01</span>
                    <span className="timeline-dot" aria-hidden="true" />
                    <div className="timeline-body">
                      <strong>Fetch the record</strong>
                      <small>BOT Scan, Bundler, and RPC where needed.</small>
                    </div>
                  </div>
                  <div className="timeline-item">
                    <span className="timeline-time">02</span>
                    <span className="timeline-dot" aria-hidden="true" />
                    <div className="timeline-body">
                      <strong>Check the sender</strong>
                      <small>
                        The observed sender must match {agent.smartAccount.slice(0, 10)}…
                      </small>
                    </div>
                  </div>
                  <div className="timeline-item">
                    <span className="timeline-time">03</span>
                    <span className="timeline-dot" aria-hidden="true" />
                    <div className="timeline-body">
                      <strong>Compare observed fields</strong>
                      <small>
                        Intent and policy checks run only on available fields.
                      </small>
                    </div>
                  </div>
                  <div className="timeline-item">
                    <span className="timeline-time">04</span>
                    <span className="timeline-dot" aria-hidden="true" />
                    <div className="timeline-body">
                      <strong>Record the result</strong>
                      <small>
                        The record keeps coverage notes, checks, and source labels.
                      </small>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {config.chainId === BOT_TESTNET_CHAIN_ID ? (
              <div className="card">
                <div className="card-head">
                  <div>
                    <h2>Verified testnet examples</h2>
                    <p>For the sample smart account</p>
                  </div>
                </div>
                <div className="card-body stack">
                  <div>
                    <p className="field-label">UserOperation</p>
                    <div className="inline-hash">
                      <code>{SAMPLE_USER_OPERATION_HASH}</code>
                      <CopyButton value={SAMPLE_USER_OPERATION_HASH} />
                    </div>
                  </div>
                  <div>
                    <p className="field-label">Outer transaction</p>
                    <div className="inline-hash">
                      <code>{SAMPLE_USER_OPERATION_TX_HASH}</code>
                      <CopyButton value={SAMPLE_USER_OPERATION_TX_HASH} />
                    </div>
                  </div>
                  <p className="source-note">
                    These records belong to smart account{" "}
                    <span className="mono-small">{SAMPLE_SMART_ACCOUNT}</span>.
                    A different registered account will fail the sender check.
                  </p>
                </div>
              </div>
            ) : null}

            <Note tone="warning">
              A bundled EntryPoint transaction cannot be attached as a
              transaction. Attach the individual UserOperation hash instead.
            </Note>
          </aside>
        </div>
      ) : (
        <Note tone="warning">
          This agent needs a policy before evidence can be evaluated.{" "}
          <Link href={`/app/agents/${agent.id}/policy`}>
            <strong>Publish a policy first.</strong>
          </Link>
        </Note>
      )}
    </>
  );
}
