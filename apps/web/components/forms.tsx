"use client";

import {
  useActionState,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from "react";
import { useFormStatus } from "react-dom";
import { initialFormState, type FormState } from "@/lib/form-state";
import { AlertIcon, ArrowRightIcon } from "./icons";

type FormAction = (
  state: FormState,
  formData: FormData,
) => Promise<FormState>;

type FieldFrameProps = {
  name: string;
  label: string;
  error?: string;
  hint?: ReactNode;
  full?: boolean;
  mono?: boolean;
  children: ReactNode;
};

function fieldError(state: FormState, name: string): string | undefined {
  if (state.fieldErrors[name]) return state.fieldErrors[name];
  const prefix = `${name}.`;
  return Object.entries(state.fieldErrors).find(([key]) =>
    key.startsWith(prefix),
  )?.[1];
}

function FieldFrame({
  name,
  label,
  error,
  hint,
  full,
  mono,
  children,
}: FieldFrameProps) {
  return (
    <div
      className={`field ${full ? "field-full" : ""} ${mono ? "field-mono" : ""}`}
    >
      <label htmlFor={name}>{label}</label>
      {children}
      {hint ? (
        <p className="field-hint" id={`${name}-hint`}>
          {hint}
        </p>
      ) : null}
      {error ? (
        <p className="field-error" id={`${name}-error`}>
          {error}
        </p>
      ) : null}
    </div>
  );
}

function fieldProps(
  name: string,
  error: string | undefined,
  hint: ReactNode | undefined,
  invalid: boolean,
) {
  return {
    id: name,
    name,
    "aria-invalid": invalid || undefined,
    "aria-describedby":
      [hint ? `${name}-hint` : null, error ? `${name}-error` : null]
        .filter(Boolean)
        .join(" ") || undefined,
  };
}

export function TextField({
  name,
  label,
  state,
  hint,
  error: explicitError,
  full,
  mono,
  ...props
}: {
  name: string;
  label: string;
  state: FormState;
  hint?: ReactNode;
  error?: string;
  full?: boolean;
  mono?: boolean;
} & Omit<InputHTMLAttributes<HTMLInputElement>, "name" | "id">) {
  const error = explicitError ?? fieldError(state, name);
  return (
    <FieldFrame
      name={name}
      label={label}
      error={error}
      hint={hint}
      full={full}
      mono={mono}
    >
      <input {...props} {...fieldProps(name, error, hint, Boolean(error))} />
    </FieldFrame>
  );
}

export function TextAreaField({
  name,
  label,
  state,
  hint,
  error: explicitError,
  full,
  mono,
  ...props
}: {
  name: string;
  label: string;
  state: FormState;
  hint?: ReactNode;
  error?: string;
  full?: boolean;
  mono?: boolean;
} & Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "name" | "id">) {
  const error = explicitError ?? fieldError(state, name);
  return (
    <FieldFrame
      name={name}
      label={label}
      error={error}
      hint={hint}
      full={full}
      mono={mono}
    >
      <textarea {...props} {...fieldProps(name, error, hint, Boolean(error))} />
    </FieldFrame>
  );
}

export function SelectField({
  name,
  label,
  state,
  hint,
  error: explicitError,
  full,
  children,
  ...props
}: {
  name: string;
  label: string;
  state: FormState;
  hint?: ReactNode;
  error?: string;
  full?: boolean;
  children: ReactNode;
} & Omit<SelectHTMLAttributes<HTMLSelectElement>, "name" | "id">) {
  const error = explicitError ?? fieldError(state, name);
  return (
    <FieldFrame
      name={name}
      label={label}
      error={error}
      hint={hint}
      full={full}
    >
      <select {...props} {...fieldProps(name, error, hint, Boolean(error))}>
        {children}
      </select>
    </FieldFrame>
  );
}

function SubmitButton({ children }: { children: ReactNode }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="button button-ink" disabled={pending}>
      {pending ? <span className="spinner" aria-hidden="true" /> : null}
      {pending ? "Working…" : children}
      {!pending ? <ArrowRightIcon size={15} /> : null}
    </button>
  );
}

function ErrorBanner({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <div className="form-error-banner" role="alert">
      <AlertIcon size={16} />
      <span>{message}</span>
    </div>
  );
}

export function AgentForm({ action }: { action: FormAction }) {
  const [state, formAction] = useActionState(action, initialFormState);

  return (
    <form action={formAction} className="form-card" noValidate>
      <div className="form-card-head">
        <h2>Register a smart account</h2>
        <p>
          Use the ERC-4337 smart account that will act on BOT Chain testnet.
          Mandate uses this address to match public evidence.
        </p>
      </div>
      <div className="form-body">
        <ErrorBanner message={state.error} />
        <div className="form-grid">
          <TextField
            name="name"
            label="Agent name"
            state={state}
            placeholder="Treasury operations"
            required
            maxLength={80}
            autoComplete="off"
          />
          <TextField
            name="smartAccount"
            label="Smart account address"
            state={state}
            placeholder="0x…"
            hint="The account that sends UserOperations or transactions. It must be on BOT Chain testnet."
            required
            full={false}
            mono
            spellCheck={false}
            autoComplete="off"
          />
          <TextAreaField
            name="description"
            label="Description"
            state={state}
            placeholder="What this agent is allowed to do and who operates it."
            hint="Optional. Keep it factual and reviewable."
            full
            maxLength={500}
          />
        </div>
        <div className="form-actions">
          <p className="form-actions-note">
            Registering an agent does not grant on-chain permissions. It creates
            a review record in this workspace.
          </p>
          <SubmitButton>Register agent</SubmitButton>
        </div>
      </div>
    </form>
  );
}

export function PolicyForm({
  action,
  agentId,
  defaults,
}: {
  action: FormAction;
  agentId: string;
  defaults?: {
    name?: string;
    allowedTargets?: string;
    allowedMethods?: string;
    maxNativePerAction?: string;
    maxNativePerDay?: string;
    expiresAt?: string;
    notes?: string;
  };
}) {
  const [state, formAction] = useActionState(action, initialFormState);

  return (
    <form action={formAction} className="form-card" noValidate>
      <input type="hidden" name="agentId" value={agentId} />
      <div className="form-card-head">
        <h2>Publish a policy version</h2>
        <p>
          Every intent records the policy version it was approved under. A new
          publication creates a new version; earlier versions remain unchanged.
        </p>
      </div>
      <div className="form-body">
        <ErrorBanner message={state.error} />
        <div className="form-grid">
          <TextField
            name="name"
            label="Policy name"
            state={state}
            defaultValue={defaults?.name}
            placeholder="Vendor settlement pilot"
            required
            maxLength={80}
          />
          <TextField
            name="maxNativePerAction"
            label="Native cap per action (BOT)"
            state={state}
            defaultValue={defaults?.maxNativePerAction}
            placeholder="0.01"
            hint="Use 0 when the agent may not move native value."
            inputMode="decimal"
            required
          />
          <TextField
            name="maxNativePerDay"
            label="Native cap per UTC day (BOT)"
            state={state}
            defaultValue={defaults?.maxNativePerDay}
            placeholder="Optional"
            hint="Leave blank for no daily cap. Must be at least the per-action cap."
            inputMode="decimal"
          />
          <TextField
            name="expiresAt"
            label="Expiry (UTC)"
            state={state}
            defaultValue={defaults?.expiresAt}
            type="datetime-local"
            hint="Leave blank for no expiry."
          />
          <TextAreaField
            name="allowedTargets"
            label="Allowed targets"
            state={state}
            defaultValue={defaults?.allowedTargets}
            placeholder={"0x1111…\n0x2222…"}
            hint="One address per line. Up to 20 targets."
            required
            mono
            rows={4}
          />
          <TextAreaField
            name="allowedMethods"
            label="Allowed selectors"
            state={state}
            defaultValue={defaults?.allowedMethods}
            placeholder={"0xa9059cbb\n0x00000000"}
            hint="One 4-byte function selector per line. Use 0x00000000 for native transfers."
            required
            mono
            rows={4}
          />
          <TextAreaField
            name="notes"
            label="Review notes"
            state={state}
            defaultValue={defaults?.notes}
            placeholder="Why these limits exist, and what reviewers should know."
            full
            maxLength={500}
            rows={3}
          />
        </div>
        <div className="form-actions">
          <p className="form-actions-note">
            Publishing stores a new review rule. It is not an on-chain
            permission or enforcement mechanism.
          </p>
          <SubmitButton>Publish policy version</SubmitButton>
        </div>
      </div>
    </form>
  );
}

export function IntentForm({
  action,
  agentId,
  policies,
  defaults,
}: {
  action: FormAction;
  agentId: string;
  policies: Array<{ id: string; name: string; version: number }>;
  defaults?: {
    policyId?: string;
    target?: string;
    methodSelector?: string;
  };
}) {
  const [state, formAction] = useActionState(action, initialFormState);

  return (
    <form action={formAction} className="form-card" noValidate>
      <input type="hidden" name="agentId" value={agentId} />
      <div className="form-card-head">
        <h2>Approve one intent</h2>
        <p>
          Record one specific action as approved. The intent keeps the policy
          snapshot that was current at approval time.
        </p>
      </div>
      <div className="form-body">
        <ErrorBanner message={state.error} />
        <div className="form-grid">
          <SelectField
            name="policyId"
            label="Policy snapshot"
            state={state}
            defaultValue={defaults?.policyId}
            required
          >
            <option value="">Choose a policy</option>
            {policies.map((policy) => (
              <option key={policy.id} value={policy.id}>
                v{policy.version} · {policy.name}
              </option>
            ))}
          </SelectField>
          <TextField
            name="title"
            label="Intent title"
            state={state}
            placeholder="Pay vendor invoice 1042"
            required
            maxLength={100}
          />
          <TextField
            name="target"
            label="Approved target"
            state={state}
            defaultValue={defaults?.target}
            placeholder="0x…"
            required
            mono
            spellCheck={false}
            hint="The inner contract or address that should receive the call."
          />
          <TextField
            name="methodSelector"
            label="Approved method selector"
            state={state}
            defaultValue={defaults?.methodSelector}
            placeholder="0xa9059cbb"
            required
            mono
            spellCheck={false}
            maxLength={10}
          />
          <TextField
            name="valueBot"
            label="Approved native value (BOT)"
            state={state}
            defaultValue="0"
            placeholder="0"
            required
            inputMode="decimal"
            hint="Use 0 for token-only calls. This is compared with observed native value."
          />
          <TextField
            name="approvedBy"
            label="Recorded by"
            state={state}
            placeholder="Treasury operator"
            hint="Name only. Mandate does not verify identity."
            required
            maxLength={80}
          />
          <TextAreaField
            name="rationale"
            label="Approval rationale"
            state={state}
            placeholder="What this action is for, and why the limits are appropriate."
            required
            full
            minLength={10}
            maxLength={1000}
            rows={4}
          />
        </div>
        <div className="form-actions">
          <p className="form-actions-note">
            This is an approval record, not a wallet signature or a queued
            transaction. Mandate cannot execute it.
          </p>
          <SubmitButton>Approve intent</SubmitButton>
        </div>
      </div>
    </form>
  );
}

export function AttachEvidenceForm({
  action,
  agentId,
  intents,
  defaults,
}: {
  action: FormAction;
  agentId: string;
  intents: Array<{ id: string; title: string; policyVersion: number }>;
  defaults?: {
    kind?: "transaction" | "user_operation";
    hash?: string;
    intentId?: string;
  };
}) {
  const [state, formAction] = useActionState(action, initialFormState);

  return (
    <form action={formAction} className="form-card" noValidate>
      <input type="hidden" name="agentId" value={agentId} />
      <div className="form-card-head">
        <h2>Fetch and attach evidence</h2>
        <p>
          Mandate reads the public transaction or UserOperation, checks that the
          sender matches this smart account, and compares it with the linked
          intent and policy.
        </p>
      </div>
      <div className="form-body">
        <ErrorBanner message={state.error} />
        <div className="form-grid">
          <SelectField
            name="kind"
            label="Evidence type"
            state={state}
            defaultValue={defaults?.kind ?? "user_operation"}
            required
          >
            <option value="user_operation">ERC-4337 UserOperation</option>
            <option value="transaction">Transaction</option>
          </SelectField>
          <SelectField
            name="intentId"
            label="Link to approved intent"
            state={state}
            defaultValue={defaults?.intentId ?? ""}
            hint="Optional. With no intent, the record is preserved as unattributed."
          >
            <option value="">No intent · unattributed</option>
            {intents.map((intent) => (
              <option key={intent.id} value={intent.id}>
                v{intent.policyVersion} · {intent.title}
              </option>
            ))}
          </SelectField>
          <TextField
            name="hash"
            label="Transaction or UserOperation hash"
            state={state}
            defaultValue={defaults?.hash}
            placeholder="0x…"
            required
            full
            mono
            spellCheck={false}
            minLength={66}
            maxLength={66}
          />
        </div>
        <div className="form-actions">
          <p className="form-actions-note">
            Read-only fetch from BOT Chain testnet and BOT Scan. No signing,
            custody, or transaction submission.
          </p>
          <SubmitButton>Fetch and attach</SubmitButton>
        </div>
      </div>
    </form>
  );
}
