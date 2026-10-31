import Link from "next/link";
import { networkName } from "@mandate/chain";
import { ArrowRightIcon } from "@/components/icons";
import { AgentForm } from "@/components/forms";
import { PageHeader } from "@/components/ui";
import { createAgentAction } from "@/lib/actions";
import { getAppConfig } from "@/lib/config";

export const metadata = {
  title: "Register agent",
};

export default function NewAgentPage() {
  const config = getAppConfig();
  return (
    <>
      <PageHeader
        eyebrow="Agent setup"
        title="Register an agent"
        description="Start with the smart account identity. Policies, approved intents, and evidence all attach to this record."
        actions={
          <Link href="/app/agents" className="button button-ghost">
            Back to agents
            <ArrowRightIcon size={15} />
          </Link>
        }
      />
      <div className="split-grid">
        <AgentForm action={createAgentAction} />
        <aside className="stack">
          <div className="card">
            <div className="card-head">
              <div>
                <h2>What Mandate needs</h2>
                <p>Network, account, policy, and evidence</p>
              </div>
            </div>
            <div className="card-body">
              <div className="detail-list">
                <div className="detail-row">
                  <dt>Network</dt>
                  <dd>
                    {networkName(config.chainId)} only · chain ID{" "}
                    {config.chainId}
                  </dd>
                </div>
                <div className="detail-row">
                  <dt>Identity</dt>
                  <dd>The ERC-4337 smart account that sends the action</dd>
                </div>
                <div className="detail-row">
                  <dt>Policy</dt>
                  <dd>Targets, selectors, native caps, and optional expiry</dd>
                </div>
                <div className="detail-row">
                  <dt>Evidence</dt>
                  <dd>A public transaction or UserOperation hash</dd>
                </div>
              </div>
            </div>
          </div>
          <div className="note note-warning">
            <strong>No wallet connection.</strong> This form does not request a
            signature. The address is used only to match public evidence.
          </div>
        </aside>
      </div>
    </>
  );
}
