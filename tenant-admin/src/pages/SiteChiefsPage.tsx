import { useQuery } from '@tanstack/react-query'
import { ShieldCheck } from 'lucide-react'
import { extraHoursApi } from '../api/extraHours'
import { Badge } from '../components/ui/Badge'
import { RoleWorkersPage } from '../components/workers/RoleWorkersPage'
import { useTranslation } from '../i18n/useTranslation'

type SiteChiefStats = {
  total: number
  pending: number
  approved: number
  rejected: number
  totalHrs: number
}

export function SiteChiefsPage() {
  const { t } = useTranslation()
  const { data: extraRequests = [] } = useQuery({
    queryKey: ['extra-hours', 'all'],
    queryFn: () => extraHoursApi.list(),
  })

  const statsMap = new Map<string, SiteChiefStats>()
  for (const request of extraRequests) {
    const key = request.siteChiefWorkerEntityId
    const stats = statsMap.get(key) ?? { total: 0, pending: 0, approved: 0, rejected: 0, totalHrs: 0 }

    stats.total += 1
    if (request.status === 'pending' || request.status === 'seen') stats.pending += 1
    if (request.status === 'approved') {
      stats.approved += 1
      stats.totalHrs += request.items.reduce((sum, item) => sum + Number(item.extraHours), 0)
    }
    if (request.status === 'rejected') stats.rejected += 1

    statsMap.set(key, stats)
  }

  return (
    <RoleWorkersPage
      role="site_chief"
      title={t.siteChiefsPage.title}
      icon={<ShieldCheck size={20} />}
      countVariant="info"
      emptyIcon={<ShieldCheck size={40} />}
      emptyText={t.siteChiefsPage.emptyText}
      columns={[
        {
          header: t.siteChiefsPage.colWorker,
          render: worker => <div style={{ fontWeight: 600 }}>{worker.name}</div>,
        },
        {
          header: t.siteChiefsPage.colRegNo,
          render: worker => <code className="td-mono">{worker.workerId}</code>,
        },
        {
          header: t.siteChiefsPage.colPosition,
          render: worker => (
            <span style={{ color: 'var(--text-secondary)', fontSize: 12 }}>
              {worker.profession || '-'}
            </span>
          ),
        },
        {
          header: t.siteChiefsPage.colTotal,
          render: worker => <span style={{ fontWeight: 700 }}>{statsMap.get(worker.id)?.total ?? 0}</span>,
        },
        {
          header: t.siteChiefsPage.colPending,
          render: worker => {
            const value = statsMap.get(worker.id)?.pending ?? 0
            return value > 0 ? <Badge variant="warning">{value}</Badge> : <span className="td-muted">-</span>
          },
        },
        {
          header: t.siteChiefsPage.colApproved,
          render: worker => {
            const value = statsMap.get(worker.id)?.approved ?? 0
            return value > 0 ? <Badge variant="success">{value}</Badge> : <span className="td-muted">-</span>
          },
        },
        {
          header: t.siteChiefsPage.colRejected,
          render: worker => {
            const value = statsMap.get(worker.id)?.rejected ?? 0
            return value > 0 ? <Badge variant="danger">{value}</Badge> : <span className="td-muted">-</span>
          },
        },
        {
          header: t.siteChiefsPage.colApprovedHrs,
          render: worker => {
            const value = statsMap.get(worker.id)?.totalHrs ?? 0
            return value > 0
              ? <span style={{ color: 'var(--primary)', fontWeight: 700 }}>{value}h</span>
              : <span className="td-muted">-</span>
          },
        },
      ]}
    />
  )
}
