import Link from "next/link";
import { SearchIcon } from "@/components/icons";
import { EmptyState, PageHeader } from "@/components/ui";

export default function WorkspaceNotFound() {
  return (
    <>
      <PageHeader
        eyebrow="404 · Workspace"
        title="Record not found"
        description="The agent, policy, intent, or evidence record does not exist in this workspace."
      />
      <EmptyState
        icon={<SearchIcon size={20} />}
        title="Nothing matches this link"
        body="Check the link or return to the evidence ledger."
        action={
          <div className="page-actions">
            <Link href="/app/evidence" className="button button-ghost">
              Open evidence
            </Link>
            <Link href="/app/agents" className="button button-ink">
              View agents
            </Link>
          </div>
        }
      />
    </>
  );
}
