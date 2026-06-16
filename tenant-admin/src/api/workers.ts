const BASE = '/api';

export type MobileRole = 'worker' | 'foreman' | 'site_chief' | 'section_chief';

export type WorkerApi = {
  id: string;
  workerId: string;
  name: string;
  profession: string;
  brigadeId: string;
  brigadeName: string;
  zoneId: string;
  zoneName: string;
  status: 'Active' | 'Inactive' | 'Suspended' | 'Transferred' | 'Terminated';
  phone?: string;
  hireDate?: string;
  qrStatus: 'Active' | 'Lost' | 'Blocked' | 'Replaced';
  lastCheckIn?: number | null;
  lastCheckOut?: number | null;
  todayHoursMs?: number | null;
  brigadirId?: string | null;
  foremanId?: string | null;
  mesaiSistemi?: string;
  mobileRole?: MobileRole;
  extraSaat?: number;
  nfcCardUid?: string | null;
};

export type MobileCredential = {
  username: string;
  isActive: boolean;
  role: MobileRole;
} | null;

export type CreateWorkerPayload = Omit<WorkerApi, 'id' | 'lastCheckIn' | 'lastCheckOut' | 'todayHoursMs'>;
export type UpdateWorkerPayload = Partial<Omit<WorkerApi, 'id' | 'lastCheckIn' | 'lastCheckOut' | 'todayHoursMs'>>;

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, init);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message ?? `Request failed: ${res.status}`);
  }
  return res.json();
}

export const workersApi = {
  list: (params?: {
    search?: string;
    brigadeId?: string;
    status?: string;
    foremanId?: string;
    mobileRole?: MobileRole;
    startDate?: string;
    endDate?: string;
    noScan?: boolean;
  }) => {
    const qs = new URLSearchParams();
    if (params?.search) qs.set('search', params.search);
    if (params?.brigadeId) qs.set('brigadeId', params.brigadeId);
    if (params?.status) qs.set('status', params.status);
    if (params?.foremanId) qs.set('foremanId', params.foremanId);
    if (params?.mobileRole) qs.set('mobileRole', params.mobileRole);
    if (params?.startDate) qs.set('startDate', params.startDate);
    if (params?.endDate) qs.set('endDate', params.endDate);
    if (params?.noScan) qs.set('noScan', 'true');
    const q = qs.toString();
    return request<WorkerApi[]>(`/workers${q ? '?' + q : ''}`);
  },

  get: (id: string) => request<WorkerApi>(`/workers/${id}`),

  create: (data: Partial<CreateWorkerPayload>) =>
    request<WorkerApi>('/workers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }),

  update: (id: string, data: UpdateWorkerPayload, changedBy?: string) =>
    request<WorkerApi>(`/workers/${id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        ...(changedBy ? { 'X-Admin-Name': changedBy } : {}),
      },
      body: JSON.stringify(data),
    }),

  remove: (id: string, changedBy?: string) =>
    request<void>(`/workers/${id}`, {
      method: 'DELETE',
      headers: changedBy ? { 'X-Admin-Name': changedBy } : {},
    }),

  exportExcel: () => {
    const a = document.createElement('a');
    a.href = `${BASE}/workers/export`;
    a.download = '';
    a.click();
  },

  importExcel: (file: File) => {
    const form = new FormData();
    form.append('file', file);
    return request<{ imported: number; updated: number; terminated: number }>(
      '/workers/import/excel',
      { method: 'POST', body: form },
    );
  },

  importCards: (file: File) => {
    const form = new FormData();
    form.append('file', file);
    return request<{ linked: number; notFound: number }>(
      '/workers/import/cards',
      { method: 'POST', body: form },
    );
  },

  listTerminated: (search?: string) => {
    const qs = search ? `?search=${encodeURIComponent(search)}` : '';
    return request<WorkerApi[]>(`/workers/terminated${qs}`);
  },

  restore: (id: string, changedBy?: string) =>
    request<WorkerApi>(`/workers/${id}/restore`, {
      method: 'PATCH',
      headers: changedBy ? { 'X-Admin-Name': changedBy } : {},
    }),

  getCredential: (workerEntityId: string) =>
    request<MobileCredential>(`/mobile/auth/credentials/${workerEntityId}`),

  setCredential: (workerEntityId: string, username: string, password: string) =>
    request<{ success: boolean; username: string }>(`/mobile/auth/credentials/${workerEntityId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    }),

  deactivateCredential: (workerEntityId: string) =>
    request<{ success: boolean }>(`/mobile/auth/credentials/${workerEntityId}/deactivate`, {
      method: 'PATCH',
    }),
};
