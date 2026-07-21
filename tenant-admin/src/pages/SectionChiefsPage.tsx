import { HardHat } from 'lucide-react'
import { Badge } from '../components/ui/Badge'
import { RoleWorkersPage } from '../components/workers/RoleWorkersPage'

export function SectionChiefsPage() {
  return (
    <RoleWorkersPage
      role="section_chief"
      title="Bölüm Başlyklary"
      icon={<HardHat size={20} />}
      countVariant="warning"
      emptyIcon={<HardHat size={40} />}
      emptyText={'Bölüm başlygy ýok. Excel import wagtynda Görev: "... SEFI" ýazgylary awtomatik bu topara girýär.'}
      description={(
        <>
          Excel import wagtynda Görev meýdany <strong>SEFI</strong> ýa-da <strong>ŞEFI</strong> bilen gutarýan
          işçiler awtomatik bu topara girýär. Olar formenlere birikdirilip bilinmez.
        </>
      )}
      columns={[
        {
          header: '#',
          render: (_worker, index) => <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>{index + 1}</span>,
        },
        {
          header: 'Ady',
          render: worker => <span style={{ fontWeight: 600 }}>{worker.name}</span>,
        },
        {
          header: 'Sicil No',
          render: worker => <code className="td-mono">{worker.workerId}</code>,
        },
        {
          header: 'Wezipesi',
          render: worker => (
            <span style={{ fontSize: 12, color: 'var(--warning)', fontWeight: 600 }}>
              {worker.profession || '-'}
            </span>
          ),
        },
        {
          header: 'Ekip',
          render: worker => (
            <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
              {worker.brigadeName || '-'}
            </span>
          ),
        },
        {
          header: 'Status',
          render: worker => <Badge variant={worker.status === 'Active' ? 'success' : 'neutral'}>{worker.status}</Badge>,
        },
      ]}
    />
  )
}
