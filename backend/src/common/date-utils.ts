/**
 * Application timezone — read from TZ env var (set in .env or PM2 config).
 * Defaults to Asia/Ashgabat if not set.
 */
export const APP_TZ: string = process.env.TZ || 'Asia/Ashgabat';

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
