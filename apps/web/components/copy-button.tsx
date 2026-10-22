"use client";

import { useState } from "react";
import { CopyIcon } from "./icons";

export function CopyButton({
  value,
  label = "Copy hash",
}: {
  value: string;
  label?: string;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  }

  return (
    <button
      type="button"
      className="copy-button"
      onClick={copy}
      aria-label={copied ? "Copied" : label}
      title={copied ? "Copied" : label}
    >
      <CopyIcon size={15} />
      <span>{copied ? "Copied" : "Copy"}</span>
    </button>
  );
}
