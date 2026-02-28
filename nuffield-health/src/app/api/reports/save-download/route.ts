import { NextRequest, NextResponse } from "next/server";
import os from "node:os";
import path from "node:path";
import { mkdir, writeFile } from "node:fs/promises";

const ALLOWED_EXTENSIONS = new Set([".csv", ".pdf"]);

function sanitizeFileName(fileName: string): string {
  const fallback = `download-${Date.now()}`;
  const base = path.basename(fileName || fallback);
  const cleaned = base
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, "-")
    .replace(/\s+/g, "-")
    .trim();

  return cleaned.length > 0 ? cleaned : fallback;
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const fileValue = formData.get("file");

    if (!fileValue || typeof fileValue !== "object" || !("arrayBuffer" in fileValue)) {
      return new NextResponse("Missing file payload", { status: 400 });
    }

    const file = fileValue as File;
    const sanitizedName = sanitizeFileName(file.name);
    const extension = path.extname(sanitizedName).toLowerCase();

    if (!ALLOWED_EXTENSIONS.has(extension)) {
      return new NextResponse("Only .csv and .pdf files are allowed", { status: 400 });
    }

    const downloadsDir =
      process.env.REPORTS_DOWNLOAD_DIR?.trim() || path.join(os.homedir(), "Downloads");
    await mkdir(downloadsDir, { recursive: true });

    const bytes = Buffer.from(await file.arrayBuffer());
    const outputPath = path.join(downloadsDir, sanitizedName);
    await writeFile(outputPath, bytes);

    return NextResponse.json({
      ok: true,
      path: outputPath,
      bytes: bytes.length,
    });
  } catch (error) {
    return new NextResponse(
      `Failed to save file: ${error instanceof Error ? error.message : String(error)}`,
      { status: 500 }
    );
  }
}
