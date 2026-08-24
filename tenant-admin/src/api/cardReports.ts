import { apiFetch } from './http';

export type CardReportStatus = 'pending' | 'resolved' | 'dismissed';

export interface CardReport {
  id: string;
  tenantId: string;
  cardUid: string;
  currentWorkerName: string | null;
  suggestedWorkerId: string | null;
  suggestedWorkerName: string | null;
  deviceLabel: string | null;
  note: string | null;
  status: CardReportStatus;
  createdAt: string;
  resolvedAt: string | null;
  resolvedBy: string | null;
}

export const cardReportsApi = {
  list: (status?: string) => {
    const params = status ? `?status=${status}` : '';
    return apiFetch<CardReport[]>(`/admin/card-reports${params}`);
  },

  pendingCount: () =>
    apiFetch<{ count: number }>('/admin/card-reports/pending-count'),

  // workerId is the worker's business tab number (Worker.workerId), matching
  // how suggestedWorkerId is stored on the report — not the internal uuid.
  // Passing it always relinks the card to that worker; omitting it falls
  // back to the report's own suggestedWorkerId (if any) on the backend.
  resolve: (id: string, workerId?: string) =>
    apiFetch<CardReport>(`/admin/card-reports/${id}/resolve`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ workerId }),
    }),

  dismiss: (id: string) =>
    apiFetch<CardReport>(`/admin/card-reports/${id}/dismiss`, { method: 'PATCH' }),
};
