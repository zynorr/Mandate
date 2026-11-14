# Mandate

Mandate is a read-only, multi-user evidence ledger for agent actions on **BOT Chain** — mainnet (chain ID 677) or Bohr testnet (chain ID 968). Each signed-in account gets a private workspace that records the action a human approved, the policy version that applied, and the public transaction or ERC-4337 UserOperation that actually happened. It then shows where the record matches, where it does not, and what evidence is missing.

Mandate does not hold funds, sign messages, submit UserOperations, or enforce policy on-chain. An optional anchor registry records policy, intent, and report hashes on BOT Chain. Users may connect a browser wallet to create an anchor and pay the network fee directly; Mandate never receives private keys or submits a transaction without wallet approval.

## Quick start

Requires Node.js 20.9 or newer.

```powershell
npm install
Copy-Item apps\web\.env.example apps\web\.env.local
npm run dev
```

Open `http://localhost:3000` for the product overview and `http://localhost:3000/app` for the workspace.

With a local database and no GitHub credentials, Mandate runs in local owner mode. The workspace belongs to the built-in `local` owner and the database is created automatically at `data/mandate.db`. On the first workspace visit, Mandate seeds clearly labelled sample records for that account. Set `MANDATE_SEED_DEMO=false` before the first start for an empty workspace.

To reset local data, stop the server and remove `data/mandate.db`, `data/mandate.db-wal`, and `data/mandate.db-shm`.

To exercise GitHub sign-in locally, create a GitHub OAuth app whose callback URL is `http://localhost:3000/api/auth/github/callback`, then add `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, and a random `MANDATE_AUTH_SECRET` of at least 32 characters to `apps/web/.env.local`. Do not set `MANDATE_AUTH_MODE=github` when using a hosted database unless all three values are present.

## Accounts and workspace isolation

- GitHub OAuth identifies the account. The app requests only the `read:user` scope and does not read repositories.
- The owner key is the immutable GitHub numeric ID (`github:<id>`), so changing a GitHub username does not move or expose a workspace.
- Agents, policies, intents, evidence, and activity all carry an `owner_id`. Every repository query and API route is scoped to the signed-in owner.
- The workspace layout requires a session. Report and discovery API routes return `401` when no valid session is present; other accounts' records return `404` rather than leaking their existence.
- Sessions are signed, HttpOnly JWTs in the `mandate_session` cookie (HS256, 30-day expiry, `SameSite=Lax`, `Secure` on HTTPS). `MANDATE_AUTH_SECRET` signs them.
- New accounts receive a labelled sample workspace on first use unless `MANDATE_SEED_DEMO=false`, or unless the account already has agents.
- Each account has a separate ledger. Invitations, teams, roles, and shared workspaces are not implemented yet.

The hosted deployment fails closed. A remote or Vercel database requires `MANDATE_DATABASE_URL`, and GitHub OAuth requires `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, and `MANDATE_AUTH_SECRET`. Local auth mode is rejected when the database is remote.

## Hosted deployment (Turso + GitHub OAuth)

Use a Turso/libSQL database for the hosted app. The serverless filesystem is ephemeral, so a local SQLite path is not durable on Vercel.

1. Create a Turso database and token:

   ```powershell
   turso db create mandate
   turso db show mandate --url
   turso db tokens create mandate
   ```

2. Create a GitHub OAuth app. Set the callback URL to `https://<your-domain>/api/auth/github/callback`. The app requests only `read:user`.

3. Configure the Vercel project:

   ```text
   MANDATE_DATABASE_URL=libsql://<database>-<org>.turso.io
   MANDATE_DATABASE_AUTH_TOKEN=<turso-token>
   GITHUB_CLIENT_ID=<github-client-id>
   GITHUB_CLIENT_SECRET=<github-client-secret>
   MANDATE_AUTH_SECRET=<at-least-32-random-characters>
   MANDATE_PUBLIC_URL=https://<your-domain>
   BOT_CHAIN_ID=677
   MANDATE_ANCHOR_REGISTRY_ADDRESS=0xc69367d69b12bc14397773d11ad462f2f1d7aeb4
   MANDATE_SEED_DEMO=false
   ```

   Generate the auth secret with:

   ```powershell
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```

4. Import `zynorr/Mandate` from GitHub. Leave the Vercel Root Directory at the repository root. `vercel.json` runs `npm install`, builds `@mandate/web`, and publishes `apps/web/.next`.

5. Deploy. The schema is created or migrated automatically on the first database connection. Missing hosted database or OAuth configuration stops the app instead of falling back to a shared public workspace.

6. Smoke-test the deployment: open `/signin`, complete GitHub sign-in, confirm `/app` loads only that account's records, export a report, and confirm a signed-out request to `/api/reports/<agentId>` returns `401`.

`MANDATE_PUBLIC_URL` must be the canonical HTTPS origin. It is used to build the GitHub callback URL and decide whether the session cookie is marked `Secure`. If it is omitted or not HTTPS on a hosted deployment, sign-in configuration is treated as invalid.

## Mainnet deployment

The app supports BOT Chain mainnet (chain ID 677) and Bohr testnet (chain ID 968). `BOT_CHAIN_ID` selects the network and any other chain ID is rejected at startup. The default and the value shipped in `.env.example` is mainnet 677. RPC, Bundler, explorer, and EntryPoint defaults follow the selected network, so mainnet only needs the following environment:

```text
BOT_CHAIN_ID=677
MANDATE_ANCHOR_REGISTRY_ADDRESS=0xc69367d69b12bc14397773d11ad462f2f1d7aeb4
MANDATE_SEED_DEMO=false
```

A hosted mainnet workspace additionally needs the Turso and GitHub OAuth variables from the hosted deployment section. Sample records are illustrative, not mainnet evidence. Mainnet anchors are permanent; do not delete or overwrite them.

Mainnet contract operations use the same scripts with an explicit confirmation guard:

```powershell
# Deploy the registry to mainnet (writes contracts/deployments/677.json)
$env:BOT_CHAIN_ID = "677"
$env:DEPLOY_CONFIRM_MAINNET = "1"
npm run contracts:deploy
Remove-Item Env:BOT_CHAIN_ID, Env:DEPLOY_CONFIRM_MAINNET

# Anchor a hash on mainnet
$env:BOT_CHAIN_ID = "677"
$env:DEPLOY_CONFIRM_MAINNET = "1"
npm run contracts:anchor -- --kind policy --hash 0x...
Remove-Item Env:BOT_CHAIN_ID, Env:DEPLOY_CONFIRM_MAINNET
```

Without `DEPLOY_CONFIRM_MAINNET=1`, the deploy and anchor scripts refuse to send a mainnet transaction. Use a dedicated deploy key that holds only gas funds.

## Migrating an existing local workspace

Before the first multi-user start, stop the dev server and keep a copy of the database:

```powershell
New-Item -ItemType Directory -Force .e2e\backups | Out-Null
Copy-Item data\mandate.db ".e2e\backups\mandate-pre-multiuser-$(Get-Date -Format yyyyMMddHHmmss).db"
```

Starting the updated app once migrates the local database automatically:

- adds `owner_id` to agents, policies, intents, evidence, and activity;
- assigns existing rows to the built-in `local` owner;
- replaces global smart-account uniqueness with per-owner `(owner_id, lower(smart_account))` uniqueness;
- sets `PRAGMA user_version = 2`.

After migration, local development opens the same records under the `local` owner. Hosted GitHub accounts start with their own separate workspace. Verify the result with:

```powershell
node -e "const {createClient}=require('@libsql/client');(async()=>{const c=createClient({url:'file:///C:/path/to/Mandate/data/mandate.db'});for(const t of ['agents','policies','intents','evidence','activity']){const r=await c.execute('SELECT owner_id, COUNT(*) AS n FROM '+t+' GROUP BY owner_id');console.log(t,r.rows)}const fk=await c.execute('PRAGMA foreign_key_check');console.log('foreign_key_check',fk.rows.length);c.close()})()"
```

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
| `npm run contracts:deploy` | Compile and deploy the registry to BOT Chain testnet (default). |
| `npm run contracts:deploy:mainnet` | Compile and deploy the registry to BOT Chain mainnet after explicit confirmation. |
| `npm run contracts:test` | Run deployment-network and confirmation safety tests. |
| `npm run contracts:anchor -- --kind policy --hash 0x...` | Anchor a policy, intent, report, or evidence hash. |

Run the opt-in live BOT testnet test in PowerShell with:

```powershell
$env:LIVE_BOT_TESTNET = "1"
npm run test --workspace @mandate/chain
Remove-Item Env:LIVE_BOT_TESTNET
```

## Workflow

1. Sign in with GitHub, or use the local owner in local development.
2. Register a BOT Chain smart account as an agent in your workspace.
3. Publish an immutable policy version for that agent.
4. Approve one specific intent against that policy snapshot.
5. Attach a public transaction or UserOperation, or discover recent activity through BOT Scan.
6. Review the split verdict, comparison rows, coverage notes, and exported report.
7. Optionally verify a policy hash, intent fingerprint, or report fingerprint against the anchor registry.

Evidence verdicts are `matched`, `out_of_policy`, `failed`, `unattributed`, `needs_review`, and `pending`. A successful transaction can still be out of policy. A record without a linked intent remains unattributed.

Policies compare the sender, target, method selector, native value, per-action and per-UTC-day caps, expiry, and chain ID. Token movements are shown for context but are not evaluated by the policy.

## Live testnet sample

The test suite contains a verified BOT Chain testnet sample. To exercise live attachment manually, set `BOT_CHAIN_ID=968` and the testnet RPC/explorer/bundler overrides from `.env.example`, register an agent with smart account `0xa682DB3Da0F37853CaB81F7aC538E067F72CF252`, approve a target of `0x402085c248EeA27D92E8b30b2C58ed07f9E20001` with method selector `0x13cd3b53`, then attach UserOperation `0xcab1d7788d6c6109c769700f29c338fae29dec0e8ecf7b28514a8b61681fc41e`.

## Mainnet E2E run

The 2026-11-14 BOT Chain mainnet run is documented in
[`docs/mainnet-e2e.md`](docs/mainnet-e2e.md). It covers registry edge cases,
native-transfer policy verdicts (matched, daily cap, per-action cap, and wrong
target), a rejected sender mismatch, and the on-chain anchor transaction for
the policy, intent, and report fingerprints. The imported records belong to the
local workspace owner and remain available in local development under the
Evidence, Activity, and agent pages.

## Anchor registry

The registry is deployed on both supported networks.

BOT Chain mainnet (chain ID 677):

- Contract: `0xc69367d69b12bc14397773d11ad462f2f1d7aeb4`
- Deployment transaction: `0x6fba151a852905a2bb0be946db5bdab3915d5396165f01e47260a44fb624787f`
- Block: `28655203`
- Explorer: `https://scan.botchain.ai/address/0xc69367d69b12bc14397773d11ad462f2f1d7aeb4`

BOT Chain Bohr testnet (chain ID 968):

- Contract: `0xe923e156570961283198faad9e59744b49d1e523`
- Deployment transaction: `0x1509a5fd4ca468a00151e8a5d6f0540daa740fcd72468b7b42eef3b24fef0756`
- Block: `27678056`
- Explorer: `https://scan.bohr.life/address/0xe923e156570961283198faad9e59744b49d1e523`

The contract stores a content hash, kind, recorder address, and block timestamp. It has no owner, custody, enforcement, upgrade path, or deletion. The first recorder of a hash wins. An anchor proves that a hash was recorded on chain by an address at a time; it does not prove authorship, correctness, or that the underlying record is current.

The workspace reads anchors through `MANDATE_ANCHOR_REGISTRY_ADDRESS`. On the Anchors page, a user can connect an EIP-1193 browser wallet, choose the record type, and approve a direct `anchor(bytes32,uint8)` transaction. The wallet must be on the configured chain; the connected account pays gas and becomes the recorder. Mandate never receives private keys or silently submits transactions. Never use a private key pasted into chat, source control, or a shared environment. For mainnet, use a wallet with only the BOT needed for gas; verify its exposure status first and never reuse a compromised key.

```powershell
# Deploy the registry to testnet and write contracts/deployments/968.json
npm run contracts:deploy

# Mainnet: review the contract and RPC, configure a fresh dedicated deployer key,
# then explicitly select chain 677 and confirm in the current PowerShell session.
$env:BOT_CHAIN_ID = "677"
$env:DEPLOY_CONFIRM_MAINNET = "1"
npm run contracts:deploy:mainnet
Remove-Item Env:BOT_CHAIN_ID, Env:DEPLOY_CONFIRM_MAINNET

# Anchor a specific hash
npm run contracts:anchor -- --kind policy --hash 0x...
npm run contracts:anchor -- --kind intent --hash 0x...
npm run contracts:anchor -- --kind report --hash 0x...
```

The mainnet registry contains the policy, intent, and report anchors from the documented mainnet E2E run. The older sample workspace hashes were anchored on the testnet registry: set `BOT_CHAIN_ID=968` and `MANDATE_ANCHOR_REGISTRY_ADDRESS=0xe923e156570961283198faad9e59744b49d1e523` to check them. Per-account sample records created for hosted accounts are illustrative and are not pre-anchored. The pitch deck PDF is anchored as a report; its hash and transaction are recorded in `docs/pitch/README.md`. Run anchor commands one at a time; each invocation reads the next nonce from the RPC.

## Pitch deck

`docs/pitch/mandate-pitch-deck.pdf` is a twelve-slide product pitch. The editable source is `docs/pitch/deck.html`; `docs/pitch/README.md` covers regeneration and the deck's on-chain anchor record.

## Architecture

- `apps/web` contains the Next.js App Router UI, server actions, GitHub OAuth and session handling, the owner-scoped libSQL repository, discovery, source-health checks, anchor lookups, and the report API.
- `packages/chain` contains the domain schemas, hashing, policy evaluation, BOT Scan/Bundler/RPC clients, decoding, evidence reconstruction, anchor reads, and report generation.
- `contracts` contains the optional `MandateAnchorRegistry` contract and its compile, deploy, and anchor scripts.
- `data` contains local SQLite runtime storage and is ignored by git.
- `.e2e` contains git-ignored E2E artifacts, wallet files, and database backups. Never commit private keys.

Useful API routes:

- `GET /api/health` checks RPC, Bundler, and BOT Scan. It does not require a session.
- `GET /api/discovery?agentId=...` lists public activity for an agent owned by the signed-in account. Returns `401` without a session.
- `GET /api/reports/{agentId}?format=json|md&download=1` exports an evidence report for an owned agent. Returns `401` without a session.
- `GET /api/auth/github/start`, `GET /api/auth/github/callback`, and `POST /api/auth/signout` implement GitHub sign-in and sign-out.

## Security model and limitations

- Authentication is GitHub identity, not wallet ownership. No wallet connection, custody, signing, UserOperation submission, EIP-7702 delegation, or paymaster flow is implemented.
- Tenant isolation is enforced in application queries by `owner_id`. The database is shared, so anyone with database credentials can read all accounts' records.
- Sessions are stateless. Signing out clears the cookie, but an already-issued token remains valid until its 30-day expiry unless `MANDATE_AUTH_SECRET` is rotated, which invalidates every session.
- There are no team invitations, roles, per-account rate limits, or abuse controls yet. Treat this as a pilot release, not an audited multi-tenant security boundary.
- No on-chain enforcement. Policies are local review rules. The anchor registry records hashes only; it does not enforce policy, custody funds, or prove authorship.
- Public explorer data may be incomplete. Inner-call decoding and token amounts are not guaranteed. The UI and reports keep those gaps visible.
- Hosted deployments must use a durable remote database. Local SQLite mode is for development only and must not be exposed publicly.
- The public research note and its Conform limitation are documented in `docs/ui-research.md`.

## Verification

```powershell
npm run check
npm run build
```

The suite includes chain unit tests and one opt-in live test. Production smoke coverage includes the marketing page, sign-in gating, owner-scoped workspace pages, agent/policy/intent/evidence flows, anchor lookup, source health, report exports, and a live sample UserOperation attachment.
