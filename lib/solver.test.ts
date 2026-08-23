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
    // Several valid anagrams of C/A/T/S exist (CAT, ACT, CATS, CAST, SCAT) and
    // which one scores highest depends on board position, so assert the
    // general shape rather than one exact word: it must use only rack
    // letters, be at least 2 long, and cover the center square.
    const cells = Array.from({ length: best.word.length }, (_, i) =>
      best.direction === "across" ? [best.row, best.col + i] : [best.row + i, best.col]
    );
    expect(cells.some(([r, c]) => r === 7 && c === 7)).toBe(true);
    expect([...best.word].every((ch) => "CATS".includes(ch))).toBe(true);
    expect(best.word.length).toBeGreaterThanOrEqual(2);
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
    const rack = ["X"].map(letterTile);
    const plays = findBestPlays(board, rack);
    // X placed under A forms the valid word "AX"; X placed under C or T would
    // form "CX"/"TX", which aren't words and must be rejected rather than returned.
    expect(plays.some((p) => p.word === "AX")).toBe(true);
    expect(plays.every((p) => p.word !== "CX" && p.word !== "TX")).toBe(true);
  });

  it("awards the 50-point bingo bonus when all 7 rack tiles are used", () => {
    const board = emptyBoard();
    // O,R,I,E,N,T,S: all letter values are 1, and "ORIENTS" is a valid 7-letter
    // word, so a bingo play covering the center is guaranteed to be found.
    // Score has a guaranteed floor of (sum of letter values) + 50, since
    // multipliers can only add to that, never subtract.
    const rack = ["O", "R", "I", "E", "N", "T", "S"].map(letterTile);
    const plays = findBestPlays(board, rack, 20);
    const bingo = plays.find((p) => p.word.length === 7);
    expect(bingo).toBeDefined();
    expect(bingo!.score).toBeGreaterThanOrEqual(7 + 50);
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

  it("still tries letter tiles that come after a blank in the rack array", () => {
    const board = emptyBoard();
    // The blank is listed first, followed by the literal letters C, A, T.
    // Forming "CATS" requires the literal C tile at the *first* position of
    // the word (with the blank reserved for the final S) — a buggy
    // implementation that breaks out of the rack loop entirely after the
    // first blank (rather than just skipping a redundant second blank) can
    // only ever fill the first position with the blank itself, since the
    // blank sits before C/A/T in the array. That consumes the blank on the
    // first letter, leaving no blank free for S, so "CATS" becomes
    // unreachable under the bug even though every tile needed is present.
    // maxResults is raised because several other anagrams of C/A/T/blank score
    // higher depending on which premium squares a given start offset lands
    // on; we only care whether "CATS" is reachable at all, not whether it's
    // top-ranked.
    const rack: RackTile[] = [{ kind: "blank" }, letterTile("C"), letterTile("A"), letterTile("T")];
    const plays = findBestPlays(board, rack, 50);
    expect(plays.some((p) => p.word === "CATS")).toBe(true);
  });

  it("never generates a truncated word by overshooting past an existing tile run", () => {
    const board = emptyBoard();
    // Row 7 has two separate existing runs: "DOG" at cols 0-2, and a lone "E"
    // at row 6 col 5 (directly above row 7 col 5). The anchor at (7,5) walks
    // backward through empty (7,4) and (7,3) before hitting the non-null
    // (7,2) = "G". A buggy implementation lets `back` reach that position
    // and start the word at (7,3) — placing M,A,X there reads "MAX" and
    // passes validation (with a valid "EX" cross-word at 7,5) — but this
    // silently ignores the mandatory "G" immediately to its left. The real
    // word starting there would be "DOGMAX" (not a dictionary word, and
    // rightly rejected via the proper anchor at (7,3), which does absorb
    // D/O/G). That specific (word, row, col, direction) combination must
    // never be returned.
    //
    // Note: the "E" tile also enables several *legitimate* "MAX" plays
    // elsewhere on this otherwise-empty board (e.g. M adjacent to E forming
    // a valid cross-word at a proper anchor), so this test checks the exact
    // illegal position rather than banning the word "MAX" outright.
    board[7][0] = { letter: "D", isBlank: false };
    board[7][1] = { letter: "O", isBlank: false };
    board[7][2] = { letter: "G", isBlank: false };
    board[6][5] = { letter: "E", isBlank: false };
    const rack = ["M", "A", "X"].map(letterTile);
    const plays = findBestPlays(board, rack, 50);
    const illegalOvershoot = plays.find(
      (p) => p.word === "MAX" && p.row === 7 && p.col === 3 && p.direction === "across"
    );
    expect(illegalOvershoot).toBeUndefined();
  });

  it("keeps the higher-scoring real-tile variant over a same-word blank variant", () => {
    const board = emptyBoard();
    board[7][7] = { letter: "C", isBlank: false };
    board[7][8] = { letter: "A", isBlank: false };
    board[7][9] = { letter: "T", isBlank: false };
    // The rack has both a blank and a real "S" — either can complete "CATS"
    // at the same position (row 7, col 7, across), landing the new tile on
    // the plain (non-premium) square at col 10. A blank scores 0 for that
    // letter, so if dedup keeps whichever variant was enumerated first
    // (rather than the highest-scoring one), it can silently keep the
    // 0-scoring blank play over the correct, higher-scoring real-tile play.
    // Listing the blank first in the rack array means the blank variant is
    // enumerated before the real-tile variant, exercising exactly that
    // ordering.
    const rack: RackTile[] = [{ kind: "blank" }, letterTile("S")];
    const plays = findBestPlays(board, rack, 50);
    const cats = plays.filter((p) => p.word === "CATS");
    expect(cats.length).toBe(1); // deduped to a single entry for this word/position
    // C(3) + A(1) + T(1) + S(1, no premium at col 10) = 6, vs. 5 if the
    // 0-scoring blank variant had been kept instead.
    expect(cats[0].score).toBe(6);
  });

  it("skips a malformed {kind: 'letter', letter: ''} rack tile instead of producing garbage plays", () => {
    const board = emptyBoard();
    const validRack = ["C", "A", "T"].map(letterTile);
    const malformedRack: RackTile[] = [...validRack, { kind: "letter", letter: "" }];

    const validPlays = findBestPlays(board, validRack, 50);
    const malformedPlays = findBestPlays(board, malformedRack, 50);

    for (const p of malformedPlays) {
      expect(Number.isFinite(p.score)).toBe(true);
      expect(/^[A-Z]+$/.test(p.word)).toBe(true);
    }

    // The malformed tile should be a pure no-op: identical plays with or
    // without it in the rack.
    const key = (p: (typeof malformedPlays)[number]) => `${p.word}|${p.row}|${p.col}|${p.direction}`;
    expect(malformedPlays.map(key).sort()).toEqual(validPlays.map(key).sort());
  });
});
