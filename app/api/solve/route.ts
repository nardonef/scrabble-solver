import { NextResponse } from "next/server";
import { findBestPlays } from "@/lib/solver";
import { ScanResult } from "@/lib/types";

export async function POST(request: Request) {
  let body: ScanResult;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const plays = findBestPlays(body.board, body.rack);
  return NextResponse.json({ plays });
}
