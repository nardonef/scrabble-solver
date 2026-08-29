"use client";

import { useState } from "react";
import { BoardGrid } from "@/components/BoardGrid";
import { RackEditor } from "@/components/RackEditor";
import { Board, Play, RackTile } from "@/lib/types";

type Stage = "capture" | "scanning" | "review" | "solving" | "results" | "error";
type ErrorKind = "scan" | "no-plays" | "generic";

function emptyBoard(): Board {
  return Array.from({ length: 15 }, () => Array(15).fill(null));
}

export default function Home() {
  const [stage, setStage] = useState<Stage>("capture");
  const [board, setBoard] = useState<Board | null>(null);
  const [rack, setRack] = useState<RackTile[]>([]);
  const [plays, setPlays] = useState<Play[]>([]);
  const [error, setError] = useState<string>("");
  const [errorKind, setErrorKind] = useState<ErrorKind>("generic");

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
      setErrorKind("scan");
      setStage("error");
    }
  }

  async function handleSolve() {
    if (!board) return;
    setStage("solving");
    try {
      const res = await fetch("/api/solve", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ board, rack }),
      });
      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error ?? "Failed to solve board");
      }
      const body = await res.json();
      if (body.plays.length === 0) {
        setPlays([]);
        setErrorKind("no-plays");
        setStage("error");
        return;
      }
      setPlays(body.plays);
      setStage("results");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to solve board");
      setErrorKind("generic");
      setStage("error");
    }
  }

  function reset() {
    setStage("capture");
    setBoard(null);
    setRack([]);
    setPlays([]);
    setError("");
  }

  function enterManualEntry() {
    setBoard(emptyBoard());
    setRack([{ kind: "blank" }]);
    setStage("review");
  }

  return (
    <main style={{ minHeight: "100vh" }}>
      {stage === "capture" && <CaptureStage onFileChange={handleFileChange} />}

      {stage === "scanning" && <ScanningStage />}

      {stage === "review" && board && (
        <ReviewStage
          board={board}
          rack={rack}
          onBoardChange={(r, c, cell) => {
            const next = board.map((row) => [...row]);
            next[r][c] = cell;
            setBoard(next);
          }}
          onRackChange={setRack}
          onSolve={handleSolve}
        />
      )}

      {stage === "solving" && board && <SolvingStage board={board} />}

      {stage === "results" && board && plays[0] && (
        <ResultsStage board={board} plays={plays} onReset={reset} />
      )}

      {stage === "error" && (
        <ErrorStage
          kind={errorKind}
          message={error}
          onRetakePhoto={reset}
          onManualEntry={enterManualEntry}
          onFixBoard={() => setStage("review")}
          onNewPhoto={reset}
        />
      )}
    </main>
  );
}

function CaptureStage({ onFileChange }: { onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void }) {
  return (
    <div
      style={{
        minHeight: "100vh",
        background: "radial-gradient(115% 85% at 50% 38%, #26313f, #141a22 55%, #0d1117)",
        color: "white",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        padding: "20px",
        position: "relative",
      }}
    >
      <div
        style={{
          alignSelf: "center",
          marginTop: "8px",
          padding: "6px 14px",
          borderRadius: "22px",
          background: "rgba(13,17,23,.62)",
          border: "1px solid rgba(255,255,255,.14)",
          display: "flex",
          alignItems: "center",
          gap: "8px",
          fontFamily: "var(--font-sans)",
          fontSize: "13px",
        }}
      >
        <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#5ee0a0", display: "inline-block" }} />
        Even light · avoid glare
      </div>

      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "18px" }}>
        <div style={{ position: "relative", width: 302, height: 302 }}>
          {(["nw", "ne", "sw", "se"] as const).map((corner) => (
            <span
              key={corner}
              style={{
                position: "absolute",
                width: 44,
                height: 44,
                border: "3px solid #fff",
                borderRadius: "10px",
                top: corner.startsWith("n") ? 0 : undefined,
                bottom: corner.startsWith("s") ? 0 : undefined,
                left: corner.endsWith("w") ? 0 : undefined,
                right: corner.endsWith("e") ? 0 : undefined,
                borderRight: corner.endsWith("w") ? "none" : undefined,
                borderLeft: corner.endsWith("e") ? "none" : undefined,
                borderBottom: corner.startsWith("n") ? "none" : undefined,
                borderTop: corner.startsWith("s") ? "none" : undefined,
              }}
            />
          ))}
          <span
            style={{
              position: "absolute",
              top: "50%",
              left: "50%",
              transform: "translate(-50%,-50%)",
              textAlign: "center",
              color: "rgba(255,255,255,.5)",
              fontFamily: "var(--font-sans)",
              fontSize: "13px",
            }}
          >
            whole board
            <br />
            inside the frame
          </span>
        </div>

        <div
          style={{
            width: 302,
            height: 56,
            border: "2px dashed rgba(255,255,255,.42)",
            borderRadius: "12px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontFamily: "var(--font-mono)",
            fontSize: "11px",
            letterSpacing: "0.1em",
            color: "rgba(255,255,255,.6)",
          }}
        >
          YOUR RACK HERE
        </div>
      </div>

      <div style={{ width: "100%", maxWidth: 420, textAlign: "center", paddingBottom: "24px" }}>
        <p style={{ fontFamily: "var(--font-sans)", fontSize: "13px", color: "rgba(255,255,255,.7)" }}>
          One photo, both things: all 15 rows and your 7 tiles.
        </p>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <label
            htmlFor="camera-input"
            style={{ fontFamily: "var(--font-sans)", fontWeight: 500, fontSize: "14px", color: "white", cursor: "pointer" }}
          >
            Upload
          </label>
          <label
            htmlFor="camera-input"
            style={{
              width: 76,
              height: 76,
              borderRadius: "50%",
              border: "3px solid white",
              background: "rgba(255,255,255,.14)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
            }}
          >
            <span style={{ width: 58, height: 58, borderRadius: "50%", background: "white", display: "block" }} />
          </label>
          <span style={{ fontFamily: "var(--font-sans)", fontWeight: 500, fontSize: "14px", color: "rgba(255,255,255,.7)" }}>
            Tips
          </span>
        </div>
      </div>

      <input
        data-testid="camera-input"
        id="camera-input"
        type="file"
        accept="image/*"
        capture="environment"
        onChange={onFileChange}
        style={{ position: "absolute", width: 1, height: 1, opacity: 0 }}
      />
    </div>
  );
}

function ScanningStage() {
  return (
    <div style={{ minHeight: "100vh", background: "#0d1117", color: "white", display: "flex", flexDirection: "column" }}>
      <div style={{ flex: 1, position: "relative", overflow: "hidden" }}>
        <div
          style={{
            position: "absolute",
            top: 70,
            left: 34,
            right: 34,
            height: 322,
            borderRadius: "10px",
            background: "linear-gradient(150deg,#3a4759,#232d3b)",
            boxShadow: "0 8px 30px rgba(0,0,0,.45)",
            transform: "perspective(600px) rotateX(6deg)",
          }}
        />
      </div>
      <div
        style={{
          background: "var(--surface)",
          color: "var(--ink)",
          borderRadius: "24px 24px 0 0",
          padding: "22px 24px 30px",
        }}
      >
        <h1 style={{ fontFamily: "var(--font-sans)", fontWeight: 600, fontSize: "17px", margin: 0 }}>
          Reading your photo
        </h1>
        <p style={{ fontFamily: "var(--font-sans)", fontSize: "14px", color: "var(--ink-2)" }}>
          Usually about five seconds.
        </p>
        <ChecklistRow label="Photo received" status="done" />
        <ChecklistRow label="Reading board tiles" status="active" />
        <ChecklistRow label="Reading your rack" status="pending" />
        <div style={{ height: 3, background: "#e6eaef", borderRadius: 2, marginTop: "18px", overflow: "hidden" }}>
          <div style={{ width: "40%", height: "100%", background: "var(--accent)" }} />
        </div>
      </div>
    </div>
  );
}

function ChecklistRow({ label, status }: { label: string; status: "done" | "active" | "pending" }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "10px", padding: "6px 0" }}>
      <span
        style={{
          width: 20,
          height: 20,
          borderRadius: "50%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: status === "done" ? "var(--accent)" : "transparent",
          boxShadow: status === "pending" ? "inset 0 0 0 2px #d4dae1" : status === "active" ? "inset 0 0 0 2px var(--accent)" : undefined,
          color: "white",
          fontSize: "11px",
        }}
      >
        {status === "done" ? "✓" : null}
      </span>
      <span style={{ fontFamily: "var(--font-sans)", fontSize: "14px", color: status === "pending" ? "var(--ink-3)" : "var(--ink)" }}>
        {label}
      </span>
    </div>
  );
}

function ReviewStage({
  board,
  rack,
  onBoardChange,
  onRackChange,
  onSolve,
}: {
  board: Board;
  rack: RackTile[];
  onBoardChange: (row: number, col: number, cell: Board[number][number]) => void;
  onRackChange: (rack: RackTile[]) => void;
  onSolve: () => void;
}) {
  const tilesRead = board.flat().filter(Boolean).length;
  const blanks = board.flat().filter((c) => c?.isBlank).length;

  return (
    <div style={{ padding: "20px", paddingBottom: "110px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "16px" }}>
        <div>
          <h1 style={{ fontFamily: "var(--font-sans)", fontWeight: 600, fontSize: "21px", margin: 0, letterSpacing: "-.02em" }}>
            Check the board
          </h1>
          <p style={{ fontFamily: "var(--font-sans)", fontSize: "14px", color: "var(--ink-2)", margin: "2px 0 0" }}>
            Tap a square to fix a letter.
          </p>
        </div>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: "10px", color: "var(--ink-3)" }}>STEP 2/3</span>
      </div>

      <BoardGrid board={board} editable onCellChange={onBoardChange} />

      <div style={{ marginTop: "26px" }}>
        <RackEditor rack={rack} onChange={onRackChange} />
      </div>

      <div
        style={{
          position: "fixed",
          bottom: 0,
          left: 0,
          right: 0,
          background: "var(--surface)",
          borderTop: `1px solid var(--line)`,
          padding: "14px 20px",
        }}
      >
        <button
          onClick={onSolve}
          disabled={rack.length === 0}
          style={{
            width: "100%",
            height: 54,
            borderRadius: "13px",
            border: "none",
            background: "var(--accent)",
            color: "white",
            fontFamily: "var(--font-sans)",
            fontWeight: 600,
            fontSize: "15.5px",
            boxShadow: rack.length === 0 ? "none" : "0 4px 14px rgba(30,95,212,.28)",
            opacity: rack.length === 0 ? 0.6 : 1,
            cursor: rack.length === 0 ? "default" : "pointer",
          }}
        >
          Find best play
        </button>
        <p style={{ textAlign: "center", fontFamily: "var(--font-sans)", fontSize: "11.5px", color: "var(--ink-3)", marginBottom: 0 }}>
          {tilesRead} tile{tilesRead === 1 ? "" : "s"} read from your photo
          {blanks > 0 ? ` · ${blanks} blank${blanks > 1 ? "s" : ""}` : ""}
        </p>
      </div>
    </div>
  );
}

function SolvingStage({ board }: { board: Board }) {
  return (
    <div style={{ position: "relative", padding: "32px 20px" }}>
      <div style={{ opacity: 0.4, filter: "saturate(.5)" }}>
        <BoardGrid board={board} />
      </div>
      <div
        style={{
          position: "fixed",
          top: "50%",
          left: "50%",
          transform: "translate(-50%,-50%)",
          width: 268,
          background: "var(--surface)",
          borderRadius: "18px",
          boxShadow: "0 12px 34px rgba(18,22,28,.16)",
          padding: "24px",
          textAlign: "center",
        }}
      >
        <div style={{ display: "flex", justifyContent: "center", gap: "6px", marginBottom: "14px" }}>
          {[0, 1, 2].map((i) => (
            <span key={i} style={{ width: 9, height: 9, borderRadius: "50%", background: "var(--accent)" }} />
          ))}
        </div>
        <h2 style={{ fontFamily: "var(--font-sans)", fontWeight: 600, fontSize: "17px", margin: "0 0 4px" }}>
          Finding your best play
        </h2>
        <p style={{ fontFamily: "var(--font-sans)", fontSize: "13px", color: "var(--ink-2)", margin: 0 }}>
          Checking every legal position on the board.
        </p>
      </div>
    </div>
  );
}

function coordLabel(row: number, col: number): string {
  return `${String.fromCharCode(65 + col)}${row + 1}`;
}

function highlightedCells(play: Play): { row: number; col: number }[] {
  return Array.from({ length: play.word.length }, (_, i) =>
    play.direction === "across"
      ? { row: play.row, col: play.col + i }
      : { row: play.row + i, col: play.col }
  );
}

function boardWithPlay(board: Board, play: Play): Board {
  const next = board.map((row) => [...row]);
  highlightedCells(play).forEach(({ row, col }, i) => {
    next[row][col] = { letter: play.word[i], isBlank: false };
  });
  return next;
}

function ResultsStage({ board, plays, onReset }: { board: Board; plays: Play[]; onReset: () => void }) {
  const best = plays[0];
  const cells = highlightedCells(best);
  const winningCells = cells.map(({ row, col }) => ({ row, col, isNew: !board[row][col] }));
  const existingLetters = cells
    .filter(({ row, col }) => board[row][col])
    .map(({ row, col }) => board[row][col]!.letter);
  const start = coordLabel(best.row, best.col);
  const end = coordLabel(cells[cells.length - 1].row, cells[cells.length - 1].col);
  const direction = best.direction === "across" ? "Across" : "Down";

  return (
    <div style={{ padding: "20px" }}>
      <div
        style={{
          background: "var(--surface)",
          borderRadius: "16px",
          border: "1px solid rgba(30,95,212,.18)",
          padding: "18px",
          marginBottom: "18px",
        }}
      >
        <span style={{ fontFamily: "var(--font-mono)", fontWeight: 600, fontSize: "10px", letterSpacing: "0.1em", color: "var(--ink-3)" }}>
          BEST PLAY
        </span>
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginTop: "8px" }}>
          <div style={{ display: "flex", gap: "4px" }}>
            {best.word.split("").map((letter, i) => {
              const isNew = winningCells[i].isNew;
              return (
                <div
                  key={i}
                  style={{
                    width: 34,
                    height: 38,
                    borderRadius: "4px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    background: isNew ? "var(--accent)" : "linear-gradient(var(--tile-face-1), var(--tile-face-2))",
                    color: isNew ? "white" : "var(--tile-letter)",
                    fontFamily: "var(--font-sans)",
                    fontWeight: 700,
                    fontSize: "18px",
                  }}
                >
                  {letter}
                </div>
              );
            })}
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontFamily: "var(--font-mono)", fontWeight: 600, fontSize: "40px", letterSpacing: "-.03em", lineHeight: 1 }}>
              {best.score}
            </div>
            <div style={{ fontFamily: "var(--font-sans)", fontSize: "12px", color: "var(--ink-3)" }}>points</div>
          </div>
        </div>
        <div style={{ display: "flex", gap: "8px", marginTop: "14px", flexWrap: "wrap" }}>
          <Chip>{start} → {end}</Chip>
          <Chip>{direction}</Chip>
          {existingLetters.length > 0 && <Chip neutral>{existingLetters.join(", ")} already on board</Chip>}
        </div>
      </div>

      <BoardGrid board={boardWithPlay(board, best)} winningCells={winningCells} />

      <div style={{ marginTop: "22px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "10px" }}>
          <span style={{ fontFamily: "var(--font-sans)", fontWeight: 600, fontSize: "13px" }}>Other plays</span>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: "10.5px", color: "var(--ink-3)" }}>
            {plays.length} FOUND
          </span>
        </div>
        <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: "1px" }}>
          {plays.map((p, i) => (
            <li
              key={i}
              style={{
                background: "var(--surface)",
                borderRadius: "11px",
                padding: "10px 14px",
                display: "flex",
                alignItems: "center",
                gap: "10px",
              }}
            >
              <span style={{ fontFamily: "var(--font-mono)", color: "var(--ink-4)", width: "18px" }}>{i + 1}</span>
              <div style={{ flex: 1 }}>
                <strong style={{ fontFamily: "var(--font-sans)", fontWeight: 600, fontSize: "15px" }}>{p.word}</strong>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: "11.5px", color: "var(--ink-3)" }}>
                  {coordLabel(p.row, p.col)} · {p.direction === "across" ? "Across" : "Down"}
                </div>
              </div>
              <span style={{ fontFamily: "var(--font-mono)", fontWeight: 600, fontSize: "16px" }}>{p.score}</span>
            </li>
          ))}
        </ul>
      </div>

      <button
        onClick={onReset}
        style={{
          width: "100%",
          height: 52,
          marginTop: "20px",
          borderRadius: "13px",
          border: "1px solid var(--line)",
          background: "var(--surface)",
          fontFamily: "var(--font-sans)",
          fontWeight: 500,
          fontSize: "15px",
          cursor: "pointer",
        }}
      >
        Scan again
      </button>
    </div>
  );
}

function Chip({ children, neutral = false }: { children: React.ReactNode; neutral?: boolean }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "4px 10px",
        borderRadius: "8px",
        fontFamily: "var(--font-sans)",
        fontSize: "13px",
        background: neutral ? "#f1f4f7" : "var(--accent-wash)",
        color: neutral ? "var(--ink-2)" : "var(--accent-text)",
      }}
    >
      {children}
    </span>
  );
}

function ErrorStage({
  kind,
  message,
  onRetakePhoto,
  onManualEntry,
  onFixBoard,
  onNewPhoto,
}: {
  kind: ErrorKind;
  message: string;
  onRetakePhoto: () => void;
  onManualEntry: () => void;
  onFixBoard: () => void;
  onNewPhoto: () => void;
}) {
  const copy =
    kind === "scan"
      ? {
          title: "We couldn't read that board",
          body: "The photo may be blurry, angled, or missing part of the board. One more try usually does it.",
        }
      : kind === "no-plays"
      ? {
          title: "No legal plays with that rack",
          body: "None of your rack tiles produce a legal play on this board. Double-check the board and rack, then try again.",
        }
      : {
          title: "Something went wrong",
          body: message,
        };

  return (
    <div style={{ padding: "20px", minHeight: "100vh", display: "flex", flexDirection: "column", justifyContent: "center" }}>
      <div
        style={{
          width: 52,
          height: 52,
          borderRadius: "14px",
          border: "1px solid var(--line-soft)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          marginBottom: "18px",
        }}
      >
        <span style={{ fontSize: "24px", color: "var(--danger)" }}>!</span>
      </div>
      <h1 style={{ fontFamily: "var(--font-sans)", fontWeight: 600, fontSize: "24px", margin: "0 0 8px", letterSpacing: "-.02em" }}>
        {copy.title}
      </h1>
      <p style={{ fontFamily: "var(--font-sans)", fontSize: "14px", color: "var(--ink-2)", marginBottom: "20px" }}>{copy.body}</p>

      {kind === "scan" && (
        <div style={{ background: "var(--surface)", borderRadius: "14px", padding: "16px", marginBottom: "26px" }}>
          <span style={{ fontFamily: "var(--font-mono)", fontWeight: 600, fontSize: "10px", letterSpacing: "0.1em", color: "var(--ink-3)" }}>
            FOR A CLEAN READ
          </span>
          <ul style={{ listStyle: "none", padding: 0, margin: "10px 0 0" }}>
            {["All 15 rows inside the frame", "Rack in the same shot, letters up", "Straight overhead, no glare"].map((tip) => (
              <li key={tip} style={{ display: "flex", alignItems: "center", gap: "8px", fontFamily: "var(--font-sans)", fontSize: "13.5px", padding: "3px 0" }}>
                <span style={{ width: 5, height: 5, borderRadius: "50%", background: "var(--accent)", display: "inline-block" }} />
                {tip}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
        {kind === "scan" && (
          <>
            <PrimaryButton onClick={onRetakePhoto}>Retake photo</PrimaryButton>
            <SecondaryButton onClick={onManualEntry}>Enter the board by hand</SecondaryButton>
          </>
        )}
        {kind === "no-plays" && (
          <>
            <PrimaryButton onClick={onFixBoard}>Fix the board</PrimaryButton>
            <SecondaryButton onClick={onNewPhoto}>New photo</SecondaryButton>
          </>
        )}
        {kind === "generic" && <SecondaryButton onClick={onNewPhoto}>Try again</SecondaryButton>}
      </div>
    </div>
  );
}

function PrimaryButton({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        height: 54,
        borderRadius: "13px",
        border: "none",
        background: "var(--accent)",
        color: "white",
        fontFamily: "var(--font-sans)",
        fontWeight: 600,
        fontSize: "15.5px",
        boxShadow: "0 4px 14px rgba(30,95,212,.28)",
        cursor: "pointer",
      }}
    >
      {children}
    </button>
  );
}

function SecondaryButton({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        height: 52,
        borderRadius: "13px",
        border: "1px solid var(--line)",
        background: "var(--surface)",
        color: "var(--ink)",
        fontFamily: "var(--font-sans)",
        fontWeight: 500,
        fontSize: "15px",
        cursor: "pointer",
      }}
    >
      {children}
    </button>
  );
}
