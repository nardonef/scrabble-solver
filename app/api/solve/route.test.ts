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

  it("returns 400 with an error shape (not a thrown exception) for a malformed JSON body", async () => {
    const request = new Request("http://localhost/api/solve", {
      method: "POST",
      body: "{not valid json",
      headers: { "content-type": "application/json" },
    });

    const res = await POST(request as never);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(typeof body.error).toBe("string");
  });
});
