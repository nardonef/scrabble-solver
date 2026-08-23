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
