import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { BoardGrid } from "./BoardGrid";
import { Board } from "@/lib/types";

function emptyBoard(): Board {
  return Array.from({ length: 15 }, () => Array(15).fill(null));
}

describe("BoardGrid", () => {
  it("renders 225 cells", () => {
    render(<BoardGrid board={emptyBoard()} />);
    expect(screen.getAllByTestId(/^cell-/)).toHaveLength(225);
  });

  it("shows existing letters", () => {
    const board = emptyBoard();
    board[7][7] = { letter: "C", isBlank: false };
    render(<BoardGrid board={board} />);
    expect(screen.getByTestId("cell-7-7")).toHaveTextContent("C");
  });

  it("calls onCellChange when an editable cell's letter is typed", () => {
    const onCellChange = vi.fn();
    render(<BoardGrid board={emptyBoard()} editable onCellChange={onCellChange} />);
    const input = screen.getByTestId("cell-input-7-7");
    fireEvent.change(input, { target: { value: "q" } });
    expect(onCellChange).toHaveBeenCalledWith(7, 7, { letter: "Q", isBlank: false });
  });

  it("lets an editable cell with a letter be marked as a blank-derived tile", () => {
    const onCellChange = vi.fn();
    const board = emptyBoard();
    board[7][7] = { letter: "Q", isBlank: false };
    render(<BoardGrid board={board} editable onCellChange={onCellChange} />);
    fireEvent.click(screen.getByTestId("cell-blank-7-7"));
    expect(onCellChange).toHaveBeenCalledWith(7, 7, { letter: "Q", isBlank: true });
  });

  it("does not show a blank toggle for an empty editable cell", () => {
    render(<BoardGrid board={emptyBoard()} editable onCellChange={() => {}} />);
    expect(screen.queryByTestId("cell-blank-7-7")).not.toBeInTheDocument();
  });

  it("applies a highlight marker to highlighted cells", () => {
    render(<BoardGrid board={emptyBoard()} highlighted={[{ row: 3, col: 4 }]} />);
    expect(screen.getByTestId("cell-3-4")).toHaveAttribute("data-highlighted", "true");
  });
});
