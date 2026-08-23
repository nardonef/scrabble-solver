import type Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { ScanResult } from "./types";

const scanSchema = z.object({
  grid: z.array(z.array(z.union([z.string(), z.null()])).length(15)).length(15),
  rack: z.array(z.string()).min(0).max(7),
});

const TOOL_NAME = "report_board_state";

export async function scanBoardImage(
  imageBase64: string,
  mediaType: string,
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
            source: { type: "base64", media_type: mediaType as "image/jpeg", data: imageBase64 },
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

  const parsed = scanSchema.parse(toolUse.input);
  return toScanResult(parsed);
}

function toScanResult(parsed: z.infer<typeof scanSchema>): ScanResult {
  const board = parsed.grid.map((row) =>
    row.map((cell) => (cell === null ? null : { letter: cell.toUpperCase(), isBlank: false }))
  );
  const rack = parsed.rack.map((r) =>
    r.toUpperCase() === "BLANK"
      ? ({ kind: "blank" } as const)
      : ({ kind: "letter", letter: r.toUpperCase() } as const)
  );
  return { board, rack };
}
