import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import Home from "./page";

function makeFile(): File {
  return new File(["fake-image-bytes"], "board.jpg", { type: "image/jpeg" });
}

describe("Home page", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn((url: string) => {
        if (url === "/api/scan") {
          return Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve({
                board: Array.from({ length: 15 }, () => Array(15).fill(null)),
                rack: [{ kind: "letter", letter: "A" }, { kind: "letter", letter: "B" }],
              }),
          });
        }
        if (url === "/api/solve") {
          return Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve({
                plays: [{ word: "AB", row: 7, col: 7, direction: "across", score: 4 }],
              }),
          });
        }
        return Promise.reject(new Error(`unexpected fetch to ${url}`));
      })
    );
    vi.stubGlobal("FileReader", class {
      onload: (() => void) | null = null;
      result: string = "data:image/jpeg;base64,ZmFrZQ==";
      readAsDataURL() {
        this.onload?.();
      }
    });
  });

  it("goes from capture through review to results", async () => {
    render(<Home />);

    const input = screen.getByTestId("camera-input");
    fireEvent.change(input, { target: { files: [makeFile()] } });

    await waitFor(() => expect(screen.getByTestId("rack-editor")).toBeInTheDocument());

    fireEvent.click(screen.getByText("Find best play"));

    await waitFor(() => expect(screen.getByText("AB")).toBeInTheDocument());
    expect(screen.getByText(/score: 4/i)).toBeInTheDocument();
    expect(screen.getByText(/row 8, col 8, across/i)).toBeInTheDocument();
  });

  it("routes to the error stage with a retry button when /api/solve fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn((url: string) => {
        if (url === "/api/scan") {
          return Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve({
                board: Array.from({ length: 15 }, () => Array(15).fill(null)),
                rack: [{ kind: "letter", letter: "A" }, { kind: "letter", letter: "B" }],
              }),
          });
        }
        if (url === "/api/solve") {
          return Promise.reject(new Error("network error"));
        }
        return Promise.reject(new Error(`unexpected fetch to ${url}`));
      })
    );

    render(<Home />);

    const input = screen.getByTestId("camera-input");
    fireEvent.change(input, { target: { files: [makeFile()] } });

    await waitFor(() => expect(screen.getByTestId("rack-editor")).toBeInTheDocument());

    fireEvent.click(screen.getByText("Find best play"));

    await waitFor(() => expect(screen.getByText("network error")).toBeInTheDocument());
    expect(screen.getByText("Try again")).toBeInTheDocument();
  });
});
