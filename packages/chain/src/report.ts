import {
  BOT_TESTNET_CHAIN_ID,
  OFFICIAL_LINKS,
  networkFor,
  networkLabel,
} from "./constants";
import {
  formatCheckValue,
  formatDateTime,
  formatNativeValue,
  shortenHash,
} from "./format";
import { contentHash } from "./hash";
import type {
  AgentRecord,
  EvidenceRecord,
  IntentRecord,
  PolicyRecord,
} from "./schemas";

export interface EvidenceReportInput {
  generatedAt?: string;
  chainId?: number;
  agent: AgentRecord & { isDemo?: boolean };
  policies: PolicyRecord[];
  intents: IntentRecord[];
  evidence: EvidenceRecord[];
}

export interface EvidenceReport {
  schemaVersion: "mandate.evidence.v1";
  generatedAt: string;
  fingerprint: string;
  network: {
    name: string;
    chainId: number;
    explorer: string;
  };
  agent: {
    id: string;
    name: string;
    description: string;
    smartAccount: string;
    isDemo: boolean;
  };
  coverage: {
    policies: number;
    intents: number;
    evidence: number;
    sampleRecords: number;
    partialRecords: number;
  };
  policies: PolicyRecord[];
  intents: IntentRecord[];
  evidence: EvidenceRecord[];
  limitations: string[];
}

const limitationsFor = (chainId: number): string[] => [
  `This report covers ${networkLabel(chainId)} (chain ID ${chainId}) only.`,
  "Mandate does not hold keys, sign, submit, or sponsor transactions.",
  "A matched record means the available observed fields match the approved intent and policy. It does not guarantee that every part of the transaction was decoded.",
  "Token movements are informational and are not evaluated by policy.",
  "Native-value caps and allowlists are evaluated against observed fields. Unexpected contract behavior, internal calls, and off-chain effects are outside this report.",
  "Content fingerprints identify this report's contents; they are not cryptographic signatures.",
];

const escapeMarkdown = (value: string): string =>
  value.replace(/\r?\n/g, " ").replace(/\|/g, "\\|").trim();

const verdictLabel = (verdict: string): string => {
  switch (verdict) {
    case "matched":
      return "Matched";
    case "out_of_policy":
      return "Out of policy";
    case "failed":
      return "Failed";
    case "unattributed":
      return "Unattributed";
    case "needs_review":
      return "Needs review";
    case "pending":
      return "Pending";
    default:
      return verdict;
  }
};

export function buildEvidenceReport(
  input: EvidenceReportInput,
): EvidenceReport {
  const generatedAt = input.generatedAt ?? new Date().toISOString();
  const chainId =
    input.chainId ??
    input.policies[0]?.chainId ??
    input.evidence[0]?.observed.chainId ??
    BOT_TESTNET_CHAIN_ID;
  const network = networkFor(chainId);
  const payload = {
    schemaVersion: "mandate.evidence.v1" as const,
    generatedAt,
    network: {
      name: network?.name ?? `Chain ${chainId}`,
      chainId,
      explorer: network?.explorerUrl ?? OFFICIAL_LINKS.explorer,
    },
    agent: {
      id: input.agent.id,
      name: input.agent.name,
      description: input.agent.description,
      smartAccount: input.agent.smartAccount,
      isDemo: input.agent.isDemo ?? false,
    },
    coverage: {
      policies: input.policies.length,
      intents: input.intents.length,
      evidence: input.evidence.length,
      sampleRecords: input.evidence.filter(
        (record) => record.source === "sample",
      ).length,
      partialRecords: input.evidence.filter(
        (record) => record.observed.coverage === "partial",
      ).length,
    },
    policies: input.policies,
    intents: input.intents,
    evidence: input.evidence,
    limitations: limitationsFor(chainId),
  };
  return {
    ...payload,
    fingerprint: contentHash(payload),
  };
}

export function renderEvidenceReportMarkdown(report: EvidenceReport): string {
  const lines: string[] = [];
  lines.push(`# Mandate evidence report: ${escapeMarkdown(report.agent.name)}`);
  lines.push("");
  lines.push(`Generated: ${formatDateTime(report.generatedAt)}`);
  lines.push(`Network: ${report.network.name} (chain ID ${report.network.chainId})`);
  lines.push(`Smart account: \`${report.agent.smartAccount}\``);
  if (report.agent.isDemo) {
    lines.push("");
    lines.push(
      "> **Sample workspace.** Some records in this report are seeded examples, not live evidence.",
    );
  }
  lines.push("");
  lines.push(`Report fingerprint: \`${report.fingerprint}\``);
  lines.push("");
  lines.push("## Coverage");
  lines.push("");
  lines.push(`- Policy versions: ${report.coverage.policies}`);
  lines.push(`- Approved intents: ${report.coverage.intents}`);
  lines.push(`- Evidence records: ${report.coverage.evidence}`);
  lines.push(`- Sample records: ${report.coverage.sampleRecords}`);
  lines.push(`- Records with partial coverage: ${report.coverage.partialRecords}`);
  lines.push("");
  lines.push("## Evidence ledger");
  lines.push("");
  if (report.evidence.length === 0) {
    lines.push("No evidence has been attached.");
  } else {
    lines.push(
      "| Attached | Verdict | Kind | Evidence | Intent | Target | Method | Native value | Coverage | Source |",
    );
    lines.push("| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |");
    for (const record of report.evidence) {
      const intent = report.intents.find(
        (item) => item.id === record.intentId,
      );
      lines.push(
        `| ${formatDateTime(record.attachedAt)} | ${verdictLabel(
          record.evaluation.verdict,
        )} | ${record.kind.replace("_", " ")} | [\`${shortenHash(
          record.hash,
        )}\`](${record.observed.explorerUrl}) | ${
          intent ? escapeMarkdown(intent.title) : "No linked intent"
        } | ${
          record.observed.target
            ? `\`${record.observed.target}\``
            : "Unavailable"
        } | ${
          record.observed.methodSelector ?? "Unavailable"
        } | ${formatNativeValue(record.observed.valueWei)} | ${
          record.observed.coverage
        } | ${record.source === "sample" ? "Sample" : "Live"} |`,
      );
    }
  }
  lines.push("");
  lines.push("## Review detail");
  lines.push("");
  for (const record of report.evidence) {
    lines.push(`### ${verdictLabel(record.evaluation.verdict)} · \`${record.hash}\``);
    lines.push("");
    lines.push(`- Kind: ${record.kind.replace("_", " ")}`);
    lines.push(`- Status: ${record.observed.chainStatus}`);
    lines.push(`- Coverage: ${record.observed.coverage}`);
    lines.push(`- Source: ${record.source === "sample" ? "Sample record" : "Live"}`);
    lines.push(`- Attached: ${formatDateTime(record.attachedAt)}`);
    if (record.observed.outerTransactionHash) {
      lines.push(
        `- Outer transaction: \`${record.observed.outerTransactionHash}\``,
      );
    }
    const intent = report.intents.find((item) => item.id === record.intentId);
    if (intent) {
      lines.push(`- Approved intent: ${escapeMarkdown(intent.title)}`);
      lines.push(`- Recorded by: ${escapeMarkdown(intent.approvedBy)}`);
    }
    const attention = [
      ...record.evaluation.checks,
      ...record.evaluation.policyChecks,
    ].filter((check) => check.state === "fail" || check.state === "unavailable");
    if (attention.length === 0) {
      lines.push("- Comparisons: all available comparisons passed or were not applicable.");
    } else {
      lines.push("- Comparisons needing attention:");
      for (const check of attention) {
        lines.push(
          `  - ${check.label}: expected ${formatCheckValue(
            check.expected,
          )}; observed ${formatCheckValue(check.observed)} (${check.state}).`,
        );
      }
    }
    if (record.evaluation.coverageNotes.length > 0) {
      lines.push("- Coverage notes:");
      for (const note of record.evaluation.coverageNotes) {
        lines.push(`  - ${escapeMarkdown(note)}`);
      }
    }
    if (record.observed.tokenMovements.length > 0) {
      lines.push("- Informational token movements:");
      for (const movement of record.observed.tokenMovements) {
        lines.push(
          `  - ${movement.amountFormatted} from \`${movement.from}\` to \`${movement.to}\` (not policy-checked).`,
        );
      }
    }
    lines.push("");
  }
  lines.push("## Policies");
  lines.push("");
  for (const policy of report.policies) {
    lines.push(
      `### ${escapeMarkdown(policy.name)} · v${policy.version}${
        policy.version ===
        Math.max(...report.policies.map((item) => item.version))
          ? " (latest)"
          : ""
      }`,
    );
    lines.push("");
    lines.push(`- Hash: \`${policy.hash}\``);
    lines.push(
      `- Per-action native cap: ${formatNativeValue(
        policy.maxNativeValuePerActionWei,
      )}`,
    );
    lines.push(
      `- Daily native cap: ${
        policy.maxNativeValuePerDayWei === null
          ? "Not configured"
          : formatNativeValue(policy.maxNativeValuePerDayWei)
      }`,
    );
    lines.push(
      `- Expiry: ${
        policy.expiresAt ? formatDateTime(policy.expiresAt) : "No expiry"
      }`,
    );
    lines.push("- Allowed targets:");
    for (const target of policy.allowedTargets) {
      lines.push(`  - \`${target}\``);
    }
    lines.push("- Allowed methods:");
    for (const selector of policy.allowedMethods) {
      lines.push(`  - \`${selector}\``);
    }
    lines.push("");
  }
  lines.push("## Limitations");
  lines.push("");
  for (const limitation of report.limitations) {
    lines.push(`- ${limitation}`);
  }
  lines.push("");
  lines.push(
    `BOT Chain: ${OFFICIAL_LINKS.botChain} · Explorer: ${OFFICIAL_LINKS.explorer} · Docs: ${OFFICIAL_LINKS.docs}`,
  );
  lines.push("");
  return lines.join("\n");
}
