import { apiFetch } from './http'

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

export interface MissingCheckOutWorker {
  workerId: string
  name: string
  team: string
  checkInTime: number
}

export interface MissingCheckOutResponse {
  count: number
  workers: MissingCheckOutWorker[]
}

export interface AnomalySchedule {
  missingCheckInEnabled: boolean
  shiftAlertEnabled: boolean
  checkOutAlertEnabled: boolean
  dayShiftLastAlertDate: string | null
  nightShiftLastAlertDate: string | null
  checkOutDayLastAlertDate: string | null
  checkOutNightLastAlertDate: string | null
}

export const anomaliesApi = {
  getMissingCheckIn(date?: string): Promise<MissingCheckInResponse> {
    const params = date ? `?date=${date}` : ''
    return apiFetch(`/admin/attendance-anomalies/missing-checkin${params}`)
  },

  getShiftAlerts(): Promise<ShiftAlertsResponse> {
    return apiFetch('/admin/attendance-anomalies/shift-alerts')
  },

  getMissingCheckOut(): Promise<MissingCheckOutResponse> {
    return apiFetch('/admin/attendance-anomalies/missing-checkout')
  },

  getSchedule(): Promise<AnomalySchedule> {
    return apiFetch('/admin/attendance-anomalies/schedule')
  },

  updateSchedule(patch: Partial<Pick<AnomalySchedule, 'missingCheckInEnabled' | 'shiftAlertEnabled' | 'checkOutAlertEnabled'>>): Promise<AnomalySchedule> {
    return apiFetch('/admin/attendance-anomalies/schedule', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    })
  },
}
