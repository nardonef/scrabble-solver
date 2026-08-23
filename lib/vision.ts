import type Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { ScanResult } from "./types";

export type SupportedImageMediaType = "image/jpeg" | "image/png" | "image/gif" | "image/webp";

const SCAN_FAILURE_MESSAGE =
  "Couldn't read the board from that photo — try again with better lighting or a clearer angle.";

// A grid cell is only ever a single A-Z letter or empty. Anything else a model
// might plausibly return for an empty square ("", ".", multi-character strings,
// punctuation) is normalized to null rather than passed through as a "letter" —
// otherwise isBoardEmpty/isAnchor silently break and every cell desyncs word
// length from board position.
const gridCellSchema = z.union([z.string(), z.null()]).transform((cell) => {
  if (cell === null) return null;
  return /^[A-Za-z]$/.test(cell) ? cell.toUpperCase() : null;
});

// A rack entry is only ever a single A-Z letter or the literal "BLANK". Any
// other string is normalized to null and dropped in toScanResult rather than
// reaching the solver as a malformed tile.
const rackEntrySchema = z.string().transform((entry) => {
  const upper = entry.toUpperCase();
  if (upper === "BLANK") return "BLANK" as const;
  return /^[A-Z]$/.test(upper) ? upper : null;
});

const scanSchema = z.object({
  grid: z.array(z.array(gridCellSchema).length(15)).length(15),
  rack: z.array(rackEntrySchema).min(0).max(7),
});

const TOOL_NAME = "report_board_state";

export async function scanBoardImage(
  imageBase64: string,
  mediaType: SupportedImageMediaType,
  client: Anthropic
): Promise<ScanResult> {
  const response = await client.messages.create({
    model: "claude-sonnet-5",
    max_tokens: 2048,
    tools: [
      {
        name: TOOL_NAME,
        description: "Report the detected Scrabble board grid and rack letters.",
        input_schema: {
          type: "object",
          properties: {
            grid: {
              type: "array",
              items: { type: "array", items: { type: ["string", "null"] } },
            },
            rack: { type: "array", items: { type: "string" } },
          },
          required: ["grid", "rack"],
        },
      },
    ],
    tool_choice: { type: "tool", name: TOOL_NAME },
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image",
            source: { type: "base64", media_type: mediaType, data: imageBase64 },
          },
          {
            type: "text",
            text:
              "Report the exact 15x15 Scrabble board grid (row-major, each cell an " +
              "uppercase letter or null for empty) and the player's rack tiles " +
              '(uppercase letters, or "BLANK" for an unplayed blank tile) using the ' +
              "report_board_state tool. Do not guess bonus-square colors; only report letters.",
          },
        ],
      },
    ],
  });

  const toolUse = response.content.find(
    (block: { type: string }): block is Anthropic.ToolUseBlock => block.type === "tool_use"
  );
  if (!toolUse) {
    throw new Error("Vision response did not include board data");
  }

  let parsed: z.infer<typeof scanSchema>;
  try {
    parsed = scanSchema.parse(toolUse.input);
  } catch {
    throw new Error(SCAN_FAILURE_MESSAGE);
  }
  return toScanResult(parsed);
}

function toScanResult(parsed: z.infer<typeof scanSchema>): ScanResult {
  const board = parsed.grid.map((row) =>
    row.map((cell) => (cell === null ? null : { letter: cell, isBlank: false }))
  );
  const rack = parsed.rack
    .filter((r): r is "BLANK" | string => r !== null)
    .map((r) => (r === "BLANK" ? ({ kind: "blank" } as const) : ({ kind: "letter", letter: r } as const)));
  return { board, rack };
}
