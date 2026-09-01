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
  /**
   * Informational only — never affects `ms`/`checkOut` beyond folding the
   * extra time in as documented below. Set when a session already had a
   * CHECK_IN paired with a CHECK_OUT, but a further CHECK_OUT scan arrived
   * later with no new CHECK_IN in between (the worker stayed on for
   * overtime/mesai past the normal shift-end scan and was scanned out again
   * at the real end of their day). The UI should surface this as a
   * non-blocking notice, not an error.
   */
  extraScan?: boolean;
};

// A checkout is only ever paired (or used to extend an already-paired
// session) when it falls within this many ms of the session's CHECK_IN —
// mirrors the 14h "stuck check-in" cutoff used elsewhere
// (missing-checkouts.service.ts / analytics.service.ts) so that a missed
// checkout can never silently stretch a session into a much later day.
const MAX_SESSION_MS = 14 * 60 * 60 * 1000;

/**
 * Pairs a chronologically-sorted list of one worker's CHECK_IN/CHECK_OUT
 * events into sessions, then buckets each session (and each raw scan, for
 * display) by dateOf(epochMs) — normally the calendar date in APP_TZ.
 *
 * A session is bucketed by the date of ITS CHECK_IN, so an overnight session
 * (check in 23:xx, check out 06:xx next day) is attributed whole to the day
 * it started, matching how a night-shift day is naturally read on a
 * timesheet ("started 23:xx, left 06:xx") rather than split in half.
 *
 * Within one session, a CHECK_OUT that arrives AFTER the session was already
 * paired, with no intervening new CHECK_IN, extends the session through to
 * that later CHECK_OUT instead of being dropped — this is the common
 * "operator scans the worker out at normal shift-end, worker stays for
 * overtime/mesai, gets scanned out again for real later" case. A CHECK_IN
 * scanned again on the SAME date while the session is still open (no
 * CHECK_OUT seen yet) is treated as a duplicate scan and ignored. A CHECK_IN
 * on a different date always starts a fresh session, even if the previous
 * one was never closed, so a missed checkout can never stretch across days.
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

  // Tracks the currently "active" session: the last CHECK_IN not yet
  // superseded by a genuinely new one. `closed` marks whether it has
  // already received at least one CHECK_OUT.
  let openCheckIn: number | null = null;
  let openCheckInDate: string | null = null;
  let closed = false;

  for (const ev of events) {
    if (ev.eventType === 'CHECK_IN') {
      const sameDayAsOpen = openCheckIn !== null && dateOf(ev.eventTime) === openCheckInDate;
      if (openCheckIn === null || closed || !sameDayAsOpen) {
        // Genuinely new session: nothing was open, the previous session
        // already closed (e.g. the next session after a lunch break), or
        // the open session belongs to an earlier day (a missed checkout
        // must not carry over into a later day's session).
        openCheckIn = ev.eventTime;
        openCheckInDate = dateOf(ev.eventTime);
        closed = false;
        const cur = get(openCheckInDate);
        if (cur.checkIn === null) cur.checkIn = ev.eventTime; // first check-in of the date wins
      }
      // else: duplicate CHECK_IN scan on the same still-open session —
      // ignore it, keep the original check-in time.
    } else {
      // CHECK_OUT
      if (openCheckIn !== null) {
        const withinCap = ev.eventTime - openCheckIn <= MAX_SESSION_MS;
        if (!closed) {
          if (withinCap) {
            const cur = get(openCheckInDate!); // bucket the SESSION by its check-in's date
            cur.checkOut = ev.eventTime;
            cur.ms += ev.eventTime - openCheckIn;
            closed = true;
          } else {
            // Too long after the check-in to plausibly be its checkout (a
            // missed checkout) — don't stretch the session. Leave the open
            // check-in's day as a missing checkout and surface this
            // checkout on its own date instead.
            const cur = get(dateOf(ev.eventTime));
            cur.checkOut = ev.eventTime;
          }
        } else if (withinCap) {
          // Extra checkout scanned after the session was already paired,
          // with no new check-in in between: overtime/mesai. Extend the
          // session through to this later checkout.
          const cur = get(openCheckInDate!);
          cur.ms += ev.eventTime - (cur.checkOut as number);
          cur.checkOut = ev.eventTime;
          cur.extraScan = true;
        } else {
          // Stray checkout far outside a plausible session — surface it on
          // its own date only, don't fold it into the earlier session.
          const cur = get(dateOf(ev.eventTime));
          cur.checkOut = ev.eventTime;
        }
      } else {
        // Unmatched check-out (no open check-in at all) — still surface it for display.
        const cur = get(dateOf(ev.eventTime));
        cur.checkOut = ev.eventTime;
      }
    }
  }
  return result;
}
