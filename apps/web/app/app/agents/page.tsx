import Link from "next/link";
import { formatDateTime, networkLabel } from "@mandate/chain";
import { AgentIcon, ArrowRightIcon, PlusIcon } from "@/components/icons";
import { EmptyState, PageHeader, SampleBadge } from "@/components/ui";
import { getAppConfig } from "@/lib/config";
import { listAgents } from "@/lib/repo";

export const metadata = {
  title: "Agents",
};

export default function AgentsPage() {
  const network = networkLabel(getAppConfig().chainId);
  const agents = listAgents();

  return (
    <>
      <PageHeader
        eyebrow="Smart accounts"
        title="Agents"
        description={`Each agent is a ${network} smart account with its own policy history, approved intents, and evidence ledger.`}
        actions={
          <Link href="/app/agents/new" className="button button-ink">
            <PlusIcon size={15} />
            Register agent
          </Link>
        }
      />

      {agents.length === 0 ? (
        <EmptyState
          icon={<AgentIcon size={20} />}
          title="No agents registered"
          body={`Add the smart account you want to review. Mandate will use it to match public ${network} evidence.`}
          action={
            <Link href="/app/agents/new" className="button button-ink">
              Register the first agent
            </Link>
          }
        />
      ) : (
        <div className="agent-list">
          {agents.map((agent) => (
            <article key={agent.id} className="agent-card">
              <div>
                <h2>
                  <Link href={`/app/agents/${agent.id}`}>{agent.name}</Link>
                  <SampleBadge isDemo={agent.isDemo} />
                </h2>
                <p className="small-muted">{agent.description}</p>
                <div className="account-block">
                  <span>{agent.smartAccount}</span>
                </div>
                <div className="agent-card-stats">
                  <span>
                    <strong>{agent.policyCount}</strong>{" "}
                    {agent.policyCount === 1 ? "policy version" : "policy versions"}
                  </span>
                  <span>
                    <strong>{agent.evidenceCount}</strong>{" "}
                    {agent.evidenceCount === 1 ? "evidence record" : "evidence records"}
                  </span>
                  <span>
                    <strong>{agent.attentionCount}</strong> needing review
                  </span>
                  <span>
                    Registered {formatDateTime(agent.createdAt)}
                  </span>
                </div>
              </div>
              <div className="agent-card-side">
                <div className="approval-seal">
                  {agent.attentionCount === 0 ? "No open issues" : "Needs review"}
                  <br />
                  {agent.latestPolicyVersion
                    ? `Policy v${agent.latestPolicyVersion}`
                    : "No policy"}
                </div>
                <Link
                  href={`/app/agents/${agent.id}`}
                  className="button button-ghost button-small"
                >
                  Open
                  <ArrowRightIcon size={15} />
                </Link>
              </div>
            </article>
          ))}
        </div>
      )}

      <div className="note note-spaced">
        <strong>No permissions granted.</strong> Registering an agent does not
        grant on-chain permissions or connect a wallet. The address is used only
        to match public evidence.
      </div>
    </>
  );
}
