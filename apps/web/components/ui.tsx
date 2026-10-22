import type { ReactNode } from "react";
import type { EvidenceVerdict } from "@mandate/chain";

const verdictLabels: Record<EvidenceVerdict, string> = {
  matched: "Matched",
  out_of_policy: "Out of policy",
  failed: "Failed",
  unattributed: "Unattributed",
  needs_review: "Needs review",
  pending: "Pending",
};

const verdictTone: Record<EvidenceVerdict, string> = {
  matched: "matched",
  out_of_policy: "out",
  failed: "failed",
  unattributed: "unattributed",
  needs_review: "review",
  pending: "pending",
};

export function VerdictBadge({
  verdict,
  compact = false,
}: {
  verdict: EvidenceVerdict;
  compact?: boolean;
}) {
  return (
    <span
      className={`status-badge status-${verdictTone[verdict]} ${
        compact ? "status-compact" : ""
      }`}
    >
      <span className="status-dot" aria-hidden="true" />
      {verdictLabels[verdict]}
    </span>
  );
}

export function verdictLabel(verdict: EvidenceVerdict): string {
  return verdictLabels[verdict];
}

export function CoverageBadge({
  coverage,
}: {
  coverage: "complete" | "partial";
}) {
  return (
    <span
      className={`coverage-badge ${
        coverage === "complete" ? "coverage-complete" : "coverage-partial"
      }`}
    >
      {coverage === "complete" ? "Complete coverage" : "Partial coverage"}
    </span>
  );
}

export function SourceBadge({
  source,
}: {
  source: "live" | "sample";
}) {
  if (source === "sample") {
    return <span className="sample-badge">Sample</span>;
  }
  return <span className="live-badge">Live</span>;
}

export function SampleBadge({ isDemo }: { isDemo: boolean }) {
  if (!isDemo) return null;
  return <span className="sample-badge">Sample workspace</span>;
}

export function ChainStatus({
  status,
}: {
  status: "success" | "failed" | "pending";
}) {
  return (
    <span className={`chain-status chain-${status}`}>
      {status === "success"
        ? "Confirmed"
        : status === "failed"
          ? "Failed on chain"
          : "Pending"}
    </span>
  );
}

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string;
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="page-header">
      <div>
        {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
        <h1>{title}</h1>
        {description ? <div className="page-description">{description}</div> : null}
      </div>
      {actions ? <div className="page-actions">{actions}</div> : null}
    </div>
  );
}

export function Metric({
  label,
  value,
  detail,
  tone = "default",
}: {
  label: string;
  value: string | number;
  detail?: string;
  tone?: "default" | "warning" | "positive" | "quiet";
}) {
  return (
    <div className={`metric metric-${tone}`}>
      <p className="metric-label">{label}</p>
      <p className="metric-value">{value}</p>
      {detail ? <p className="metric-detail">{detail}</p> : null}
    </div>
  );
}

export function SectionHeading({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="section-heading">
      <div>
        {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
        <h2>{title}</h2>
        {description ? <p>{description}</p> : null}
      </div>
      {action}
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  body,
  action,
}: {
  icon?: ReactNode;
  title: string;
  body: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty-state">
      {icon ? <div className="empty-icon">{icon}</div> : null}
      <h3>{title}</h3>
      <p>{body}</p>
      {action ? <div className="empty-action">{action}</div> : null}
    </div>
  );
}

export function Note({
  tone = "neutral",
  children,
}: {
  tone?: "neutral" | "warning" | "positive";
  children: ReactNode;
}) {
  return <div className={`note note-${tone}`}>{children}</div>;
}
