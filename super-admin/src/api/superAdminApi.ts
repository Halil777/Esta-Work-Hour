const BASE = '/api';

function authHeaders(): Record<string, string> {
  const token = localStorage.getItem('superAdminJwt');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders(),
      ...init?.headers,
    },
  });
  if (res.status === 401) {
    localStorage.removeItem('superAdminJwt');
    window.location.href = '/login';
    throw new Error('Sesiýa tamam boldy');
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as any).message ?? `Request failed: ${res.status}`);
  }
  return res.json();
}

export type TenantDto = {
  id: string;
  name: string;
  adminUsername: string;
  logoUrl: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type TenantStat = {
  tenantId: string;
  tenantName: string;
  isActive: boolean;
  totalWorkers: number;
  activeWorkers: number;
  checkedInToday: number;
  lastActivityAt: string | null;
};

export type SuperAdminStats = {
  totalTenants: number;
  activeTenants: number;
  totalWorkers: number;
  activeWorkers: number;
  checkedInToday: number;
  tenants: TenantStat[];
  trend7d: { date: string; scans: number; workers: number }[];
};

export type SuperAdminWorker = {
  workerId: string;
  name: string;
  profession: string;
  brigadeName: string;
  tenantId: string;
  tenantName: string;
  status: string;
  shift: string | null;
};

export type CreateTenantPayload = {
  name: string;
  adminUsername: string;
  adminPassword: string;
  logoUrl?: string;
  isActive?: boolean;
};

export type UpdateTenantPayload = {
  name?: string;
  adminUsername?: string;
  adminPassword?: string;
  logoUrl?: string;
  isActive?: boolean;
};

export const superAdminApi = {
  login: async (username: string, password: string) => {
    const res = await fetch(`${BASE}/super-admin/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error((err as any).message ?? 'Login failed');
    }
    return res.json() as Promise<{ token: string; user: { name: string; role: string } }>;
  },

  stats: () => apiFetch<SuperAdminStats>('/super-admin/tenants/stats'),
  workforce: () => apiFetch<SuperAdminWorker[]>('/super-admin/tenants/workforce'),

  tenants: {
    list: () => apiFetch<TenantDto[]>('/super-admin/tenants'),
    get: (id: string) => apiFetch<TenantDto>(`/super-admin/tenants/${id}`),
    create: (data: CreateTenantPayload) =>
      apiFetch<TenantDto>('/super-admin/tenants', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    update: (id: string, data: UpdateTenantPayload) =>
      apiFetch<TenantDto>(`/super-admin/tenants/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),
    remove: (id: string) =>
      apiFetch<{ success: boolean }>(`/super-admin/tenants/${id}`, { method: 'DELETE' }),
  },
};
