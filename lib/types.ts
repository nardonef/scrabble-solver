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
