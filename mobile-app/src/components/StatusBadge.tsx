import React from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { palette } from '../theme/colors'
import type { AttendanceStatus, OvertimeStatus } from '../types'

const attendanceColor: Record<AttendanceStatus, string> = {
  Present: palette.success,
  Absent: palette.danger,
  Late: palette.warning,
  Medical: palette.info,
  SickLeave: palette.info,
  Vacation: palette.primary,
  Unauthorized: palette.danger,
  Transferred: palette.neutral,
  NoInfo: palette.neutral,
  NotMarked: '#64748B',
}

const overtimeColor: Record<OvertimeStatus, string> = {
  Draft: palette.neutral,
  Pending: palette.warning,
  Approved: palette.success,
  Rejected: palette.danger,
  Returned: palette.info,
  Canceled: palette.neutral,
}

interface Props {
  type: 'attendance' | 'overtime'
  value: AttendanceStatus | OvertimeStatus
  label?: string
}

export function StatusBadge({ type, value, label }: Props) {
  const color = type === 'attendance'
    ? attendanceColor[value as AttendanceStatus] ?? palette.neutral
    : overtimeColor[value as OvertimeStatus] ?? palette.neutral
  const displayLabel = label ?? value

  return (
    <View style={[s.badge, { backgroundColor: color + '22', borderColor: color + '44' }]}>
      <Text style={[s.text, { color }]}>{displayLabel}</Text>
    </View>
  )
}

const s = StyleSheet.create({
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 99, borderWidth: 1 },
  text: { fontSize: 11, fontWeight: '600' },
})
