const BASE = '/api';

export interface BrigadirApi {
  id: string;
  name: string;
  phone?: string | null;
  workerId?: string | null;
  foremanId?: string | null;
  foremanName?: string | null;
  workerCount: number;
}

export interface BrigadirWorker {
  id: string;
  workerId: string;
  name: string;
  profession: string;
  status: string;
  brigadirId: string | null;
}

export interface BrigadirDetail extends BrigadirApi {
  workers: BrigadirWorker[];
}

export interface CreateBrigadirPayload { name: string; phone?: string; workerId?: string; foremanId?: string | null }
export interface UpdateBrigadirPayload { name?: string; phone?: string | null; workerId?: string | null; foremanId?: string | null }

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const r = await fetch(`${BASE}${path}`, init);
  if (!r.ok) { const e = await r.json().catch(() => ({})); throw new Error(e.message ?? `Error ${r.status}`); }
  return r.json();
}

const h = (admin?: string): HeadersInit => ({
  'Content-Type': 'application/json',
  ...(admin ? { 'X-Admin-Name': admin } : {}),
});

export const brigadirsApi = {
  list: (): Promise<BrigadirApi[]> => req('/brigadirs'),

  getById: (id: string): Promise<BrigadirDetail> => req(`/brigadirs/${id}`),

  create: (data: CreateBrigadirPayload, admin?: string): Promise<BrigadirApi> =>
    req('/brigadirs', { method: 'POST', headers: h(admin), body: JSON.stringify(data) }),

  update: (id: string, data: UpdateBrigadirPayload, admin?: string): Promise<BrigadirApi> =>
    req(`/brigadirs/${id}`, { method: 'PATCH', headers: h(admin), body: JSON.stringify(data) }),

  remove: (id: string, admin?: string): Promise<void> =>
    req(`/brigadirs/${id}`, { method: 'DELETE', headers: admin ? { 'X-Admin-Name': admin } : {} }),

  assignWorker: (brigadirId: string, workerId: string, admin?: string) =>
    req<{ ok: boolean }>(`/brigadirs/${brigadirId}/assign-worker`, {
      method: 'POST',
      headers: h(admin),
      body: JSON.stringify({ workerId }),
    }),

  unassignWorker: (brigadirId: string, workerId: string, admin?: string) =>
    req<{ ok: boolean }>(`/brigadirs/${brigadirId}/workers/${workerId}`, {
      method: 'DELETE',
      headers: admin ? { 'X-Admin-Name': admin } : {},
    }),

  importExcel: (file: File, admin?: string) => {
    const form = new FormData();
    form.append('file', file);
    return req<{ imported: number }>('/brigadirs/import/excel', {
      method: 'POST',
      headers: admin ? { 'X-Admin-Name': admin } : {},
      body: form,
    });
  },
};
