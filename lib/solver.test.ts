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
});
