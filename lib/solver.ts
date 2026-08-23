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

    let triedBlank = false;
    for (let i = 0; i < frame.remainingRack.length; i++) {
      const tile = frame.remainingRack[i];
      // Defensive guard: a rack tile should never be {kind: "letter"} with
      // anything but a single A-Z letter, but skip it here rather than trust
      // every caller — a malformed tile would otherwise act as a zero-width
      // "letter" (desyncing word length from board position) and score NaN.
      if (tile.kind === "letter" && !/^[A-Z]$/.test(tile.letter)) continue;
      if (tile.kind === "blank") {
        if (triedBlank) continue; // the two blanks are interchangeable
        triedBlank = true;
      }
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
          // If the walk stopped because it hit an existing tile (rather than
          // running off the board), the farthest empty cell is adjacent to
          // that tile. Starting the word there would leave that tile
          // un-absorbed even though it's mandatory, silently truncating the
          // real word — so exclude that one overshoot position.
          if (inBounds(br, bc)) maxBack--;
        }

        for (let back = 0; back <= maxBack; back++) {
          tryPlacementsFrom(board, rack, lr - dr * back, lc - dc * back, dr, dc, direction, plays);
        }
      }
    }
  }

  // Sort before dedup: two placements (e.g. a real tile vs. a blank standing
  // in for the same letter) can share the same word/row/col/direction key
  // but score differently (blanks score 0). Sorting first ensures dedup
  // keeps the highest-scoring variant for each key, not whichever happened
  // to be enumerated first.
  plays.sort((a, b) => b.score - a.score);

  const seen = new Set<string>();
  const unique = plays.filter((p) => {
    const key = `${p.word}|${p.row}|${p.col}|${p.direction}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return unique.slice(0, maxResults);
}
