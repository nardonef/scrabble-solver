import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { scanBoardImage } from "@/lib/vision";

export async function POST(request: Request) {
  const body = (await request.json()) as { imageBase64?: string; mediaType?: string };
  const { imageBase64, mediaType } = body;

  if (!imageBase64 || !mediaType) {
    return NextResponse.json({ error: "imageBase64 and mediaType are required" }, { status: 400 });
  }

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  try {
    const result = await scanBoardImage(imageBase64, mediaType, client);
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to scan image";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
