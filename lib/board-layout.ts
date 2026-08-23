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
