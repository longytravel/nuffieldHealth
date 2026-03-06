// Simple in-memory batch store for rewrite batches.
// Lives at module level — survives for the lifetime of the Next.js server process.
// This is intentional for demo/prototype use (spec §12.4).

export interface BatchEntry {
  slugs: string[];
  rewrite_ids: string[];
  run_id: string;
  mode: "full" | "element";
  completed: Set<string>;
  failed: Set<string>;
  created_at: string;
}

const batchStore = new Map<string, BatchEntry>();

export function setBatch(batchId: string, entry: BatchEntry): void {
  batchStore.set(batchId, entry);
}

export function getBatch(batchId: string): BatchEntry | null {
  return batchStore.get(batchId) ?? null;
}

export function markBatchRewriteCompleted(batchId: string, rewriteId: string): void {
  const entry = batchStore.get(batchId);
  if (entry) {
    entry.completed.add(rewriteId);
  }
}

export function markBatchRewriteFailed(batchId: string, rewriteId: string): void {
  const entry = batchStore.get(batchId);
  if (entry) {
    entry.failed.add(rewriteId);
  }
}
