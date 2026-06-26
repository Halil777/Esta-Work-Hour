import { apiFetch as request } from './http';

export type ExtraHoursItem = {
  id: string;
  workerEntityId: string;
  workerName: string;
  workerId: string;
  extraHours: number;
};

export type ExtraHoursRequest = {
  id: string;
  foremanWorkerEntityId: string;
  foremanName: string;
  siteChiefWorkerEntityId: string;
  siteChiefName: string;
  workDate: string;
  note: string | null;
  status: 'pending' | 'seen' | 'approved' | 'rejected';
  sentAt: string;
  seenAt: string | null;
  actionAt: string | null;
  items: ExtraHoursItem[];
};

export const extraHoursApi = {
  list: (params?: { status?: string; limit?: number }) => {
    const qs = new URLSearchParams();
    if (params?.status) qs.set('status', params.status);
    if (params?.limit) qs.set('limit', String(params.limit));
    const q = qs.toString();
    return request<ExtraHoursRequest[]>(`/extra-hours${q ? '?' + q : ''}`);
  },

  action: (id: string, action: 'approved' | 'rejected') =>
    request<ExtraHoursRequest>(`/extra-hours/${id}/action`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action }),
    }),
};
