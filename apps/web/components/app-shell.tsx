import Link from "next/link";
import type { ReactNode } from "react";
import { BOT_TESTNET_CHAIN_ID } from "@mandate/chain";
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
  return (
    <div className="app-frame">
      <aside className="app-sidebar">
        <div className="app-sidebar-top">
          <Link href="/" className="brand-link" aria-label="Mandate home">
            <Wordmark />
          </Link>
          <div className="environment-pill">
            <span className="environment-dot" aria-hidden="true" />
            BOT testnet · {BOT_TESTNET_CHAIN_ID}
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
            968
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
