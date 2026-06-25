const BASE = '/api';
async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, init);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export type AttendanceOverride = {
  id: string;
  workerEntityId: string;
  date: string;
  checkInMs: number | null;
  checkOutMs: number | null;
  note: string | null;
  createdBy: string;
};

export const attendanceOverridesApi = {
  getForWorker: (workerEntityId: string, startDate?: string, endDate?: string) => {
    const qs = new URLSearchParams({ workerEntityId });
    if (startDate) qs.set('startDate', startDate);
    if (endDate) qs.set('endDate', endDate);
    return req<AttendanceOverride[]>(`/attendance-overrides?${qs}`);
  },
  upsert: (workerEntityId: string, date: string, checkInMs: number | null, checkOutMs: number | null, note: string | null, createdBy: string) =>
    req<AttendanceOverride>('/attendance-overrides', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ workerEntityId, date, checkInMs, checkOutMs, note, createdBy }),
    }),
  remove: (workerEntityId: string, date: string) =>
    req<void>(`/attendance-overrides?workerEntityId=${workerEntityId}&date=${date}`, { method: 'DELETE' }),
};
