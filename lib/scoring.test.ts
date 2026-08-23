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
