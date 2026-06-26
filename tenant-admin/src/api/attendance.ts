import { apiFetch as request } from './http';

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

export type MissingCheckout = {
  workerEntityId: string;
  workerName: string;
  workerId: string;
  profession: string;
  brigadeName: string;
  checkInTime: number;
  hoursAgo: number;
  foremanWorkerEntityId: string | null;
};

export const attendanceApi = {
  getWorkerSummary: (workerEntityId: string, startDate?: string, endDate?: string) => {
    const qs = new URLSearchParams({ workerEntityId });
    if (startDate) qs.set('startDate', startDate);
    if (endDate) qs.set('endDate', endDate);
    return request<WorkerSummaryResponse>(`/attendance/worker-summary?${qs}`);
  },

  getMissingCheckouts: () => request<MissingCheckout[]>('/attendance/missing-checkouts'),
};
