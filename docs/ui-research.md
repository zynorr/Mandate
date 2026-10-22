# UI research

Research date: 21 October 2026. Scope: BOT Chain testnet integration, explorer/account-abstraction surfaces, brand usage, and adjacent agent-governance products.

## What was reviewed

### BOT Chain, first-party

- [Developer docs](https://dev-docs.botchain.ai/), especially Quick Guide, JSON-RPC, Account Abstraction (ERC-4337 and EIP-7702), EOA Paymaster, and Agent OS.
- [BOT Chain testnet explorer](https://scan.bohr.life) and its Blockscout v2 API, including account-abstraction endpoints.
- The official [brand kit](https://www.botchain.ai/static/BOT%20Chain%20Assets/BOT%20Chain%20Brand%20Kit.zip) and [brand guidelines PDF](https://www.botchain.ai/static/BOT%20Chain%20Assets/BOT%20Chain%20Brand%20Guideline.pdf).

Observed:

- Testnet is **Bohr Testnet**, chain ID **968**, RPC `https://rpc.bohr.life`, bundler `https://bundler.bohr.life/rpc/`, explorer `https://scan.bohr.life`. Mainnet is 677 and must not be mixed into this product.
- ERC-4337 EntryPoint v0.7 is documented as supported. EIP-7702 is only partially supported and is disabled on the public bundler, so Mandate does not assume 7702.
- There is no public ERC-4337 Paymaster. The documented "EOA Paymaster" is a different, wallet-originated gas-sponsorship flow. Mandate does not use or imply paymaster support.
- The testnet explorer exposes account-abstraction operations through Blockscout's proxy API, with sender, outer transaction hash, status, gas, and sometimes decoded inner call data. Inner-call decoding is not guaranteed.
- BOT Scan's public API presents a dense, data-first explorer: statuses, long hashes, tabular transaction lists, and a strong "source of truth" feel. Its density is useful for evidence, but it is not the right model for an approval or review workflow.
- The brand kit contains a white wordmark on transparent background and an `.ai` source. The guideline forbids editing or distorting the mark. The supplied asset is therefore placed on a dark BOT Chain footer surface, at its native aspect ratio.

### Adjacent products and patterns

Public research covered agent-governance and execution-evidence products including [ExecutionProof](https://builderexecutionproof.io/), [AgentAuth by Flow](https://www.create-flow.ai/en), [Attestix](https://attestix.io/), [kriya Console](https://github.com/governex/kriya-console), and the open [AARM spec](https://github.com/opt-prime/aarm_OL), as well as several transaction-monitoring consoles.

Recurring patterns:

- The strongest products make the **decision boundary** visible: proposed action → policy/approval → execution → receipt.
- Status language is careful. "Submitted" and "succeeded" are separate states. Evidence vendors explicitly distinguish on-chain inclusion from business success.
- Trust is increased by **showing what is missing**, not only what passed: coverage badges, unavailable fields, and unverified sources.
- Good review surfaces pair a compact summary with a drill-down into raw evidence. Hash-heavy data is secondary, not the primary visual language.
- Agent governance products often drift toward wallet/signing functionality or live enforcement. The audit-oriented products are calmer, document-like, and export-focused.

### Conform

The brief names Conform as a comparison point. Public research did not locate a live, relevant Conform product with an accessible UI: `conform.xyz` is a parked domain, and search results resolved to unrelated products (an accessibility compliance site and a research-interview tool). I have therefore treated "distinct from Conform" as a direction to avoid a generic dark compliance dashboard and generic violet-gradient SaaS styling, and made deliberate choices below. No layout, copy, or asset from an unrelated product was used.

## Patterns Mandate will adapt

1. **Timeline as primary structure.** Events are ordered, timestamped, and link back to the policy version and evidence that made them meaningful. This is more reviewable than a wall of status cards.
2. **Split verdicts.** Intent match, policy result, chain result, and source attribution are separate signals. A successful transaction can still be out of policy. A failed transaction can still be attributed.
3. **Evidence with provenance.** Every observed field names its source (BOT Scan, chain RPC, bundler, manual attachment) and every attachment carries a fetched-at timestamp.
4. **Honest coverage.** UserOperation inner-call targets and token amounts may be unavailable. The UI says so in place, and reports preserve the same caveat.
5. **Progressive disclosure.** Reviewers see a plain-language summary first; hashes, gas fields, and raw source payloads are available in a details panel.
6. **Human-approved intent as the anchor.** The product is not a prompt log. The intent record is deliberately narrow: target, method, native value, policy version, human approver, timestamp.

## Visual direction

Mandate borrows the trust cues of a signed paper ledger and the clarity of an audit workpaper, not a trading terminal.

- **Palette:** warm white paper (`#f7f3eb`), soft ivory surfaces, deep ink, muted indigo (`#55618a`) for authorization, evergreen for verified evidence, ochre for review, and a restrained brick red for failures. No neon, no dark "cyber" chrome, no gradient-purple SaaS look.
- **Typography:** Fraunces for editorial headings, Manrope for interface copy, IBM Plex Mono only for addresses, hashes, and gas values. Numbers are tabular where comparison matters.
- **Layout:** an evidence timeline and review queue on the application overview; a single-column review page for evidence; a policy card that reads like a versioned document rather than a settings form.
- **Motion:** only for state transitions and page entrance, with `prefers-reduced-motion` respected.
- **Logo treatment:** BOT Chain's supplied white wordmark sits untouched on a deep green footer panel, with generous clear space. It is never recolored, cropped, or used as a decorative pattern.

## Distinctness from Conform and category peers

- Light and editorial rather than dark, dense, or terminal-like.
- Indigo is used for **authority**, green for **confirmed evidence**, not for generic "success everywhere".
- The marketing site leads with the record and the review ritual, not with a wallet, key, token, or signing metaphor.
- Mandate never presents itself as a custodian, signer, enforcement layer, or complete tracing service. That boundary is part of the visual story: the "coverage" section is a first-class section, not a footnote.
- The app's core object is a **versioned mandate plus an evidence comparison**, not a chat, approval card feed, or transaction builder.

## Constraints carried into implementation

- BOT Chain testnet only; chain ID is validated against 968.
- Explorer, RPC, bundler, EntryPoint, and database locations are environment-configurable.
- No keys, signing, custody, or transaction submission.
- No claim of success until an on-chain receipt confirms it.
- Sample/demo records are labelled at row level and in exports.
- The required BOT Chain footer links are present in every public and app footer, including the mainnet explorer link requested in the brief; the product's in-context evidence links point to the configured testnet explorer.
