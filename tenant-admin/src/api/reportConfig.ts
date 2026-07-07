import { apiFetch as req } from './http';

export interface ReportScheduleItem {
  id: string;
  label: string;
  time: string;
  enabled: boolean;
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
  sendNow: (date?: string) =>
    req<{ ok: boolean }>(`/report-config/send-now${date ? `?date=${date}` : ''}`, {
      method: 'POST',
    }),
};
