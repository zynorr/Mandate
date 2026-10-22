"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { parseEther } from "viem";
import { z } from "zod";
import {
  EvidenceAttributionError,
  agentDraftSchema,
  attachEvidenceSchema,
  evaluateEvidence,
  evidenceRecordSchema,
  fetchEvidence,
  intentDraftSchema,
  policyDraftSchema,
} from "@mandate/chain";
import { getChainConfig } from "./config";
import type { FormState } from "./form-state";
import {
  AppError,
  createAgent,
  createIntent,
  createPolicyVersion,
  getAgent,
  getCurrentPolicy,
  getEvidenceByHash,
  getIntent,
  getPolicy,
  insertEvidence,
  priorNativeValueInUtcDay,
} from "./repo";

const stringField = (formData: FormData, key: string): string => {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
};

const splitList = (value: string): string[] =>
  value
    .split(/[\n,]/)
    .map((item) => item.trim())
    .filter(Boolean);

const fieldErrorsFrom = (error: z.ZodError): Record<string, string> => {
  const fieldErrors: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.length > 0 ? issue.path.join(".") : "form";
    if (!fieldErrors[key]) fieldErrors[key] = issue.message;
  }
  return fieldErrors;
};

const parseBotAmount = (
  value: string,
  field: string,
  optional: boolean,
): { wei: string | null; error?: Record<string, string> } => {
  const trimmed = value.trim();
  if (trimmed === "") {
    return optional
      ? { wei: null }
      : { wei: null, error: { [field]: "Enter a BOT amount (use 0 for none)." } };
  }
  if (!/^\d+(\.\d{1,18})?$/.test(trimmed)) {
    return {
      wei: null,
      error: { [field]: "Use a positive BOT amount with up to 18 decimals." },
    };
  }
  try {
    return { wei: parseEther(trimmed).toString() };
  } catch {
    return { wei: null, error: { [field]: "That BOT amount is not valid." } };
  }
};

const parseExpiry = (
  value: string,
): { iso: string | null; error?: Record<string, string> } => {
  const trimmed = value.trim();
  if (trimmed === "") return { iso: null };
  const withZone = `${trimmed}${trimmed.length === 16 ? ":00" : ""}Z`;
  const date = new Date(withZone);
  if (Number.isNaN(date.getTime())) {
    return { iso: null, error: { expiresAt: "Enter a valid UTC date and time." } };
  }
  return { iso: date.toISOString() };
};

const fail = (
  error: string,
  fieldErrors: Record<string, string> = {},
): FormState => ({ error, fieldErrors });

export async function createAgentAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = agentDraftSchema.safeParse({
    name: stringField(formData, "name"),
    description: stringField(formData, "description"),
    smartAccount: stringField(formData, "smartAccount"),
  });
  if (!parsed.success) {
    return fail("Check the agent details.", fieldErrorsFrom(parsed.error));
  }

  let agentId: string;
  try {
    const agent = createAgent(parsed.data);
    agentId = agent.id;
  } catch (error) {
    return fail(
      error instanceof AppError
        ? error.message
        : "The agent could not be created.",
    );
  }

  revalidatePath("/app");
  revalidatePath("/app/agents");
  redirect(`/app/agents/${agentId}`);
}

export async function createPolicyAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const agentId = stringField(formData, "agentId").trim();
  if (!agentId) return fail("Agent is missing.");
  if (!getAgent(agentId)) return fail("Agent not found.");

  const perAction = parseBotAmount(
    stringField(formData, "maxNativePerAction"),
    "maxNativePerAction",
    false,
  );
  if (perAction.error) {
    return fail("Check the policy caps.", perAction.error);
  }
  const perDay = parseBotAmount(
    stringField(formData, "maxNativePerDay"),
    "maxNativePerDay",
    true,
  );
  if (perDay.error) {
    return fail("Check the policy caps.", perDay.error);
  }
  const expiry = parseExpiry(stringField(formData, "expiresAt"));
  if (expiry.error) {
    return fail("Check the policy expiry.", expiry.error);
  }

  const parsed = policyDraftSchema.safeParse({
    name: stringField(formData, "name"),
    chainId: 968,
    allowedTargets: splitList(stringField(formData, "allowedTargets")),
    allowedMethods: splitList(stringField(formData, "allowedMethods")),
    maxNativeValuePerActionWei: perAction.wei ?? "0",
    maxNativeValuePerDayWei: perDay.wei,
    expiresAt: expiry.iso,
    notes: stringField(formData, "notes"),
  });
  if (!parsed.success) {
    return fail("Check the policy details.", fieldErrorsFrom(parsed.error));
  }

  try {
    createPolicyVersion(agentId, parsed.data);
  } catch (error) {
    return fail(
      error instanceof AppError
        ? error.message
        : "The policy version could not be published.",
    );
  }

  revalidatePath("/app", "layout");
  redirect(`/app/agents/${agentId}/policy?published=1`);
}

export async function createIntentAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const agentId = stringField(formData, "agentId").trim();
  const policyId = stringField(formData, "policyId").trim();
  if (!agentId || !policyId) return fail("Agent or policy is missing.");

  const value = parseBotAmount(
    stringField(formData, "valueBot"),
    "valueBot",
    false,
  );
  if (value.error) {
    return fail("Check the approved native value.", value.error);
  }

  const parsed = intentDraftSchema.safeParse({
    title: stringField(formData, "title"),
    rationale: stringField(formData, "rationale"),
    target: stringField(formData, "target"),
    methodSelector: stringField(formData, "methodSelector"),
    valueWei: value.wei ?? "0",
    approvedBy: stringField(formData, "approvedBy"),
  });
  if (!parsed.success) {
    return fail("Check the approved intent.", fieldErrorsFrom(parsed.error));
  }

  try {
    createIntent(agentId, policyId, parsed.data);
  } catch (error) {
    return fail(
      error instanceof AppError
        ? error.message
        : "The intent could not be approved.",
    );
  }

  revalidatePath("/app", "layout");
  redirect(`/app/agents/${agentId}?intent=approved#intents`);
}

export async function attachEvidenceAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const agentId = stringField(formData, "agentId").trim();
  const rawIntentId = stringField(formData, "intentId").trim();
  const parsed = attachEvidenceSchema.safeParse({
    kind: stringField(formData, "kind"),
    hash: stringField(formData, "hash"),
    intentId: rawIntentId === "" ? null : rawIntentId,
  });
  if (!parsed.success) {
    return fail(
      "Check the evidence type and hash.",
      fieldErrorsFrom(parsed.error),
    );
  }

  const agent = getAgent(agentId);
  if (!agent) return fail("Agent not found.");

  let intent = null;
  if (parsed.data.intentId) {
    intent = getIntent(parsed.data.intentId);
    if (!intent || intent.agentId !== agentId) {
      return fail("The selected intent does not belong to this agent.");
    }
  }

  const policy = intent
    ? getPolicy(intent.policyId)
    : getCurrentPolicy(agentId);
  if (!policy || policy.agentId !== agentId) {
    return fail(
      intent
        ? "The policy snapshot for that intent is unavailable."
        : "Publish a policy before attaching evidence.",
    );
  }

  const existing = getEvidenceByHash(
    agentId,
    parsed.data.kind,
    parsed.data.hash,
  );
  if (existing) {
    return fail(
      "This evidence is already attached. Open it from the evidence ledger instead.",
    );
  }

  let fetched;
  try {
    fetched = await fetchEvidence({
      kind: parsed.data.kind,
      hash: parsed.data.hash,
      agentAccount: agent.smartAccount,
      config: getChainConfig(),
    });
  } catch (error) {
    if (error instanceof EvidenceAttributionError) {
      return fail(error.message);
    }
    return fail(
      error instanceof Error
        ? error.message
        : "The evidence could not be read from BOT Chain testnet.",
    );
  }

  const now = new Date();
  const attachedAt = now.toISOString();
  const priorNativeValueTodayWei = priorNativeValueInUtcDay(
    agentId,
    now,
  );
  const evaluation = evaluateEvidence({
    policy,
    intent,
    observed: fetched.observed,
    agentAccount: agent.smartAccount,
    priorNativeValueTodayWei,
    now,
  });

  const record = evidenceRecordSchema.safeParse({
    id: randomUUID(),
    agentId,
    intentId: intent?.id ?? null,
    policyId: policy.id,
    policyVersion: policy.version,
    policyHash: policy.hash,
    kind: fetched.kind,
    hash: fetched.hash,
    source: "live",
    observed: fetched.observed,
    evaluation,
    attachedAt,
    fetchedAt: fetched.fetchedAt,
  });
  if (!record.success) {
    return fail(
      "The chain response was invalid, so no evidence was attached.",
    );
  }

  try {
    insertEvidence(record.data);
  } catch (error) {
    return fail(
      error instanceof AppError
        ? error.message
        : "The evidence could not be saved.",
    );
  }

  revalidatePath("/app", "layout");
  redirect(`/app/evidence/${record.data.id}?attached=1`);
}
