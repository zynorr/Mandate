import Link from "next/link";
import { SiteFooter, SiteHeader } from "@/components/brand";
import { ArrowRightIcon } from "@/components/icons";

export default function NotFound() {
  return (
    <>
      <SiteHeader />
      <main id="main" className="center-page">
        <div className="center-card">
          <p className="eyebrow">404 · Not found</p>
          <h1>No page here.</h1>
          <p>
            The page you requested does not exist. Check the link or return to
            the workspace.
          </p>
          <Link href="/app" className="button button-ink">
            Return to the ledger
            <ArrowRightIcon size={15} />
          </Link>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
