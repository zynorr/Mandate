# Mandate

Mandate is a read-only evidence ledger for agent actions on **BOT Chain Bohr testnet** (chain ID 968). It records the action a human approved, the policy version that applied, and the public transaction or ERC-4337 UserOperation that actually happened. It then shows where the record matches, where it does not, and what evidence is missing.

Mandate does not hold funds, sign messages, submit UserOperations, or enforce policy on-chain. An optional anchor registry records policy, intent, and report hashes on BOT Chain testnet; the app only reads those anchors.

## Quick start

Requires Node.js 20.9 or newer.

```powershell
npm install
Copy-Item apps\web\.env.example apps\web\.env.local
npm run dev
```

Open `http://localhost:3000` for the product overview and `http://localhost:3000/app` for the workspace.

The database is created automatically at `data/mandate.db`. On first run, Mandate seeds a clearly labelled sample workspace. Set `MANDATE_SEED_DEMO=false` before the first start for an empty ledger.

To reset local data, stop the server and remove `data/mandate.db`, `data/mandate.db-wal`, and `data/mandate.db-shm`.

## Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the Next.js development server. |
| `npm run build` | Create a production build. |
| `npm run start` | Serve the production build. |
| `npm run typecheck` | Type-check the chain package and web app. |
| `npm run test` | Run chain unit tests. The live test is skipped by default. |
| `npm run lint` | Lint the web app. |
| `npm run check` | Run typecheck, unit tests, lint, and contract compilation. |
| `npm run contracts:compile` | Compile the anchor registry with `solc`. |
| `npm run contracts:deploy` | Compile and deploy the registry to BOT Chain testnet. |
| `npm run contracts:anchor -- --kind policy --hash 0x...` | Anchor a policy, intent, report, or evidence hash. |

Run the opt-in live BOT testnet test in PowerShell with:

```powershell
$env:LIVE_BOT_TESTNET = "1"
npm run test --workspace @mandate/chain
Remove-Item Env:LIVE_BOT_TESTNET
```

## Workflow

1. Register a BOT Chain testnet smart account as an agent.
2. Publish an immutable policy version for that agent.
3. Approve one specific intent against that policy snapshot.
4. Attach a public transaction or UserOperation, or discover recent activity through BOT Scan.
5. Review the split verdict, comparison rows, coverage notes, and exported report.
6. Optionally verify a policy hash, intent fingerprint, or report fingerprint against the anchor registry.

Evidence verdicts are `matched`, `out_of_policy`, `failed`, `unattributed`, `needs_review`, and `pending`. A successful transaction can still be out of policy. A record without a linked intent remains unattributed.

Policies compare the sender, target, method selector, native value, per-action and per-UTC-day caps, expiry, and chain ID. Token movements are shown for context but are not evaluated by the policy.

## Live sample

The test suite contains a verified BOT Chain testnet sample. To exercise live attachment manually, register an agent with smart account `0xa682DB3Da0F37853CaB81F7aC538E067F72CF252`, approve a target of `0x402085c248EeA27D92E8b30b2C58ed07f9E20001` with method selector `0x13cd3b53`, then attach UserOperation `0xcab1d7788d6c6109c769700f29c338fae29dec0e8ecf7b28514a8b61681fc41e`.

## Anchor registry

The registry is deployed on BOT Chain Bohr testnet:

- Contract: `0xe923e156570961283198faad9e59744b49d1e523`
- Deployment transaction: `0x1509a5fd4ca468a00151e8a5d6f0540daa740fcd72468b7b42eef3b24fef0756`
- Block: `27678056`
- Explorer: `https://scan.bohr.life/address/0xe923e156570961283198faad9e59744b49d1e523`

The contract stores a content hash, kind, recorder address, and block timestamp. It has no owner, custody, enforcement, upgrade path, or deletion. The first recorder of a hash wins. An anchor proves that a hash was recorded on chain by an address at a time; it does not prove authorship, correctness, or that the underlying record is current.

The workspace reads anchors through `MANDATE_ANCHOR_REGISTRY_ADDRESS` and never creates them. Deployments use a burner testnet key stored locally in `.env.deploy.local`, which is ignored by git. Do not use a funded mainnet key.

```powershell
# Deploy the registry and write contracts/deployments/968.json
npm run contracts:deploy

# Anchor a specific hash
npm run contracts:anchor -- --kind policy --hash 0x...
npm run contracts:anchor -- --kind intent --hash 0x...
npm run contracts:anchor -- --kind report --hash 0x...
```

The sample workspace policy hash and all three sample intent fingerprints are anchored. Open `http://localhost:3000/app/anchors` to verify them. Run anchor commands one at a time; each invocation reads the next nonce from the RPC.

## Architecture

- `apps/web` contains the Next.js App Router UI, server actions, SQLite repository, discovery, source-health checks, anchor lookups, and report API.
- `packages/chain` contains the domain schemas, hashing, policy evaluation, BOT Scan/Bundler/RPC clients, decoding, evidence reconstruction, anchor reads, and report generation.
- `contracts` contains the optional `MandateAnchorRegistry` contract and its compile, deploy, and anchor scripts.
- `data` contains local SQLite runtime storage and is ignored by git.

Useful API routes:

- `GET /api/health` checks RPC, Bundler, and BOT Scan.
- `GET /api/discovery?agentId=...` lists public activity for an agent.
- `GET /api/reports/{agentId}?format=json|md&download=1` exports an evidence report.

## Boundaries and limitations

- Testnet only. The app rejects a chain ID other than 968.
- No wallet connection, authentication, custody, signing, UserOperation submission, EIP-7702 delegation, or paymaster flow.
- No on-chain enforcement. Policies are local review rules. The anchor registry records hashes only; it does not enforce policy, custody funds, or prove authorship.
- Public explorer data may be incomplete. Inner-call decoding and token amounts are not guaranteed. The UI and reports keep those gaps visible.
- The workspace is designed for local single-operator use. Do not expose it directly to the public internet without adding authentication and database access controls.
- The public research note and its Conform limitation are documented in `docs/ui-research.md`.

## Verification

```powershell
npm run check
npm run build
```

The current suite has 19 passing unit tests and one opt-in live test. Production smoke coverage includes the marketing page, workspace pages, agent/policy/intent/evidence flows, anchor lookup, source health, report exports, and a live sample UserOperation attachment.
