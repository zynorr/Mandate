import Link from "next/link";
import type { EvidenceVerdict } from "@mandate/chain";
import { EvidenceTable } from "@/components/evidence-table";
import { ArrowRightIcon, DownloadIcon, SearchIcon } from "@/components/icons";
import { Note, PageHeader } from "@/components/ui";
import { listAgents, listEvidence } from "@/lib/repo";

const verdictOptions: Array<{ value: EvidenceVerdict; label: string }> = [
  { value: "matched", label: "Matched" },
  { value: "out_of_policy", label: "Out of policy" },
  { value: "failed", label: "Failed" },
  { value: "unattributed", label: "Unattributed" },
  { value: "needs_review", label: "Needs review" },
  { value: "pending", label: "Pending" },
];

const isVerdict = (value: string | undefined): value is EvidenceVerdict =>
  verdictOptions.some((option) => option.value === value);

export default async function EvidencePage({
  searchParams,
}: {
  searchParams: Promise<{
    agent?: string;
    verdict?: string;
    source?: string;
    q?: string;
  }>;
}) {
  const query = await searchParams;
  const agents = listAgents();
  const allEvidence = listEvidence({ limit: 1000 });
  const selectedAgent = agents.find((agent) => agent.id === query.agent);
  const verdict = isVerdict(query.verdict) ? query.verdict : undefined;
  const source =
    query.source === "live" || query.source === "sample"
      ? query.source
      : undefined;
  const search = query.q?.trim().toLowerCase() ?? "";

  const evidence = allEvidence.filter((record) => {
    if (selectedAgent && record.agentId !== selectedAgent.id) return false;
    if (verdict && record.evaluation.verdict !== verdict) return false;
    if (source && record.source !== source) return false;
    if (search) {
      const haystack = [
        record.hash,
        record.agentName,
        record.intentTitle ?? "",
        record.observed.methodLabel ?? "",
        record.observed.methodSelector ?? "",
        record.observed.target ?? "",
      ]
        .join(" ")
        .toLowerCase();
      if (!haystack.includes(search)) return false;
    }
    return true;
  });

  const hasFilters = Boolean(selectedAgent || verdict || source || search);
  const firstAgent = agents[0] ?? null;

  return (
    <>
      <PageHeader
        eyebrow="Ledger"
        title="Evidence"
        description="Every observed action, its comparison state, and the coverage limits behind the verdict."
        actions={
          <>
            <Link href="/app/reports" className="button button-ghost">
              <DownloadIcon size={15} />
              Reports
            </Link>
            {firstAgent ? (
              <Link
                href={`/app/agents/${firstAgent.id}/evidence/new`}
                className="button button-ink"
              >
                Attach evidence
              </Link>
            ) : null}
          </>
        }
      />

      <form className="filter-bar" method="get" action="/app/evidence">
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
        <div className="field">
          <label htmlFor="verdict">Verdict</label>
          <select id="verdict" name="verdict" defaultValue={query.verdict ?? ""}>
            <option value="">All verdicts</option>
            {verdictOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="source">Source</label>
          <select id="source" name="source" defaultValue={source ?? ""}>
            <option value="">All sources</option>
            <option value="live">Live</option>
            <option value="sample">Sample</option>
          </select>
        </div>
        <div className="field filter-search">
          <label htmlFor="q">Search</label>
          <input
            id="q"
            name="q"
            type="search"
            defaultValue={query.q ?? ""}
            placeholder="Hash, agent, method…"
          />
        </div>
        <button type="submit" className="button button-ghost button-small">
          <SearchIcon size={14} />
          Apply
        </button>
        {hasFilters ? (
          <Link href="/app/evidence" className="text-link filter-reset">
            Reset
          </Link>
        ) : null}
      </form>

      <div className="evidence-list-head">
        <p className="small-muted">
          {`Showing ${evidence.length} of ${allEvidence.length} ${
            allEvidence.length === 1 ? "record" : "records"
          }${selectedAgent ? ` for ${selectedAgent.name}` : ""}.`}
        </p>
        <div className="pill-row">
          <span className="sample-badge">
            {allEvidence.filter((record) => record.source === "sample").length}{" "}
            sample
          </span>
          <span className="live-badge">
            {allEvidence.filter((record) => record.source === "live").length}{" "}
            live
          </span>
        </div>
      </div>

      {allEvidence.some((record) => record.source === "sample") ? (
        <Note>
          <strong>Sample records are labeled.</strong> They illustrate the review
          states and are not live BOT Chain evidence.
        </Note>
      ) : null}

      <EvidenceTable
        records={evidence}
        emptyMessage={
          hasFilters
            ? "No evidence matches these filters."
            : "Attach a public transaction or UserOperation to build the ledger."
        }
      />

      <div className="card-foot ledger-foot">
        <span>
          A matched verdict covers only the observed fields.
        </span>
        <Link href="/app/sources" className="text-link">
          Check sources
          <ArrowRightIcon size={13} />
        </Link>
      </div>
    </>
  );
}
