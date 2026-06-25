const BASE = '/api';

async function request<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`);
  if (!res.ok) throw new Error(`Request failed: ${res.status}`);
  return res.json();
}

export type DaySummary = {
  date: string;
  totalMs: number;
  checkIn: number | null;
  checkOut: number | null;
  sessions: { checkIn: number; checkOut: number | null }[];
};

export type WorkerSummaryResponse = {
  worker: {
    id: string;
    workerId: string;
    name: string;
    profession: string;
    brigadeName: string;
    status: string;
    mesaiSistemi: string;
    shift: 'day' | 'night' | null;
    hireDate: string | null;
    phone: string | null;
    mobileRole: string;
    extraSaat: number;
    nfcCardUid: string | null;
  };
  days: DaySummary[];
  totalMs: number;
};

export const attendanceApi = {
  getWorkerSummary: (workerEntityId: string, startDate?: string, endDate?: string) => {
    const qs = new URLSearchParams({ workerEntityId });
    if (startDate) qs.set('startDate', startDate);
    if (endDate) qs.set('endDate', endDate);
    return request<WorkerSummaryResponse>(`/attendance/worker-summary?${qs}`);
  },
};
