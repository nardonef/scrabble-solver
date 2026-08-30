"use client";

import { RackTile } from "@/lib/types";
import { LETTER_VALUES } from "@/lib/scoring";

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
    onChange([...rack, { kind: "blank" }]);
  }

  function clearRack() {
    onChange([]);
  }

  const atCap = rack.length >= MAX_TILES;
  const emptySlots = Math.max(0, MAX_TILES - rack.length);

  return (
    <div data-testid="rack-editor">
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
          marginBottom: "10px",
        }}
      >
        <span style={{ fontFamily: "var(--font-sans)", fontWeight: 600, fontSize: "13px", color: "var(--ink)" }}>
          Your rack
        </span>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: "11px", color: "var(--ink-3)", letterSpacing: "0.1em" }}>
          {rack.length} / {MAX_TILES} TILES
        </span>
      </div>

      <div style={{ display: "flex", gap: "7px", marginBottom: "14px" }}>
        {rack.map((tile, i) => (
          <div
            key={i}
            data-testid={`rack-slot-${i}`}
            style={{
              width: 42,
              height: 47,
              position: "relative",
              borderRadius: "5px",
              background: tile.kind === "letter" ? "linear-gradient(var(--tile-face-1), var(--tile-face-2))" : "var(--surface)",
              boxShadow:
                tile.kind === "blank"
                  ? "inset 0 0 0 1.4px var(--accent)"
                  : "inset 0 1px 0 rgba(255,255,255,.85), inset 0 -1px 0 rgba(120,95,50,.22)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {tile.kind === "blank" && (
              <span
                style={{
                  fontFamily: "var(--font-mono)",
                  fontWeight: 600,
                  fontSize: "8px",
                  color: "var(--accent)",
                  pointerEvents: "none",
                }}
              >
                BLANK
              </span>
            )}
            <input
              data-testid={`rack-input-${i}`}
              maxLength={1}
              value={tile.kind === "letter" ? tile.letter : ""}
              onChange={(e) => {
                const value = e.target.value.toUpperCase();
                setTile(i, value ? { kind: "letter", letter: value } : { kind: "blank" });
              }}
              style={{
                position: "absolute",
                inset: 0,
                width: "100%",
                height: "100%",
                textAlign: "center",
                border: "none",
                background: "transparent",
                fontFamily: "var(--font-sans)",
                fontWeight: 700,
                fontSize: "18px",
                color: "var(--tile-letter)",
                opacity: tile.kind === "blank" ? 0 : 1,
              }}
            />
            {tile.kind === "letter" && (
              <span
                style={{
                  position: "absolute",
                  bottom: "2px",
                  right: "4px",
                  fontFamily: "var(--font-mono)",
                  fontWeight: 600,
                  fontSize: "8px",
                  opacity: 0.7,
                  color: "var(--tile-letter)",
                  pointerEvents: "none",
                }}
              >
                {LETTER_VALUES[tile.letter] ?? 0}
              </span>
            )}
            {rack.length > MIN_TILES && (
              <button
                type="button"
                data-testid={`remove-tile-${i}`}
                onClick={() => removeTile(i)}
                aria-label={`remove tile ${i + 1}`}
                style={{
                  position: "absolute",
                  top: -6,
                  right: -6,
                  width: 16,
                  height: 16,
                  borderRadius: "50%",
                  border: "none",
                  background: "var(--ink-3)",
                  color: "white",
                  fontSize: "10px",
                  lineHeight: 1,
                  cursor: "pointer",
                }}
              >
                ×
              </button>
            )}
          </div>
        ))}
        {Array.from({ length: emptySlots }).map((_, i) => (
          <div
            key={`empty-${i}`}
            aria-hidden
            style={{
              width: 42,
              height: 47,
              borderRadius: "5px",
              border: "1.5px dashed #c3ccd6",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#c3ccd6",
              fontSize: "21px",
            }}
          >
            +
          </div>
        ))}
      </div>

      <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
        <button
          type="button"
          data-testid="add-tile"
          onClick={addTile}
          disabled={atCap}
          style={{
            height: 38,
            borderRadius: "10px",
            border: "1px solid var(--line)",
            background: "var(--surface)",
            padding: "0 12px",
            fontFamily: "var(--font-sans)",
            fontWeight: 500,
            fontSize: "14px",
            color: atCap ? "var(--ink-4)" : "var(--ink)",
            cursor: atCap ? "default" : "pointer",
          }}
        >
          Add tile
        </button>
        <button
          type="button"
          data-testid="add-blank"
          onClick={addTile}
          disabled={atCap}
          style={{
            height: 38,
            borderRadius: "10px",
            border: "1px solid var(--line)",
            background: "var(--surface)",
            padding: "0 12px",
            fontFamily: "var(--font-sans)",
            fontWeight: 500,
            fontSize: "14px",
            color: atCap ? "var(--ink-4)" : "var(--ink)",
            cursor: atCap ? "default" : "pointer",
          }}
        >
          Add blank
        </button>
        <button
          type="button"
          data-testid="clear-rack"
          onClick={clearRack}
          style={{
            border: "none",
            background: "transparent",
            fontFamily: "var(--font-sans)",
            fontWeight: 500,
            fontSize: "14px",
            color: "var(--ink-3)",
            cursor: "pointer",
          }}
        >
          Clear rack
        </button>
      </div>
    </div>
  );
}
