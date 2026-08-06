import { apiClient } from './client'

export interface MissingCheckInWorker {
  workerId: string
  name: string
  team: string
  checkOutTime: number
}

export interface MissingCheckInResponse {
  date: string
  count: number
  workers: MissingCheckInWorker[]
}

export interface ShiftAlertWorker {
  workerId: string
  name: string
  team: string
}

export interface ShiftAlertData {
  startTime: string
  graceEndTime: string
  graceExpired: boolean
  workers: ShiftAlertWorker[]
}

export interface ShiftAlertsResponse {
  day: ShiftAlertData
  night: ShiftAlertData
}

export interface AnomalySchedule {
  missingCheckInEnabled: boolean
  shiftAlertEnabled: boolean
  dayShiftLastAlertDate: string | null
  nightShiftLastAlertDate: string | null
}

export const anomaliesApi = {
  getMissingCheckIn(date?: string): Promise<MissingCheckInResponse> {
    const params = date ? `?date=${date}` : ''
    return apiClient.get(`/admin/attendance-anomalies/missing-checkin${params}`)
  },

  getShiftAlerts(): Promise<ShiftAlertsResponse> {
    return apiClient.get('/admin/attendance-anomalies/shift-alerts')
  },

  getSchedule(): Promise<AnomalySchedule> {
    return apiClient.get('/admin/attendance-anomalies/schedule')
  },

  updateSchedule(patch: Partial<Pick<AnomalySchedule, 'missingCheckInEnabled' | 'shiftAlertEnabled'>>): Promise<AnomalySchedule> {
    return apiClient.patch('/admin/attendance-anomalies/schedule', patch)
  },
}
