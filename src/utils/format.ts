/** Human-readable byte size, e.g. `1.2 MB`. */
export function formatBytes(bytes: number | null | undefined, decimals = 1): string {
  if (typeof bytes !== 'number' || !Number.isFinite(bytes) || bytes < 0) {
    return '';
  }
  if (bytes === 0) {
    return '0 B';
  }
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / Math.pow(1024, exponent);
  const rounded = exponent === 0 ? value : Number(value.toFixed(decimals));
  return `${rounded} ${units[exponent]}`;
}

/**
 * Shortens a file name while preserving its extension:
 * `very-long-report-name.pdf` becomes `very-long-rep….pdf`.
 */
export function truncateFileName(name: string, maxLength = 24): string {
  if (typeof name !== 'string' || name.length <= maxLength) {
    return name ?? '';
  }
  const lastDot = name.lastIndexOf('.');
  const hasExtension = lastDot > 0 && lastDot > name.length - 8;
  if (!hasExtension) {
    return `${name.slice(0, maxLength - 1)}…`;
  }
  const extension = name.slice(lastDot);
  const stemBudget = Math.max(1, maxLength - extension.length - 1);
  return `${name.slice(0, stemBudget)}…${extension}`;
}

/** First grapheme-safe letters of a display name, for avatar placeholders. */
export function initials(displayName: string, count = 2): string {
  const words = displayName.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) {
    return '';
  }
  return words
    .slice(0, count)
    .map((word) => [...word][0] ?? '')
    .join('')
    .toUpperCase();
}
