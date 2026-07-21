import type { MobileRole } from '../api/workers'
import type { WorkerStatus } from '../types/tenant'
import type { BadgeVariant } from '../components/ui/Badge'

export const MOBILE_ROLES: MobileRole[] = ['worker', 'foreman', 'site_chief', 'section_chief']
export const WORKER_STATUSES: WorkerStatus[] = ['Active', 'Inactive', 'Suspended', 'Transferred', 'Terminated']
export const MESAI_SISTEMLERI = ['Saatlik', 'Aylık']

export const ROLE_LABELS: Record<MobileRole, string> = {
  worker: 'Işçi',
  foreman: 'Foremen',
  site_chief: 'Site Chief',
  section_chief: 'Bölüm Başlygy',
}

export const ROLE_VARIANTS: Record<MobileRole, BadgeVariant> = {
  worker: 'neutral',
  foreman: 'info',
  site_chief: 'warning',
  section_chief: 'danger',
}

export function statusBadge(status: WorkerStatus): { label: string; variant: BadgeVariant } {
  const map: Record<WorkerStatus, { label: string; variant: BadgeVariant }> = {
    Active: { label: 'Aktif', variant: 'success' },
    Inactive: { label: 'Pasif', variant: 'neutral' },
    Suspended: { label: 'Askıda', variant: 'warning' },
    Transferred: { label: 'Transfer', variant: 'info' },
    Terminated: { label: 'Işden çykan', variant: 'danger' },
  }

  return map[status]
}
