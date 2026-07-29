import type { AuthUser } from '../types/tenant';
import { apiFetch } from './http';

export type AdminLoginResponse = {
  token: string;
  deviceToken: string | null;
  user: AuthUser;
};

export const adminAuthApi = {
  login: async (username: string, password: string): Promise<AdminLoginResponse> => {
    const res = await fetch('/api/admin/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error((err as any).message ?? 'Login failed');
    }
    return res.json();
  },

  getDeviceToken: (): Promise<{ deviceToken: string | null }> =>
    apiFetch('/admin/auth/device-token'),

  regenerateDeviceToken: (): Promise<{ deviceToken: string }> =>
    apiFetch('/admin/auth/device-token/regenerate', { method: 'POST' }),
};
