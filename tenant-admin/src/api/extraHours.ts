import { apiFetch as request } from './http';

export type ExtraHoursItem = {
  id: string;
  workerEntityId: string;
  workerName: string;
  workerId: string;
  extraHours: number;
};

// One row per site chief the request was sent to -- each tracks their own
// seen/action independently. See ExtraHoursRequest.status doc below for how
// these roll up into the overall status.
export type ExtraHoursRecipient = {
  id: string;
  siteChiefWorkerEntityId: string;
  siteChiefName: string;
  seenAt: string | null;
  action: 'pending' | 'approved' | 'rejected';
  actionAt: string | null;
};

export type ExtraHoursRequest = {
  id: string;
  foremanWorkerEntityId: string;
  foremanName: string;
  workDate: string;
  note: string | null;
  // Overall/aggregate status: any one recipient's approval settles this as
  // "approved" for everyone; "rejected" only once every recipient has
  // rejected it. See `recipients` for who it was sent to and who has/hasn't
  // responded yet.
  status: 'pending' | 'seen' | 'approved' | 'rejected';
  sentAt: string;
  seenAt: string | null;
  actionAt: string | null;
  items: ExtraHoursItem[];
  recipients: ExtraHoursRecipient[];
};

export const extraHoursApi = {
  list: (params?: { status?: string; foremanId?: string; siteChiefId?: string; limit?: number }) => {
    const qs = new URLSearchParams();
    if (params?.status) qs.set('status', params.status);
    if (params?.foremanId) qs.set('foremanId', params.foremanId);
    if (params?.siteChiefId) qs.set('siteChiefId', params.siteChiefId);
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
