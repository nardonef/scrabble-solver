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
