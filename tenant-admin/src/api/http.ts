const BASE = '/api';

function adminHeaders(): Record<string, string> {
  const token = localStorage.getItem('adminToken');
  return token ? { 'X-Admin-Token': token } : {};
}

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      ...adminHeaders(),
      ...init?.headers,
    },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as any).message ?? `Request failed: ${res.status}`);
  }
  return res.json();
}
