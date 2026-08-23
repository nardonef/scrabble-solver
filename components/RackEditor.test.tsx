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

  it("adds a tile up to a max of 7", () => {
    const onChange = vi.fn();
    const rack: RackTile[] = Array(7).fill({ kind: "letter", letter: "A" });
    render(<RackEditor rack={rack} onChange={onChange} />);
    expect(screen.queryByTestId("add-tile")).not.toBeInTheDocument();
  });

  it("removes a tile", () => {
    const onChange = vi.fn();
    const rack: RackTile[] = [{ kind: "letter", letter: "A" }, { kind: "letter", letter: "B" }];
    render(<RackEditor rack={rack} onChange={onChange} />);
    fireEvent.click(screen.getByTestId("remove-tile-0"));
    expect(onChange).toHaveBeenCalledWith([{ kind: "letter", letter: "B" }]);
  });
});
