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

  resolve: (id: string) =>
    apiFetch<CardReport>(`/admin/card-reports/${id}/resolve`, { method: 'PATCH' }),

  dismiss: (id: string) =>
    apiFetch<CardReport>(`/admin/card-reports/${id}/dismiss`, { method: 'PATCH' }),
};
