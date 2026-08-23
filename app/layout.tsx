import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Scrabble Solver",
  description: "Scan a Scrabble board and find the highest-scoring play",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
