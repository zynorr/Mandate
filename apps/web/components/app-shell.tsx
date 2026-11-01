import Link from "next/link";
import type { ReactNode } from "react";
import { getAppConfig } from "@/lib/config";
import { networkLabel } from "@mandate/chain";
import { AppNav } from "./app-nav";
import { SiteFooter, Wordmark } from "./brand";

const shellAgents = (agents: Array<{ id: string; name: string; isDemo: boolean }>) =>
  agents.map((agent) => ({
    id: agent.id,
    name: agent.name,
    isDemo: agent.isDemo,
  }));

export function AppShell({
  agents,
  children,
}: {
  agents: Array<{ id: string; name: string; isDemo: boolean }>;
  children: ReactNode;
}) {
  const config = getAppConfig();
  const shortNetwork = networkLabel(config.chainId);
  return (
    <div className="app-frame">
      <aside className="app-sidebar">
        <div className="app-sidebar-top">
          <Link href="/" className="brand-link" aria-label="Mandate home">
            <Wordmark />
          </Link>
          <div className="environment-pill">
            <span className="environment-dot" aria-hidden="true" />
            {shortNetwork} · {config.chainId}
          </div>
        </div>
        <AppNav agents={shellAgents(agents)} />
        <div className="app-sidebar-foot">
          <p className="sidebar-kicker">Read-only chain access</p>
          <p>
            Mandate never holds keys, signs transactions, or submits
            UserOperations.
          </p>
          <Link href="/app/sources">Check sources</Link>
        </div>
      </aside>
      <div className="app-main">
        <header className="app-mobile-header">
          <Link href="/" aria-label="Mandate home">
            <Wordmark compact />
          </Link>
          <span className="environment-pill">
            <span className="environment-dot" aria-hidden="true" />
            {config.chainId}
          </span>
        </header>
        <div className="app-mobile-nav">
          <AppNav agents={shellAgents(agents)} />
        </div>
        <main className="app-content" id="main">
          {children}
        </main>
        <SiteFooter compact />
      </div>
    </div>
  );
}
