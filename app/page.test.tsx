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
    expect(screen.getByText("H8 · Across")).toBeInTheDocument();
  });

  it("routes to the no-legal-plays error screen when /api/solve returns no plays", async () => {
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
          return Promise.resolve({ ok: true, json: () => Promise.resolve({ plays: [] }) });
        }
        return Promise.reject(new Error(`unexpected fetch to ${url}`));
      })
    );

    render(<Home />);

    const input = screen.getByTestId("camera-input");
    fireEvent.change(input, { target: { files: [makeFile()] } });

    await waitFor(() => expect(screen.getByTestId("rack-editor")).toBeInTheDocument());

    fireEvent.click(screen.getByText("Find best play"));

    await waitFor(() => expect(screen.getByText("No legal plays with that rack")).toBeInTheDocument());
    expect(screen.getByText("Fix the board")).toBeInTheDocument();
    expect(screen.getByText("New photo")).toBeInTheDocument();
  });

  it("routes to the generic error stage with a retry button when /api/solve fails", async () => {
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

  it("routes to the scan error stage with retake/manual-entry actions when /api/scan fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn((url: string) => {
        if (url === "/api/scan") {
          return Promise.resolve({ ok: false, json: () => Promise.resolve({ error: "Could not read the photo" }) });
        }
        return Promise.reject(new Error(`unexpected fetch to ${url}`));
      })
    );

    render(<Home />);

    const input = screen.getByTestId("camera-input");
    fireEvent.change(input, { target: { files: [makeFile()] } });

    await waitFor(() => expect(screen.getByText("We couldn't read that board")).toBeInTheDocument());
    expect(screen.getByText("Retake photo")).toBeInTheDocument();
    expect(screen.getByText("Enter the board by hand")).toBeInTheDocument();
  });

  it("lets the user enter the board by hand from the scan error stage", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn((url: string) => {
        if (url === "/api/scan") {
          return Promise.resolve({ ok: false, json: () => Promise.resolve({ error: "Could not read the photo" }) });
        }
        return Promise.reject(new Error(`unexpected fetch to ${url}`));
      })
    );

    render(<Home />);

    const input = screen.getByTestId("camera-input");
    fireEvent.change(input, { target: { files: [makeFile()] } });

    await waitFor(() => expect(screen.getByText("Enter the board by hand")).toBeInTheDocument());
    fireEvent.click(screen.getByText("Enter the board by hand"));

    expect(screen.getByTestId("rack-editor")).toBeInTheDocument();
  });
});
