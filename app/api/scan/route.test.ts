import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/vision", () => ({ scanBoardImage: vi.fn() }));
vi.mock("@anthropic-ai/sdk", () => ({
  default: vi.fn(function() {
    return {};
  }),
}));

import { scanBoardImage } from "@/lib/vision";
import { POST } from "./route";

function jsonRequest(body: unknown): Request {
  return new Request("http://localhost/api/scan", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
}

describe("POST /api/scan", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 400 when imageBase64 or mediaType is missing", async () => {
    const res = await POST(jsonRequest({}) as never);
    expect(res.status).toBe(400);
  });

  it("returns the scan result on success", async () => {
    const fakeResult = { board: [], rack: [] };
    vi.mocked(scanBoardImage).mockResolvedValue(fakeResult as never);

    const res = await POST(jsonRequest({ imageBase64: "abc", mediaType: "image/jpeg" }) as never);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual(fakeResult);
  });

  it("returns 502 with the error message when scanning fails", async () => {
    vi.mocked(scanBoardImage).mockRejectedValue(new Error("bad image"));

    const res = await POST(jsonRequest({ imageBase64: "abc", mediaType: "image/jpeg" }) as never);
    const body = await res.json();

    expect(res.status).toBe(502);
    expect(body.error).toBe("bad image");
  });

  it("returns 400 with an error shape (not a thrown exception) for a malformed JSON body", async () => {
    const request = new Request("http://localhost/api/scan", {
      method: "POST",
      body: "{not valid json",
      headers: { "content-type": "application/json" },
    });

    const res = await POST(request as never);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(typeof body.error).toBe("string");
  });

  it("returns 400 for an unsupported image media type", async () => {
    const res = await POST(jsonRequest({ imageBase64: "abc", mediaType: "image/heic" }) as never);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe("Unsupported image type — please use JPEG, PNG, GIF, or WebP");
    expect(scanBoardImage).not.toHaveBeenCalled();
  });
});
