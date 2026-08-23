import { NextResponse } from "next/server";
import { findBestPlays } from "@/lib/solver";
import { ScanResult } from "@/lib/types";

export async function POST(request: Request) {
  const body = (await request.json()) as ScanResult;
  const plays = findBestPlays(body.board, body.rack);
  return NextResponse.json({ plays });
}
