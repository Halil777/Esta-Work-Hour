const BASE = '/api';

function authHeaders(): Record<string, string> {
  const token = localStorage.getItem('adminJwt');
  return token ? { 'Authorization': `Bearer ${token}` } : {};
}

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      ...authHeaders(),
      ...init?.headers,
    },
  });
  if (res.status === 401) {
    localStorage.removeItem('adminJwt');
    window.location.href = '/login';
    throw new Error('Sesiýa tamam boldy, täzeden giriň');
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as any).message ?? `Request failed: ${res.status}`);
  }
  return res.json();
}
