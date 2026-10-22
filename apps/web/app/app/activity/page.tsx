import Link from "next/link";
import { formatDateTime } from "@mandate/chain";
import { PageHeader } from "@/components/ui";
import { activityKindLabel } from "@/lib/labels";
import { listActivity, listAgents } from "@/lib/repo";

export const metadata = {
  title: "Activity",
};

export default async function ActivityPage({
  searchParams,
}: {
  searchParams: Promise<{ agent?: string }>;
}) {
  const query = await searchParams;
  const agents = listAgents();
  const selectedAgent = agents.find((agent) => agent.id === query.agent);
  const activity = listActivity({
    agentId: selectedAgent?.id,
    limit: 150,
  });

  return (
    <>
      <PageHeader
        eyebrow="Audit trail"
        title="Activity"
        description="Workspace events: registration, policy publication, intent approval, and evidence attachment."
        actions={
          <Link href="/app/reports" className="button button-ghost">
            Download a report
          </Link>
        }
      />

      <form className="filter-bar" method="get" action="/app/activity">
        <div className="field">
          <label htmlFor="agent">Agent</label>
          <select id="agent" name="agent" defaultValue={query.agent ?? ""}>
            <option value="">All agents</option>
            {agents.map((agent) => (
              <option key={agent.id} value={agent.id}>
                {agent.name}
                {agent.isDemo && !agent.name.toLowerCase().includes("sample")
                  ? " (sample)"
                  : ""}
              </option>
            ))}
          </select>
        </div>
        <button type="submit" className="button button-ghost button-small">
          Apply
        </button>
        {selectedAgent ? (
          <Link href="/app/activity" className="text-link filter-reset">
            Reset
          </Link>
        ) : null}
      </form>

      <div className="activity-head">
        <p className="small-muted">
          {`${activity.length} ${
            activity.length === 1 ? "event" : "events"
          }${selectedAgent ? ` for ${selectedAgent.name}` : " across the workspace"}.`}
        </p>
      </div>

      {activity.length === 0 ? (
        <div className="empty-state">
          <h3>No activity recorded</h3>
          <p>Register an agent, publish a policy, or attach evidence.</p>
        </div>
      ) : (
        <div className="card activity-card">
          <div className="card-body">
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
                    <div className="timeline-meta">
                      {item.agentId ? (
                        <Link href={`/app/agents/${item.agentId}`}>
                          {item.agentName}
                        </Link>
                      ) : (
                        <span>Workspace</span>
                      )}
                      {item.agentIsDemo ? (
                        <span className="sample-badge">Sample</span>
                      ) : null}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
