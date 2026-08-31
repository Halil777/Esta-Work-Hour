import { WorkAdjustment, AdjustmentType } from '../work-adjustments/work-adjustment.entity';

/**
 * Applies admin-entered adjustments on top of actualMinutes (in creation
 * order). SET resets the running total; ADD/BONUS add to it; SUBTRACT
 * reduces it; MINIMUM enforces a floor. With no adjustments, the raw actual
 * value passes through unchanged — this is the single source of truth for
 * "credited" (officially counted) hours used everywhere in the system:
 * Excel/PDF/HTML reports, the worker's own timesheet, and the day-view
 * admin screen. The real scan-based check-in/check-out and actual duration
 * must always be kept and shown separately alongside this value — this
 * function never mutates or discards them.
 */
export function computeCredited(actualMinutes: number, adjustments: WorkAdjustment[]): number {
  if (!adjustments.length) return actualMinutes;
  let credited = actualMinutes;
  const sorted = [...adjustments].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  for (const adj of sorted) {
    switch (adj.adjustmentType) {
      case AdjustmentType.ADD:
      case AdjustmentType.BONUS:
        credited += adj.minutes;
        break;
      case AdjustmentType.SUBTRACT:
        credited = Math.max(0, credited - adj.minutes);
        break;
      case AdjustmentType.SET:
        credited = adj.minutes;
        break;
      case AdjustmentType.MINIMUM:
        credited = Math.max(credited, adj.minutes);
        break;
    }
  }
  return Math.max(0, credited);
}

/** Groups a flat list of adjustments by `${workerEntityId}:${workDate}` for O(1) per-day lookup. */
export function groupAdjustmentsByWorkerDate(adjustments: WorkAdjustment[]): Map<string, WorkAdjustment[]> {
  const map = new Map<string, WorkAdjustment[]>();
  for (const adj of adjustments) {
    const key = `${adj.workerEntityId}:${adj.workDate}`;
    const arr = map.get(key) ?? [];
    arr.push(adj);
    map.set(key, arr);
  }
  return map;
}
