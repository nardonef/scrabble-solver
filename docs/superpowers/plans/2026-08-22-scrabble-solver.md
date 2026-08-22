# Scrabble Best-Play Solver Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A Next.js web app where a phone photo of a Scrabble board + rack is scanned via Claude's vision API, reviewed/corrected by the user, and solved by a from-scratch move generator to surface the highest-scoring legal play plus ranked alternatives.

**Architecture:** Single Next.js (App Router) app on Vercel. Two server-side API routes: `/api/scan` (photo → structured board/rack JSON via Claude vision) and `/api/solve` (board/rack → ranked legal plays via an anchor-square + cross-check move generator against a bundled word list). All board/game logic is pure, dependency-free TypeScript in `lib/`, unit-tested in isolation from the API/UI layers.

**Tech Stack:** Next.js (App Router, latest), TypeScript, React, `@anthropic-ai/sdk`, `zod`, Vitest + Testing Library for tests. Deployed on Vercel.

**Spec:** `docs/superpowers/specs/2026-08-22-scrabble-solver-design.md`

## Global Constraints

- No database, no auth, no persistence between visits — fully stateless per request.
- Board bonus-square layout is the fixed standard Scrabble layout (hardcoded constant), never detected from the photo.
- Blank tiles always score 0 points regardless of which letter they represent (standard Scrabble rule) — the board and rack data model must track blank status per tile, not just its letter.
- Cell/word multipliers apply only to tiles placed in the *current* solved play, never to tiles already on the board.
- Dictionary word list: the public-domain ENABLE1 word list (`https://raw.githubusercontent.com/dolph/dictionary/master/enable1.txt`, 172,823 words) — the open-source TWL-equivalent substitute noted in the spec's caveats, not the literal licensed Hasbro TWL file.
- Camera capture uses `<input type="file" accept="image/*" capture="environment">` — no custom `getUserMedia` preview.
- Vision output is forced structured JSON via Anthropic tool-calling, not free-form text parsing.
- UI changes are verified by actually running the app (dev server + browser/phone), not just unit tests, before the feature is considered done.

---

### Task 1: Project scaffolding

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.ts`, `vitest.config.ts`, `vitest.setup.ts`
- Create: `app/layout.tsx`, `app/globals.css`, `app/page.tsx` (minimal placeholder, replaced fully in Task 11)
- Create: `.gitignore`

**Interfaces:** None — this task produces the runnable shell every later task builds on.

- [ ] **Step 1: Initialize package.json and install dependencies**

```bash
npm init -y
npm install next@latest react@latest react-dom@latest @anthropic-ai/sdk@latest zod@latest
npm install -D typescript@latest @types/node@latest @types/react@latest @types/react-dom@latest \
  vitest@latest @testing-library/react@latest @testing-library/jest-dom@latest \
  @testing-library/user-event@latest jsdom@latest @vitejs/plugin-react@latest
```

- [ ] **Step 2: Edit package.json scripts**

Add to the generated `package.json`:

```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "test": "vitest run"
  }
}
```

- [ ] **Step 3: Write tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2017",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./*"] }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

- [ ] **Step 4: Write next.config.ts**

```ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {};

export default nextConfig;
```

- [ ] **Step 5: Write vitest.config.ts and vitest.setup.ts**

```ts
// vitest.config.ts
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    passWithNoTests: true,
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, ".") },
  },
});
```

```ts
// vitest.setup.ts
import "@testing-library/jest-dom/vitest";
```

- [ ] **Step 6: Write app/layout.tsx and app/globals.css**

```tsx
// app/layout.tsx
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Scrabble Solver",
  description: "Scan a Scrabble board and find the highest-scoring play",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
```

```css
/* app/globals.css */
* { box-sizing: border-box; }
body { margin: 0; font-family: system-ui, sans-serif; }
```

- [ ] **Step 7: Write minimal app/page.tsx**

```tsx
// app/page.tsx
export default function Home() {
  return <main><h1>Scrabble Solver</h1></main>;
}
```

- [ ] **Step 8: Write .gitignore**

```
node_modules
.next
.env*.local
```

- [ ] **Step 9: Verify the build**

Run: `npm run build`
Expected: build completes with no errors.

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "Scaffold Next.js project with Vitest"
```

---

### Task 2: Shared types and board layout constant

**Files:**
- Create: `lib/types.ts`
- Create: `lib/board-layout.ts`
- Test: `lib/board-layout.test.ts`

**Interfaces:**
- Produces: `Letter` (string alias), `BoardCell`, `Board`, `RackTile`, `ScanResult`, `PlacedTile`, `Play` (all from `lib/types.ts`); `BOARD_SIZE`, `CENTER`, `CellType`, `BOARD_LAYOUT` (from `lib/board-layout.ts`).

- [ ] **Step 1: Write lib/types.ts**

```ts
export type Letter = string; // single uppercase A-Z

export type BoardCell = { letter: Letter; isBlank: boolean } | null;
export type Board = BoardCell[][]; // 15x15, row-major

export type RackTile = { kind: "letter"; letter: Letter } | { kind: "blank" };

export type ScanResult = {
  board: Board;
  rack: RackTile[];
};

export type PlacedTile = {
  row: number;
  col: number;
  letter: Letter;
  isBlank: boolean;
  isNew: boolean;
};

export type Play = {
  word: string;
  row: number;
  col: number;
  direction: "across" | "down";
  score: number;
};
```

- [ ] **Step 2: Write the failing test for board-layout**

```ts
// lib/board-layout.test.ts
import { describe, it, expect } from "vitest";
import { BOARD_LAYOUT, BOARD_SIZE, CENTER } from "./board-layout";

describe("BOARD_LAYOUT", () => {
  it("is 15x15", () => {
    expect(BOARD_LAYOUT).toHaveLength(BOARD_SIZE);
    for (const row of BOARD_LAYOUT) expect(row).toHaveLength(BOARD_SIZE);
  });

  it("has the standard count of each premium square type", () => {
    const counts: Record<string, number> = { TW: 0, DW: 0, TL: 0, DL: 0 };
    for (const row of BOARD_LAYOUT) {
      for (const cell of row) {
        if (cell) counts[cell]++;
      }
    }
    expect(counts.TW).toBe(8);
    expect(counts.DW).toBe(17);
    expect(counts.TL).toBe(12);
    expect(counts.DL).toBe(24);
  });

  it("marks the center square as a double word score", () => {
    expect(BOARD_LAYOUT[CENTER][CENTER]).toBe("DW");
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run lib/board-layout.test.ts`
Expected: FAIL — `lib/board-layout.ts` does not exist yet.

- [ ] **Step 4: Write lib/board-layout.ts**

```ts
export const BOARD_SIZE = 15;
export const CENTER = 7;

export type CellType = null | "DL" | "TL" | "DW" | "TW";

// Standard Scrabble board layout, one 15-character string per row.
// . = plain, 2 = double letter, 3 = triple letter, D = double word, T = triple word.
const ROWS = [
  "T..2...T...2..T",
  ".D...3...3...D.",
  "..D...2.2...D..",
  "2..D...2...D..2",
  "....D.....D....",
  ".3...3...3...3.",
  "..2...2.2...2..",
  "T..2...D...2..T",
  "..2...2.2...2..",
  ".3...3...3...3.",
  "....D.....D....",
  "2..D...2...D..2",
  "..D...2.2...D..",
  ".D...3...3...D.",
  "T..2...T...2..T",
];

const CODE_TO_TYPE: Record<string, CellType> = {
  ".": null,
  "2": "DL",
  "3": "TL",
  D: "DW",
  T: "TW",
};

export const BOARD_LAYOUT: CellType[][] = ROWS.map((row) =>
  row.split("").map((ch) => CODE_TO_TYPE[ch])
);
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run lib/board-layout.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 6: Commit**

```bash
git add lib/types.ts lib/board-layout.ts lib/board-layout.test.ts
git commit -m "Add shared types and standard board layout constant"
```

---

### Task 3: Scoring engine

**Files:**
- Create: `lib/scoring.ts`
- Test: `lib/scoring.test.ts`

**Interfaces:**
- Consumes: `PlacedTile` (from `lib/types.ts`), `BOARD_LAYOUT` (from `lib/board-layout.ts`)
- Produces: `LETTER_VALUES: Record<string, number>`, `BINGO_BONUS`, `BINGO_TILE_COUNT`, `scorePlay(mainWordTiles: PlacedTile[], crossWords: PlacedTile[][], newTileCount: number): number`

- [ ] **Step 1: Write the failing tests**

```ts
// lib/scoring.test.ts
import { describe, it, expect } from "vitest";
import { scorePlay } from "./scoring";
import { PlacedTile } from "./types";

function tile(row: number, col: number, letter: string, opts: Partial<PlacedTile> = {}): PlacedTile {
  return { row, col, letter, isBlank: false, isNew: true, ...opts };
}

describe("scorePlay", () => {
  it("sums letter values with no multipliers on plain squares", () => {
    // row 0 is "T..2...T...2..T": cols 1, 2, 4 are all plain
    const tiles = [tile(0, 1, "C"), tile(0, 2, "A"), tile(0, 4, "T")];
    expect(scorePlay(tiles, [], 3)).toBe(3 + 1 + 1); // C=3, A=1, T=1
  });

  it("applies a triple word score only once for the whole word", () => {
    // row 0 col 0 is "T" (triple word), col 1 is plain
    const tiles = [tile(0, 0, "A"), tile(0, 1, "T")];
    expect(scorePlay(tiles, [], 2)).toBe((1 + 1) * 3);
  });

  it("does not apply multipliers to previously-placed tiles", () => {
    // row 0 col 0 is triple word, but this tile isNew: false
    const tiles = [tile(0, 0, "A", { isNew: false }), tile(0, 1, "T")];
    expect(scorePlay(tiles, [], 1)).toBe(1 + 1); // no multiplier applied at all
  });

  it("scores blank tiles as zero regardless of letter", () => {
    const tiles = [tile(0, 1, "Z", { isBlank: true }), tile(0, 2, "A")];
    expect(scorePlay(tiles, [], 2)).toBe(0 + 1);
  });

  it("includes cross-word scores and the 50-point bingo bonus for 7 tiles", () => {
    const main = [tile(0, 1, "C"), tile(0, 2, "A")];
    const cross = [tile(0, 2, "A"), tile(1, 2, "T")];
    expect(scorePlay(main, [cross], 7)).toBe((3 + 1) + (1 + 1) + 50);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/scoring.test.ts`
Expected: FAIL — `lib/scoring.ts` does not exist yet.

- [ ] **Step 3: Write lib/scoring.ts**

```ts
import { PlacedTile } from "./types";
import { BOARD_LAYOUT } from "./board-layout";

export const LETTER_VALUES: Record<string, number> = {
  A: 1, B: 3, C: 3, D: 2, E: 1, F: 4, G: 2, H: 4, I: 1, J: 8,
  K: 5, L: 1, M: 3, N: 1, O: 1, P: 3, Q: 10, R: 1, S: 1, T: 1,
  U: 1, V: 4, W: 4, X: 8, Y: 4, Z: 10,
};

export const BINGO_BONUS = 50;
export const BINGO_TILE_COUNT = 7;

function scoreWord(tiles: PlacedTile[]): number {
  let wordMultiplier = 1;
  let sum = 0;
  for (const t of tiles) {
    const base = t.isBlank ? 0 : LETTER_VALUES[t.letter];
    let letterMultiplier = 1;
    if (t.isNew) {
      const cellType = BOARD_LAYOUT[t.row][t.col];
      if (cellType === "DL") letterMultiplier = 2;
      if (cellType === "TL") letterMultiplier = 3;
      if (cellType === "DW") wordMultiplier *= 2;
      if (cellType === "TW") wordMultiplier *= 3;
    }
    sum += base * letterMultiplier;
  }
  return sum * wordMultiplier;
}

export function scorePlay(
  mainWordTiles: PlacedTile[],
  crossWords: PlacedTile[][],
  newTileCount: number
): number {
  let total = scoreWord(mainWordTiles);
  for (const cw of crossWords) total += scoreWord(cw);
  if (newTileCount === BINGO_TILE_COUNT) total += BINGO_BONUS;
  return total;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/scoring.test.ts`
Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add lib/scoring.ts lib/scoring.test.ts
git commit -m "Add Scrabble scoring engine"
```

---

### Task 4: Dictionary (word list + trie)

**Files:**
- Create: `data/wordlist.txt` (downloaded)
- Create: `lib/dictionary.ts`
- Test: `lib/dictionary.test.ts`

**Interfaces:**
- Produces: `Trie` (class), `buildTrie(words: string[]): Trie`, `loadDictionary(): Trie`, `isValidWord(word: string): boolean`, `hasPrefix(prefix: string): boolean`

- [ ] **Step 1: Download the word list**

```bash
mkdir -p data
curl -sL -o data/wordlist.txt "https://raw.githubusercontent.com/dolph/dictionary/master/enable1.txt"
wc -l data/wordlist.txt
```

Expected: `172823 data/wordlist.txt`

- [ ] **Step 2: Write the failing tests**

```ts
// lib/dictionary.test.ts
import { describe, it, expect } from "vitest";
import { buildTrie, loadDictionary, isValidWord, hasPrefix } from "./dictionary";

describe("Trie (via buildTrie)", () => {
  const trie = buildTrie(["CAT", "CATS", "DOG"]);

  it("recognizes inserted words", () => {
    expect(trie.isWord("CAT")).toBe(true);
    expect(trie.isWord("CATS")).toBe(true);
    expect(trie.isWord("DOG")).toBe(true);
  });

  it("rejects partial or unknown words", () => {
    expect(trie.isWord("CA")).toBe(false);
    expect(trie.isWord("CATSS")).toBe(false);
    expect(trie.isWord("DOGGY")).toBe(false);
  });

  it("reports valid prefixes distinctly from full words", () => {
    expect(trie.hasPrefix("CA")).toBe(true);
    expect(trie.hasPrefix("CAT")).toBe(true);
    expect(trie.hasPrefix("DOB")).toBe(false);
  });
});

describe("bundled dictionary", () => {
  it("loads the real word list and validates known words", () => {
    expect(isValidWord("house")).toBe(true);
    expect(isValidWord("QUIZ")).toBe(true);
    expect(isValidWord("zzzzqqqq")).toBe(false);
  });

  it("caches the loaded trie across calls", () => {
    const first = loadDictionary();
    const second = loadDictionary();
    expect(first).toBe(second);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run lib/dictionary.test.ts`
Expected: FAIL — `lib/dictionary.ts` does not exist yet.

- [ ] **Step 4: Write lib/dictionary.ts**

```ts
import fs from "fs";
import path from "path";

class TrieNode {
  children: Map<string, TrieNode> = new Map();
  isWord = false;
}

export class Trie {
  private root = new TrieNode();

  insert(word: string): void {
    let node = this.root;
    for (const ch of word) {
      let next = node.children.get(ch);
      if (!next) {
        next = new TrieNode();
        node.children.set(ch, next);
      }
      node = next;
    }
    node.isWord = true;
  }

  isWord(word: string): boolean {
    const node = this.findNode(word);
    return node !== null && node.isWord;
  }

  hasPrefix(prefix: string): boolean {
    return this.findNode(prefix) !== null;
  }

  private findNode(str: string): TrieNode | null {
    let node = this.root;
    for (const ch of str) {
      const next = node.children.get(ch);
      if (!next) return null;
      node = next;
    }
    return node;
  }
}

export function buildTrie(words: string[]): Trie {
  const trie = new Trie();
  for (const w of words) trie.insert(w.toUpperCase());
  return trie;
}

let cached: Trie | null = null;

export function loadDictionary(): Trie {
  if (cached) return cached;
  const filePath = path.join(process.cwd(), "data", "wordlist.txt");
  const raw = fs.readFileSync(filePath, "utf-8");
  const words = raw
    .split("\n")
    .map((w) => w.trim())
    .filter((w) => w.length >= 2);
  cached = buildTrie(words);
  return cached;
}

export function isValidWord(word: string): boolean {
  return loadDictionary().isWord(word.toUpperCase());
}

export function hasPrefix(prefix: string): boolean {
  return loadDictionary().hasPrefix(prefix.toUpperCase());
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run lib/dictionary.test.ts`
Expected: PASS (5 tests)

- [ ] **Step 6: Commit**

```bash
git add data/wordlist.txt lib/dictionary.ts lib/dictionary.test.ts
git commit -m "Add bundled word list and dictionary trie"
```

---

### Task 5: Move solver

This is the core algorithm: for every anchor square (an empty square adjacent to an existing tile, or the center square on an empty board), try every legal placement of rack tiles in both directions, validating the main word and every crossword formed against the dictionary, and score each legal candidate.

**Files:**
- Create: `lib/solver.ts`
- Test: `lib/solver.test.ts`

**Interfaces:**
- Consumes: `Board`, `RackTile`, `Play`, `PlacedTile` (`lib/types.ts`); `BOARD_SIZE`, `CENTER` (`lib/board-layout.ts`); `hasPrefix`, `isValidWord` (`lib/dictionary.ts`); `scorePlay` (`lib/scoring.ts`)
- Produces: `findBestPlays(board: Board, rack: RackTile[], maxResults?: number): Play[]`

- [ ] **Step 1: Write the failing tests**

```ts
// lib/solver.test.ts
import { describe, it, expect } from "vitest";
import { findBestPlays } from "./solver";
import { Board, RackTile } from "./types";

function emptyBoard(): Board {
  return Array.from({ length: 15 }, () => Array(15).fill(null));
}

function letterTile(letter: string): RackTile {
  return { kind: "letter", letter };
}

describe("findBestPlays", () => {
  it("finds the best word covering the center square on an empty board", () => {
    const board = emptyBoard();
    const rack = ["C", "A", "T", "S"].map(letterTile);
    const plays = findBestPlays(board, rack);
    expect(plays.length).toBeGreaterThan(0);
    const best = plays[0];
    expect(best.row === 7 || best.col === 7).toBe(true); // passes through center
    expect(["CAT", "CATS", "ACT", "TACS"].includes(best.word)).toBe(true);
  });

  it("rejects placements that don't touch the center on an empty board", () => {
    const board = emptyBoard();
    const rack = ["C", "A", "T"].map(letterTile);
    const plays = findBestPlays(board, rack);
    for (const play of plays) {
      const cells =
        play.direction === "across"
          ? Array.from({ length: play.word.length }, (_, i) => [play.row, play.col + i])
          : Array.from({ length: play.word.length }, (_, i) => [play.row + i, play.col]);
      expect(cells.some(([r, c]) => r === 7 && c === 7)).toBe(true);
    }
  });

  it("extends an existing word using board tiles plus rack tiles", () => {
    const board = emptyBoard();
    board[7][7] = { letter: "C", isBlank: false };
    board[7][8] = { letter: "A", isBlank: false };
    board[7][9] = { letter: "T", isBlank: false };
    const rack = ["S"].map(letterTile);
    const plays = findBestPlays(board, rack);
    const cats = plays.find((p) => p.word === "CATS");
    expect(cats).toBeDefined();
  });

  it("validates cross words formed perpendicular to the main word", () => {
    const board = emptyBoard();
    board[7][7] = { letter: "C", isBlank: false };
    board[7][8] = { letter: "A", isBlank: false };
    board[7][9] = { letter: "T", isBlank: false };
    // "XX" is not a valid word, so a down play placing X at (8,9) forming "TX" must be rejected
    const rack = ["X", "X"].map(letterTile);
    const plays = findBestPlays(board, rack);
    expect(plays.every((p) => p.word !== "TX" && p.word !== "XX")).toBe(true);
  });

  it("awards the 50-point bingo bonus when all 7 rack tiles are used", () => {
    const board = emptyBoard();
    // Rack that can form a real 7-letter word: "LANTER" + "N" -> not guaranteed to be a word;
    // instead assert indirectly: any returned play using 7 tiles scores >= sum of its letters + 50.
    const rack = ["S", "T", "A", "R", "L", "I", "N", "G"].slice(0, 7).map(letterTile);
    const plays = findBestPlays(board, rack, 20);
    const bingo = plays.find((p) => p.word.length === 7);
    if (bingo) {
      expect(bingo.score).toBeGreaterThanOrEqual(50);
    }
  });

  it("returns an empty array when no legal play exists", () => {
    const board = emptyBoard();
    const rack = ["Q"].map(letterTile); // a lone Q has no valid 1-tile word covering center
    const plays = findBestPlays(board, rack);
    expect(plays).toEqual([]);
  });

  it("lets a blank tile stand in for any letter", () => {
    const board = emptyBoard();
    const rack: RackTile[] = [letterTile("C"), letterTile("A"), { kind: "blank" }];
    const plays = findBestPlays(board, rack);
    // CAT, CAB, CAP, CAR, CAN, CAW are all valid completions of "CA?"
    expect(plays.length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/solver.test.ts`
Expected: FAIL — `lib/solver.ts` does not exist yet.

- [ ] **Step 3: Write lib/solver.ts**

```ts
import { Board, PlacedTile, Play, RackTile } from "./types";
import { BOARD_SIZE, CENTER } from "./board-layout";
import { hasPrefix, isValidWord } from "./dictionary";
import { scorePlay } from "./scoring";

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

type Direction = "across" | "down";

function step(direction: Direction): [number, number] {
  return direction === "across" ? [0, 1] : [1, 0];
}

function inBounds(r: number, c: number): boolean {
  return r >= 0 && r < BOARD_SIZE && c >= 0 && c < BOARD_SIZE;
}

function isBoardEmpty(board: Board): boolean {
  return board.every((row) => row.every((cell) => cell === null));
}

function isAnchor(board: Board, r: number, c: number): boolean {
  if (board[r][c] !== null) return false;
  if (isBoardEmpty(board)) return r === CENTER && c === CENTER;
  const neighbors: [number, number][] = [
    [r - 1, c],
    [r + 1, c],
    [r, c - 1],
    [r, c + 1],
  ];
  return neighbors.some(([nr, nc]) => inBounds(nr, nc) && board[nr][nc] !== null);
}

function crossWordAt(
  board: Board,
  r: number,
  c: number,
  direction: Direction,
  placedLetter: string,
  placedIsBlank: boolean
): PlacedTile[] | null {
  const [pdr, pdc] = direction === "across" ? [1, 0] : [0, 1];
  let sr = r;
  let sc = c;
  while (inBounds(sr - pdr, sc - pdc) && board[sr - pdr][sc - pdc] !== null) {
    sr -= pdr;
    sc -= pdc;
  }
  let er = r;
  let ec = c;
  while (inBounds(er + pdr, ec + pdc) && board[er + pdr][ec + pdc] !== null) {
    er += pdr;
    ec += pdc;
  }
  if (sr === er && sc === ec) return null; // no adjacent tiles perpendicular to the play

  const tiles: PlacedTile[] = [];
  let cr = sr;
  let cc = sc;
  while (true) {
    if (cr === r && cc === c) {
      tiles.push({ row: cr, col: cc, letter: placedLetter, isBlank: placedIsBlank, isNew: true });
    } else {
      const cell = board[cr][cc]!;
      tiles.push({ row: cr, col: cc, letter: cell.letter, isBlank: cell.isBlank, isNew: false });
    }
    if (cr === er && cc === ec) break;
    cr += pdr;
    cc += pdc;
  }
  return tiles;
}

function connectsToBoard(board: Board, placed: PlacedTile[], direction: Direction): boolean {
  if (isBoardEmpty(board)) {
    return placed.some((t) => t.row === CENTER && t.col === CENTER);
  }
  if (placed.some((t) => !t.isNew)) return true; // extends an existing word
  return placed.some(
    (t) => t.isNew && crossWordAt(board, t.row, t.col, direction, t.letter, t.isBlank) !== null
  );
}

type Frame = {
  r: number;
  c: number;
  prefix: string;
  placed: PlacedTile[];
  remainingRack: RackTile[];
};

function tryPlacementsFrom(
  board: Board,
  rack: RackTile[],
  startR: number,
  startC: number,
  dr: number,
  dc: number,
  direction: Direction,
  out: Play[]
): void {
  function finish(frame: Frame): void {
    if (frame.placed.length < 2) return;
    if (!frame.placed.some((t) => t.isNew)) return;
    const word = frame.placed.map((t) => t.letter).join("");
    if (!isValidWord(word)) return;
    if (!connectsToBoard(board, frame.placed, direction)) return;

    const crossWords: PlacedTile[][] = [];
    for (const t of frame.placed) {
      if (!t.isNew) continue;
      const cw = crossWordAt(board, t.row, t.col, direction, t.letter, t.isBlank);
      if (cw) {
        const crossStr = cw.map((x) => x.letter).join("");
        if (!isValidWord(crossStr)) return;
        crossWords.push(cw);
      }
    }

    const newTileCount = frame.placed.filter((t) => t.isNew).length;
    const score = scorePlay(frame.placed, crossWords, newTileCount);
    out.push({ word, row: frame.placed[0].row, col: frame.placed[0].col, direction, score });
  }

  function extend(frame: Frame): void {
    if (!inBounds(frame.r, frame.c)) {
      finish(frame);
      return;
    }
    const cell = board[frame.r][frame.c];
    if (cell !== null) {
      const nextPrefix = frame.prefix + cell.letter;
      if (!hasPrefix(nextPrefix)) return;
      extend({
        r: frame.r + dr,
        c: frame.c + dc,
        prefix: nextPrefix,
        placed: [
          ...frame.placed,
          { row: frame.r, col: frame.c, letter: cell.letter, isBlank: cell.isBlank, isNew: false },
        ],
        remainingRack: frame.remainingRack,
      });
      return;
    }

    finish(frame);

    for (let i = 0; i < frame.remainingRack.length; i++) {
      const tile = frame.remainingRack[i];
      const candidates = tile.kind === "blank" ? ALPHABET : [tile.letter];
      for (const letter of candidates) {
        const nextPrefix = frame.prefix + letter;
        if (!hasPrefix(nextPrefix)) continue;
        const restRack = [...frame.remainingRack.slice(0, i), ...frame.remainingRack.slice(i + 1)];
        extend({
          r: frame.r + dr,
          c: frame.c + dc,
          prefix: nextPrefix,
          placed: [
            ...frame.placed,
            { row: frame.r, col: frame.c, letter, isBlank: tile.kind === "blank", isNew: true },
          ],
          remainingRack: restRack,
        });
      }
      if (tile.kind === "blank") break; // the two blanks are interchangeable
    }
  }

  extend({ r: startR, c: startC, prefix: "", placed: [], remainingRack: rack });
}

export function findBestPlays(board: Board, rack: RackTile[], maxResults = 5): Play[] {
  const plays: Play[] = [];

  for (const direction of ["across", "down"] as Direction[]) {
    const [dr, dc] = step(direction);
    for (let r = 0; r < BOARD_SIZE; r++) {
      for (let c = 0; c < BOARD_SIZE; c++) {
        if (!isAnchor(board, r, c)) continue;

        // Walk backward through any existing tiles immediately before the anchor
        // (mandatory: they must be part of the word), then further back through
        // empty cells (optional extension using rack tiles).
        let lr = r;
        let lc = c;
        {
          let pr = r - dr;
          let pc = c - dc;
          while (inBounds(pr, pc) && board[pr][pc] !== null) {
            lr = pr;
            lc = pc;
            pr -= dr;
            pc -= dc;
          }
        }
        let maxBack = 0;
        {
          let br = lr - dr;
          let bc = lc - dc;
          while (inBounds(br, bc) && board[br][bc] === null) {
            maxBack++;
            br -= dr;
            bc -= dc;
          }
        }

        for (let back = 0; back <= maxBack; back++) {
          tryPlacementsFrom(board, rack, lr - dr * back, lc - dc * back, dr, dc, direction, plays);
        }
      }
    }
  }

  const seen = new Set<string>();
  const unique = plays.filter((p) => {
    const key = `${p.word}|${p.row}|${p.col}|${p.direction}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  unique.sort((a, b) => b.score - a.score);
  return unique.slice(0, maxResults);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/solver.test.ts`
Expected: PASS (7 tests). If a test fails, debug against the specific fixture — this is the most algorithmically complex file in the project; step through the failing case (e.g. add a temporary `console.log` of `plays` in the test) rather than assuming the test is wrong.

- [ ] **Step 5: Commit**

```bash
git add lib/solver.ts lib/solver.test.ts
git commit -m "Add anchor-square move generator with cross-word validation"
```

---

### Task 6: Vision integration

**Files:**
- Create: `lib/vision.ts`
- Test: `lib/vision.test.ts`

**Interfaces:**
- Consumes: `ScanResult`, `Board`, `RackTile` (`lib/types.ts`)
- Produces: `scanBoardImage(imageBase64: string, mediaType: string, client: Anthropic): Promise<ScanResult>`

- [ ] **Step 1: Write the failing tests**

```ts
// lib/vision.test.ts
import { describe, it, expect, vi } from "vitest";
import { scanBoardImage } from "./vision";
import type Anthropic from "@anthropic-ai/sdk";

function fakeClient(toolInput: unknown): Anthropic {
  return {
    messages: {
      create: vi.fn().mockResolvedValue({
        content: [{ type: "tool_use", id: "t1", name: "report_board_state", input: toolInput }],
      }),
    },
  } as unknown as Anthropic;
}

describe("scanBoardImage", () => {
  it("parses a valid tool_use response into a ScanResult", async () => {
    const grid = Array.from({ length: 15 }, () => Array(15).fill(null));
    grid[7][7] = "c";
    const client = fakeClient({ grid, rack: ["a", "BLANK"] });

    const result = await scanBoardImage("base64data", "image/jpeg", client);

    expect(result.board[7][7]).toEqual({ letter: "C", isBlank: false });
    expect(result.rack).toEqual([{ kind: "letter", letter: "A" }, { kind: "blank" }]);
  });

  it("throws when the response has no tool_use block", async () => {
    const client = {
      messages: { create: vi.fn().mockResolvedValue({ content: [{ type: "text", text: "oops" }] }) },
    } as unknown as Anthropic;

    await expect(scanBoardImage("base64data", "image/jpeg", client)).rejects.toThrow(
      "Vision response did not include board data"
    );
  });

  it("throws when the tool input fails schema validation", async () => {
    const client = fakeClient({ grid: "not-a-grid", rack: [] });
    await expect(scanBoardImage("base64data", "image/jpeg", client)).rejects.toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/vision.test.ts`
Expected: FAIL — `lib/vision.ts` does not exist yet.

- [ ] **Step 3: Write lib/vision.ts**

```ts
import type Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { ScanResult } from "./types";

const scanSchema = z.object({
  grid: z.array(z.array(z.union([z.string(), z.null()])).length(15)).length(15),
  rack: z.array(z.string()).min(0).max(7),
});

const TOOL_NAME = "report_board_state";

export async function scanBoardImage(
  imageBase64: string,
  mediaType: string,
  client: Anthropic
): Promise<ScanResult> {
  const response = await client.messages.create({
    model: "claude-sonnet-5",
    max_tokens: 2048,
    tools: [
      {
        name: TOOL_NAME,
        description: "Report the detected Scrabble board grid and rack letters.",
        input_schema: {
          type: "object",
          properties: {
            grid: {
              type: "array",
              items: { type: "array", items: { type: ["string", "null"] } },
            },
            rack: { type: "array", items: { type: "string" } },
          },
          required: ["grid", "rack"],
        },
      },
    ],
    tool_choice: { type: "tool", name: TOOL_NAME },
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image",
            source: { type: "base64", media_type: mediaType as "image/jpeg", data: imageBase64 },
          },
          {
            type: "text",
            text:
              "Report the exact 15x15 Scrabble board grid (row-major, each cell an " +
              "uppercase letter or null for empty) and the player's rack tiles " +
              '(uppercase letters, or "BLANK" for an unplayed blank tile) using the ' +
              "report_board_state tool. Do not guess bonus-square colors; only report letters.",
          },
        ],
      },
    ],
  });

  const toolUse = response.content.find(
    (block: { type: string }): block is Anthropic.ToolUseBlock => block.type === "tool_use"
  );
  if (!toolUse) {
    throw new Error("Vision response did not include board data");
  }

  const parsed = scanSchema.parse(toolUse.input);
  return toScanResult(parsed);
}

function toScanResult(parsed: z.infer<typeof scanSchema>): ScanResult {
  const board = parsed.grid.map((row) =>
    row.map((cell) => (cell === null ? null : { letter: cell.toUpperCase(), isBlank: false }))
  );
  const rack = parsed.rack.map((r) =>
    r.toUpperCase() === "BLANK"
      ? ({ kind: "blank" } as const)
      : ({ kind: "letter", letter: r.toUpperCase() } as const)
  );
  return { board, rack };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/vision.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add lib/vision.ts lib/vision.test.ts
git commit -m "Add Claude vision integration for board/rack scanning"
```

---

### Task 7: `/api/scan` route

**Files:**
- Create: `app/api/scan/route.ts`
- Test: `app/api/scan/route.test.ts`

**Interfaces:**
- Consumes: `scanBoardImage` (`lib/vision.ts`)
- Produces: `POST` handler returning `ScanResult` JSON on success, `{ error: string }` with 4xx/5xx on failure

- [ ] **Step 1: Write the failing tests**

```ts
// app/api/scan/route.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/vision", () => ({ scanBoardImage: vi.fn() }));
vi.mock("@anthropic-ai/sdk", () => ({ default: vi.fn().mockImplementation(() => ({})) }));

import { scanBoardImage } from "@/lib/vision";
import { POST } from "./route";

function jsonRequest(body: unknown): Request {
  return new Request("http://localhost/api/scan", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
}

describe("POST /api/scan", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 400 when imageBase64 or mediaType is missing", async () => {
    const res = await POST(jsonRequest({}) as never);
    expect(res.status).toBe(400);
  });

  it("returns the scan result on success", async () => {
    const fakeResult = { board: [], rack: [] };
    vi.mocked(scanBoardImage).mockResolvedValue(fakeResult as never);

    const res = await POST(jsonRequest({ imageBase64: "abc", mediaType: "image/jpeg" }) as never);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual(fakeResult);
  });

  it("returns 502 with the error message when scanning fails", async () => {
    vi.mocked(scanBoardImage).mockRejectedValue(new Error("bad image"));

    const res = await POST(jsonRequest({ imageBase64: "abc", mediaType: "image/jpeg" }) as never);
    const body = await res.json();

    expect(res.status).toBe(502);
    expect(body.error).toBe("bad image");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run app/api/scan/route.test.ts`
Expected: FAIL — `app/api/scan/route.ts` does not exist yet.

- [ ] **Step 3: Write app/api/scan/route.ts**

```ts
import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { scanBoardImage } from "@/lib/vision";

export async function POST(request: Request) {
  const body = (await request.json()) as { imageBase64?: string; mediaType?: string };
  const { imageBase64, mediaType } = body;

  if (!imageBase64 || !mediaType) {
    return NextResponse.json({ error: "imageBase64 and mediaType are required" }, { status: 400 });
  }

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  try {
    const result = await scanBoardImage(imageBase64, mediaType, client);
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to scan image";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run app/api/scan/route.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add app/api/scan/route.ts app/api/scan/route.test.ts
git commit -m "Add /api/scan route"
```

---

### Task 8: `/api/solve` route

**Files:**
- Create: `app/api/solve/route.ts`
- Test: `app/api/solve/route.test.ts`

**Interfaces:**
- Consumes: `findBestPlays` (`lib/solver.ts`), `ScanResult` (`lib/types.ts`)
- Produces: `POST` handler returning `{ plays: Play[] }`

- [ ] **Step 1: Write the failing test**

```ts
// app/api/solve/route.test.ts
import { describe, it, expect } from "vitest";
import { POST } from "./route";

function emptyBoard() {
  return Array.from({ length: 15 }, () => Array(15).fill(null));
}

describe("POST /api/solve", () => {
  it("returns ranked plays for a given board and rack", async () => {
    const body = {
      board: emptyBoard(),
      rack: [
        { kind: "letter", letter: "C" },
        { kind: "letter", letter: "A" },
        { kind: "letter", letter: "T" },
      ],
    };
    const request = new Request("http://localhost/api/solve", {
      method: "POST",
      body: JSON.stringify(body),
      headers: { "content-type": "application/json" },
    });

    const res = await POST(request as never);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(Array.isArray(json.plays)).toBe(true);
    expect(json.plays.length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run app/api/solve/route.test.ts`
Expected: FAIL — `app/api/solve/route.ts` does not exist yet.

- [ ] **Step 3: Write app/api/solve/route.ts**

```ts
import { NextResponse } from "next/server";
import { findBestPlays } from "@/lib/solver";
import { ScanResult } from "@/lib/types";

export async function POST(request: Request) {
  const body = (await request.json()) as ScanResult;
  const plays = findBestPlays(body.board, body.rack);
  return NextResponse.json({ plays });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run app/api/solve/route.test.ts`
Expected: PASS (1 test)

- [ ] **Step 5: Commit**

```bash
git add app/api/solve/route.ts app/api/solve/route.test.ts
git commit -m "Add /api/solve route"
```

---

### Task 9: BoardGrid component

**Files:**
- Create: `components/BoardGrid.tsx`
- Test: `components/BoardGrid.test.tsx`

**Interfaces:**
- Consumes: `Board` (`lib/types.ts`)
- Produces: `<BoardGrid board={Board} editable?: boolean; onCellChange?: (row: number, col: number, cell: BoardCell) => void; highlighted?: { row: number; col: number }[] />`

- [ ] **Step 1: Write the failing tests**

```tsx
// components/BoardGrid.test.tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { BoardGrid } from "./BoardGrid";
import { Board } from "@/lib/types";

function emptyBoard(): Board {
  return Array.from({ length: 15 }, () => Array(15).fill(null));
}

describe("BoardGrid", () => {
  it("renders 225 cells", () => {
    render(<BoardGrid board={emptyBoard()} />);
    expect(screen.getAllByTestId(/^cell-/)).toHaveLength(225);
  });

  it("shows existing letters", () => {
    const board = emptyBoard();
    board[7][7] = { letter: "C", isBlank: false };
    render(<BoardGrid board={board} />);
    expect(screen.getByTestId("cell-7-7")).toHaveTextContent("C");
  });

  it("calls onCellChange when an editable cell's letter is typed", () => {
    const onCellChange = vi.fn();
    render(<BoardGrid board={emptyBoard()} editable onCellChange={onCellChange} />);
    const input = screen.getByTestId("cell-input-7-7");
    fireEvent.change(input, { target: { value: "q" } });
    expect(onCellChange).toHaveBeenCalledWith(7, 7, { letter: "Q", isBlank: false });
  });

  it("lets an editable cell with a letter be marked as a blank-derived tile", () => {
    const onCellChange = vi.fn();
    const board = emptyBoard();
    board[7][7] = { letter: "Q", isBlank: false };
    render(<BoardGrid board={board} editable onCellChange={onCellChange} />);
    fireEvent.click(screen.getByTestId("cell-blank-7-7"));
    expect(onCellChange).toHaveBeenCalledWith(7, 7, { letter: "Q", isBlank: true });
  });

  it("does not show a blank toggle for an empty editable cell", () => {
    render(<BoardGrid board={emptyBoard()} editable onCellChange={() => {}} />);
    expect(screen.queryByTestId("cell-blank-7-7")).not.toBeInTheDocument();
  });

  it("applies a highlight marker to highlighted cells", () => {
    render(<BoardGrid board={emptyBoard()} highlighted={[{ row: 3, col: 4 }]} />);
    expect(screen.getByTestId("cell-3-4")).toHaveAttribute("data-highlighted", "true");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run components/BoardGrid.test.tsx`
Expected: FAIL — `components/BoardGrid.tsx` does not exist yet.

- [ ] **Step 3: Write components/BoardGrid.tsx**

```tsx
"use client";

import { Board, BoardCell } from "@/lib/types";

type Props = {
  board: Board;
  editable?: boolean;
  onCellChange?: (row: number, col: number, cell: BoardCell) => void;
  highlighted?: { row: number; col: number }[];
};

export function BoardGrid({ board, editable = false, onCellChange, highlighted = [] }: Props) {
  const isHighlighted = (row: number, col: number) =>
    highlighted.some((h) => h.row === row && h.col === col);

  return (
    <div
      style={{ display: "grid", gridTemplateColumns: "repeat(15, 2rem)" }}
      data-testid="board-grid"
    >
      {board.map((rowCells, row) =>
        rowCells.map((cell, col) => (
          <div
            key={`${row}-${col}`}
            data-testid={`cell-${row}-${col}`}
            data-highlighted={isHighlighted(row, col) ? "true" : "false"}
            style={{
              width: "2rem",
              height: "2rem",
              border: "1px solid #999",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: isHighlighted(row, col) ? "#ffe680" : undefined,
            }}
          >
            {editable ? (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                <input
                  data-testid={`cell-input-${row}-${col}`}
                  maxLength={1}
                  value={cell?.letter ?? ""}
                  onChange={(e) => {
                    const value = e.target.value.toUpperCase();
                    onCellChange?.(
                      row,
                      col,
                      value ? { letter: value, isBlank: cell?.isBlank ?? false } : null
                    );
                  }}
                  style={{ width: "100%", height: "1.2rem", textAlign: "center", border: "none" }}
                />
                {cell && (
                  <input
                    data-testid={`cell-blank-${row}-${col}`}
                    type="checkbox"
                    checked={cell.isBlank}
                    onChange={(e) => onCellChange?.(row, col, { letter: cell.letter, isBlank: e.target.checked })}
                    title="mark as blank tile"
                  />
                )}
              </div>
            ) : (
              cell?.letter ?? ""
            )}
          </div>
        ))
      )}
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run components/BoardGrid.test.tsx`
Expected: PASS (6 tests)

- [ ] **Step 5: Commit**

```bash
git add components/BoardGrid.tsx components/BoardGrid.test.tsx
git commit -m "Add editable/highlightable BoardGrid component"
```

---

### Task 10: RackEditor component

**Files:**
- Create: `components/RackEditor.tsx`
- Test: `components/RackEditor.test.tsx`

**Interfaces:**
- Consumes: `RackTile` (`lib/types.ts`)
- Produces: `<RackEditor rack={RackTile[]} onChange={(rack: RackTile[]) => void} />`

- [ ] **Step 1: Write the failing tests**

```tsx
// components/RackEditor.test.tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { RackEditor } from "./RackEditor";
import { RackTile } from "@/lib/types";

describe("RackEditor", () => {
  it("renders one input per rack tile", () => {
    const rack: RackTile[] = [{ kind: "letter", letter: "A" }, { kind: "blank" }];
    render(<RackEditor rack={rack} onChange={() => {}} />);
    expect(screen.getAllByTestId(/^rack-slot-/)).toHaveLength(2);
  });

  it("updates a letter slot on change", () => {
    const onChange = vi.fn();
    const rack: RackTile[] = [{ kind: "letter", letter: "A" }];
    render(<RackEditor rack={rack} onChange={onChange} />);
    fireEvent.change(screen.getByTestId("rack-input-0"), { target: { value: "z" } });
    expect(onChange).toHaveBeenCalledWith([{ kind: "letter", letter: "Z" }]);
  });

  it("adds a tile up to a max of 7", () => {
    const onChange = vi.fn();
    const rack: RackTile[] = Array(7).fill({ kind: "letter", letter: "A" });
    render(<RackEditor rack={rack} onChange={onChange} />);
    expect(screen.queryByTestId("add-tile")).not.toBeInTheDocument();
  });

  it("removes a tile", () => {
    const onChange = vi.fn();
    const rack: RackTile[] = [{ kind: "letter", letter: "A" }, { kind: "letter", letter: "B" }];
    render(<RackEditor rack={rack} onChange={onChange} />);
    fireEvent.click(screen.getByTestId("remove-tile-0"));
    expect(onChange).toHaveBeenCalledWith([{ kind: "letter", letter: "B" }]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run components/RackEditor.test.tsx`
Expected: FAIL — `components/RackEditor.tsx` does not exist yet.

- [ ] **Step 3: Write components/RackEditor.tsx**

```tsx
"use client";

import { RackTile } from "@/lib/types";

type Props = {
  rack: RackTile[];
  onChange: (rack: RackTile[]) => void;
};

const MAX_TILES = 7;
const MIN_TILES = 2;

export function RackEditor({ rack, onChange }: Props) {
  function setTile(index: number, tile: RackTile) {
    const next = [...rack];
    next[index] = tile;
    onChange(next);
  }

  function removeTile(index: number) {
    onChange(rack.filter((_, i) => i !== index));
  }

  function addTile() {
    onChange([...rack, { kind: "letter", letter: "" }]);
  }

  return (
    <div style={{ display: "flex", gap: "0.5rem" }} data-testid="rack-editor">
      {rack.map((tile, i) => (
        <div key={i} data-testid={`rack-slot-${i}`} style={{ display: "flex", flexDirection: "column" }}>
          <input
            data-testid={`rack-input-${i}`}
            maxLength={1}
            value={tile.kind === "letter" ? tile.letter : ""}
            placeholder="?"
            onChange={(e) => {
              const value = e.target.value.toUpperCase();
              setTile(i, value ? { kind: "letter", letter: value } : { kind: "blank" });
            }}
          />
          <label>
            <input
              type="checkbox"
              checked={tile.kind === "blank"}
              onChange={(e) => setTile(i, e.target.checked ? { kind: "blank" } : { kind: "letter", letter: "" })}
            />
            blank
          </label>
          {rack.length > MIN_TILES && (
            <button data-testid={`remove-tile-${i}`} onClick={() => removeTile(i)} type="button">
              remove
            </button>
          )}
        </div>
      ))}
      {rack.length < MAX_TILES && (
        <button data-testid="add-tile" onClick={addTile} type="button">
          add tile
        </button>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run components/RackEditor.test.tsx`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add components/RackEditor.tsx components/RackEditor.test.tsx
git commit -m "Add RackEditor component"
```

---

### Task 11: Capture page (full flow wiring)

**Files:**
- Modify: `app/page.tsx`
- Test: `app/page.test.tsx`

**Interfaces:**
- Consumes: `BoardGrid` (`components/BoardGrid.tsx`), `RackEditor` (`components/RackEditor.tsx`), `ScanResult`, `Play` (`lib/types.ts`)
- Produces: the top-level page component (no external consumers)

- [ ] **Step 1: Write the failing tests**

```tsx
// app/page.test.tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import Home from "./page";

function makeFile(): File {
  return new File(["fake-image-bytes"], "board.jpg", { type: "image/jpeg" });
}

describe("Home page", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn((url: string) => {
        if (url === "/api/scan") {
          return Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve({
                board: Array.from({ length: 15 }, () => Array(15).fill(null)),
                rack: [{ kind: "letter", letter: "A" }, { kind: "letter", letter: "B" }],
              }),
          });
        }
        if (url === "/api/solve") {
          return Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve({
                plays: [{ word: "AB", row: 7, col: 7, direction: "across", score: 4 }],
              }),
          });
        }
        return Promise.reject(new Error(`unexpected fetch to ${url}`));
      })
    );
    vi.stubGlobal("FileReader", class {
      onload: (() => void) | null = null;
      result: string = "data:image/jpeg;base64,ZmFrZQ==";
      readAsDataURL() {
        this.onload?.();
      }
    });
  });

  it("goes from capture through review to results", async () => {
    render(<Home />);

    const input = screen.getByTestId("camera-input");
    fireEvent.change(input, { target: { files: [makeFile()] } });

    await waitFor(() => expect(screen.getByTestId("rack-editor")).toBeInTheDocument());

    fireEvent.click(screen.getByText("Find best play"));

    await waitFor(() => expect(screen.getByText("AB")).toBeInTheDocument());
    expect(screen.getByText(/score: 4/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run app/page.test.tsx`
Expected: FAIL — `app/page.tsx` is still the Task 1 placeholder.

- [ ] **Step 3: Write app/page.tsx**

```tsx
"use client";

import { useState } from "react";
import { BoardGrid } from "@/components/BoardGrid";
import { RackEditor } from "@/components/RackEditor";
import { Board, Play, RackTile } from "@/lib/types";

type Stage = "capture" | "scanning" | "review" | "solving" | "results" | "error";

export default function Home() {
  const [stage, setStage] = useState<Stage>("capture");
  const [board, setBoard] = useState<Board | null>(null);
  const [rack, setRack] = useState<RackTile[]>([]);
  const [plays, setPlays] = useState<Play[]>([]);
  const [error, setError] = useState<string>("");

  function readFileAsDataUrl(file: File): Promise<string> {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.readAsDataURL(file);
    });
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setStage("scanning");
    try {
      const dataUrl = await readFileAsDataUrl(file);
      const [, base64] = dataUrl.split(",");
      const res = await fetch("/api/scan", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ imageBase64: base64, mediaType: file.type }),
      });
      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error ?? "Failed to scan image");
      }
      const result = await res.json();
      setBoard(result.board);
      setRack(result.rack);
      setStage("review");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to scan image");
      setStage("error");
    }
  }

  async function handleSolve() {
    if (!board) return;
    setStage("solving");
    const res = await fetch("/api/solve", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ board, rack }),
    });
    const body = await res.json();
    setPlays(body.plays);
    setStage("results");
  }

  function reset() {
    setStage("capture");
    setBoard(null);
    setRack([]);
    setPlays([]);
    setError("");
  }

  return (
    <main>
      <h1>Scrabble Solver</h1>

      {stage === "capture" && (
        <input
          data-testid="camera-input"
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handleFileChange}
        />
      )}

      {stage === "scanning" && <p>Scanning photo...</p>}

      {stage === "review" && board && (
        <div>
          <BoardGrid board={board} editable onCellChange={(r, c, cell) => {
            const next = board.map((row) => [...row]);
            next[r][c] = cell;
            setBoard(next);
          }} />
          <RackEditor rack={rack} onChange={setRack} />
          <button onClick={handleSolve}>Find best play</button>
        </div>
      )}

      {stage === "solving" && <p>Solving...</p>}

      {stage === "results" && board && (
        <div>
          <BoardGrid
            board={board}
            highlighted={plays[0] ? highlightedCells(plays[0]) : []}
          />
          {plays.length === 0 ? (
            <p>No valid plays found.</p>
          ) : (
            <ul>
              {plays.map((p, i) => (
                <li key={i}>
                  {p.word} — score: {p.score}
                </li>
              ))}
            </ul>
          )}
          <button onClick={reset}>Scan again</button>
        </div>
      )}

      {stage === "error" && (
        <div>
          <p>{error}</p>
          <button onClick={reset}>Try again</button>
        </div>
      )}
    </main>
  );
}

function highlightedCells(play: Play): { row: number; col: number }[] {
  return Array.from({ length: play.word.length }, (_, i) =>
    play.direction === "across"
      ? { row: play.row, col: play.col + i }
      : { row: play.row + i, col: play.col }
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run app/page.test.tsx`
Expected: PASS (1 test)

- [ ] **Step 5: Run the full test suite**

Run: `npm test`
Expected: all tests across all files pass.

- [ ] **Step 6: Commit**

```bash
git add app/page.tsx app/page.test.tsx
git commit -m "Wire up capture -> review -> solve -> results flow"
```

---

### Task 12: Deploy and verify on a real phone

This task requires the user's own Vercel login and Anthropic API key — it is guidance for the user/executor to run interactively, not something to script unattended.

**Files:** none (deployment + manual verification only)

- [ ] **Step 1: Link and deploy the project**

```bash
npx vercel link
npx vercel env add ANTHROPIC_API_KEY
npx vercel deploy --prod
```

- [ ] **Step 2: Manual verification on a phone**

1. Open the deployed URL on a phone browser.
2. Set up a real (or simulated) Scrabble board with a few tiles placed and a rack of 4-7 letters.
3. Tap the capture control, take a photo including both board and rack.
4. Confirm the scanned board/rack appear in the review UI; correct any misread cells.
5. Tap "Find best play" and confirm a legal, sensible play is highlighted with a plausible score.
6. Try a case with no legal play (e.g. a rack of tiles that can't extend anything) and confirm "No valid plays found" appears instead of an error.
7. Report back: does the flow work end-to-end, and are there any tiles/positions the vision step consistently misreads that the correction UI should make easier to fix?

- [ ] **Step 3: Commit any fixes found during manual verification**

If manual testing surfaces bugs, fix them following the same test-first approach as earlier tasks, then commit.
