"use client";

import { RackTile } from "@/lib/types";

type Props = {
  rack: RackTile[];
  onChange: (rack: RackTile[]) => void;
};

const MAX_TILES = 7;
const MIN_TILES = 1;

export function RackEditor({ rack, onChange }: Props) {
  function setTile(index: number, tile: RackTile) {
    const next = [...rack];
    next[index] = tile;
    onChange(next);
  }

  function removeTile(index: number) {
    onChange(rack.filter((_, i) => i !== index));
  }

  function addTile() {
    onChange([...rack, { kind: "letter", letter: "" }]);
  }

  return (
    <div style={{ display: "flex", gap: "0.5rem" }} data-testid="rack-editor">
      {rack.map((tile, i) => (
        <div key={i} data-testid={`rack-slot-${i}`} style={{ display: "flex", flexDirection: "column" }}>
          <input
            data-testid={`rack-input-${i}`}
            maxLength={1}
            value={tile.kind === "letter" ? tile.letter : ""}
            placeholder="?"
            onChange={(e) => {
              const value = e.target.value.toUpperCase();
              setTile(i, value ? { kind: "letter", letter: value } : { kind: "blank" });
            }}
          />
          <label>
            <input
              type="checkbox"
              checked={tile.kind === "blank"}
              onChange={(e) => setTile(i, e.target.checked ? { kind: "blank" } : { kind: "letter", letter: "" })}
            />
            blank
          </label>
          {rack.length > MIN_TILES && (
            <button data-testid={`remove-tile-${i}`} onClick={() => removeTile(i)} type="button">
              remove
            </button>
          )}
        </div>
      ))}
      {rack.length < MAX_TILES && (
        <button data-testid="add-tile" onClick={addTile} type="button">
          add tile
        </button>
      )}
    </div>
  );
}
