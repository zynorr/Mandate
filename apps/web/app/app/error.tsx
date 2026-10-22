"use client";

import Link from "next/link";
import { ArrowRightIcon } from "@/components/icons";
import { PageHeader } from "@/components/ui";

export default function WorkspaceError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <>
      <PageHeader
        eyebrow="Workspace error"
        title="This page could not be loaded"
        description="The page data was unavailable. Stored records were not changed."
      />
      <div className="center-card">
        <p>
          Try again. If the problem continues, check source health.
        </p>
        <div className="error-actions">
          <button type="button" className="button button-ink" onClick={reset}>
            Try again
          </button>
          <Link href="/app/sources" className="button button-ghost">
            Check sources
            <ArrowRightIcon size={15} />
          </Link>
          <Link href="/app" className="text-link">
            Return to ledger
          </Link>
        </div>
      </div>
    </>
  );
}
