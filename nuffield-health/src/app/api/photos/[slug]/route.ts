import { NextResponse } from "next/server";
import { readFileSync } from "fs";
import { extname, join } from "path";
import { getConsultantPhoto } from "@/db/queries";

interface RouteParams {
  params: Promise<{ slug: string }>;
}

const CONTENT_TYPES: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
};

export async function GET(_request: Request, { params }: RouteParams) {
  const { slug } = await params;

  const photo = await getConsultantPhoto(slug);
  if (!photo) {
    return NextResponse.json({ error: "Photo not found" }, { status: 404 });
  }

  const ext = extname(photo.file_path).toLowerCase();
  const contentType = CONTENT_TYPES[ext] ?? "application/octet-stream";

  // file_path is relative to the project root (e.g. data/photos/slug.jpg)
  const absolutePath = join(process.cwd(), photo.file_path);

  let fileBuffer: Buffer;
  try {
    fileBuffer = readFileSync(absolutePath);
  } catch {
    return NextResponse.json({ error: "Photo file not found on disk" }, { status: 404 });
  }

  return new NextResponse(fileBuffer.buffer as ArrayBuffer, {
    status: 200,
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "public, max-age=86400",
    },
  });
}
