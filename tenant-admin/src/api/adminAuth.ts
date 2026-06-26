import type { AuthUser } from '../types/tenant';

export type AdminLoginResponse = {
  token: string;
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
};
