import { apiFetch } from './http';

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
  shift?: 'day' | 'night' | null;
  isStaff?: boolean;
  photoUrl?: string | null;
  terminatedAt?: string | null;
  terminationDate?: string | null;
  terminationReason?: string | null;
  terminationNote?: string | null;
};

export type MobileCredential = {
  username: string;
  isActive: boolean;
  role: MobileRole;
} | null;

export type WorkerLifecyclePendingSummary = {
  total: number;
  counts: {
    created: number;
    terminated: number;
    restored: number;
  };
  nextSendAt: string | null;
  delayMinutes: number;
};

export type WorkerLifecycleReport = {
  id: string;
  batchId: string;
  status: 'sent' | 'failed';
  subject: string;
  recipients: string[];
  eventCount: number;
  counts: {
    created: number;
    terminated: number;
    restored: number;
  };
  eventIds: string[];
  error?: string | null;
  sentAt?: string | null;
  resentAt?: string | null;
  resendCount: number;
  createdAt: string;
  updatedAt: string;
};

export type WorkerImportPreviewItem = {
  rowNumber?: number;
  workerId: string;
  name: string;
  profession: string;
  brigadeName: string;
  mesaiSistemi: string;
  currentStatus?: WorkerApi['status'] | null;
};

export type WorkerImportPreview = {
  totalRows: number;
  rowsWithWorkerId: number;
  counts: {
    created: number;
    updated: number;
    restored: number;
    terminated: number;
    duplicateWorkerIds: number;
  };
  samples: {
    created: WorkerImportPreviewItem[];
    updated: WorkerImportPreviewItem[];
    restored: WorkerImportPreviewItem[];
    terminated: WorkerImportPreviewItem[];
    duplicates: string[];
  };
};

export type TerminateWorkerPayload = {
  terminationDate: string;
  reason: string;
  note?: string;
};

export type CreateWorkerPayload = Omit<WorkerApi, 'id' | 'lastCheckIn' | 'lastCheckOut' | 'todayHoursMs'>;
export type UpdateWorkerPayload = Partial<Omit<WorkerApi, 'id' | 'lastCheckIn' | 'lastCheckOut' | 'todayHoursMs'>>;

const request = apiFetch;

export const workersApi = {
  list: (params?: {
    search?: string;
    brigadeId?: string;
    status?: string;
    foremanId?: string;
    mobileRole?: MobileRole;
    mesaiSistemi?: string;
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
    if (params?.mesaiSistemi) qs.set('mesaiSistemi', params.mesaiSistemi);
    if (params?.startDate) qs.set('startDate', params.startDate);
    if (params?.endDate) qs.set('endDate', params.endDate);
    if (params?.noScan) qs.set('noScan', 'true');
    const q = qs.toString();
    return request<WorkerApi[]>(`/workers${q ? '?' + q : ''}`);
  },

  get: (id: string) => request<WorkerApi>(`/workers/${id}`),

  create: (data: Partial<CreateWorkerPayload>, changedBy?: string) =>
    request<WorkerApi>('/workers', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(changedBy ? { 'X-Admin-Name': changedBy } : {}),
      },
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

  terminate: (id: string, data: TerminateWorkerPayload, changedBy?: string) =>
    request<WorkerApi>(`/workers/${id}/terminate`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        ...(changedBy ? { 'X-Admin-Name': changedBy } : {}),
      },
      body: JSON.stringify(data),
    }),

  exportExcel: () => {
    const a = document.createElement('a');
    a.href = `/api/workers/export`;
    a.download = '';
    a.click();
  },

  importExcel: (file: File, changedBy?: string) => {
    const form = new FormData();
    form.append('file', file);
    return request<{ imported: number; updated: number; restored: number; terminated: number }>(
      '/workers/import/excel',
      {
        method: 'POST',
        headers: changedBy ? { 'X-Admin-Name': changedBy } : {},
        body: form,
      },
    );
  },

  previewImportExcel: (file: File) => {
    const form = new FormData();
    form.append('file', file);
    return request<WorkerImportPreview>(
      '/workers/import/excel/preview',
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

  uploadPhoto: (id: string, file: File) => {
    const form = new FormData();
    form.append('photo', file);
    return request<{ photoUrl: string }>(`/workers/${id}/photo`, {
      method: 'PATCH',
      body: form,
    });
  },

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

  lifecyclePendingSummary: () =>
    request<WorkerLifecyclePendingSummary>('/worker-lifecycle/pending-summary'),

  lifecycleReports: (limit = 30) =>
    request<WorkerLifecycleReport[]>(`/worker-lifecycle/reports?limit=${limit}`),

  resendLifecycleReport: (batchId: string) =>
    request<WorkerLifecycleReport>(`/worker-lifecycle/reports/${encodeURIComponent(batchId)}/resend`, {
      method: 'POST',
    }),

  sendPendingLifecycleReports: () =>
    request<WorkerLifecycleReport | { sent: false; message: string }>('/worker-lifecycle/reports/send-pending', {
      method: 'POST',
    }),

  downloadLifecycleReport: async (batchId: string) => {
    const token = localStorage.getItem('adminJwt');
    const res = await fetch(`/api/worker-lifecycle/reports/${encodeURIComponent(batchId)}/download`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error((err as any).message ?? 'Download failed');
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${batchId}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
  },
};
