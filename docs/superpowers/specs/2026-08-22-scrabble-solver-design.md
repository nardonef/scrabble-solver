# Scrabble Best-Play Solver — Design Spec

## Purpose

A mobile-friendly web app: take a photo of a Scrabble board (with your rack
tiles visible in the same shot), review/correct the detected board and rack,
and get the single highest-scoring legal play plus a few ranked runners-up.

## Stack

Next.js (App Router) + TypeScript, deployed on Vercel. No database — fully
stateless, single-session tool, no auth, no persistence between visits.

## Data flow

```
Photo (capture UI)
  -> POST /api/scan   (vision: photo -> board grid + rack JSON)
  -> Correction UI     (user edits any misreads)
  -> POST /api/solve   (move generator + scorer -> ranked plays)
  -> Results UI         (best play highlighted + alternatives list)
```

## Components

### 1. Capture UI (`app/page.tsx`)

- `<input type="file" accept="image/*" capture="environment">` to invoke the
  phone's native camera app directly (more reliable across iOS/Android than a
  custom `getUserMedia` preview, and requires far less code).
- On file select, POSTs the image to `/api/scan` and shows a loading state.

### 2. `POST /api/scan`

- Input: multipart image upload (or base64 JSON body).
- Calls Claude's vision API (Anthropic Messages API, image content block)
  with a prompt instructing it to return **structured JSON only** (forced via
  tool-calling / JSON schema), shaped as:

```ts
type ScanResult = {
  grid: (string | null)[][];  // 15x15, each cell: single uppercase letter, "?" for a blank tile played as a wildcard-turned-letter (annotate which letter it's serving as), or null for empty
  rack: (string | "BLANK")[]; // 2-7 entries; "BLANK" = an unplayed blank/wildcard tile
};
```

- Board bonus squares (double/triple letter, double/triple word, center
  star) are **not** requested from the vision model — they're a hardcoded
  constant (`lib/board-layout.ts`) representing the standard fixed Scrabble
  board. This removes an entire class of vision error.
- Returns `ScanResult` as JSON. On vision failure (bad image, API error),
  returns a 4xx/5xx with an error message the client surfaces with a retry
  option.

### 3. Correction UI

- Renders the 15x15 grid as a click-to-edit component: click a cell, pick a
  letter (or clear it, or mark it as a blank-derived letter).
- Renders the rack as an editable row of up to 7 slots (letter or "blank").
- "Solve" button POSTs the (possibly edited) `ScanResult` to `/api/solve`.

### 4. `POST /api/solve`

- Input: `ScanResult` (corrected grid + rack).
- Move generation: anchor-square algorithm — for every empty cell adjacent
  to an existing tile (or the center square if the board is empty), attempt
  every legal horizontal/vertical placement using the rack's letters
  (blanks as wildcards), respecting:
  - cross-checks (every word formed perpendicular to the main word at each
    new tile must also be a legal dictionary word),
  - existing tiles must not be overwritten,
  - the main placement must connect to existing tiles unless the board is
    empty.
- Dictionary: a TWL-equivalent open-source word list (see Caveats), loaded
  into a trie/set at module load for O(word length) lookups.
- Scoring: standard Scrabble letter values × cell multipliers (multipliers
  apply only to newly-placed tiles, never previously-played ones) + 50-point
  bingo bonus if all 7 rack tiles are used in one play.
- Output: top play + up to ~4 ranked alternatives, each as:

```ts
type Play = {
  word: string;
  row: number; col: number; direction: "across" | "down";
  score: number;
};
```

- If no legal play exists for the given rack/board, returns an empty list
  (client shows "no valid plays found" — not an error).

### 5. Results UI

- Highlights the winning play's cells on the board.
- Shows word, score, and the ranked alternatives list below.

## File structure (indicative)

```
app/
  page.tsx                  # capture UI
  api/scan/route.ts
  api/solve/route.ts
lib/
  board-layout.ts            # standard bonus-square constant
  scoring.ts                 # letter values + play scoring
  dictionary.ts               # word list loading + lookup
  solver.ts                   # anchor/cross-check move generator
  vision-prompt.ts            # prompt + schema for /api/scan
components/
  BoardGrid.tsx               # shared editable/highlightable grid
  RackEditor.tsx
docs/superpowers/specs/
  2026-08-22-scrabble-solver-design.md
```

## Testing

- Unit tests (`lib/scoring.test.ts`, `lib/solver.test.ts`): known
  board+rack fixtures with hand-verified expected best play and score,
  including at least one bingo (all-7-tiles) case and one case with no
  legal play.
- Unit tests (`lib/dictionary.test.ts`): legality checks for known
  valid/invalid words.
- Manual verification: run the full capture → scan → correct → solve flow
  on an actual phone browser against a real physical board before calling
  the feature done (per project policy — UI changes are verified in a
  browser, not just by unit tests).

## Caveats / open risks

- **Dictionary licensing**: Hasbro's official TWL word list is proprietary
  and not freely redistributable. This design uses a widely-used
  open-source TWL-equivalent list (e.g. an `enable1`/`TWL06`-derived list
  commonly bundled in open-source Scrabble engines) — functionally
  equivalent for legality checks, but not the literal licensed Hasbro file.
  Flagging this now so it's an explicit, known substitution rather than an
  assumed exact match.
- **Vision accuracy on blanks**: a blank tile played on the board is
  visually indistinguishable from a normal tile of that letter in most
  photos (no color difference on most tile sets). The design does not
  attempt to auto-detect which placed tiles are blanks; if this matters for
  your recomputation (blanks played on the board don't affect legality or
  future scoring, only future rack tracking, which is out of scope), it can
  be corrected manually in the correction UI.
- **Single-session, no game-state tracking**: this app only solves "what's
  the best play right now, given this board and rack" — it does not track
  turn history, opponent tiles, remaining tile bag, or score totals across a
  full game.
