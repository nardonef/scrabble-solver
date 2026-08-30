import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { RackEditor } from "./RackEditor";
import { RackTile } from "@/lib/types";

describe("RackEditor", () => {
  it("renders one slot per rack tile", () => {
    const rack: RackTile[] = [{ kind: "letter", letter: "A" }, { kind: "blank" }];
    render(<RackEditor rack={rack} onChange={() => {}} />);
    expect(screen.getAllByTestId(/^rack-slot-/)).toHaveLength(2);
  });

  it("updates a letter slot on change", () => {
    const onChange = vi.fn();
    const rack: RackTile[] = [{ kind: "letter", letter: "A" }];
    render(<RackEditor rack={rack} onChange={onChange} />);
    fireEvent.change(screen.getByTestId("rack-input-0"), { target: { value: "z" } });
    expect(onChange).toHaveBeenCalledWith([{ kind: "letter", letter: "Z" }]);
  });

  it("adds a blank tile (never an empty-string letter tile) when add-tile is clicked", () => {
    const onChange = vi.fn();
    const rack: RackTile[] = [{ kind: "letter", letter: "A" }];
    render(<RackEditor rack={rack} onChange={onChange} />);
    fireEvent.click(screen.getByTestId("add-tile"));
    expect(onChange).toHaveBeenCalledWith([{ kind: "letter", letter: "A" }, { kind: "blank" }]);
  });

  it("adds a blank tile when add-blank is clicked", () => {
    const onChange = vi.fn();
    const rack: RackTile[] = [{ kind: "letter", letter: "A" }];
    render(<RackEditor rack={rack} onChange={onChange} />);
    fireEvent.click(screen.getByTestId("add-blank"));
    expect(onChange).toHaveBeenCalledWith([{ kind: "letter", letter: "A" }, { kind: "blank" }]);
  });

  it("disables both add buttons at a max of 7 tiles", () => {
    const onChange = vi.fn();
    const rack: RackTile[] = Array(7).fill({ kind: "letter", letter: "A" });
    render(<RackEditor rack={rack} onChange={onChange} />);
    expect(screen.getByTestId("add-tile")).toBeDisabled();
    expect(screen.getByTestId("add-blank")).toBeDisabled();
  });

  it("clears the whole rack when clear-rack is clicked", () => {
    const onChange = vi.fn();
    const rack: RackTile[] = [{ kind: "letter", letter: "A" }, { kind: "blank" }];
    render(<RackEditor rack={rack} onChange={onChange} />);
    fireEvent.click(screen.getByTestId("clear-rack"));
    expect(onChange).toHaveBeenCalledWith([]);
  });

  it("removes a tile", () => {
    const onChange = vi.fn();
    const rack: RackTile[] = [{ kind: "letter", letter: "A" }, { kind: "letter", letter: "B" }];
    render(<RackEditor rack={rack} onChange={onChange} />);
    fireEvent.click(screen.getByTestId("remove-tile-0"));
    expect(onChange).toHaveBeenCalledWith([{ kind: "letter", letter: "B" }]);
  });

  it("shows the tile count out of the 7-tile cap", () => {
    const rack: RackTile[] = [{ kind: "letter", letter: "A" }, { kind: "blank" }];
    render(<RackEditor rack={rack} onChange={() => {}} />);
    expect(screen.getByText("2 / 7 TILES")).toBeInTheDocument();
  });
});
