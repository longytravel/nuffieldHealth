import { mkdirSync, existsSync, writeFileSync } from "fs";
import { join, extname } from "path";
import { randomUUID } from "crypto";
import { searchImages } from "@/lib/tavily-search";
import { upsertConsultantPhoto } from "@/db/queries";

const PHOTOS_DIR = "data/photos";

export interface PhotoResult {
  photo_id: string;
  slug: string;
  file_path: string;
  source_url: string;
  width: number | null;
  height: number | null;
  file_size_bytes: number | null;
}

function ensurePhotosDir(): void {
  if (!existsSync(PHOTOS_DIR)) {
    mkdirSync(PHOTOS_DIR, { recursive: true });
  }
}

function extensionFromUrl(url: string): string {
  try {
    const pathname = new URL(url).pathname;
    const ext = extname(pathname).toLowerCase();
    if (ext === ".jpg" || ext === ".jpeg") return ".jpg";
    if (ext === ".png") return ".png";
    if (ext === ".webp") return ".webp";
  } catch {
    // fall through
  }
  return ".jpg";
}

async function downloadFile(url: string, destPath: string): Promise<number> {
  const response = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (compatible; ConsultantIntelligence/1.0)",
    },
    redirect: "follow",
  });

  if (!response.ok) {
    throw new Error(`Failed to download image: ${response.status} ${response.statusText}`);
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  writeFileSync(destPath, buffer);
  return buffer.length;
}

/**
 * Search for and download a consultant photograph.
 *
 * Tries primary query first, then fallback. Downloads the highest-res
 * result to data/photos/{slug}.{ext} and records it in consultant_photos.
 *
 * Returns null if no suitable photo is found. Per spec §6.
 */
export async function downloadConsultantPhoto(
  slug: string,
  name: string,
  specialty: string
): Promise<PhotoResult | null> {
  ensurePhotosDir();

  const queries = [
    `"${name}" ${specialty} portrait`,
    `"${name}" doctor photo`,
  ];

  for (const query of queries) {
    let results;
    try {
      results = await searchImages(query);
    } catch (err) {
      console.warn(`[photo-downloader] Image search failed for "${query}": ${err}`);
      continue;
    }

    if (results.length === 0) continue;

    // Sort by resolution descending (prefer larger images)
    const sorted = results.slice().sort((a, b) => {
      const aArea = (a.width ?? 0) * (a.height ?? 0);
      const bArea = (b.width ?? 0) * (b.height ?? 0);
      return bArea - aArea;
    });

    for (const candidate of sorted.slice(0, 3)) {
      const ext = extensionFromUrl(candidate.url);
      const filePath = join(PHOTOS_DIR, `${slug}${ext}`);

      try {
        const fileSize = await downloadFile(candidate.url, filePath);
        const photoId = randomUUID();
        const now = new Date().toISOString();

        upsertConsultantPhoto({
          photo_id: photoId,
          slug,
          file_path: filePath,
          source_url: candidate.url,
          source_attribution: candidate.source_url,
          width: candidate.width,
          height: candidate.height,
          file_size_bytes: fileSize,
          downloaded_at: now,
          verified_by: null,
          verified_at: null,
        });

        return {
          photo_id: photoId,
          slug,
          file_path: filePath,
          source_url: candidate.url,
          width: candidate.width,
          height: candidate.height,
          file_size_bytes: fileSize,
        };
      } catch (err) {
        console.warn(`[photo-downloader] Failed to download ${candidate.url}: ${err}`);
        continue;
      }
    }
  }

  // No suitable photo found — per spec §6.4 this is expected, not an error
  return null;
}
