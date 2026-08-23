import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { RackEditor } from "./RackEditor";
import { RackTile } from "@/lib/types";

describe("RackEditor", () => {
  it("renders one input per rack tile", () => {
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

  it("hides the add-tile button at a max of 7 tiles", () => {
    const onChange = vi.fn();
    const rack: RackTile[] = Array(7).fill({ kind: "letter", letter: "A" });
    render(<RackEditor rack={rack} onChange={onChange} />);
    expect(screen.queryByTestId("add-tile")).not.toBeInTheDocument();
  });

  it("does not turn an unchecked blank tile into an empty-string letter tile", () => {
    const onChange = vi.fn();
    const rack: RackTile[] = [{ kind: "blank" }];
    render(<RackEditor rack={rack} onChange={onChange} />);
    const checkbox = screen.getByRole("checkbox");
    fireEvent.click(checkbox); // uncheck the blank checkbox
    expect(onChange).not.toHaveBeenCalledWith([{ kind: "letter", letter: "" }]);
  });

  it("removes a tile", () => {
    const onChange = vi.fn();
    const rack: RackTile[] = [{ kind: "letter", letter: "A" }, { kind: "letter", letter: "B" }];
    render(<RackEditor rack={rack} onChange={onChange} />);
    fireEvent.click(screen.getByTestId("remove-tile-0"));
    expect(onChange).toHaveBeenCalledWith([{ kind: "letter", letter: "B" }]);
  });
});
