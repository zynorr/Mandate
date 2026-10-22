import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { OFFICIAL_LINKS } from "@mandate/chain";
import { ArrowRightIcon } from "./icons";

export function MandateMark({ className = "" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 36 36"
      role="img"
      aria-label="Mandate"
    >
      <rect width="36" height="36" rx="10" fill="currentColor" />
      <path
        d="M10 24V12l8 6 8-6v12"
        fill="none"
        stroke="#F7F3EB"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="18" cy="27" r="1.35" fill="#A4EF6B" />
    </svg>
  );
}

export function Wordmark({ compact = false }: { compact?: boolean }) {
  return (
    <span className="wordmark">
      <MandateMark className="wordmark-mark" />
      <span className="wordmark-text">
        <span className="wordmark-name">Mandate</span>
        {!compact ? (
          <span className="wordmark-sub">Evidence ledger</span>
        ) : null}
      </span>
    </span>
  );
}

export function SiteHeader() {
  return (
    <header className="site-header">
      <div className="site-header-inner">
        <Link href="/" className="brand-link" aria-label="Mandate home">
          <Wordmark />
        </Link>
        <nav className="site-nav" aria-label="Primary">
          <a href="#how-it-works">How it works</a>
          <a href="#review-model">Review model</a>
          <a href="#coverage">Coverage</a>
        </nav>
        <Link href="/app" className="button button-small button-ink">
          Open ledger
          <ArrowRightIcon size={15} />
        </Link>
      </div>
    </header>
  );
}

function FooterLink({
  href,
  children,
  external = false,
}: {
  href: string;
  children: ReactNode;
  external?: boolean;
}) {
  if (external) {
    return (
      <a href={href} target="_blank" rel="noreferrer">
        {children}
      </a>
    );
  }
  return <Link href={href}>{children}</Link>;
}

export function SiteFooter({ compact = false }: { compact?: boolean }) {
  return (
    <footer className={`site-footer ${compact ? "site-footer-compact" : ""}`}>
      <div className="footer-top">
        <div className="footer-statement">
          <p className="eyebrow eyebrow-light">BOT Chain testnet</p>
          <p className="footer-headline">
            A readable record of what was approved and what happened.
          </p>
        </div>
        <div className="footer-logo-wrap">
          <Image
            src="/brand/bot-chain.svg"
            alt="BOT Chain"
            width={202}
            height={40}
            unoptimized
          />
        </div>
      </div>
      <div className="footer-grid">
        <div className="footer-brand">
          <Wordmark compact />
          <p>
            An agent authorization and evidence ledger for BOT Chain testnet.
            No custody, signing, or transaction submission.
          </p>
        </div>
        <div className="footer-column">
          <h2>Ledger</h2>
          <FooterLink href="/app">Overview</FooterLink>
          <FooterLink href="/app/evidence">Evidence</FooterLink>
          <FooterLink href="/app/reports">Reports</FooterLink>
          <FooterLink href="/app/sources">Sources</FooterLink>
        </div>
        <div className="footer-column">
          <h2>BOT Chain</h2>
          <FooterLink href={OFFICIAL_LINKS.botChain} external>
            BOT Chain
          </FooterLink>
          <FooterLink href={OFFICIAL_LINKS.explorer} external>
            BOT Chain Explorer
          </FooterLink>
          <FooterLink href={OFFICIAL_LINKS.docs} external>
            Developer Docs
          </FooterLink>
        </div>
        <div className="footer-column footer-meta">
          <h2>Workspace</h2>
          <p>BOT Chain testnet · chain ID 968</p>
          <p>ERC-4337 v0.7</p>
          <p>Data stays on this machine</p>
        </div>
      </div>
      <div className="footer-bottom">
        <p>© {new Date().getFullYear()} Mandate</p>
        <p>Official BOT Chain marks belong to BOT Chain.</p>
      </div>
    </footer>
  );
}
