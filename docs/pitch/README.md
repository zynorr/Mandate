# Pitch deck

The deck is a twelve-slide, 16:9 product pitch for Mandate.

| File | Purpose |
| --- | --- |
| `deck.html` | Editable source. One `<section class="slide">` per slide. |
| `mandate-pitch-deck.pdf` | Rendered deck, 12 pages, 1280 × 720 per page. |

## Content

Every claim in the deck comes from this repository: `README.md`,
`docs/ui-research.md`, the marketing page, the contract deployment record, and
the test suite. No market size, revenue, or customer figures are asserted.

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

## Anchor record

- Content hash (SHA-256 of the PDF): `0x34bcc1e361da596adab84ae4b890148348c3bfba549bc9188ad42f967b8a8e6c`
- Kind: `report`
- Recorder: `0x9D0d02328dcc8ACDEf02D6110247b408Ab2C4Ec8`
- Registry: `0xe923e156570961283198faad9e59744b49d1e523`
- Transaction: [`0xb87f7a13cd74505c0bc787f40c9a1524bf67be6446735395d750e525c8fc8908`](https://scan.bohr.life/tx/0xb87f7a13cd74505c0bc787f40c9a1524bf67be6446735395d750e525c8fc8908)
- Block: `27765251`
- Chain: BOT Chain Bohr testnet, chain ID `968`
- Anchored: 22 October 2026

Verify the file against the anchor:

```powershell
node -e "const c=require('crypto'),f=require('fs');console.log('0x'+c.createHash('sha256').update(f.readFileSync('docs/pitch/mandate-pitch-deck.pdf')).digest('hex'))"
npm run contracts:anchor -- --kind report --hash 0x34bcc1e361da596adab84ae4b890148348c3bfba549bc9188ad42f967b8a8e6c
```

The second command re-reads the registry and reports `alreadyAnchored: true`
with the original recorder and timestamp. The anchor proves that this hash was
recorded on chain by an address at a time. It does not prove authorship,
correctness, or that the deck is current.
