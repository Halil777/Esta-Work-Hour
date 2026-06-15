const BASE = '/api';

export interface ForemanWorker {
  id: string;
  workerId: string;
  name: string;
  profession: string;
  status: string;
  mesaiSistemi: string;
  foremanId: string | null;
}

export interface ForemanApi {
  id: string;
  name: string;
  phone?: string | null;
  workerId?: string | null;
  workerCount: number;
}

export interface ForemanDetail {
  id: string;
  name: string;
  phone?: string | null;
  workerId?: string | null;
  workerCount: number;
  workers: ForemanWorker[];
}

export interface CreateForemanPayload { name: string; phone?: string; workerId?: string }
export interface UpdateForemanPayload { name?: string; phone?: string | null; workerId?: string | null }

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const r = await fetch(`${BASE}${path}`, init);
  if (!r.ok) { const e = await r.json().catch(() => ({})); throw new Error(e.message ?? `Error ${r.status}`); }
  return r.json();
}

const h = (admin?: string): HeadersInit => ({
  'Content-Type': 'application/json',
  ...(admin ? { 'X-Admin-Name': admin } : {}),
});

export const foremansApi = {
  list: (): Promise<ForemanApi[]> => req('/foremans'),

  getById: (id: string): Promise<ForemanDetail> => req(`/foremans/${id}`),

  create: (data: CreateForemanPayload, admin?: string): Promise<ForemanApi> =>
    req('/foremans', { method: 'POST', headers: h(admin), body: JSON.stringify(data) }),

  update: (id: string, data: UpdateForemanPayload, admin?: string): Promise<ForemanApi> =>
    req(`/foremans/${id}`, { method: 'PATCH', headers: h(admin), body: JSON.stringify(data) }),

  remove: (id: string, admin?: string): Promise<void> =>
    req(`/foremans/${id}`, { method: 'DELETE', headers: admin ? { 'X-Admin-Name': admin } : {} }),

  assignWorker: (foremanId: string, workerId: string, admin?: string): Promise<void> =>
    req(`/foremans/${foremanId}/assign`, {
      method: 'POST',
      headers: h(admin),
      body: JSON.stringify({ workerId }),
    }),

  unassignWorker: (foremanId: string, workerId: string, admin?: string): Promise<void> =>
    req(`/foremans/${foremanId}/unassign`, {
      method: 'POST',
      headers: h(admin),
      body: JSON.stringify({ workerId }),
    }),

  importExcel: (file: File, admin?: string) => {
    const form = new FormData();
    form.append('file', file);
    return req<{ imported: number }>('/foremans/import/excel', {
      method: 'POST',
      headers: admin ? { 'X-Admin-Name': admin } : {},
      body: form,
    });
  },
};
