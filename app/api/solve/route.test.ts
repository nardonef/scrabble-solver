import { describe, it, expect } from "vitest";
import { POST } from "./route";

function emptyBoard() {
  return Array.from({ length: 15 }, () => Array(15).fill(null));
}

describe("POST /api/solve", () => {
  it("returns ranked plays for a given board and rack", async () => {
    const body = {
      board: emptyBoard(),
      rack: [
        { kind: "letter", letter: "C" },
        { kind: "letter", letter: "A" },
        { kind: "letter", letter: "T" },
      ],
    };
    const request = new Request("http://localhost/api/solve", {
      method: "POST",
      body: JSON.stringify(body),
      headers: { "content-type": "application/json" },
    });

    const res = await POST(request as never);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(Array.isArray(json.plays)).toBe(true);
    expect(json.plays.length).toBeGreaterThan(0);
  });
});
