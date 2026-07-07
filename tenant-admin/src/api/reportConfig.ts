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

export interface ReportConfigDto {
  emails: string[];
  schedules: ReportScheduleItem[];
}

export const reportConfigApi = {
  getConfig: () => req<ReportConfigDto>('/report-config'),
  saveAll: (emails: string[], schedules: ReportScheduleItem[]) =>
    req<void>('/report-config', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ emails, schedules }),
    }),
  sendNow: (date?: string, reportType: ReportType = 'daily_all') => {
    const params = new URLSearchParams();
    if (date) params.set('date', date);
    params.set('reportType', reportType);
    return req<{ ok: boolean }>(`/report-config/send-now?${params.toString()}`, { method: 'POST' });
  },
};
