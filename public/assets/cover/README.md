# Braves Beat — generated cover & article images

This directory holds the **bespoke, generated Braves moments** that appear on the
Braves Beat view: one lead cover plus optional per-article cuts. It is the
"generation route." Files here are produced downstream (the Antigravity image
task reads `~/Vault/Notes/image-requests.md`) and committed into this folder.
The daily `braves-tracker-update` skill only queues requests and points the data
at the expected filenames — it does not generate images.

## Filename contract

```
/braves-tracker/assets/cover/{YYYY-MM-DD}-{slug}.jpg
```

- `{YYYY-MM-DD}` — the date of the run that queued it.
- `{slug}` — 2-3 word kebab describing the moment: `bart-perfect-game-breaker`,
  `strider-k-side`, `acuna-walkoff`.
- Format: `.jpg`. Lead ≈ portrait/landscape 1200×1600 or 1600×900; article cuts
  are landscape (rendered at 16:9 for the lede, 3:2 for column cuts).

## How the app consumes these

- **Lead cover** ← `COVER_PHOTO.imageUrl` in `src/playerData.js`
  (component `BeatPhoto`).
- **Article cuts** ← the optional `art.imageUrl` on a `NEWS_DIGEST.keyTopics`
  entry (component `ArticlePhoto`).

Both walk a fallback chain: **generated image → toned free-license action frame
(`public/assets/action/…`) → nothing**. So it is always safe to reference a file
that has not been generated yet — the slot shows a category-appropriate action
frame until the real image lands, then upgrades automatically on next load.

## Rendering / house style

Generated images are usually full colour. The app tones them at render through an
inline SVG duotone (`BeatDuotoneFilter`, id `#beat-duotone`) that maps shadows →
Braves navy `#0f2247` and highlights → cream `#f3e9cf`, matching the paper's two
inks and the pre-toned action frames. **Do not pre-tone generated images** — ship
them full colour and let the app apply the duotone, so a single filter governs the
whole look.

## Housekeeping

- One lead + up to two article images per run (the skill's cap).
- When a topic leaves the digest, its `art` reference leaves with it; orphaned
  files here are harmless but can be pruned.
