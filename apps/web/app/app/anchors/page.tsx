import Link from "next/link";
import {
  formatDateTime,
  networkLabel,
  shortenHash,
} from "@mandate/chain";
import { CopyButton } from "@/components/copy-button";
import { AnchorIcon, ArrowUpRightIcon } from "@/components/icons";
import { Note, PageHeader } from "@/components/ui";
import {
  getAnchorCount,
  getAnchorLookup,
  getAnchorRegistry,
} from "@/lib/anchors";
import { getAppConfig } from "@/lib/config";
import { anchorKindLabel } from "@/lib/labels";

export const metadata = {
  title: "Anchors",
};

const hashPattern = /^0x[0-9a-fA-F]{64}$/;

export default async function AnchorsPage({
  searchParams,
}: {
  searchParams: Promise<{ hash?: string | string[] }>;
}) {
  const query = await searchParams;
  const config = getAppConfig();
  const network = networkLabel(config.chainId);
  const rawHash = Array.isArray(query.hash) ? query.hash[0] : query.hash;
  const contentHash = rawHash?.trim() ?? "";
  const validHash = hashPattern.test(contentHash);
  const registry = getAnchorRegistry();
  const [count, result] = await Promise.all([
    registry.address ? getAnchorCount() : Promise.resolve(null),
    registry.address && validHash
      ? getAnchorLookup(contentHash.toLowerCase() as `0x${string}`)
      : Promise.resolve(null),
  ]);

  return (
    <>
      <PageHeader
        eyebrow="Proofs"
        title="Anchor registry"
        description={
          <>
            Check whether a policy hash, intent fingerprint, or report
            fingerprint is recorded on {network}. Mandate reads the registry;
            it does not write to it.
          </>
        }
      />

      <section className="card card-pad anchor-registry">
        <p className="field-label">Registry contract</p>
        {registry.address ? (
          <>
            <div className="account-block">
              <span>{registry.address}</span>
              <CopyButton
                value={registry.address}
                label="Copy registry address"
              />
            </div>
            <div className="kv-inline kv-spaced">
              <span>
                {config.networkName} · {config.chainId}
              </span>
              <span>
                {count === null
                  ? "Anchor count unavailable"
                  : `${count.toString()} ${
                      count === 1n ? "anchor" : "anchors"
                    } recorded`}
              </span>
              <span>Read-only lookup</span>
            </div>
            <p className="small-muted">
              <Link
                href={`${registry.explorerUrl}/address/${registry.address}`}
                className="text-link"
                target="_blank"
                rel="noreferrer"
              >
                Open in BOT Scan
                <ArrowUpRightIcon size={14} />
              </Link>
            </p>
          </>
        ) : (
          <p className="small-muted">
            No anchor registry is configured for this workspace.
          </p>
        )}
      </section>

      <section className="card anchor-panel">
        <div className="card-head">
          <div>
            <h2>Check a content hash</h2>
            <p>Policy hashes, intent fingerprints, and report fingerprints.</p>
          </div>
        </div>
        <div className="card-body">
          <form className="anchor-form" method="get">
            <div className="field field-mono">
              <label htmlFor="hash">Content hash</label>
              <input
                id="hash"
                name="hash"
                type="text"
                defaultValue={contentHash}
                placeholder="0x…"
                autoComplete="off"
                spellCheck={false}
              />
              <span className="field-hint">
                Paste a 32-byte hex hash. The lookup sends no wallet request.
              </span>
            </div>
            <div className="form-actions">
              <p className="form-actions-note">
                Anchors are optional on-chain records. The workspace never
                creates them.
              </p>
              <button type="submit" className="button button-ink">
                <AnchorIcon size={15} />
                Check anchor
              </button>
            </div>
          </form>
        </div>
      </section>

      {contentHash && !validHash ? (
        <div className="note-spaced">
          <Note tone="warning">
            <strong>Invalid hash.</strong> Enter a 32-byte hex value beginning
            with 0x.
          </Note>
        </div>
      ) : null}

      {result?.state === "anchored" ? (
        <section className="card anchor-result">
          <div className="card-head">
            <div>
              <div className="agent-name-line">
                <h2>Anchored</h2>
                <span className="live-badge">Recorded on chain</span>
              </div>
              <p>This hash is present in the Mandate anchor registry.</p>
            </div>
          </div>
          <div className="card-body">
            <dl className="detail-list">
              <div className="detail-row">
                <dt>Kind</dt>
                <dd>{anchorKindLabel(result.kind)}</dd>
              </div>
              <div className="detail-row">
                <dt>Recorded by</dt>
                <dd className="detail-value-mono">
                  {result.recorder}
                  <CopyButton
                    value={result.recorder}
                    label="Copy anchor recorder"
                  />
                </dd>
              </div>
              <div className="detail-row">
                <dt>Anchored</dt>
                <dd>{formatDateTime(result.timestamp)}</dd>
              </div>
              <div className="detail-row">
                <dt>Content hash</dt>
                <dd className="detail-value-mono">
                  {contentHash.toLowerCase()}
                  <CopyButton
                    value={contentHash.toLowerCase()}
                    label="Copy content hash"
                  />
                </dd>
              </div>
            </dl>
          </div>
        </section>
      ) : null}

      {result?.state === "missing" ? (
        <div className="note-spaced">
          <Note tone="warning">
            <strong>Not anchored.</strong> No registry entry was found for{" "}
            <code>{shortenHash(contentHash.toLowerCase())}</code>.
          </Note>
        </div>
      ) : null}

      {result?.state === "unavailable" ? (
        <div className="note-spaced">
          <Note tone="warning">
            <strong>Anchor lookup unavailable.</strong> The registry RPC request
            failed. The record may still be anchored; try again later.
          </Note>
        </div>
      ) : null}

      {result?.state === "disabled" ? (
        <div className="note-spaced">
          <Note tone="warning">
            <strong>No registry configured.</strong> Set{" "}
            <code>MANDATE_ANCHOR_REGISTRY_ADDRESS</code> to enable anchor
            checks.
          </Note>
        </div>
      ) : null}

      <div className="note note-spaced">
        <strong>What an anchor proves.</strong> It proves that the content hash
        was recorded in the registry by the listed address at the listed time.
        It does not prove authorship, correctness, or that the underlying record
        is current.
      </div>
    </>
  );
}
