/**
 * Application timezone — read from TZ env var (set in .env or PM2 config).
 * Defaults to Europe/Moscow (UTC+3, Tatarstan) if not set.
 */
export const APP_TZ: string = process.env.TZ || 'Europe/Moscow';
/**
 * Returns today's date as YYYY-MM-DD in the local timezone.
 * Relies on process.env.TZ being set before app start (done in main.ts).
 */
export function todayLocal(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * Returns current hours * 60 + minutes in local timezone.
 */
export function currentLocalMinutes(): number {
  const d = new Date();
  return d.getHours() * 60 + d.getMinutes();
}

/**
 * Returns yesterday's date as YYYY-MM-DD in local timezone.
 */
export function yesterdayLocal(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * [startMs, endMs] epoch-millisecond bounds of one local calendar day
 * (inclusive), for a "YYYY-MM-DD" date string.
 *
 * Because process.env.TZ is pinned to APP_TZ before anything else runs (see
 * main.ts), the Date constructor's local getters/setters already resolve in
 * that zone — no AT TIME ZONE / to_timestamp() needed on the SQL side. Use
 * this to turn a date filter into a plain numeric range against a bigint
 * "eventTime" column, which Postgres can satisfy with a normal index instead
 * of a full table scan.
 */
export function localDayRangeMs(dateStr: string): { startMs: number; endMs: number } {
  const [y, m, d] = dateStr.split('-').map(Number);
  const startMs = new Date(y, m - 1, d, 0, 0, 0, 0).getTime();
  const endMs = new Date(y, m - 1, d, 23, 59, 59, 999).getTime();
  return { startMs, endMs };
}

/**
 * [startMs, endMs] epoch-millisecond bounds spanning from the start of
 * startDateStr to the end of endDateStr (both "YYYY-MM-DD", inclusive).
 */
export function localDateRangeMs(startDateStr: string, endDateStr: string): { startMs: number; endMs: number } {
  const { startMs } = localDayRangeMs(startDateStr);
  const { endMs } = localDayRangeMs(endDateStr);
  return { startMs, endMs };
}
