import { apiFetch } from './http';

export interface AttendanceEventRecord {
  id: string;
  workerName: string;
  employeeNumber: string;
  cardUid: string;
  eventType: 'CHECK_IN' | 'CHECK_OUT';
  eventTime: number;
  source: string;
  createdAt: string;
}

export interface DailySession {
  checkIn: number;
  checkOut: number | null;
}

export interface DailySummaryRecord {
  employeeNumber: string;
  workerName: string;
  sessions: DailySession[];
  totalMs: number;
}

const request = apiFetch;

export const attendanceEventsApi = {
  list: (params?: { date?: string; limit?: number }): Promise<AttendanceEventRecord[]> => {
    const qs = new URLSearchParams();
    if (params?.date) qs.set('date', params.date);
    if (params?.limit) qs.set('limit', String(params.limit));
    const q = qs.toString();
    return request(`/attendance/events${q ? '?' + q : ''}`);
  },

  dailySummary: (date?: string): Promise<DailySummaryRecord[]> => {
    const qs = date ? `?date=${date}` : '';
    return request(`/attendance/daily-summary${qs}`);
  },
};
