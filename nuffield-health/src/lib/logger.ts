type LogLevel = "info" | "warn" | "error";
type StageName = "CRAWL" | "PARSE" | "BOOKING" | "AI" | "SCORE" | "PIPELINE";

function timestamp(): string {
  const now = new Date();
  return [
    String(now.getHours()).padStart(2, "0"),
    String(now.getMinutes()).padStart(2, "0"),
    String(now.getSeconds()).padStart(2, "0"),
  ].join(":");
}

function formatStage(stage: StageName): string {
  return stage.padEnd(8);
}

function formatProgress(current: number, total: number): string {
  return `[${current}/${total}]`;
}

export function logInfo(
  stage: StageName,
  slug: string,
  status: string,
  detail?: string,
  progress?: { current: number; total: number }
): void {
  const parts = [`[${timestamp()}]`, `[${formatStage(stage)}]`];
  if (progress) parts.push(formatProgress(progress.current, progress.total));
  parts.push(`${slug} —`);
  parts.push(status);
  if (detail) parts.push(`(${detail})`);
  console.log(parts.join(" "));
}

export function logWarn(
  stage: StageName,
  slug: string,
  status: string,
  detail?: string,
  progress?: { current: number; total: number }
): void {
  const parts = [`[${timestamp()}]`, `[${formatStage(stage)}]`];
  if (progress) parts.push(formatProgress(progress.current, progress.total));
  parts.push(`${slug} —`);
  parts.push(status);
  if (detail) parts.push(`(${detail})`);
  console.warn(parts.join(" "));
}

export function logError(
  stage: StageName,
  slug: string,
  status: string,
  detail?: string,
  progress?: { current: number; total: number }
): void {
  const parts = [`[${timestamp()}]`, `[${formatStage(stage)}]`];
  if (progress) parts.push(formatProgress(progress.current, progress.total));
  parts.push(`${slug} —`);
  parts.push(status);
  if (detail) parts.push(`(${detail})`);
  console.error(parts.join(" "));
}

export const logger = { info: logInfo, warn: logWarn, error: logError };
