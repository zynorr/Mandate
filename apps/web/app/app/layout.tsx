import type { Metadata } from "next";
import { AppShell } from "@/components/app-shell";
import { requireUser } from "@/lib/auth";
import { ensureDemoWorkspace } from "@/lib/db";
import { listAgents } from "@/lib/repo";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Workspace",
  description:
    "Review BOT Chain agent intents, evidence, and policy coverage.",
};

export default async function WorkspaceLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const user = await requireUser();
  await ensureDemoWorkspace(user.ownerId);
  const agents = (await listAgents(user.ownerId)).map((agent) => ({
    id: agent.id,
    name: agent.name,
    isDemo: agent.isDemo,
  }));

  return (
    <AppShell agents={agents} user={user}>
      {children}
    </AppShell>
  );
}
