"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  AgentIcon,
  AnchorIcon,
  LedgerIcon,
  PulseIcon,
  ReportIcon,
  SourceIcon,
} from "./icons";

const primary = [
  { href: "/app", label: "Overview", icon: LedgerIcon },
  { href: "/app/evidence", label: "Evidence", icon: PulseIcon },
  { href: "/app/activity", label: "Activity", icon: AgentIcon },
  { href: "/app/reports", label: "Reports", icon: ReportIcon },
  { href: "/app/anchors", label: "Anchors", icon: AnchorIcon },
  { href: "/app/sources", label: "Sources", icon: SourceIcon },
];

export function AppNav({
  agents,
}: {
  agents: Array<{ id: string; name: string; isDemo: boolean }>;
}) {
  const pathname = usePathname();

  const isActive = (href: string) =>
    href === "/app" ? pathname === "/app" : pathname.startsWith(href);

  return (
    <nav className="app-nav" aria-label="Workspace">
      <ul className="app-nav-list">
        {primary.map((item) => {
          const Icon = item.icon;
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                className={`app-nav-link ${isActive(item.href) ? "is-active" : ""}`}
              >
                <Icon size={17} />
                <span>{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>

      <div className="app-nav-section-head">
        <span>Agents</span>
        <Link href="/app/agents/new" className="icon-link" aria-label="Register agent">
          +
        </Link>
      </div>
      <ul className="app-agent-list">
        {agents.length === 0 ? (
          <li className="app-agent-empty">No agents yet</li>
        ) : (
          agents.map((agent) => (
            <li key={agent.id}>
              <Link
                href={`/app/agents/${agent.id}`}
                className={`app-agent-link ${
                  pathname.startsWith(`/app/agents/${agent.id}`)
                    ? "is-active"
                    : ""
                }`}
              >
                <span className="agent-initial">
                  {agent.name.slice(0, 1).toUpperCase()}
                </span>
                <span className="agent-link-text">
                  <span>{agent.name}</span>
                  {agent.isDemo ? <small>Sample workspace</small> : null}
                </span>
              </Link>
            </li>
          ))
        )}
      </ul>
    </nav>
  );
}
