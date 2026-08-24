import { WorkerStatus } from './worker.entity';

// Statuses considered "in use" when reconciling an Excel import against the
// database — anything not in this list (i.e. already Terminated) is treated
// as already gone and is skipped rather than re-terminated.
export const ACTIVE_WORKER_STATUSES = [
  WorkerStatus.Active,
  WorkerStatus.Inactive,
  WorkerStatus.Suspended,
  WorkerStatus.Transferred,
];

// Cap on how many sample rows we return per bucket (created/updated/etc.)
// when previewing an Excel import, so the preview payload stays small.
export const IMPORT_PREVIEW_SAMPLE_LIMIT = 12;
