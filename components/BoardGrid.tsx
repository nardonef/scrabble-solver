"use client";

import { useRef, useState } from "react";
import { Board, BoardCell } from "@/lib/types";
import { BOARD_LAYOUT, CENTER, CellType } from "@/lib/board-layout";
import { LETTER_VALUES } from "@/lib/scoring";

type WinningCell = { row: number; col: number; isNew: boolean };

type Props = {
  board: Board;
  editable?: boolean;
  onCellChange?: (row: number, col: number, cell: BoardCell) => void;
  winningCells?: WinningCell[];
};

const BONUS_LABEL: Record<Exclude<CellType, null>, string> = {
  TW: "TW",
  DW: "DW",
  TL: "TL",
  DL: "DL",
};

function squareBackground(row: number, col: number, cellType: CellType): string {
  if (row === CENTER && col === CENTER) return "var(--sq-center-bg)";
  switch (cellType) {
    case "TW": return "var(--sq-tw-bg)";
    case "DW": return "var(--sq-dw-bg)";
    case "TL": return "var(--sq-tl-bg)";
    case "DL": return "var(--sq-dl-bg)";
    default: return "var(--sq-plain-bg)";
  }
}

function squareLabelColor(row: number, col: number, cellType: CellType): string {
  if (row === CENTER && col === CENTER) return "var(--sq-center-label)";
  switch (cellType) {
    case "TW": return "var(--sq-tw-label)";
    case "DW": return "var(--sq-dw-label)";
    case "TL": return "var(--sq-tl-label)";
    case "DL": return "var(--sq-dl-label)";
    default: return "transparent";
  }
}

const MIN_SCALE = 1;
const MAX_SCALE = 2.5;

export function BoardGrid({ board, editable = false, onCellChange, winningCells = [] }: Props) {
  const [activeCell, setActiveCell] = useState<{ row: number; col: number } | null>(null);
  const [overlayPos, setOverlayPos] = useState({ top: 0, left: 0 });
  const [zoom, setZoom] = useState({ scale: 1, originX: 50, originY: 50 });
  const pinchState = useRef<{ pointers: Map<number, { x: number; y: number }>; startDist: number; startScale: number } | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const cellRefs = useRef<Map<string, HTMLButtonElement>>(new Map());

  const winningInfo = (row: number, col: number) =>
    winningCells.find((w) => w.row === row && w.col === col);

  function activate(row: number, col: number) {
    if (!editable) return;
    const el = cellRefs.current.get(`${row}-${col}`);
    const wrapper = wrapperRef.current;
    if (el && wrapper) {
      const cellRect = el.getBoundingClientRect();
      const wrapperRect = wrapper.getBoundingClientRect();
      setOverlayPos({
        top: cellRect.top - wrapperRect.top + cellRect.height / 2,
        left: cellRect.left - wrapperRect.left + cellRect.width / 2,
      });
    }
    setActiveCell({ row, col });
  }

  function closeEditor() {
    setActiveCell(null);
  }

  function commitLetter(row: number, col: number, value: string) {
    const cell = board[row][col];
    onCellChange?.(row, col, value ? { letter: value, isBlank: cell?.isBlank ?? false } : null);
    if (value && col + 1 < 15) {
      setActiveCell({ row, col: col + 1 });
    }
  }

  function onPointerDown(e: React.PointerEvent) {
    if (e.pointerType !== "touch") return;
    const state = pinchState.current ?? { pointers: new Map(), startDist: 0, startScale: zoom.scale };
    state.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (state.pointers.size === 2) {
      const [a, b] = Array.from(state.pointers.values());
      state.startDist = Math.hypot(a.x - b.x, a.y - b.y);
      state.startScale = zoom.scale;
    }
    pinchState.current = state;
  }

  function onPointerMove(e: React.PointerEvent) {
    const state = pinchState.current;
    if (!state || !state.pointers.has(e.pointerId)) return;
    state.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (state.pointers.size !== 2 || state.startDist === 0) return;
    const [a, b] = Array.from(state.pointers.values());
    const dist = Math.hypot(a.x - b.x, a.y - b.y);
    const nextScale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, state.startScale * (dist / state.startDist)));
    setZoom((z) => ({ ...z, scale: nextScale, originX: (a.x + b.x) / 2, originY: (a.y + b.y) / 2 }));
  }

  function onPointerUp(e: React.PointerEvent) {
    pinchState.current?.pointers.delete(e.pointerId);
    if (pinchState.current && pinchState.current.pointers.size < 2) {
      pinchState.current.startDist = 0;
    }
  }

  function onDoubleClick() {
    setZoom({ scale: 1, originX: 50, originY: 50 });
  }

  const active = activeCell ? board[activeCell.row][activeCell.col] ?? { letter: "", isBlank: false } : null;

  return (
    <div style={{ position: "relative" }} ref={wrapperRef}>
      <div
        data-testid="board-grid"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onDoubleClick={onDoubleClick}
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(15, 1fr)",
          gap: "1.5px",
          padding: "5px",
          background: "var(--board-frame)",
          borderRadius: "9px",
          boxShadow: "inset 0 0 0 1px rgba(18,22,28,.09)",
          maxWidth: "min(100%, 480px)",
          margin: "0 auto",
          touchAction: pinchState.current && pinchState.current.pointers.size === 2 ? "none" : undefined,
          transform: `scale(${zoom.scale})`,
          transformOrigin: `${zoom.originX}% ${zoom.originY}%`,
          transition: pinchState.current ? "none" : "transform 150ms ease-out",
        }}
      >
        {board.map((rowCells, row) =>
          rowCells.map((cell, col) => {
            const cellType = BOARD_LAYOUT[row][col];
            const win = winningInfo(row, col);
            const isCenter = row === CENTER && col === CENTER && !cell;
            const isActive = activeCell?.row === row && activeCell?.col === col;

            return (
              <button
                key={`${row}-${col}`}
                type="button"
                ref={(el) => {
                  if (el) cellRefs.current.set(`${row}-${col}`, el);
                  else cellRefs.current.delete(`${row}-${col}`);
                }}
                data-testid={`cell-${row}-${col}`}
                data-highlighted={win ? "true" : "false"}
                data-winning-new={win?.isNew ? "true" : "false"}
                onClick={() => activate(row, col)}
                disabled={!editable}
                style={{
                  aspectRatio: "1",
                  border: "none",
                  padding: 0,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  position: "relative",
                  background: squareBackground(row, col, cellType),
                  cursor: editable ? "pointer" : "default",
                  opacity: isActive ? 0.35 : 1,
                }}
              >
                {!cell && cellType && !isCenter && (
                  <span
                    style={{
                      fontFamily: "var(--font-sans)",
                      fontWeight: 700,
                      fontSize: "6.4px",
                      letterSpacing: "0.02em",
                      color: squareLabelColor(row, col, cellType),
                    }}
                  >
                    {BONUS_LABEL[cellType]}
                  </span>
                )}
                {isCenter && <span style={{ fontSize: "10px", color: "var(--sq-center-label)" }}>★</span>}
                {cell && (
                  <Tile letter={cell.letter} isBlank={cell.isBlank} isWinning={!!win} isWinningNew={!!win?.isNew} size="board" />
                )}
              </button>
            );
          })
        )}
      </div>

      {editable && activeCell && active && (
        <>
          <div
            data-testid="cell-editor-scrim"
            onClick={closeEditor}
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(246,248,250,.42)",
              zIndex: 10,
            }}
          />
          <div style={{ position: "absolute", top: overlayPos.top, left: overlayPos.left, zIndex: 11 }}>
            <div
              style={{
                position: "absolute",
                width: 64,
                height: 64,
                transform: "translate(-50%,-50%)",
                borderRadius: 8,
                boxShadow: "0 0 0 2.5px var(--accent), 0 10px 22px rgba(18,22,28,.28)",
              }}
            >
              <Tile letter={active.letter} isBlank={active.isBlank} size="enlarged" />
              <input
                data-testid={`cell-input-${activeCell.row}-${activeCell.col}`}
                autoFocus
                maxLength={1}
                value={active.letter}
                onChange={(e) => commitLetter(activeCell.row, activeCell.col, e.target.value.toUpperCase())}
                onKeyDown={(e) => {
                  if (e.key === "Enter") closeEditor();
                }}
                style={{ position: "absolute", opacity: 0, width: 64, height: 64, top: 0, left: 0 }}
              />
            </div>
            <div style={{ position: "absolute", left: 40, top: 0, transform: "translateY(-50%)", display: "flex", flexDirection: "column", gap: "6px" }}>
              {active.letter && (
                <label
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "4px",
                    background: "var(--surface)",
                    borderRadius: 9,
                    padding: "6px 10px",
                    boxShadow: "0 3px 10px rgba(18,22,28,.18)",
                    fontFamily: "var(--font-sans)",
                    fontSize: "13px",
                  }}
                >
                  <input
                    data-testid={`cell-blank-${activeCell.row}-${activeCell.col}`}
                    type="checkbox"
                    checked={active.isBlank}
                    onChange={(e) => onCellChange?.(activeCell.row, activeCell.col, { letter: active.letter, isBlank: e.target.checked })}
                  />
                  Blank
                </label>
              )}
              <button
                type="button"
                onClick={() => onCellChange?.(activeCell.row, activeCell.col, null)}
                style={{
                  background: "var(--surface)",
                  borderRadius: 9,
                  border: "none",
                  padding: "6px 10px",
                  boxShadow: "0 3px 10px rgba(18,22,28,.18)",
                  color: "var(--danger)",
                  fontFamily: "var(--font-sans)",
                  fontSize: "13px",
                  cursor: "pointer",
                }}
              >
                Clear
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function Tile({
  letter,
  isBlank,
  isWinning = false,
  isWinningNew = false,
  size,
}: {
  letter: string;
  isBlank: boolean;
  isWinning?: boolean;
  isWinningNew?: boolean;
  size: "board" | "enlarged";
}) {
  const winningSolid = isWinning && isWinningNew;
  const value = isBlank ? 0 : (LETTER_VALUES[letter] ?? 0);
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        borderRadius: size === "board" ? "2.5px" : "8px",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        position: "relative",
        background: winningSolid ? "var(--accent)" : "linear-gradient(var(--tile-face-1), var(--tile-face-2))",
        boxShadow: winningSolid
          ? undefined
          : isBlank
          ? "inset 0 0 0 1.4px var(--accent), inset 0 1px 0 rgba(255,255,255,.85), inset 0 -1px 0 rgba(120,95,50,.22)"
          : "inset 0 1px 0 rgba(255,255,255,.85), inset 0 -1px 0 rgba(120,95,50,.22)",
      }}
    >
      <span
        style={{
          fontFamily: "var(--font-sans)",
          fontWeight: 700,
          fontSize: size === "board" ? "12px" : "30px",
          color: winningSolid ? "#ffffff" : isBlank ? "var(--accent)" : "var(--tile-letter)",
        }}
      >
        {letter}
      </span>
      <span
        style={{
          position: "absolute",
          bottom: "2px",
          right: "3px",
          fontFamily: "var(--font-mono)",
          fontWeight: 600,
          fontSize: size === "board" ? "6px" : "15px",
          opacity: winningSolid ? 0.8 : 0.7,
          color: winningSolid ? "#ffffff" : isBlank ? "var(--accent)" : "var(--tile-letter)",
        }}
      >
        {value}
      </span>
    </div>
  );
}
