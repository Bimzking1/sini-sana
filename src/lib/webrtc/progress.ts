export function computeProgress(completed: number, total: number): number {
  if (total <= 0) return 1;
  const ratio = completed / total;
  if (ratio <= 0) return 0;
  if (ratio >= 1) return 1;
  return ratio;
}

export function formatPercent(progress: number): string {
  return `${Math.round(computeProgress(progress, 1) * 100)}%`;
}

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return "0 B";
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let value = bytes;
  let unitIndex = -1;
  do {
    value /= 1024;
    unitIndex += 1;
  } while (value >= 1024 && unitIndex < units.length - 1);
  const digits = Number.isInteger(value) ? 0 : value >= 100 ? 0 : 1;
  return `${value.toFixed(digits)} ${units[unitIndex] ?? "TB"}`;
}

export function formatProgressTotal(completed: number, total: number): string {
  return `${formatBytes(completed)} / ${formatBytes(total)}`;
}