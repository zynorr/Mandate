import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRightIcon, ShieldIcon } from "@/components/icons";
import { SiteFooter, SiteHeader } from "@/components/brand";
import { getSessionUser, safeReturnTo } from "@/lib/auth";
import { getAppConfig } from "@/lib/config";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Sign in",
  description: "Sign in to your private Mandate workspace.",
};

const errorCopy: Record<string, string> = {
  config:
    "Sign-in is not configured yet. The deployment owner needs to set the GitHub OAuth environment variables.",
  oauth: "GitHub did not complete the sign-in. Please try again.",
  state: "The sign-in request expired or did not match. Please start again.",
};

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const query = await searchParams;
  const config = getAppConfig();
  const next = safeReturnTo(query.next);
  const configured = !config.auth.error;

  if (configured && config.auth.mode === "local") {
    redirect(next);
  }

  const user = await getSessionUser();
  if (user) redirect(next);

  const errorMessage =
    config.auth.error ??
    (query.error ? errorCopy[query.error] ?? errorCopy.oauth : null);

  return (
    <>
      <SiteHeader />
      <main id="main" className="signin-main">
        <div className="shell signin-grid">
          <section className="signin-intro">
            <p className="eyebrow">Private workspace</p>
            <h1>Your evidence ledger, separated from everyone else&apos;s.</h1>
            <p className="signin-lede">
              Mandate stores agents, policies, intents, evidence, and activity
              per account. Sign in with GitHub to open your own workspace on
              BOT Chain {config.chainId}.
            </p>
            <div className="signin-points">
              <div>
                <ShieldIcon size={18} />
                <p>
                  <strong>Owner-scoped reads and writes.</strong> Every query is
                  filtered by the signed-in account, including reports and
                  discovery endpoints.
                </p>
              </div>
              <div>
                <ShieldIcon size={18} />
                <p>
                  <strong>No wallet access.</strong> GitHub identifies your
                  workspace. Mandate never connects a wallet, holds keys, or
                  signs transactions.
                </p>
              </div>
              <div>
                <ShieldIcon size={18} />
                <p>
                  <strong>Read-only chain evidence.</strong> Public BOT Chain
                  records are compared with your approved intents and policies.
                </p>
              </div>
            </div>
          </section>

          <aside className="signin-card">
            <p className="eyebrow">Continue</p>
            <h2>Sign in to Mandate</h2>
            <p>
              GitHub is used only for account identity. Mandate requests the
              basic public profile scope and does not access repositories.
            </p>

            {errorMessage ? (
              <div className="signin-error" role="alert">
                {errorMessage}
              </div>
            ) : null}

            {configured ? (
              <a
                href={`/api/auth/github/start?next=${encodeURIComponent(next)}`}
                className="button button-ink signin-button"
              >
                Continue with GitHub
                <ArrowRightIcon size={16} />
              </a>
            ) : (
              <p className="signin-help">
                For local development, the owner can configure GitHub OAuth or
                set <code>MANDATE_AUTH_MODE=local</code> with a local database.
              </p>
            )}

            <p className="signin-fineprint">
              By continuing, you agree that Mandate may store your GitHub login,
              display name, and workspace records. No repository contents are
              read or stored.
            </p>
            <Link href="/" className="text-link">
              Return to the product overview
            </Link>
          </aside>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
