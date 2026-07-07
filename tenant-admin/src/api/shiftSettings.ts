import { apiFetch as req } from './http';

export type ShiftSetting = {
  id: string;
  shiftType: 'day' | 'night';
  startTime: string;
  endTime: string;
  graceMinutes: number;
};

export const shiftSettingsApi = {
  getAll: () => req<ShiftSetting[]>('/shift-settings'),
  update: (shiftType: 'day' | 'night', startTime: string, endTime: string, graceMinutes: number) =>
    req<ShiftSetting>(`/shift-settings/${shiftType}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ startTime, endTime, graceMinutes }),
    }),
};
