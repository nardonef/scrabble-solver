"use client";

import { useState } from "react";
import { BoardGrid } from "@/components/BoardGrid";
import { RackEditor } from "@/components/RackEditor";
import { Board, Play, RackTile } from "@/lib/types";

type Stage = "capture" | "scanning" | "review" | "solving" | "results" | "error";

export default function Home() {
  const [stage, setStage] = useState<Stage>("capture");
  const [board, setBoard] = useState<Board | null>(null);
  const [rack, setRack] = useState<RackTile[]>([]);
  const [plays, setPlays] = useState<Play[]>([]);
  const [error, setError] = useState<string>("");

  function readFileAsDataUrl(file: File): Promise<string> {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.readAsDataURL(file);
    });
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setStage("scanning");
    try {
      const dataUrl = await readFileAsDataUrl(file);
      const [, base64] = dataUrl.split(",");
      const res = await fetch("/api/scan", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ imageBase64: base64, mediaType: file.type }),
      });
      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error ?? "Failed to scan image");
      }
      const result = await res.json();
      setBoard(result.board);
      setRack(result.rack);
      setStage("review");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to scan image");
      setStage("error");
    }
  }

  async function handleSolve() {
    if (!board) return;
    setStage("solving");
    const res = await fetch("/api/solve", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ board, rack }),
    });
    const body = await res.json();
    setPlays(body.plays);
    setStage("results");
  }

  function reset() {
    setStage("capture");
    setBoard(null);
    setRack([]);
    setPlays([]);
    setError("");
  }

  return (
    <main>
      <h1>Scrabble Solver</h1>

      {stage === "capture" && (
        <input
          data-testid="camera-input"
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handleFileChange}
        />
      )}

      {stage === "scanning" && <p>Scanning photo...</p>}

      {stage === "review" && board && (
        <div>
          <BoardGrid board={board} editable onCellChange={(r, c, cell) => {
            const next = board.map((row) => [...row]);
            next[r][c] = cell;
            setBoard(next);
          }} />
          <RackEditor rack={rack} onChange={setRack} />
          <button onClick={handleSolve}>Find best play</button>
        </div>
      )}

      {stage === "solving" && <p>Solving...</p>}

      {stage === "results" && board && (
        <div>
          <BoardGrid
            board={board}
            highlighted={plays[0] ? highlightedCells(plays[0]) : []}
          />
          {plays.length === 0 ? (
            <p>No valid plays found.</p>
          ) : (
            <ul>
              {plays.map((p, i) => (
                <li key={i}>
                  <strong>{p.word}</strong> — score: {p.score}
                </li>
              ))}
            </ul>
          )}
          <button onClick={reset}>Scan again</button>
        </div>
      )}

      {stage === "error" && (
        <div>
          <p>{error}</p>
          <button onClick={reset}>Try again</button>
        </div>
      )}
    </main>
  );
}

function highlightedCells(play: Play): { row: number; col: number }[] {
  return Array.from({ length: play.word.length }, (_, i) =>
    play.direction === "across"
      ? { row: play.row, col: play.col + i }
      : { row: play.row + i, col: play.col }
  );
}
