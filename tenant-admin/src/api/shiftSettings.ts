const BASE = '/api';
async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, init);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export type ShiftSetting = { id: string; shiftType: 'day' | 'night'; startTime: string; graceMinutes: number };

export const shiftSettingsApi = {
  getAll: () => req<ShiftSetting[]>('/shift-settings'),
  update: (shiftType: 'day' | 'night', startTime: string, graceMinutes: number) =>
    req<ShiftSetting>(`/shift-settings/${shiftType}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ startTime, graceMinutes }),
    }),
};
