import { apiFetch } from './http'

export type AdjustmentType = 'ADD' | 'SUBTRACT' | 'SET' | 'MINIMUM' | 'BONUS'
export type AdjustmentStatus = 'ACTIVE' | 'CANCELLED'

export interface AdjustmentReason {
  id: string
  tenantId: string
  name: string
  description: string | null
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export interface WorkAdjustment {
  id: string
  workerEntityId: string
  workDate: string
  adjustmentType: AdjustmentType
  minutes: number
  reasonId: string | null
  reasonLabel: string | null
  description: string | null
  sourceType: string
  bulkId: string | null
  status: AdjustmentStatus
  createdBy: string
  updatedBy: string | null
  createdAt: string
  updatedAt: string
}

export interface WorkerSummaryRow {
  workerEntityId: string
  workerId: string
  name: string
  profession: string
  brigade: string
  shift: 'day' | 'night' | null
  actualMinutes: number
  adjustmentMinutes: number
  creditedMinutes: number
}

export interface MonthSummary {
  month: string
  totals: {
    actualMinutes: number
    adjustmentMinutes: number
    creditedMinutes: number
  }
  workers: WorkerSummaryRow[]
}

export interface DayRow {
  workDate: string
  actualMinutes: number
  adjustmentMinutes: number
  creditedMinutes: number
  checkIn: number | null
  checkOut: number | null
  adjustments: WorkAdjustment[]
}

export interface WorkerTimesheet {
  workerEntityId: string
  workerId: string
  name: string
  profession: string
  brigade: string
  shift: 'day' | 'night' | null
  month: string
  totalActualMinutes: number
  totalAdjustmentMinutes: number
  totalCreditedMinutes: number
  days: DayRow[]
}

export interface DayWorkerRow {
  workerEntityId: string
  workerId: string
  name: string
  profession: string
  brigade: string
  shift: 'day' | 'night' | null
  isStaff: boolean
  mesaiSistemi: string
  actualMinutes: number
  creditedMinutes: number
  adjustmentMinutes: number
  checkIn: number | null
  checkOut: number | null
  hasScan: boolean
  adjustments: {
    id: string
    adjustmentType: AdjustmentType
    minutes: number
    reasonId: string | null
    reasonLabel: string | null
    description: string | null
  }[]
}

export interface DaySummary {
  date: string
  workers: DayWorkerRow[]
}

export interface AdjustmentLog {
  id: string
  adjustmentId: string
  workerEntityId: string
  workDate: string
  action: 'CREATED' | 'UPDATED' | 'CANCELLED'
  oldValue: any
  newValue: any
  changedBy: string
  changeReason: string | null
  changedAt: string
}

// ── Work Time ──────────────────────────────────────────────────────────────────

export const workTimeApi = {
  getMonthSummary: (month: string) =>
    apiFetch<MonthSummary>(`/admin/work-time/month-summary?month=${month}`),

  getWorkerTimesheet: (workerEntityId: string, month: string) =>
    apiFetch<WorkerTimesheet>(
      `/admin/work-time/timesheet?workerEntityId=${workerEntityId}&month=${month}`,
    ),

  getDaySummary: (date: string) =>
    apiFetch<DaySummary>(`/admin/work-time/day-summary?date=${date}`),

  exportXlsx: async (month: string, mode: 'times' | 'hours' | 'both', lang?: string): Promise<void> => {
    const token = localStorage.getItem('adminJwt');
    const params = new URLSearchParams({ month, mode });
    if (lang) params.set('lang', lang);
    const res = await fetch(`/api/admin/work-time/export-xlsx?${params}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (res.status === 401) {
      localStorage.removeItem('adminJwt');
      window.location.href = '/login';
      throw new Error('Sesiýa tamam boldy');
    }
    if (!res.ok) throw new Error(`Export ýalňyşlyk: ${res.status}`);
    const blob = await res.blob();
    const prefixes: Record<string, string> = { en: 'work-time', ru: 'rabochee-vremya', tr: 'mesai-takibi' };
    const prefix = prefixes[lang ?? ''] ?? 'mesai-takibi';
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `${prefix}-${month}-${mode}.xlsx`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  },
}

// ── Adjustment Reasons ─────────────────────────────────────────────────────────

export const reasonsApi = {
  getAll: () =>
    apiFetch<AdjustmentReason[]>('/admin/adjustment-reasons'),

  create: (data: { name: string; description?: string }) =>
    apiFetch<AdjustmentReason>('/admin/adjustment-reasons', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }),

  update: (id: string, data: { name?: string; description?: string | null; isActive?: boolean }) =>
    apiFetch<AdjustmentReason>(`/admin/adjustment-reasons/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }),
}

// ── Work Adjustments ───────────────────────────────────────────────────────────

export interface AdjustmentAnalyticsDay {
  date: string
  actualMs: number
  creditedMs: number
  diffMs: number
  adjustments: {
    id: string
    adjustmentType: AdjustmentType
    minutes: number
    reasonLabel: string | null
    description: string | null
    createdBy: string
    createdAt: string
  }[]
}

export interface AdjustmentAnalyticsWorker {
  workerEntityId: string
  workerId: string
  name: string
  profession: string
  brigade: string
  adjustmentCount: number
  totalIncreaseMs: number
  totalDecreaseMs: number
  netDiffMs: number
  days: AdjustmentAnalyticsDay[]
}

export interface AdjustmentAnalytics {
  startDate: string | null
  endDate: string | null
  summary: {
    totalAdjustments: number
    workersAffected: number
    totalIncreaseMs: number
    totalDecreaseMs: number
    netDiffMs: number
  }
  workers: AdjustmentAnalyticsWorker[]
}

export const adjustmentsApi = {
  getAnalytics: (startDate?: string, endDate?: string) => {
    const params = new URLSearchParams()
    if (startDate) params.set('startDate', startDate)
    if (endDate) params.set('endDate', endDate)
    const q = params.toString()
    return apiFetch<AdjustmentAnalytics>(`/admin/work-adjustments/analytics${q ? `?${q}` : ''}`)
  },

  create: (data: {
    workerEntityId: string
    workDate: string
    adjustmentType: AdjustmentType
    minutes: number
    reasonId?: string
    description?: string
  }) =>
    apiFetch<WorkAdjustment>('/admin/work-adjustments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }),

  createBulk: (data: {
    workerEntityIds: string[]
    workDate: string
    adjustmentType: AdjustmentType
    minutes: number
    reasonId?: string
    description?: string
  }) =>
    apiFetch<WorkAdjustment[]>('/admin/work-adjustments/bulk', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }),

  update: (id: string, data: {
    adjustmentType?: AdjustmentType
    minutes?: number
    reasonId?: string | null
    description?: string | null
    changeReason?: string
  }) =>
    apiFetch<WorkAdjustment>(`/admin/work-adjustments/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }),

  cancel: (id: string, reason?: string) => {
    const q = reason ? `?reason=${encodeURIComponent(reason)}` : ''
    return apiFetch<void>(`/admin/work-adjustments/${id}${q}`, { method: 'DELETE' })
  },

}
