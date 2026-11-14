# BOT Chain mainnet E2E run — 2026-11-14

This document records the mainnet end-to-end run used to verify the Mandate
workspace and the `MandateAnchorRegistry` contract. The run used BOT Chain
mainnet only (chain ID 677). Private keys are not included; wallet files remain
in the git-ignored `.e2e/` directory.

## Environment

| Item | Value |
| --- | --- |
| Network | BOT Chain mainnet, chain ID 677 |
| RPC | `https://rpc.botchain.ai` |
| Explorer | `https://scan.botchain.ai` |
| Registry | `0xc69367d69b12bc14397773d11ad462f2f1d7aeb4` |
| Registry deployment | `0x6fba151a852905a2bb0be946db5bdab3915d5396165f01e47260a44fb624787f` |
| Solidity compiler | `v0.8.37+commit.f401782d`, optimizer 200 runs, EVM `paris` |
| Explorer verification | Pass — Verified |

## Wallets

Only public addresses are listed. Ten additional mainnet wallets were funded
for this run (batch 2). The hub wallet distributed gas to the other nine.

| # | Address | Role |
| --- | --- | --- |
| 1 | `0x4CeCBA34927a28c93CE2891F27681195982dACd6` | Batch 2 hub; contract edge tests |
| 2 | `0x1bd47eA09aE66c9A43Da96697906a8F88fB8A234` | Native-transfer policy tests |
| 3 | `0x0bbE0c7EA19Dd38BF3dd027e7f7dA4C757A0191D` | Approved target; report anchor |
| 4 | `0x73E82A94F896a942c508363F22BBd60069cFcb73` | Wrong-target recipient |
| 5–10 | See `.e2e/wallets-batch2.json` | Anchor coverage |

## Contract edge cases

All calls were sent to the registry from batch 2 wallet #1.

| Test | Result | Transaction |
| --- | --- | --- |
| `anchorMany` with four entries, kinds 0–3 | Pass. Four `Anchored` events decoded with the correct recorder, kind, hash, and block timestamp; all four records read back correctly. | [`0xb0147cf2…e976`](https://scan.botchain.ai/tx/0xb0147cf238b41208bdc7c46059fd5f41f335f92349e5a42fa8fcba73e817e976) |
| Atomic batch containing a duplicate | Pass. Transaction reverted; the new hash was not stored and `totalAnchors` did not change. | [`0x08e7d77a…0999`](https://scan.botchain.ai/tx/0x08e7d77aa9911e6ad95529697ff2de2c1b67dafeb84b84f8029f7dd8e3ec0999) |
| Empty `anchorMany([], [])` | Pass. Successful with zero logs and no state change. | [`0x7a8e8d72…40ba`](https://scan.botchain.ai/tx/0x7a8e8d7232382c63434f3ed3ae664ca6d439c6f957d539490c361037283440ba) |
| Duplicate from another wallet | Pass. Simulation reverted with `AlreadyAnchored(hash, recorder, timestamp)`. | Simulation only |

`totalAnchors` moved from **32 to 36**. Total edge-test fees were
**0.00423932 BOT**.

The initial duplicate check used a wallet client where a public client was
required. It was re-run correctly; the correction is recorded in
`.e2e/results/edge-tests-20261114100406-16fa59.json` and the corrected result
is in `.e2e/results/duplicate-checks-1794650723808.json`.

## App-level native-transfer policy

Agent: `Native Transfer E2E Agent` (`bf947c92-13e9-46e8-a0a1-562c0a0c728f`)  
Smart account: `0x1bd47eA09aE66c9A43Da96697906a8F88fB8A234`  
Policy v1 hash: `0x2c2be23e1e566acde2e21e41d4bc7df7604c332126e527cf90ad340c6ff4bcd5`  
Intent fingerprint: `0x239e4aeaa78c8a0bf385cc4a5aeb3615a2970d6b9a4672e7c293ab4d7c3cc8c1`

Policy v1 allows native transfers only to `0x0bbE0c7EA19Dd38BF3dd027e7f7dA4C757A0191D`
with selector `0x00000000`, capped at **0.0001 BOT per action** and
**0.00015 BOT per UTC day**, expiring 2027-12-31.

| Evidence | Amount | Verdict | Failed checks | Transaction |
| --- | --- | --- | --- | --- |
| First transfer | 0.0001 BOT | Matched | None | [`0xce87d5d0…af24`](https://scan.botchain.ai/tx/0xce87d5d0c924a07386905a1b1912665203548dfa6f973b4313ef2b4301b9af24) |
| Second transfer | 0.0001 BOT | Out of policy | Daily cap: 0.0002 BOT total exceeds 0.00015 BOT | [`0x2aa23eeb…ba43`](https://scan.botchain.ai/tx/0x2aa23eeb0729ae133ef74213143ec2b8922ea2cd18354546841553b60e27ba43) |
| Larger transfer | 0.0003 BOT | Out of policy | Intent value, per-action cap, and daily cap | [`0xee83666d…a409`](https://scan.botchain.ai/tx/0xee83666d7493fcc27916870bf6e9c3bcd29ee610b92c89398513d77fb921a409) |
| Wrong target | 0.0001 BOT | Out of policy | Intent target, allowed target, and daily cap | [`0x225dcd17…05b8`](https://scan.botchain.ai/tx/0x225dcd17ad853e4cf2a2d8bbca960521b9b2740c3804f56cf0079ae1e78905b8) |

The wrong-target transfer was sent to
`0x73E82A94F896a942c508363F22BBd60069cFcb73`. The daily cap is cumulative,
so later evidence also fails that check; each row still isolates the new
condition under test.

### Sender identity check

A transaction from batch 2 wallet #3
(`0x0bbE0c7EA19Dd38BF3dd027e7f7dA4C757A0191D`) was offered to the
native-transfer agent. The app rejected it before creating an evidence record:

> This transaction was sent by 0x0bbE…191D, not by the registered smart
> account 0x1bd4…A234.

Rejected transaction:
[`0x93aec9c6…dd99`](https://scan.botchain.ai/tx/0x93aec9c673ba627bc2bc410997fbbbfc4ce1b4d618dccfc78f92674cc8f7dd99).

## Anchor and report coverage

The app-level anchor transaction recorded three hashes in one `anchorMany`
call from wallet #3:

| Kind | Content hash |
| --- | --- |
| Policy | `0x2c2be23e1e566acde2e21e41d4bc7df7604c332126e527cf90ad340c6ff4bcd5` |
| Intent | `0x239e4aeaa78c8a0bf385cc4a5aeb3615a2970d6b9a4672e7c293ab4d7c3cc8c1` |
| Report | `0xa43549bb8500c12766caa34c97f06af117c356f4dde1769d6b156a4819fac463` |

Transaction:
[`0xbd1ae23f…64ba`](https://scan.botchain.ai/tx/0xbd1ae23f227d94b218f791c3b1c6b79adc9c1e49494cfe313a6b5fd56cf164ba),
block `30223111`, fee `0.00212352 BOT`.

`totalAnchors` moved from **36 to 39**. The exported report
(`.e2e/results/report.json`) contains 4 evidence records: 1 matched and 3 out
of policy.

The earlier mainnet anchor agent also has one matched evidence record:
[`0xfa0bd183…31e7`](https://scan.botchain.ai/tx/0xfa0bd18372aa066b73c9a399fa6997c805502e90ed4e0bd5b6454ed5ad0531e7),
block `30111955`.

## Workspace records

The run originally used `data/mandate-e2e.db`. Its records were imported into
the default workspace database (`data/mandate.db`) so the Evidence, Activity,
and agent pages show the run without switching databases.

Imported records:

- 2 agents
- 2 policies
- 2 intents
- 5 evidence records
- 11 activity events

Each imported activity summary states the test case and outcome, for example:

- `Evidence attached: 0.0001 BOT transfer 0xce87d5d0… (block 30222527) matched the approved intent and every policy check.`
- `Evidence attached: second 0.0001 BOT transfer 0x2aa23eeb… was out of policy — daily total 0.0002 BOT exceeds the 0.00015 BOT cap.`
- `Evidence attached: 0.0003 BOT transfer 0xee83666d… was out of policy — intent value, per-action cap, and daily cap all exceeded.`
- `Evidence attached: 0.0001 BOT transfer 0x225dcd17… went to 0x73E8…cb73 instead of the approved target; intent and policy target checks failed.`

The import used an upsert keyed by record ID, preserved foreign keys, and was
preceded by a backup at `.e2e/backups/mandate-main-20261114110813.db`.
`PRAGMA foreign_key_check` returned no violations.

## Final balances

| Group | Balance |
| --- | --- |
| Batch 2 wallets | 0.037296 BOT |
| Batch 1 wallets | 0.061513 BOT |
| Combined | ~0.098809 BOT |

Batch 2 wallet #2 finished with `0.00167402 BOT`; wallet #3 finished with
`0.00181026 BOT`. New spend for the contract edge cases, four transfers, and
the report anchor was approximately `0.00804 BOT`.

## Artifacts

- `.e2e/results/edge-tests-20261114100406-16fa59.json`
- `.e2e/results/duplicate-checks-1794650723808.json`
- `.e2e/results/transfer-20261114101539-4733aa.json`
- `.e2e/results/transfer-20261114101730-6e4008.json`
- `.e2e/results/transfer-20261114101835-5b93a1.json`
- `.e2e/results/transfer-20261114101955-0c87b4.json`
- `.e2e/results/transfer-20261114102054-327013.json`
- `.e2e/results/anchor-app-records-20261114102254-3feb69.json`
- `.e2e/results/report.json`
- `.e2e/results/main-db-import-20261114110813.json`

Private keys are stored only in the git-ignored `.e2e/` wallet files and are
never printed by the harness.
