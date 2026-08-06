import { apiFetch } from './http'

export interface AttendanceChartPoint {
  date: string
  present: number
  absent: number
  total: number
}

export interface TopWorkerItem {
  workerId: string
  name: string
  totalHours: number
  daysPresent: number
}

export interface DashboardSchedule {
  enabled: boolean
  time: string       // HH:MM
  emails: string[]
  lastSentDate: string | null
}

export const analyticsApi = {
  getAttendanceChart: (startDate: string, endDate: string) =>
    apiFetch<AttendanceChartPoint[]>(
      `/admin/analytics/attendance-chart?startDate=${startDate}&endDate=${endDate}`,
    ),

  getTopWorkers: (startDate: string, endDate: string, limit = 10) =>
    apiFetch<TopWorkerItem[]>(
      `/admin/analytics/top-workers?startDate=${startDate}&endDate=${endDate}&limit=${limit}`,
    ),

  getDashboardSchedule: () =>
    apiFetch<DashboardSchedule>('/admin/analytics/dashboard-schedule'),

  updateDashboardSchedule: (schedule: Omit<DashboardSchedule, 'lastSentDate'>) =>
    apiFetch<DashboardSchedule>('/admin/analytics/dashboard-schedule', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(schedule),
    }),

  sendDashboardNow: (payload: { startDate: string; endDate: string; emails?: string[] }) =>
    apiFetch<{ ok: boolean }>('/admin/analytics/send-dashboard', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }),
}
