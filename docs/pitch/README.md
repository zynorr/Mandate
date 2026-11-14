# Pitch deck

The deck is a twelve-slide, 16:9 product pitch for Mandate.

| File | Purpose |
| --- | --- |
| `deck.html` | Editable source. One `<section class="slide">` per slide. |
| `mandate-pitch-deck.pdf` | Rendered deck, 12 pages, 1280 × 720 per page. |

## Content

Every claim in the deck comes from this repository: `README.md`,
`docs/mainnet-e2e.md`, `docs/ui-research.md`, the marketing page, the contract
deployment record, and the test suite. No market size, revenue, or customer
figures are asserted. The $1,000 request is a bounded pilot budget, not a
forecast.

## Regenerate the PDF

Render with headless Edge from the repository root:

```powershell
& "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe" `
  --headless=new --disable-gpu `
  --user-data-dir="$env:TEMP\mandate-pdf-profile" `
  --no-pdf-header-footer --virtual-time-budget=25000 `
  --print-to-pdf="C:\Users\HP\Documents\Mandate\docs\pitch\mandate-pitch-deck.pdf" `
  "file:///C:/Users/HP/Documents/Mandate/docs/pitch/deck.html"
```

Slides load Fraunces, Manrope, and IBM Plex Mono from Google Fonts, so the
renderer needs network access. After regenerating, recompute the hash below —
a new PDF is a new record and would need its own anchor.

## Current rendered deck

- Content hash (SHA-256 of the current PDF): `0x9377fb4a0815ca770790420e29201b04e02e7603491b6543f048959c9e1a4ebd`
- Status: current grant proposal; not yet anchored
- Network described: BOT Chain mainnet, chain ID `677`
- Grant request: `$1,000` for a three-team mainnet pilot

The current PDF supersedes the originally anchored testnet rendering below.
The prior anchor remains permanent and is retained as historical provenance; it
does not attest to the current PDF contents.

## Historical anchor record

- Content hash (SHA-256 of the PDF): `0x34bcc1e361da596adab84ae4b890148348c3bfba549bc9188ad42f967b8a8e6c`
- Kind: `report`
- Recorder: `0x9D0d02328dcc8ACDEf02D6110247b408Ab2C4Ec8`
- Registry: `0xe923e156570961283198faad9e59744b49d1e523`
- Transaction: [`0xb87f7a13cd74505c0bc787f40c9a1524bf67be6446735395d750e525c8fc8908`](https://scan.bohr.life/tx/0xb87f7a13cd74505c0bc787f40c9a1524bf67be6446735395d750e525c8fc8908)
- Block: `27765251`
- Chain: BOT Chain Bohr testnet, chain ID `968`
- Anchored: 22 October 2026

The historical testnet rendering can be verified against its preserved anchor:

```powershell
node -e "const c=require('crypto'),f=require('fs');console.log('0x'+c.createHash('sha256').update(f.readFileSync('docs/pitch/mandate-pitch-deck.pdf')).digest('hex'))"
npm run contracts:anchor -- --kind report --hash 0x34bcc1e361da596adab84ae4b890148348c3bfba549bc9188ad42f967b8a8e6c
```

The second command re-reads the registry and reports `alreadyAnchored: true`
with the original recorder and timestamp. The anchor proves that the historical
hash was recorded on chain by an address at a time. It does not prove authorship,
correctness, or that the current deck is unchanged. If the current proposal is
anchored later, add a new record; never overwrite or delete the historical one.
