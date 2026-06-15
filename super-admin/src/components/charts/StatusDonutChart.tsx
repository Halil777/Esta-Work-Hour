import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'
import type { StatusSegment } from '../../types/admin.ts'

export function StatusDonutChart({ data }: { data: StatusSegment[] }) {
  return (
    <div className="donut-wrapper">
      <ResponsiveContainer width="100%" height={280}>
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="label"
            innerRadius={72}
            outerRadius={102}
            paddingAngle={3}
          >
            {data.map((entry) => (
              <Cell key={entry.label} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{
              background: 'var(--surface-elevated)',
              border: '1px solid var(--border-strong)',
              borderRadius: '16px',
            }}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  )
}
