import Link from "next/link";
import { networkLabel, networkName } from "@mandate/chain";
import { SiteFooter, SiteHeader } from "@/components/brand";
import { getAppConfig } from "@/lib/config";
import {
  AlertIcon,
  AnchorIcon,
  ArrowRightIcon,
  CheckIcon,
  ClockIcon,
  FileCheckIcon,
  ShieldIcon,
} from "@/components/icons";
import { VerdictBadge } from "@/components/ui";

const reviewStates = [
  {
    verdict: "matched" as const,
    meaning:
      "The available observed fields match the linked intent and the recorded policy snapshot.",
  },
  {
    verdict: "out_of_policy" as const,
    meaning:
      "The action belongs to the agent, but a target, method, value, or policy check differs.",
  },
  {
    verdict: "failed" as const,
    meaning:
      "The chain reports failure. Mandate preserves the record without treating it as authorized.",
  },
  {
    verdict: "unattributed" as const,
    meaning:
      "There is no approved intent attached. The action remains visible for review.",
  },
  {
    verdict: "needs_review" as const,
    meaning:
      "Coverage is incomplete. Mandate does not convert missing evidence into a pass.",
  },
  {
    verdict: "pending" as const,
    meaning:
      "The action is not yet confirmed. No success claim is made before a receipt.",
  },
];

export default function HomePage() {
  const config = getAppConfig();
  const network = networkLabel(config.chainId);
  return (
    <>
      <SiteHeader />
      <main id="main" className="marketing-main">
        <section className="hero">
          <div className="shell">
            <div className="hero-grid">
              <div>
                <p className="eyebrow">
                  Agent authorization evidence · {network}
                </p>
                <h1>
                  Approve the action.
                  <br />
                  Verify what <em>happened</em>.
                </h1>
                <p className="hero-lede">
                  Mandate compares an approved intent with activity from a{" "}
                  {network} smart account, then keeps the comparison and its
                  coverage gaps in a reviewable ledger.
                </p>
                <div className="hero-actions">
                  <Link href="/app" className="button button-ink">
                    Open the evidence ledger
                    <ArrowRightIcon size={16} />
                  </Link>
                  <a href="#how-it-works" className="button button-ghost">
                    How it works
                  </a>
                </div>
                <div className="hero-footnote">
                  <span>Read-only app</span>
                  <span>No custody or signing</span>
                  <span>
                    {network} · {config.chainId}
                  </span>
                </div>
              </div>

              <div className="hero-record-wrap">
                <article className="record-card">
                  <div className="record-head">
                    <p className="record-kicker">Illustrative review record</p>
                    <span className="sample-badge">Sample</span>
                  </div>
                  <h2 className="record-title">Vendor settlement · invoice 1042</h2>
                  <p className="record-sub">
                    One approved transfer, compared field by field.
                  </p>
                  <div className="record-body">
                    <div className="record-line">
                      <span className="record-line-label">Intent</span>
                      <span className="record-line-value">
                        Settle sample invoice
                      </span>
                      <CheckIcon size={15} className="record-line-icon" />
                    </div>
                    <div className="record-line">
                      <span className="record-line-label">Target</span>
                      <span className="record-line-value mono-small">
                        0x75ed…0fe3
                      </span>
                      <CheckIcon size={15} className="record-line-icon" />
                    </div>
                    <div className="record-line">
                      <span className="record-line-label">Method</span>
                      <span className="record-line-value mono-small">
                        transfer(address,uint256)
                      </span>
                      <CheckIcon size={15} className="record-line-icon" />
                    </div>
                    <div className="record-line">
                      <span className="record-line-label">Value</span>
                      <span className="record-line-value">0 BOT</span>
                      <CheckIcon size={15} className="record-line-icon" />
                    </div>
                    <div className="record-line">
                      <span className="record-line-label">Coverage</span>
                      <span className="record-line-value">
                        Complete for observed fields
                      </span>
                      <CheckIcon size={15} className="record-line-icon" />
                    </div>
                  </div>
                  <div className="record-verdict">
                    <div>
                      <p className="record-verdict-label">
                        Matches the approved intent
                      </p>
                      <small>
                        Not a guarantee of unobserved behavior.
                      </small>
                    </div>
                    <VerdictBadge verdict="matched" compact />
                  </div>
                  <div className="record-foot">
                    <span>Intent fingerprint 0x91c2…7af4</span>
                    <span>Stored locally</span>
                  </div>
                  <div className="record-stamp">
                    Evidence
                    <br />
                    reviewed
                  </div>
                </article>
              </div>
            </div>

            <div className="trust-strip" aria-label="Product boundaries">
              <div className="trust-item">
                <strong>Read-only app</strong>
                No keys, signing, or UserOperation submission.
              </div>
              <div className="trust-item">
                <strong>Specific approvals</strong>
                Checks one approved action, not just a balance.
              </div>
              <div className="trust-item">
                <strong>Visible gaps</strong>
                Missing fields become review items, not passes.
              </div>
              <div className="trust-item">
                <strong>Exports</strong>
                Download an agent&apos;s record as JSON or Markdown.
              </div>
            </div>
          </div>
        </section>

        <section className="section">
          <div className="shell">
            <div className="section-head">
              <div>
                <p className="eyebrow">The premise</p>
                <h2>
                  “It happened on-chain” is not the same as “it was authorized.”
                </h2>
                <p className="section-head-lede">
                  A transaction hash shows that something was submitted to the
                  chain. It does not show who approved its target, method, or
                  value. Mandate keeps those two questions separate.
                </p>
              </div>
              <p className="section-aside">
                For {network} agent pilots and review workflows that need a
                readable authorization trail.
              </p>
            </div>
            <div className="principles">
              <article className="principle">
                <p className="principle-num">01 / Intent</p>
                <h3>Record the approved action first.</h3>
                <p>
                  An operator records one target, one method, and one native
                  value. The intent keeps the policy version it relies on.
                </p>
              </article>
              <article className="principle">
                <p className="principle-num">02 / Evidence</p>
                <h3>Compare against public evidence.</h3>
                <p>
                  Mandate fetches the transaction or UserOperation and decodes
                  the account call where supported. Missing fields stay missing.
                </p>
              </article>
              <article className="principle">
                <p className="principle-num">03 / Verdict</p>
                <h3>Show every exception.</h3>
                <p>
                  Mismatches, partial coverage, failures, and unattributed
                  actions each have a separate verdict.
                </p>
              </article>
            </div>
          </div>
        </section>

        <section className="section" id="how-it-works">
          <div className="shell">
            <div className="workflow">
              <div className="workflow-intro">
                <p className="eyebrow">How it works</p>
                <h2>From an approved action to an audit record.</h2>
                <p>
                  Five steps. No wallet connection or custody. Policies are
                  review rules, not on-chain enforcement.
                </p>
              </div>
              <div className="steps">
                <article className="step">
                  <span className="step-number">01</span>
                  <div>
                    <h3>Register the smart account</h3>
                    <p>
                      Add the {network} smart account you want to review. This
                      is the identity Mandate uses when matching evidence.
                    </p>
                    <span className="step-tag">Account record</span>
                  </div>
                </article>
                <article className="step">
                  <span className="step-number">02</span>
                  <div>
                    <h3>Publish a review policy</h3>
                    <p>
                      Define allowed targets, method selectors, native-value
                      caps, and an optional expiry. Every publication creates a
                      new version with a content hash.
                    </p>
                    <span className="step-tag">Policy v1, v2, v3…</span>
                  </div>
                </article>
                <article className="step">
                  <span className="step-number">03</span>
                  <div>
                    <h3>Approve a specific intent</h3>
                    <p>
                      Record one exact action as approved and who recorded it.
                      The intent keeps its policy snapshot and a content
                      fingerprint.
                    </p>
                    <span className="step-tag">Approval record</span>
                  </div>
                </article>
                <article className="step">
                  <span className="step-number">04</span>
                  <div>
                    <h3>Attach public evidence</h3>
                    <p>
                      Mandate fetches a transaction or UserOperation from{" "}
                      {network}, checks that the sender matches the account, and
                      compares it with the intent and policy.
                    </p>
                    <span className="step-tag">RPC · BOT Scan · Bundler</span>
                  </div>
                </article>
                <article className="step">
                  <span className="step-number">05</span>
                  <div>
                    <h3>Review or export the ledger</h3>
                    <p>
                      Inspect every comparison, coverage note, and token movement.
                      Export a JSON or Markdown report with a content fingerprint.
                    </p>
                    <span className="step-tag">JSON + Markdown</span>
                  </div>
                </article>
              </div>
            </div>
          </div>
        </section>

        <section className="section" id="review-model">
          <div className="shell">
            <div className="review-grid">
              <div className="review-intro">
                <p className="eyebrow">Review model</p>
                <h2>Six review states</h2>
                <p>
                  Each record gets the most conservative verdict supported by the
                  available evidence. Missing evidence never becomes a pass.
                </p>
                <Link href="/app/evidence" className="text-link">
                  Browse evidence
                  <ArrowRightIcon size={14} />
                </Link>
              </div>
              <div className="review-table-wrap">
                <table className="review-table">
                  <thead>
                    <tr>
                      <th scope="col">Verdict</th>
                      <th scope="col">What it means</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reviewStates.map((item) => (
                      <tr key={item.verdict}>
                        <td>
                          <VerdictBadge verdict={item.verdict} compact />
                        </td>
                        <td>{item.meaning}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </section>

        <section className="coverage-section" id="coverage">
          <div className="shell">
            <div className="coverage-grid">
              <div>
                <p className="eyebrow eyebrow-light">Coverage</p>
                <h2>What Mandate checks, and what it does not</h2>
                <p className="coverage-grid-lede">
                  Mandate reviews the fields listed here. It does not audit every
                  contract effect or off-chain outcome.
                </p>
              </div>
              <div className="coverage-list">
                <div className="coverage-item">
                  <CheckIcon size={18} />
                  <div>
                    <h3>Account and chain check</h3>
                    <p>
                      Verifies the configured chain ID and that the observed
                      sender matches the registered smart account.
                    </p>
                  </div>
                </div>
                <div className="coverage-item">
                  <CheckIcon size={18} />
                  <div>
                    <h3>Intent and policy comparison</h3>
                    <p>
                      Checks the target, method selector, native value, policy
                      expiry, chain ID, and native value already recorded that
                      UTC day.
                    </p>
                  </div>
                </div>
                <div className="coverage-item">
                  <AlertIcon size={18} />
                  <div>
                    <h3>Decoding has limits</h3>
                    <p>
                      Supported Kernel and SimpleAccount calls are decoded.
                      Unknown multicalls or opaque inner calls are marked as
                      partial coverage.
                    </p>
                  </div>
                </div>
                <div className="coverage-item">
                  <AnchorIcon size={18} />
                  <div>
                    <h3>Optional hash anchors</h3>
                    <p>
                      Policy, intent, and report hashes can be checked against a
                      read-only registry. An anchor proves the hash was recorded,
                      not that the record is correct.
                    </p>
                  </div>
                </div>
                <div className="coverage-item">
                  <AlertIcon size={18} />
                  <div>
                    <h3>Not an on-chain control</h3>
                    <p>
                      Policies are review rules. Mandate cannot prevent an
                      action, custody funds, sponsor gas, or sign on your behalf.
                      Token movements are informational only.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="section-tight cta-band">
          <div className="shell">
            <div className="cta-inner">
              <div>
                <p className="eyebrow">Sample workspace</p>
                <h2>See the review trail for yourself.</h2>
                <p>
                  Explore the sample workspace or register a {network} smart
                  account. Every sample record is labeled.
                </p>
              </div>
              <div className="cta-actions">
                <Link href="/app" className="button button-ink">
                  Open workspace
                  <ArrowRightIcon size={16} />
                </Link>
                <Link href="/app/sources" className="button button-ghost">
                  View sources
                </Link>
              </div>
            </div>
          </div>
        </section>

        <section className="section-tight">
          <div className="shell">
            <div className="section-heading">
              <div>
                <p className="eyebrow">Built for BOT Chain</p>
                <h2>{networkName(config.chainId)} only.</h2>
                <p>
                  Runs on {networkName(config.chainId)} and reads ERC-4337 v0.7
                  activity. It does not connect a wallet or submit transactions.
                </p>
              </div>
              <Link href="/app" className="text-link">
                Open the workspace
                <ArrowRightIcon size={14} />
              </Link>
            </div>
            <div className="trust-strip trust-strip-flush">
              <div className="trust-item">
                <strong>Chain</strong>
                {networkName(config.chainId)} · {config.chainId}
              </div>
              <div className="trust-item">
                <strong>EntryPoint</strong>
                ERC-4337 v0.7
              </div>
              <div className="trust-item">
                <strong>Data</strong>
                Stored on this machine
              </div>
              <div className="trust-item">
                <strong>Boundary</strong>
                No custody · no signing · no submission
              </div>
            </div>
            <div className="pill-row pill-row-spaced">
              <span className="code-tag">
                <ClockIcon size={12} /> UTC timestamps
              </span>
              <span className="code-tag">
                <ShieldIcon size={12} /> Approved intents
              </span>
              <span className="code-tag">
                <FileCheckIcon size={12} /> JSON + Markdown reports
              </span>
              <span className="code-tag">
                <AnchorIcon size={12} /> Optional hash anchors
              </span>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
