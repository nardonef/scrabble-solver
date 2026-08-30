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

  it("opens a tap-to-enlarge editor for an editable cell and commits a typed letter", () => {
    const onCellChange = vi.fn();
    render(<BoardGrid board={emptyBoard()} editable onCellChange={onCellChange} />);
    fireEvent.click(screen.getByTestId("cell-7-7"));
    const input = screen.getByTestId("cell-input-7-7");
    fireEvent.change(input, { target: { value: "q" } });
    expect(onCellChange).toHaveBeenCalledWith(7, 7, { letter: "Q", isBlank: false });
  });

  it("does not render a per-cell input until the cell is tapped", () => {
    render(<BoardGrid board={emptyBoard()} editable onCellChange={() => {}} />);
    expect(screen.queryByTestId("cell-input-7-7")).not.toBeInTheDocument();
  });

  it("lets an editable cell with a letter be marked as a blank-derived tile", () => {
    const onCellChange = vi.fn();
    const board = emptyBoard();
    board[7][7] = { letter: "Q", isBlank: false };
    render(<BoardGrid board={board} editable onCellChange={onCellChange} />);
    fireEvent.click(screen.getByTestId("cell-7-7"));
    fireEvent.click(screen.getByTestId("cell-blank-7-7"));
    expect(onCellChange).toHaveBeenCalledWith(7, 7, { letter: "Q", isBlank: true });
  });

  it("does not show a blank toggle for an empty editable cell", () => {
    render(<BoardGrid board={emptyBoard()} editable onCellChange={() => {}} />);
    fireEvent.click(screen.getByTestId("cell-7-7"));
    expect(screen.queryByTestId("cell-blank-7-7")).not.toBeInTheDocument();
  });

  it("clears a cell via the Clear chip", () => {
    const onCellChange = vi.fn();
    const board = emptyBoard();
    board[7][7] = { letter: "Q", isBlank: false };
    render(<BoardGrid board={board} editable onCellChange={onCellChange} />);
    fireEvent.click(screen.getByTestId("cell-7-7"));
    fireEvent.click(screen.getByText("Clear"));
    expect(onCellChange).toHaveBeenCalledWith(7, 7, null);
  });

  it("closes the editor when the scrim is clicked", () => {
    const board = emptyBoard();
    board[7][7] = { letter: "Q", isBlank: false };
    render(<BoardGrid board={board} editable onCellChange={() => {}} />);
    fireEvent.click(screen.getByTestId("cell-7-7"));
    expect(screen.getByTestId("cell-input-7-7")).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("cell-editor-scrim"));
    expect(screen.queryByTestId("cell-input-7-7")).not.toBeInTheDocument();
  });

  it("applies a highlight marker to winning cells and flags newly placed ones", () => {
    render(
      <BoardGrid
        board={emptyBoard()}
        winningCells={[{ row: 3, col: 4, isNew: true }, { row: 3, col: 5, isNew: false }]}
      />
    );
    expect(screen.getByTestId("cell-3-4")).toHaveAttribute("data-highlighted", "true");
    expect(screen.getByTestId("cell-3-4")).toHaveAttribute("data-winning-new", "true");
    expect(screen.getByTestId("cell-3-5")).toHaveAttribute("data-winning-new", "false");
  });
});
