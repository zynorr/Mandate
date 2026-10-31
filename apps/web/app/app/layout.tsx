import type { Metadata } from "next";
import { AppShell } from "@/components/app-shell";
import { listAgents } from "@/lib/repo";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Workspace",
  description:
    "Review BOT Chain agent intents, evidence, and policy coverage.",
};

export default function WorkspaceLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const agents = listAgents().map((agent) => ({
    id: agent.id,
    name: agent.name,
    isDemo: agent.isDemo,
  }));

  return <AppShell agents={agents}>{children}</AppShell>;
}
