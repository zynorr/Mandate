"use client";

import Link from "next/link";
import { ArrowRightIcon } from "@/components/icons";

export default function ErrorPage({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main id="main" className="center-page">
      <div className="center-card">
        <p className="eyebrow">Page error</p>
        <h1>This page could not be loaded.</h1>
        <p>Try again. If the problem continues, reload the page.</p>
        <div className="error-actions">
          <button type="button" className="button button-ink" onClick={reset}>
            Try again
          </button>
          <Link href="/app" className="button button-ghost">
            Return to ledger
            <ArrowRightIcon size={15} />
          </Link>
        </div>
      </div>
    </main>
  );
}
