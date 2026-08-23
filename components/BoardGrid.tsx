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
