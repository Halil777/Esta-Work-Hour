import { apiFetch as req } from './http';

export type ReportType =
  | 'daily_all'
  | 'daily_staff'
  | 'daily_shift_day'
  | 'daily_shift_night'
  | 'daily_attended'
  | 'daily_absent';

export const REPORT_TYPE_LABELS: Record<ReportType, string> = {
  daily_all:         'Ähli işçiler',
  daily_staff:       'Staff Personal',
  daily_shift_day:   'Gündiz Shift',
  daily_shift_night: 'Gije Shift',
  daily_attended:    'Diňe gelenler',
  daily_absent:      'Diňe gelmedikler',
};

export interface ReportScheduleItem {
  id: string;
  label: string;
  time: string;
  enabled: boolean;
  reportType: ReportType;
  lastSentDate: string | null;
}

export interface MonthlySchedule {
  enabled: boolean;
  time: string;
  emails: string[];
  lastSentMonth: string | null;
}

export interface ReportConfigDto {
  emails: string[];
  schedules: ReportScheduleItem[];
  monthlySchedule: MonthlySchedule;
}

export interface RangeRow {
  workerId: string;
  name: string;
  profession: string;
  brigade: string;
  totalMs: number;
  daysPresent: number;
}

export interface RangeData {
  rows: RangeRow[];
  startDate: string;
  endDate: string;
  totalWorkers: number;
  totalMs: number;
  daysInRange: number;
}

// ── Config CRUD ────────────────────────────────────────────────────────────────

export const reportConfigApi = {
  getConfig: () => req<ReportConfigDto>('/report-config'),

  saveAll: (
    emails: string[],
    schedules: ReportScheduleItem[],
    monthlySchedule?: MonthlySchedule,
  ) =>
    req<void>('/report-config', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ emails, schedules, monthlySchedule }),
    }),

  // Daily send-now
  sendNow: (date?: string, reportType: ReportType = 'daily_all') => {
    const params = new URLSearchParams();
    if (date) params.set('date', date);
    params.set('reportType', reportType);
    return req<{ ok: boolean }>(`/report-config/send-now?${params.toString()}`, { method: 'POST' });
  },

  // Range send by email
  sendRange: (
    startDate: string,
    endDate: string,
    workerIds?: string[],
    customEmails?: string[],
  ) =>
    req<{ ok: boolean; message: string }>('/report-config/send-range', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ startDate, endDate, workerIds, customEmails }),
    }),
};

// ── Range data (preview) ────────────────────────────────────────────────────────

export const reportsApi = {
  getRangeData: (startDate: string, endDate: string, workerIds?: string[]) => {
    const params = new URLSearchParams({ startDate, endDate });
    if (workerIds && workerIds.length > 0) params.set('workerIds', workerIds.join(','));
    return req<RangeData>(`/reports/range-data?${params.toString()}`);
  },

  /** Downloads xlsx as a Blob for browser save */
  downloadRangeXlsx: async (
    startDate: string,
    endDate: string,
    workerIds?: string[],
  ): Promise<void> => {
    const token = localStorage.getItem('adminJwt');
    const params = new URLSearchParams({ startDate, endDate });
    if (workerIds && workerIds.length > 0) params.set('workerIds', workerIds.join(','));

    const res = await fetch(`/api/reports/range-xlsx?${params.toString()}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) throw new Error(`Download failed: ${res.status}`);

    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `is-sagatlary-${startDate}-${endDate}.xlsx`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  },
};
