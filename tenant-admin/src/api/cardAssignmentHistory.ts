import { apiFetch } from './http';

export type CardAssignmentHistoryEntry = {
  id: string;
  tenantId: string | null;
  workerEntityId: string;
  workerName: string | null;
  action: 'ASSIGNED' | 'CLEARED';
  previousCardUid: string | null;
  newCardUid: string | null;
  source: string; // 'card-report' | 'manual-edit'
  changedBy: string | null;
  note: string | null;
  createdAt: string;
};

export const cardAssignmentHistoryApi = {
  getForWorker: (workerId: string): Promise<CardAssignmentHistoryEntry[]> =>
    apiFetch(`/admin/card-assignment-history?workerId=${encodeURIComponent(workerId)}`),
};
