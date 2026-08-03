/**
 * Date and duration helpers.
 *
 * Replaces moment. Formatting goes through `Intl.DateTimeFormat`, which Hermes
 * ships with full ICU on both platforms, so locales work without a data blob.
 */

/**
 * True when two timestamps fall on different calendar days in local time.
 *
 * 0.0.x compared elapsed hours (`diff > 1` day), so two messages a few hours
 * apart across midnight were treated as the same day and no separator was
 * drawn. Calendar comparison is what a day separator actually means.
 */
export function isDifferentDay(tsA: number, tsB: number): boolean {
  const a = new Date(tsA);
  const b = new Date(tsB);
  return (
    a.getFullYear() !== b.getFullYear() ||
    a.getMonth() !== b.getMonth() ||
    a.getDate() !== b.getDate()
  );
}

export function isToday(ts: number, now: number = Date.now()): boolean {
  return !isDifferentDay(ts, now);
}

export function isYesterday(ts: number, now: number = Date.now()): boolean {
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  return !isDifferentDay(ts, yesterday.getTime());
}

const timeFormatCache = new Map<string, Intl.DateTimeFormat>();

function cachedFormat(locale: string, options: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  const key = `${locale}|${JSON.stringify(options)}`;
  let formatter = timeFormatCache.get(key);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat(locale, options);
    timeFormatCache.set(key, formatter);
  }
  return formatter;
}

/** Clock time for a message row, e.g. `14:05`. */
export function formatMessageTime(ts: number, locale = 'en'): string {
  return cachedFormat(locale, { hour: '2-digit', minute: '2-digit' }).format(new Date(ts));
}

/** Absolute label for a day separator; `Jan 12, 2026` at the default locale. */
export function formatDayLabel(ts: number, locale = 'en'): string {
  return cachedFormat(locale, { day: 'numeric', month: 'short', year: 'numeric' }).format(
    new Date(ts),
  );
}

/**
 * Compact timestamp for a chat list row: time today, weekday this week,
 * date otherwise.
 */
export function formatListTimestamp(ts: number, locale = 'en', now: number = Date.now()): string {
  if (isToday(ts, now)) {
    return formatMessageTime(ts, locale);
  }
  const sixDaysAgo = now - 6 * 24 * 60 * 60 * 1000;
  if (ts >= sixDaysAgo) {
    return cachedFormat(locale, { weekday: 'short' }).format(new Date(ts));
  }
  return cachedFormat(locale, { day: 'numeric', month: 'short' }).format(new Date(ts));
}

/** `m:ss` for durations under an hour, `h:mm:ss` above. */
export function formatDuration(milliseconds: number): string {
  const safe = Number.isFinite(milliseconds) && milliseconds > 0 ? milliseconds : 0;
  const totalSeconds = Math.floor(safe / 1000);
  const seconds = totalSeconds % 60;
  const minutes = Math.floor(totalSeconds / 60) % 60;
  const hours = Math.floor(totalSeconds / 3600);
  const pad = (value: number): string => String(value).padStart(2, '0');
  return hours > 0 ? `${hours}:${pad(minutes)}:${pad(seconds)}` : `${minutes}:${pad(seconds)}`;
}
