import { getAddress, isAddress } from "viem";
import { z } from "zod";
import { BOT_TESTNET_CHAIN_ID } from "./constants";

const MAX_UINT256 = (1n << 256n) - 1n;

export const addressSchema = z
  .string()
  .trim()
  .refine((value) => isAddress(value, { strict: false }), "Enter a valid EVM address.")
  .transform((value) => getAddress(value));

export const hashSchema = z
  .string()
  .trim()
  .regex(/^0x[0-9a-fA-F]{64}$/, "Enter a 32-byte hex hash.")
  .transform((value) => value.toLowerCase());

export const selectorSchema = z
  .string()
  .trim()
  .regex(/^0x[0-9a-fA-F]{8}$/, "Enter a 4-byte function selector.")
  .transform((value) => value.toLowerCase());

export const weiSchema = z
  .string()
  .trim()
  .regex(/^(0|[1-9]\d*)$/, "Enter a whole number of wei.")
  .refine((value) => BigInt(value) <= MAX_UINT256, "Amount exceeds uint256.");

export const isoDateTimeSchema = z
  .string()
  .refine((value) => !Number.isNaN(Date.parse(value)), "Enter a valid date and time.");

const uniqueBy = <T>(items: T[], key: (item: T) => string) => {
  const seen = new Set<string>();
  return items.filter((item) => {
    const value = key(item).toLowerCase();
    if (seen.has(value)) return false;
    seen.add(value);
    return true;
  });
};

const policyFieldsSchema = z.object({
  name: z.string().trim().min(2, "Give the policy a name.").max(80),
  chainId: z.literal(BOT_TESTNET_CHAIN_ID),
  allowedTargets: z
    .array(addressSchema)
    .min(1, "Allow at least one target.")
    .max(20, "Use no more than 20 targets.")
    .transform((items) => uniqueBy(items, (item) => item)),
  allowedMethods: z
    .array(selectorSchema)
    .min(1, "Allow at least one method.")
    .max(20, "Use no more than 20 methods.")
    .transform((items) => uniqueBy(items, (item) => item)),
  maxNativeValuePerActionWei: weiSchema,
  maxNativeValuePerDayWei: weiSchema.nullable(),
  expiresAt: isoDateTimeSchema.nullable(),
  notes: z.string().trim().max(500).default(""),
});

const validatePolicyCaps = (
  policy: z.infer<typeof policyFieldsSchema>,
  context: z.RefinementCtx,
) => {
  if (
    policy.maxNativeValuePerDayWei !== null &&
    BigInt(policy.maxNativeValuePerDayWei) <
      BigInt(policy.maxNativeValuePerActionWei)
  ) {
    context.addIssue({
      code: "custom",
      path: ["maxNativeValuePerDayWei"],
      message: "The daily cap cannot be below the per-action cap.",
    });
  }
};

export const policyDraftSchema = policyFieldsSchema.superRefine(
  (policy, context) => {
    validatePolicyCaps(policy, context);
    if (
      policy.expiresAt !== null &&
      Date.parse(policy.expiresAt) <= Date.now()
    ) {
      context.addIssue({
        code: "custom",
        path: ["expiresAt"],
        message: "The expiry must be in the future.",
      });
    }
  },
);

export const policyRecordSchema = policyFieldsSchema
  .superRefine(validatePolicyCaps)
  .and(
    z.object({
      id: z.string().uuid(),
      version: z.number().int().positive(),
      hash: hashSchema,
      createdAt: isoDateTimeSchema,
    }),
  );

export const intentDraftSchema = z.object({
  title: z.string().trim().min(3, "Describe the approved action.").max(100),
  rationale: z.string().trim().min(10, "Record why this action was approved.").max(1000),
  target: addressSchema,
  methodSelector: selectorSchema,
  valueWei: weiSchema,
  approvedBy: z.string().trim().min(2, "Record who approved this.").max(80),
});

export const intentRecordSchema = intentDraftSchema.and(
  z.object({
    id: z.string().uuid(),
    agentId: z.string().uuid(),
    policyId: z.string().uuid(),
    policyVersion: z.number().int().positive(),
    policyHash: hashSchema,
    chainId: z.literal(BOT_TESTNET_CHAIN_ID),
    fingerprint: hashSchema,
    createdAt: isoDateTimeSchema,
  }),
);

export const evidenceKindSchema = z.enum(["transaction", "user_operation"]);

export const tokenMovementSchema = z.object({
  tokenAddress: addressSchema,
  symbol: z.string().max(32).nullable(),
  name: z.string().max(80).nullable(),
  decimals: z.number().int().min(0).max(36),
  amountRaw: weiSchema,
  amountFormatted: z.string().max(120),
  from: addressSchema,
  to: addressSchema,
  logIndex: z.string().nullable(),
});

export const observedActionSchema = z.object({
  chainId: z.literal(BOT_TESTNET_CHAIN_ID),
  kind: evidenceKindSchema,
  sender: addressSchema,
  target: addressSchema.nullable(),
  targetSource: z.enum(["decoded_inner", "explorer_inner", "outer", "unavailable"]),
  methodSelector: selectorSchema.nullable(),
  methodLabel: z.string().max(160).nullable(),
  valueWei: weiSchema.nullable(),
  valueSource: z.enum(["decoded_inner", "explorer_inner", "outer", "unavailable"]),
  outerEnvelopeLabel: z.string().max(160).nullable(),
  chainStatus: z.enum(["success", "failed", "pending"]),
  outerTransactionHash: hashSchema.nullable(),
  blockNumber: z.string().regex(/^\d+$/).nullable(),
  confirmedAt: isoDateTimeSchema.nullable(),
  gasUsed: weiSchema.nullable(),
  gasPriceWei: weiSchema.nullable(),
  feeWei: weiSchema.nullable(),
  coverage: z.enum(["complete", "partial"]),
  coverageNotes: z.array(z.string().max(400)).max(12),
  tokenMovements: z.array(tokenMovementSchema).max(25),
  explorerUrl: z.string().url(),
  decodedBy: z.enum(["mandate", "explorer", "rpc"]),
});

export const checkStateSchema = z.enum([
  "pass",
  "fail",
  "unavailable",
  "not_applicable",
]);

export const evidenceCheckSchema = z.object({
  key: z.string().max(60),
  label: z.string().max(120),
  expected: z.string().max(300),
  observed: z.string().max(300),
  state: checkStateSchema,
  detail: z.string().max(400).optional(),
});

export const evaluationSchema = z.object({
  verdict: z.enum([
    "matched",
    "out_of_policy",
    "failed",
    "unattributed",
    "needs_review",
    "pending",
  ]),
  intentMatch: z.enum(["match", "mismatch", "no_intent", "unavailable"]),
  policyResult: z.enum(["within_policy", "violation", "unavailable"]),
  chainResult: z.enum(["success", "failed", "pending"]),
  coverage: z.enum(["complete", "partial"]),
  checks: z.array(evidenceCheckSchema),
  policyChecks: z.array(evidenceCheckSchema),
  coverageNotes: z.array(z.string().max(400)).max(12),
  evaluatedAt: isoDateTimeSchema,
});

export const evidenceSourceSchema = z.enum(["live", "sample"]);

export const evidenceRecordSchema = z.object({
  id: z.string().uuid(),
  agentId: z.string().uuid(),
  intentId: z.string().uuid().nullable(),
  policyId: z.string().uuid(),
  policyVersion: z.number().int().positive(),
  policyHash: hashSchema,
  kind: evidenceKindSchema,
  hash: hashSchema,
  source: evidenceSourceSchema,
  observed: observedActionSchema,
  evaluation: evaluationSchema,
  attachedAt: isoDateTimeSchema,
  fetchedAt: isoDateTimeSchema,
});

export const agentDraftSchema = z.object({
  name: z.string().trim().min(2, "Give the agent a name.").max(80),
  description: z.string().trim().max(500).default(""),
  smartAccount: addressSchema,
});

export const agentRecordSchema = agentDraftSchema.and(
  z.object({
    id: z.string().uuid(),
    createdAt: isoDateTimeSchema,
    updatedAt: isoDateTimeSchema,
  }),
);

export const attachEvidenceSchema = z.object({
  kind: evidenceKindSchema,
  hash: hashSchema,
  intentId: z.string().uuid().nullable(),
});

export const discoveryCandidateSchema = z.object({
  key: z.string(),
  kind: evidenceKindSchema,
  hash: hashSchema,
  outerTransactionHash: hashSchema.nullable(),
  target: addressSchema.nullable(),
  methodLabel: z.string().nullable(),
  valueWei: weiSchema.nullable(),
  chainStatus: z.enum(["success", "failed", "pending"]),
  timestamp: isoDateTimeSchema.nullable(),
  blockNumber: z.string().nullable(),
  alreadyAttached: z.boolean(),
});

export type PolicyDraft = z.infer<typeof policyDraftSchema>;
export type PolicyRecord = z.infer<typeof policyRecordSchema>;
export type IntentDraft = z.infer<typeof intentDraftSchema>;
export type IntentRecord = z.infer<typeof intentRecordSchema>;
export type EvidenceKind = z.infer<typeof evidenceKindSchema>;
export type TokenMovement = z.infer<typeof tokenMovementSchema>;
export type ObservedAction = z.infer<typeof observedActionSchema>;
export type EvidenceCheck = z.infer<typeof evidenceCheckSchema>;
export type EvidenceEvaluation = z.infer<typeof evaluationSchema>;
export type EvidenceSource = z.infer<typeof evidenceSourceSchema>;
export type EvidenceRecord = z.infer<typeof evidenceRecordSchema>;
export type AgentDraft = z.infer<typeof agentDraftSchema>;
export type AgentRecord = z.infer<typeof agentRecordSchema>;
export type AttachEvidenceInput = z.infer<typeof attachEvidenceSchema>;
export type DiscoveryCandidate = z.infer<typeof discoveryCandidateSchema>;
export type EvidenceVerdict = EvidenceEvaluation["verdict"];
export type CheckState = EvidenceCheck["state"];
