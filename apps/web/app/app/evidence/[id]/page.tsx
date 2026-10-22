import Link from "next/link";
import { notFound } from "next/navigation";
import {
  describeVerdict,
  formatCheckValue,
  formatDateTime,
  formatNativeValue,
  shortenAddress,
  shortenHash,
  type CheckState,
} from "@mandate/chain";
import { CopyButton } from "@/components/copy-button";
import {
  ArrowRightIcon,
  ArrowUpRightIcon,
  DownloadIcon,
} from "@/components/icons";
import {
  ChainStatus,
  CoverageBadge,
  Note,
  SourceBadge,
  VerdictBadge,
} from "@/components/ui";
import { evidenceKindLabel } from "@/lib/labels";
import { getAgent, getEvidence, getIntent, getPolicy } from "@/lib/repo";

const stateLabel: Record<CheckState, string> = {
  pass: "Pass",
  fail: "Fail",
  unavailable: "Unavailable",
  not_applicable: "N/A",
};

const intentMatchLabel = {
  match: "Match",
  mismatch: "Mismatch",
  no_intent: "No linked intent",
  unavailable: "Unavailable",
} as const;

const policyResultLabel = {
  within_policy: "Within policy",
  violation: "Violation",
  unavailable: "Unavailable",
} as const;

const chainResultLabel = {
  success: "Success",
  failed: "Failed",
  pending: "Pending",
} as const;

const observedSourceLabel = {
  decoded_inner: "Decoded inner call",
  explorer_inner: "BOT Scan inner call",
  outer: "Outer transaction",
  unavailable: "Unavailable",
} as const;

const decodedByLabel = {
  mandate: "Mandate",
  explorer: "BOT Scan",
  rpc: "RPC",
} as const;

function CheckRows({
  checks,
}: {
  checks: Array<{
    key: string;
    label: string;
    expected: string;
    observed: string;
    state: CheckState;
    detail?: string;
  }>;
}) {
  return (
    <div className="comparison-list">
      {checks.map((check) => (
        <div key={check.key} className="comparison-row">
          <span className="comparison-label">{check.label}</span>
          <span
            className="comparison-cell"
            title={formatCheckValue(check.expected)}
          >
            {formatCheckValue(check.expected)}
          </span>
          <span
            className="comparison-cell"
            title={formatCheckValue(check.observed)}
          >
            {formatCheckValue(check.observed)}
          </span>
          <span className={`comparison-state state-${check.state}`}>
            {stateLabel[check.state]}
          </span>
        </div>
      ))}
    </div>
  );
}

export default async function EvidenceDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ attached?: string }>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const record = getEvidence(id);
  if (!record) notFound();

  const agent = getAgent(record.agentId);
  if (!agent) notFound();
  const intent = record.intentId ? getIntent(record.intentId) : null;
  const policy = getPolicy(record.policyId);

  return (
    <>
      {query.attached === "1" ? (
        <div className="form-success-banner spaced" role="status">
          Evidence fetched and attached. Review the comparisons and coverage
          notes below.
        </div>
      ) : null}

      <article className="detail-hero">
        <div className="detail-hero-head">
          <div>
            <p className="eyebrow">
              {evidenceKindLabel(record.kind)} · attached{" "}
              {formatDateTime(record.attachedAt)}
            </p>
            <h1>{record.intentTitle ?? "Unattributed observed action"}</h1>
            <div className="detail-hero-meta">
              <span>{record.hash}</span>
              <Link href={`/app/agents/${agent.id}`}>
                {agent.name}
              </Link>
            </div>
          </div>
          <div className="detail-hero-badges">
            <VerdictBadge verdict={record.evaluation.verdict} />
            <SourceBadge source={record.source} />
            <CoverageBadge coverage={record.observed.coverage} />
            <ChainStatus status={record.observed.chainStatus} />
          </div>
        </div>

        <div className="detail-summary">
          <div className="detail-summary-main">
            <p className="eyebrow">Verdict</p>
            <p className="verdict-statement">
              {describeVerdict(record.evaluation.verdict)}
            </p>
            <div className="verdict-facts">
              <span>
                Intent match:{" "}
                <strong>
                  {intentMatchLabel[record.evaluation.intentMatch]}
                </strong>
              </span>
              <span>
                Policy result:{" "}
                <strong>
                  {policyResultLabel[record.evaluation.policyResult]}
                </strong>
              </span>
              <span>
                Chain result:{" "}
                <strong>{chainResultLabel[record.evaluation.chainResult]}</strong>
              </span>
            </div>
            <div className="detail-actions">
              {record.source === "live" ? (
                <a
                  href={record.observed.explorerUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="button button-ghost button-small"
                >
                  BOT Scan
                  <ArrowUpRightIcon size={14} />
                </a>
              ) : null}
              <a
                href={`/api/reports/${agent.id}?format=md&download=1`}
                className="button button-ghost button-small"
              >
                <DownloadIcon size={14} />
                Download report
              </a>
              <Link
                href={`/app/agents/${agent.id}/evidence/new?kind=${record.kind}`}
                className="text-link"
              >
                Attach another
                <ArrowRightIcon size={13} />
              </Link>
            </div>
          </div>
          <div className="detail-summary-side">
            <p className="eyebrow">Record</p>
            <div className="detail-list">
              <div className="detail-row">
                <dt>Agent</dt>
                <dd>
                  <Link href={`/app/agents/${agent.id}`}>{agent.name}</Link>
                </dd>
              </div>
              <div className="detail-row">
                <dt>Smart account</dt>
                <dd className="detail-value-mono">
                  <span className="inline-hash">
                    <code>{agent.smartAccount}</code>
                    <CopyButton value={agent.smartAccount} />
                  </span>
                </dd>
              </div>
              <div className="detail-row">
                <dt>Policy snapshot</dt>
                <dd>
                  {policy ? (
                    <Link href={`/app/agents/${agent.id}/policy`}>
                      v{record.policyVersion} · {policy.name}
                    </Link>
                  ) : (
                    `v${record.policyVersion}`
                  )}
                </dd>
              </div>
              <div className="detail-row">
                <dt>Hash</dt>
                <dd className="detail-value-mono">
                  <span className="inline-hash">
                    <code>{shortenHash(record.hash, 10)}</code>
                    <CopyButton value={record.hash} />
                  </span>
                </dd>
              </div>
              <div className="detail-row">
                <dt>Attached</dt>
                <dd>{formatDateTime(record.attachedAt)}</dd>
              </div>
              <div className="detail-row">
                <dt>Fetched</dt>
                <dd>{formatDateTime(record.fetchedAt)}</dd>
              </div>
              <div className="detail-row">
                <dt>Decoded by</dt>
                <dd>{decodedByLabel[record.observed.decodedBy]}</dd>
              </div>
            </div>
          </div>
        </div>
      </article>

      <div className="stack-lg evidence-detail-body">
        <section>
          <div className="section-heading">
            <div>
              <p className="eyebrow">Observed action</p>
              <h2>What the record shows</h2>
              <p>
                Each field includes its source. Unavailable values are left
                unavailable rather than inferred.
              </p>
            </div>
          </div>
          <div className="card">
            <div className="card-body">
              <div className="detail-list">
                <div className="detail-row">
                  <dt>Sender</dt>
                  <dd className="detail-value-mono">
                    {record.observed.sender}
                  </dd>
                </div>
                <div className="detail-row">
                  <dt>Target</dt>
                  <dd className="detail-value-mono">
                    {record.observed.target ? (
                      <>
                        {record.observed.target}{" "}
                        <span className="small-muted">
                          · {observedSourceLabel[record.observed.targetSource]}
                        </span>
                      </>
                    ) : (
                      "Unavailable"
                    )}
                  </dd>
                </div>
                <div className="detail-row">
                  <dt>Method</dt>
                  <dd>
                    {record.observed.methodLabel ??
                      record.observed.methodSelector ??
                      "Unavailable"}
                    {record.observed.methodSelector ? (
                      <span className="mono-small">
                        {" "}
                        · {record.observed.methodSelector}
                      </span>
                    ) : null}
                  </dd>
                </div>
                <div className="detail-row">
                  <dt>Native value</dt>
                  <dd>
                    {record.observed.valueWei ? (
                      <>
                        {formatNativeValue(record.observed.valueWei)}{" "}
                        <span className="small-muted">
                          · {observedSourceLabel[record.observed.valueSource]}
                        </span>
                      </>
                    ) : (
                      "Unavailable"
                    )}
                  </dd>
                </div>
                <div className="detail-row">
                  <dt>Outer envelope</dt>
                  <dd>{record.observed.outerEnvelopeLabel ?? "Not applicable"}</dd>
                </div>
                <div className="detail-row">
                  <dt>Outer transaction</dt>
                  <dd className="detail-value-mono">
                    {record.observed.outerTransactionHash ?? "Unavailable"}
                  </dd>
                </div>
                <div className="detail-row">
                  <dt>Block</dt>
                  <dd>{record.observed.blockNumber ?? "Unavailable"}</dd>
                </div>
                <div className="detail-row">
                  <dt>Confirmed</dt>
                  <dd>{formatDateTime(record.observed.confirmedAt)}</dd>
                </div>
                <div className="detail-row">
                  <dt>Fee</dt>
                  <dd>{formatNativeValue(record.observed.feeWei)}</dd>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section>
          <div className="section-heading">
            <div>
              <p className="eyebrow">Intent comparison</p>
              <h2>Against the approved intent</h2>
              <p>
                {intent
                  ? `Recorded by ${intent.approvedBy} on ${formatDateTime(intent.createdAt)}.`
                  : "No intent is linked. The action is preserved for review."}
              </p>
            </div>
            {intent ? (
              <Link href={`/app/agents/${agent.id}#intents`} className="text-link">
                Open agent
                <ArrowRightIcon size={13} />
              </Link>
            ) : null}
          </div>
          <CheckRows checks={record.evaluation.checks} />
          {intent ? (
            <div className="card intent-detail-card">
              <div className="card-body">
                <div className="intent-detail-head">
                  <div>
                    <p className="field-label">Approved intent</p>
                    <h3>{intent.title}</h3>
                    <p>{intent.rationale}</p>
                  </div>
                  <span className="policy-version">v{intent.policyVersion}</span>
                </div>
                <div className="intent-row-meta">
                  <span>Target {shortenAddress(intent.target)}</span>
                  <span>Method {intent.methodSelector}</span>
                  <span>Value {formatNativeValue(intent.valueWei)}</span>
                  <span>
                    Fingerprint{" "}
                    <Link
                      href={`/app/anchors?hash=${intent.fingerprint}`}
                      className="small-link"
                    >
                      {shortenHash(intent.fingerprint, 7)}
                    </Link>
                  </span>
                </div>
              </div>
            </div>
          ) : null}
        </section>

        <section>
          <div className="section-heading">
            <div>
              <p className="eyebrow">Policy comparison</p>
              <h2>Against the recorded policy</h2>
              <p>
                {policy
                  ? `${policy.name} · version ${policy.version}.`
                  : "The policy snapshot is unavailable."}
              </p>
            </div>
            {policy ? (
              <Link
                href={`/app/agents/${agent.id}/policy`}
                className="text-link"
              >
                Policy history
                <ArrowRightIcon size={13} />
              </Link>
            ) : null}
          </div>
          {policy ? (
            <>
              <CheckRows checks={record.evaluation.policyChecks} />
              <div className="policy-meta policy-detail-meta">
                <span>
                  Per-action cap{" "}
                  {formatNativeValue(policy.maxNativeValuePerActionWei)}
                </span>
                <span>
                  Daily cap{" "}
                  {policy.maxNativeValuePerDayWei
                    ? formatNativeValue(policy.maxNativeValuePerDayWei)
                    : "not set"}
                </span>
                <span>
                  Expiry{" "}
                  {policy.expiresAt ? formatDateTime(policy.expiresAt) : "none"}
                </span>
                <span>
                  Policy hash{" "}
                  <Link
                    href={`/app/anchors?hash=${policy.hash}`}
                    className="small-link"
                  >
                    {shortenHash(policy.hash, 8)}
                  </Link>
                </span>
              </div>
            </>
          ) : (
            <Note tone="warning">
              The policy snapshot referenced by this record could not be loaded.
            </Note>
          )}
        </section>

        <section>
          <div className="section-heading">
            <div>
              <p className="eyebrow">Coverage</p>
              <h2>What remains visible</h2>
              <p>
                Coverage notes record gaps and limits in the available evidence.
              </p>
            </div>
          </div>
          <div className="coverage-notes">
            {record.evaluation.coverageNotes.map((note) => (
              <div className="note" key={note}>
                {note}
              </div>
            ))}
          </div>
          {record.observed.tokenMovements.length > 0 ? (
            <div className="token-block">
              <p className="field-label">Informational token movements</p>
              <p className="source-note">
                Token movements are displayed for context and are not evaluated
                by the policy.
              </p>
              <div className="token-list">
                {record.observed.tokenMovements.map((movement) => (
                  <div
                    key={`${movement.tokenAddress}-${movement.logIndex ?? movement.from}-${movement.amountRaw}`}
                    className="token-row"
                  >
                    <div>
                      <p className="token-amount">{movement.amountFormatted}</p>
                      <p className="token-path">
                        {movement.symbol ?? "Token"} · {movement.tokenAddress}
                      </p>
                    </div>
                    <p className="token-path">
                      {shortenAddress(movement.from)} →{" "}
                      {shortenAddress(movement.to)}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
          <details className="raw-details">
            <summary>Raw record data</summary>
            <pre>
              {JSON.stringify(
                {
                  observed: record.observed,
                  evaluation: record.evaluation,
                },
                null,
                2,
              )}
            </pre>
          </details>
        </section>
      </div>

      {record.source === "sample" ? (
        <Note tone="warning">
          This is a labeled sample record. It was not fetched from BOT Chain and
          must not be treated as live evidence.
        </Note>
      ) : null}
    </>
  );
}
