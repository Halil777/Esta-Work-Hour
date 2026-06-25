const BASE = '/api';
async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, init);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export type AbsenceNote = {
  id: string;
  workerEntityId: string;
  workerName: string;
  workerId: string;
  date: string;
  note: string;
  createdBy: string;
  createdByName: string;
  createdAt: string;
};

export const absenceNotesApi = {
  getForDate: (date: string) => req<AbsenceNote[]>(`/absence-notes?date=${date}`),
  getForWorker: (workerEntityId: string) => req<AbsenceNote[]>(`/absence-notes/worker/${workerEntityId}`),
  upsert: (workerEntityId: string, date: string, note: string, createdByName: string) =>
    req<AbsenceNote>('/absence-notes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ workerEntityId, date, note, createdByName }),
    }),
  remove: (id: string) => req<void>(`/absence-notes/${id}`, { method: 'DELETE' }),
};
