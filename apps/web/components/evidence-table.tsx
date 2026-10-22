import Link from "next/link";
import {
  formatDateTime,
  formatNativeValue,
  shortenAddress,
  shortenHash,
} from "@mandate/chain";
import type { AppEvidence } from "@/lib/repo";
import {
  ChainStatus,
  CoverageBadge,
  SourceBadge,
  VerdictBadge,
} from "./ui";

const kindLabel = (kind: string) =>
  kind === "user_operation" ? "UserOperation" : "Transaction";

export function EvidenceTable({
  records,
  showAgent = true,
  emptyMessage = "No evidence has been attached yet.",
}: {
  records: AppEvidence[];
  showAgent?: boolean;
  emptyMessage?: string;
}) {
  if (records.length === 0) {
    return (
      <div className="empty-state">
        <h3>No evidence yet</h3>
        <p>{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="table-wrap">
      <table className="data-table">
        <thead>
          <tr>
            <th scope="col">Verdict</th>
            <th scope="col">Evidence</th>
            {showAgent ? <th scope="col">Agent</th> : null}
            <th scope="col">Observed action</th>
            <th scope="col">Source</th>
            <th scope="col">Attached</th>
          </tr>
        </thead>
        <tbody>
          {records.map((record) => (
            <tr key={record.id}>
              <td>
                <VerdictBadge
                  verdict={record.evaluation.verdict}
                  compact
                />
              </td>
              <td>
                <div className="table-primary">
                  <Link href={`/app/evidence/${record.id}`}>
                    {shortenHash(record.hash)}
                  </Link>
                  <span>
                    {kindLabel(record.kind)} ·{" "}
                    {record.observed.coverage === "complete"
                      ? "complete coverage"
                      : "partial coverage"}
                  </span>
                </div>
              </td>
              {showAgent ? (
                <td>
                  <Link
                    href={`/app/agents/${record.agentId}`}
                    className="table-primary"
                  >
                    <strong>{record.agentName}</strong>
                    <span>{shortenAddress(record.agentSmartAccount)}</span>
                  </Link>
                </td>
              ) : null}
              <td>
                <div className="table-primary">
                  <strong>
                    {record.observed.target
                      ? shortenAddress(record.observed.target)
                      : "Target unavailable"}
                  </strong>
                  <span>
                    {record.observed.methodLabel ??
                      record.observed.methodSelector ??
                      "No method"}{" "}
                    · {formatNativeValue(record.observed.valueWei)}
                  </span>
                </div>
              </td>
              <td>
                <div className="pill-row">
                  <SourceBadge source={record.source} />
                  <CoverageBadge coverage={record.observed.coverage} />
                </div>
                <div className="badge-stack">
                  <ChainStatus status={record.observed.chainStatus} />
                </div>
              </td>
              <td>
                <span className="table-hash">
                  {formatDateTime(record.attachedAt)}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
