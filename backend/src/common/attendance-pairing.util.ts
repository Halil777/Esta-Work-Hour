// Shared CHECK_IN/CHECK_OUT pairing logic, used by both the Reports module
// (range Excel/JSON exports) and the Work Time module (monthly summaries).
//
// IMPORTANT: events must be pre-bucketed by employee only, sorted ascending
// by eventTime — NOT pre-bucketed by calendar date. A night-shift worker who
// checks in before midnight and checks out after midnight has those two
// events on two different calendar dates; grouping by date *before* pairing
// (the old approach) means the CHECK_IN and CHECK_OUT never end up in the
// same bucket and never pair, silently producing 0 worked minutes for that
// day. Pairing first, across the whole chronological stream, and only then
// attributing each finished session to the calendar date of its CHECK_IN,
// fixes this while leaving same-day (day-shift) results unchanged.

export type AttendanceEvent = { eventType: string; eventTime: number };

export type DayAttendance = {
  /** First CHECK_IN scan attributed to this date (for display). */
  checkIn: number | null;
  /** Last CHECK_OUT scan attributed to this date (for display) — may be on
   *  the next calendar day for an overnight/night-shift session. */
  checkOut: number | null;
  /** Total worked ms for all sessions whose CHECK_IN falls on this date. */
  ms: number;
};

/**
 * Pairs a chronologically-sorted list of one worker's CHECK_IN/CHECK_OUT
 * events into sessions, then buckets each session (and each raw scan, for
 * display) by dateOf(epochMs) — normally the calendar date in APP_TZ.
 *
 * A session is bucketed by the date of ITS CHECK_IN, so an overnight session
 * (check in 23:xx, check out 06:xx next day) is attributed whole to the day
 * it started, matching how a night-shift day is naturally read on a
 * timesheet ("started 23:xx, left 06:xx") rather than split in half.
 */
export function buildDailyAttendance(
  events: AttendanceEvent[],
  dateOf: (epochMs: number) => string,
): Map<string, DayAttendance> {
  const result = new Map<string, DayAttendance>();
  const get = (d: string): DayAttendance => {
    let cur = result.get(d);
    if (!cur) {
      cur = { checkIn: null, checkOut: null, ms: 0 };
      result.set(d, cur);
    }
    return cur;
  };

  let openCheckIn: number | null = null;
  for (const ev of events) {
    if (ev.eventType === 'CHECK_IN') {
      if (openCheckIn === null) openCheckIn = ev.eventTime;
      const cur = get(dateOf(ev.eventTime));
      if (cur.checkIn === null) cur.checkIn = ev.eventTime; // first check-in of the date wins
    } else {
      if (openCheckIn !== null) {
        const cur = get(dateOf(openCheckIn)); // bucket the SESSION by its check-in's date
        cur.checkOut = ev.eventTime; // last check-out wins
        cur.ms += ev.eventTime - openCheckIn;
        openCheckIn = null;
      } else {
        // Unmatched check-out (no open check-in) — still surface it for display.
        const cur = get(dateOf(ev.eventTime));
        cur.checkOut = ev.eventTime;
      }
    }
  }
  return result;
}
