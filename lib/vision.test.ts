import { describe, it, expect, vi } from "vitest";
import { scanBoardImage } from "./vision";
import type Anthropic from "@anthropic-ai/sdk";

function fakeClient(toolInput: unknown): Anthropic {
  return {
    messages: {
      create: vi.fn().mockResolvedValue({
        content: [{ type: "tool_use", id: "t1", name: "report_board_state", input: toolInput }],
      }),
    },
  } as unknown as Anthropic;
}

describe("scanBoardImage", () => {
  it("parses a valid tool_use response into a ScanResult", async () => {
    const grid = Array.from({ length: 15 }, () => Array(15).fill(null));
    grid[7][7] = "c";
    const client = fakeClient({ grid, rack: ["a", "BLANK"] });

    const result = await scanBoardImage("base64data", "image/jpeg", client);

    expect(result.board[7][7]).toEqual({ letter: "C", isBlank: false });
    expect(result.rack).toEqual([{ kind: "letter", letter: "A" }, { kind: "blank" }]);
  });

  it("throws when the response has no tool_use block", async () => {
    const client = {
      messages: { create: vi.fn().mockResolvedValue({ content: [{ type: "text", text: "oops" }] }) },
    } as unknown as Anthropic;

    await expect(scanBoardImage("base64data", "image/jpeg", client)).rejects.toThrow(
      "Vision response did not include board data"
    );
  });

  it("throws a human-readable error (not the raw Zod error) when the tool input fails schema validation", async () => {
    const client = fakeClient({ grid: "not-a-grid", rack: [] });
    await expect(scanBoardImage("base64data", "image/jpeg", client)).rejects.toThrow(
      "Couldn't read the board from that photo — try again with better lighting or a clearer angle."
    );
  });

  it("normalizes an empty-string grid cell to null instead of an empty letter", async () => {
    const grid = Array.from({ length: 15 }, () => Array(15).fill(null));
    grid[3][3] = "";
    grid[4][4] = "Qu"; // a multi-character cell is similarly not a real letter
    const client = fakeClient({ grid, rack: [] });

    const result = await scanBoardImage("base64data", "image/jpeg", client);

    expect(result.board[3][3]).toBeNull();
    expect(result.board[4][4]).toBeNull();
  });
});
