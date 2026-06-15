import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { TrendPoint } from '../../types/admin.ts'

export function AttendanceChart({ data }: { data: TrendPoint[] }) {
  return (
    <div className="chart-panel">
      <ResponsiveContainer width="100%" height={300}>
        <AreaChart data={data}>
          <defs>
            <linearGradient id="attendanceFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="var(--accent)" stopOpacity={0.35} />
              <stop offset="95%" stopColor="var(--accent)" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="overtimeFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="var(--accent-secondary)" stopOpacity={0.3} />
              <stop offset="95%" stopColor="var(--accent-secondary)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="var(--chart-grid)" vertical={false} />
          <XAxis dataKey="label" tickLine={false} axisLine={false} />
          <YAxis tickLine={false} axisLine={false} />
          <Tooltip
            contentStyle={{
              background: 'var(--surface-elevated)',
              border: '1px solid var(--border-strong)',
              borderRadius: '16px',
            }}
          />
          <Area
            type="monotone"
            dataKey="attendance"
            stroke="var(--accent)"
            fill="url(#attendanceFill)"
            strokeWidth={3}
          />
          <Area
            type="monotone"
            dataKey="overtime"
            stroke="var(--accent-secondary)"
            fill="url(#overtimeFill)"
            strokeWidth={2.5}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
