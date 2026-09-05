import { apiFetch } from './http';

export type CardAssignmentHistoryEntry = {
  id: string;
  tenantId: string | null;
  workerEntityId: string;
  workerName: string | null;
  action: 'ASSIGNED' | 'CLEARED';
  previousCardUid: string | null;
  newCardUid: string | null;
  source: string; // 'mobile-device' | 'manual-edit' | 'card-report' (legacy, no longer created)
  changedBy: string | null;
  note: string | null;
  createdAt: string;
};

export const cardAssignmentHistoryApi = {
  getForWorker: (workerId: string): Promise<CardAssignmentHistoryEntry[]> =>
    apiFetch(`/admin/card-assignment-history?workerId=${encodeURIComponent(workerId)}`),

  // Tenant-wide feed (not scoped to one worker) — powers the Card History
  // report page, so an admin can see every operator/device-initiated card
  // unbind/rebind across the whole tenant, not just one worker's own page.
  getRecent: (limit = 300): Promise<CardAssignmentHistoryEntry[]> =>
    apiFetch(`/admin/card-assignment-history/recent?limit=${limit}`),
};
