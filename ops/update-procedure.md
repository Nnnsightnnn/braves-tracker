---
name: braves-tracker-update
description: Fetches the latest Atlanta Braves news, stats, injury-list moves, and NL East standings via web search, rewrites the tracker app's `src/playerData.js` with fresh data, verifies the build, commits, and pushes to GitHub — which triggers the live GitHub Pages deploy.
---

# Braves Tracker Update

This skill runs the daily refresh for the Braves tracker during MLB season. It's the Braves sibling of `liverpool-tracker-update` / `falcons-tracker-update` / `hawks-tracker-update`.

## Repo layout (for reference)

- **Local path**: `/Users/kenny/braves-tracker`
- **Remote**: `https://github.com/Nnnsightnnn/braves-tracker`
- **Live URL**: `https://nnnsightnnn.github.io/braves-tracker/`
- **Core data file**: `src/playerData.js` (single source of truth — PLAYERS, RSS_FEEDS, TEAM_LOGOS, NEXT_GAME, RESULTS, NL_EAST_STANDINGS, NEWS_DIGEST)
- **UI file**: `src/App.jsx` (do not edit during normal updates — data-only refresh)
- **Build command**: `npm run build` (must pass before commit)

## Critical rules

- **BUILD**: `npm run build` MUST pass before any commit. Fix errors first.
- **SCOPE**: Only `src/playerData.js` is edited in the normal daily loop. App.jsx changes are out of scope.
- **GIT HYGIENE**: Never stage `dist/`, `node_modules/`, or anything matched by `.gitignore`. Use `git add src/playerData.js` (specific), not `git add -A`.
- **PAT**: See `AUTH.md` in this directory. If expiry is < 30 days away, warn Kenny in the final report.
- **RECENCY**: News digest must be biased toward the last 48 hours. Anything older than 1 week should be dropped unless it's still materially relevant (ongoing injury, long-term trade fallout, etc).
- **ASSIGNMENT**: Every player has an `assignment` field (`"mlb" | "aaa" | "aa" | "rehab"`) that is **orthogonal to `status`**. Recalls/options FLIP the assignment — never delete or re-add a player on roster moves. See "Assignment handling" below.

## Assignment handling

The roster model uses two independent fields:

- `status`: medical/eligibility state (`active`, `il-10`, `il-15`, `il-60`, `suspended`, `day-to-day`, `questionable`, `departed`)
- `assignment`: organizational location (`mlb`, `aaa`, `aa`, `rehab`)

This lets us track "healthy but in Triple-A" (Muñoz) separately from "injured and rehabbing at Triple-A" (Strider).

### Assignment taxonomy

| Assignment | Meaning | UI location |
|------------|---------|-------------|
| `mlb`   | On the 26-man active roster with Atlanta | Lineup / Rotation / Bullpen sections |
| `aaa`   | Healthy 40-man player optioned to Triple-A Gwinnett | **Triple-A Depth** section |
| `aa`    | High-profile prospect one level below (rare) | **Triple-A Depth** section |
| `rehab` | Injured player on a minor-league rehab assignment | Injured List (with REHAB @ AAA badge) |

### Rules for roster moves

1. **Recall from Triple-A**: flip `assignment: "aaa" → "mlb"`. DO NOT add a new player entry.
2. **Option to Triple-A**: flip `assignment: "mlb" → "aaa"`. DO NOT remove the entry.
3. **Start a rehab assignment**: keep `status: "il-10" | "il-15" | "il-60"` but flip `assignment: "mlb" → "rehab"`. Update `injuryNote` to mention the rehab location.
4. **End a rehab assignment (activated)**: flip `status → "active"` AND `assignment → "mlb"` simultaneously.
5. **Move between levels while optioned**: change `assignment` (`aaa ↔ aa`) only. Status stays the same.
6. **DFA / trade**: set `status: "departed"`; assignment becomes irrelevant but leave it as whatever it was.

### Known Triple-A depth pool (seed list — maintain, don't rebuild)

These entries are permanent. When news says one of them was recalled, flip `assignment` — don't create a duplicate:

- `munoz-rolddy` — Rolddy Muñoz (RP, power righty, optioned 4/21/26)
- `dodd` — Dylan Dodd (LP, swingman; currently `mlb` after 4/21/26 recall)
- (Add more as they surface: typical candidates are 40-man depth arms and bench bats.)

### When news mentions a player not yet in `PLAYERS`

If a recall happens for someone NOT already in the file, add them as a full entry with:
- `assignment: "mlb"` (since they just got recalled)
- Real ESPN headshot ID (verify with `curl` — must return 200)
- Accurate `contract` / `career` if known; stub with reasonable defaults if not

If it's an option move for a healthy player not yet in the file, add them with `assignment: "aaa"` in the Triple-A depth block.

## Workflow

### Step 1 — Web search (parallelize)

Run these searches in parallel via `WebSearch`:

1. `"Atlanta Braves" news today` — headline scan
2. `"Atlanta Braves" injury report OR injured list` — IL changes
3. `"Atlanta Braves" lineup OR rotation` — usage changes
4. `Braves game last night score recap` — most recent result
5. `MLB NL East standings` — standings refresh
6. `"Atlanta Braves" [next opponent] probable pitcher` — next game matchup
7. `"Atlanta Braves" stats leaders week` — stat movers

Supplement with `WebFetch` on primary sources where needed:
- `https://www.mlb.com/braves/news`
- `https://www.mlb.com/braves/roster`
- `https://www.mlb.com/braves/schedule`
- `https://www.mlb.com/standings/nl-east`
- `https://www.baseball-reference.com/teams/ATL/2026.shtml`

### Step 2 — Build NEWS_DIGEST

From the search results, assemble `NEWS_DIGEST` in `src/playerData.js`:

```js
NEWS_DIGEST = {
  generatedAt: "<ISO-8601 with -04:00 offset>",
  headline: "<one-line team state summary>",
  keyTopics: [
    {
      category: "injury" | "lineup" | "result" | "rotation" | "transaction" | "standings" | "milestone" | "narrative",
      title: "<short, declarative>",
      summary: "<1-2 sentences, specific>",
      recency: "today" | "yesterday" | "this-week" | "ongoing",
    },
    // ... aim for 10-14 topics
  ],
}
```

Categories drive the pill color in `NewsDigestSection`. Don't invent new categories — App.jsx's `CATEGORY_COLORS` only knows the ones above.

### Step 3 — Update PLAYERS

For each player whose status, stats, or location meaningfully changed:
- Update `stats` object (pitchers: `era`, `whip`, `ip`, `k`, `wins`, `losses`, `saves`, `holds` as applicable; batters: `avg`, `hr`, `rbi`, `games`, `obp`, `slg`, `ops`, `sb`)
- Update `status` using the taxonomy: `active | day-to-day | questionable | il-10 | il-15 | il-60 | suspended | departed`
- Update `assignment` if the player's org location changed: `mlb | aaa | aa | rehab`. See the "Assignment handling" section above for the flip rules.
- Update `injuryNote` if IL status changed — include brief mechanism and expected return window. If they start a rehab assignment, mention the level (Triple-A Gwinnett / Double-A Columbus / etc).
- Update `form` with a short recent-performance line (e.g., "3 HR in last 5 games" or "0.00 ERA across 2 starts")

**For roster moves specifically:**
- If news says "X was recalled from Triple-A": find X in `PLAYERS` and flip `assignment: "aaa" → "mlb"`. If X isn't in the file, add a full entry (headshot-verified) with `assignment: "mlb"`.
- If news says "X was optioned to Triple-A": flip `assignment: "mlb" → "aaa"`. Keep the entry; the UI moves it to the Triple-A Depth section automatically.
- If news says "X moved up to a Triple-A rehab assignment": keep the `il-*` status, flip `assignment → "rehab"`, and update `injuryNote` to mention Gwinnett.
- If news says "X was activated from the IL": flip BOTH `status → "active"` AND `assignment → "mlb"`.

Don't regenerate the whole file — surgical edits only. Preserve `id`, `image`, `contract`, `career`, `nationality`, `age` unless they actually changed.

### Step 4 — Refresh NEXT_GAME and RESULTS

`NEXT_GAME`:
```js
{
  date: "<YYYY-MM-DD>",
  time: "<h:mm AM/PM ET>",
  opponent: "<Full team name>",
  opponentAbbr: "<3-letter>",
  location: "home" | "away",
  venue: "<Truist Park or opposing venue>",
  bravesStarter: { name, record, era },
  opponentStarter: { name, record, era },
  broadcast: "<FS1 / MLB Network / etc>" // optional
}
```

`RESULTS`: keep the last 7-10 games. Each entry:
```js
{
  date: "<YYYY-MM-DD>",
  opponent: "<team>",
  opponentAbbr: "<abbr>",
  location: "home" | "away",
  result: "W" | "L",
  score: "<atl>-<opp>",
  winningPitcher: "<name>",
  losingPitcher: "<name>",
  save: "<name>" | null,
  homeRuns: ["<player> (#<season HR>)", ...],
  highlight: "<one-line narrative>",
}
```

### Step 5 — Refresh NL_EAST_STANDINGS

```js
NL_EAST_STANDINGS = [
  { team: "Braves", abbr: "ATL", wins: N, losses: N, pct: 0.xxx, gb: "-" | "N.N", streak: "W3" | "L2", last10: "7-3" },
  // ... all 5 teams sorted by standings
]
```

Sort by wins desc, then by winning pct desc. Use "-" for the division leader's games-back.

### Step 5.5 — Queue image requests (lead cover + genuinely visual articles)

After news + standings + game data are settled, but BEFORE the build, decide which of today's stories warrant a bespoke generated image. For each one you pick, invoke the **`limn-editor-enhance`** skill (`~/.claude/skills/limn-editor-enhance/SKILL.md`) — it does the Limn-style prompt enhancement and appends a fully-spec'd entry to `~/Vault/Notes/image-requests.md`. A separate Antigravity-side skill generates each image, saves it, and pushes it to `~/braves-tracker/public/assets/cover/` later. You do NOT generate or commit the images here.

The Beat now shows a photo on the **lead AND every article** (component: `BeatPhoto` + `ArticlePhoto` in App.jsx). Any slot without a generated file falls back to a **navy/cream-toned free-license action frame** keyed to the story category (never a headshot, never a broken image) — so it is always safe to point at a not-yet-generated file. The generation route just upgrades individual slots from a generic action frame to the actual Braves moment as the files land.

#### Queue ONLY for genuinely visual moments

- A just-played game with a clear hero moment (walk-off HR, 6-pitch no-hit bid, Strider 14-K start, Ozuna grand slam).
- A clinch / elimination moment, postseason berth, division-title-clinch celebration.
- A notable IL return — pitcher's first start back, Acuña off the IL.
- A milestone (player's 30th HR, manager's 1000th win, debut of a top prospect).

#### Do NOT queue for

- Trade-deadline rumor mill, projected lineup chatter.
- Routine standings updates, magic-number math, IL placements without a return-to-action moment.
- Off-day fluff with no scene.
- Anything you couldn't picture as a single still photograph.

#### How to invoke (per image)

Call the skill with this minimum payload:

| Field | Value |
|---|---|
| `roughPrompt` | One-sentence rough idea — concrete subject + setting. |
| `tracker` | `braves` |
| `leadStory` | The single-sentence lead pulled from `NEWS_DIGEST.headline` or the topic. |
| `subject` | Player + venue (e.g., "Spencer Strider striking out the side in the 7th at Truist Park"). |
| `aspectRatio` | `portrait` (1200×1600) for the lead; `landscape` (1600×900) for in-column article cuts, dugout / celebration / field-wide shots. |
| `slug` | 2-3-word kebab — `strider-k-side`, `acuna-walkoff`. |

**Cap at 3 requests per run: 1 lead + up to 2 articles.** Generation is not free, so be selective; if more than three moments compete, queue the biggest and drop the rest. On a quiet news day, queue zero.

#### Wire each queued image back into the data (required)

The filename convention is always `/braves-tracker/assets/cover/{YYYY-MM-DD}-{slug}.jpg`.

- **Lead cover** → update `COVER_PHOTO` in `src/playerData.js` to match the request exactly: `date`, `imageUrl`, `fallbackPlayerId` (the featured player's `PLAYERS` id — still used elsewhere), a 1-2 sentence `cutline` in newspaper voice, keep `credit`.
- **Each queued article** → add an `art` object to that topic inside `NEWS_DIGEST.keyTopics`:

  ```js
  art: {
    imageUrl: "/braves-tracker/assets/cover/{YYYY-MM-DD}-{slug}.jpg",
    alt: "<newspaper-voice cutline, one line>",
    credit: "TRACKER PHOTO DESK",
  }
  ```

  `ArticlePhoto` prefers `art.imageUrl`, then falls back to the toned action frame. Generated covers render through the navy→cream duotone (`BeatDuotoneFilter`) so they match the rest of the page. Leave `art` OFF any topic you didn't queue.
- **If you skipped queueing entirely**: leave `COVER_PHOTO` on the most recent request and don't add any `art`. Only rewrite a stale `cutline`.
- **Housekeeping**: don't let stale `art` linger. When a topic rolls out of the digest its `art` goes with it; if you keep a topic but its generated file is more than ~10 days old and no longer the story, drop the `art` so it reverts to a fresh action frame.

See `public/assets/cover/README.md` for the full contract the Antigravity generator follows.

#### Report

Add to the Step 9 report:

- `Image requests: queued N ({slug}.jpg, ...) — {one-line reasons}` **or** `Image requests: skipped — {one-line reason}`.
- `COVER_PHOTO: updated to {filename}` **or** `COVER_PHOTO: unchanged`.
- `Article art: set on N topics ({slugs})` **or** `Article art: none`.

### Step 6 — Verify headshots (only if roster changed)

If you added a new player or changed a player's `id`, verify the ESPN headshot loads:

```bash
curl -o /dev/null -s -w "%{http_code}\n" "https://a.espncdn.com/i/headshots/mlb/players/full/<id>.png"
```

Require 200 before committing. If 404, leave `image: null` — `PlayerAvatar` falls back to initials.

### Step 7 — Build verify

```bash
cd /Users/kenny/braves-tracker && npm run build
```

Must complete with `✓ built in` — no errors. If it fails, read the error and fix before proceeding.

### Step 8 — Commit and push (via scripts/git-publish.sh — do NOT use plain git push)

Do NOT run plain `git add` / `git commit` / `git push` here. On the Cowork sandbox
mount deletes are blocked (EPERM), so plain git can't remove `.git/index.lock` or
prune temp objects — that's the root cause of the stale lock and the daily "local
out of sync" breakage. Publish with the helper (throwaway `/tmp` index, `commit-tree`,
push by SHA — never deletes or moves a local file):

```bash
cd /Users/kenny/braves-tracker && bash scripts/git-publish.sh \
  --branch main \
  --message "Daily update: <YYYY-MM-DD> — <1-line summary>" \
  src/playerData.js
```

Note: the installed `git-publish.sh` discovers the repo from the current
working directory (`git rev-parse --show-toplevel`) and has no `--repo` flag,
so `cd` into the repo first. Supported flags: `--message`/`-m` (required),
`--branch`/`-b`, `--remote`/`-r`, `--dry-run`, then file paths.

- Name only `src/playerData.js` (and any other file you actually edited). Never publish `dist/` or `node_modules/`.
- The helper REFUSES to push if the remote moved ahead of local HEAD and never force-pushes, so it can't clobber Kenny's local work; on non-fast-forward it stops — note it. `warning: unable to unlink ... tmp_obj` lines are EXPECTED and harmless. It pushes by SHA, so the LOCAL ref stays put — Kenny reconciles his clone separately (sync-tracker).
- If the push fails with 403, the PAT (cowork-tracker-pusher) hasn't been extended to braves-tracker yet — surface this prominently.

GitHub Actions auto-deploys. Wait ~2 min for `https://nnnsightnnn.github.io/braves-tracker/` to reflect.

### Step 9 — Report

Output a compact summary:
- Record & standing ("15-7, 1st NL East")
- Last result
- Next game
- Any IL changes since last run
- Top 3-5 news topics
- Commit SHA and live URL
- **PAT expiry warning if within 30 days**

## Common edge cases

- **Off-day**: Skip RESULTS update but still refresh NEWS_DIGEST and standings. NEXT_GAME stays the same.
- **Doubleheader**: Add both games to RESULTS; NEXT_GAME reflects tomorrow.
- **Suspension / DFA / trade**: Move player to `status: "suspended"` or `"departed"`, keep entry for reference. UI filters them out of active lineups automatically.
- **All-Star break**: NEXT_GAME can hold a "All-Star Break" placeholder object — don't break the schema.
- **Postseason**: Add a `PLAYOFF_SERIES` block (mirror the Hawks pattern) — App.jsx already has the section stub ready.
