import { HardHat } from 'lucide-react'
import { Badge } from '../components/ui/Badge'
import { RoleWorkersPage } from '../components/workers/RoleWorkersPage'
import { useTranslation } from '../i18n/useTranslation'

export function SectionChiefsPage() {
  const { t } = useTranslation()
  return (
    <RoleWorkersPage
      role="section_chief"
      title={t.sectionChiefsPage.title}
      icon={<HardHat size={20} />}
      countVariant="warning"
      emptyIcon={<HardHat size={40} />}
      emptyText={t.sectionChiefsPage.emptyText}
      description={<>{t.sectionChiefsPage.description}</>}
      columns={[
        {
          header: '#',
          render: (_worker, index) => <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>{index + 1}</span>,
        },
        {
          header: t.sectionChiefsPage.colName,
          render: worker => <span style={{ fontWeight: 600 }}>{worker.name}</span>,
        },
        {
          header: t.sectionChiefsPage.colRegNo,
          render: worker => <code className="td-mono">{worker.workerId}</code>,
        },
        {
          header: t.sectionChiefsPage.colPosition,
          render: worker => (
            <span style={{ fontSize: 12, color: 'var(--warning)', fontWeight: 600 }}>
              {worker.profession || '-'}
            </span>
          ),
        },
        {
          header: t.sectionChiefsPage.colTeam,
          render: worker => (
            <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
              {worker.brigadeName || '-'}
            </span>
          ),
        },
        {
          header: t.sectionChiefsPage.colStatus,
          render: worker => <Badge variant={worker.status === 'Active' ? 'success' : 'neutral'}>{worker.status}</Badge>,
        },
      ]}
    />
  )
}
