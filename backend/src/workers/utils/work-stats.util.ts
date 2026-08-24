export type WorkStats = { totalMs: number; firstIn: number | null; lastOut: number | null };

/**
 * Reduces a worker's ordered CHECK_IN/CHECK_OUT events for one work day into
 * total worked time plus the first check-in and last check-out timestamps.
 */
export function computeWorkStats(events: { eventType: string; eventTime: number }[]): WorkStats {
  let totalMs = 0;
  let clockIn: number | null = null;
  let firstIn: number | null = null;
  let lastOut: number | null = null;

  for (const ev of events) {
    if (ev.eventType === 'CHECK_IN') {
      if (clockIn === null) clockIn = ev.eventTime;
      if (firstIn === null) firstIn = ev.eventTime;
    } else {
      if (clockIn !== null) {
        totalMs += ev.eventTime - clockIn;
        clockIn = null;
      }
      lastOut = ev.eventTime;
    }
  }

  return { totalMs, firstIn, lastOut };
}
