import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { scanBoardImage, SupportedImageMediaType } from "@/lib/vision";

const SUPPORTED_MEDIA_TYPES: readonly SupportedImageMediaType[] = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
];

function isSupportedMediaType(value: string): value is SupportedImageMediaType {
  return (SUPPORTED_MEDIA_TYPES as readonly string[]).includes(value);
}

export async function POST(request: Request) {
  let body: { imageBase64?: string; mediaType?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const { imageBase64, mediaType } = body;

  if (!imageBase64 || !mediaType) {
    return NextResponse.json({ error: "imageBase64 and mediaType are required" }, { status: 400 });
  }

  if (!isSupportedMediaType(mediaType)) {
    return NextResponse.json(
      { error: "Unsupported image type — please use JPEG, PNG, GIF, or WebP" },
      { status: 400 }
    );
  }

  try {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const result = await scanBoardImage(imageBase64, mediaType, client);
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to scan image";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
