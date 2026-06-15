import React from 'react'
import { View, Text, StyleSheet } from 'react-native'
import type { SyncStatus } from '../types'
import { palette } from '../theme/colors'

interface Props { status: SyncStatus }

const config: Record<SyncStatus, { label: string; color: string }> = {
  local: { label: 'Local', color: palette.neutral },
  pending: { label: 'Pending', color: palette.warning },
  syncing: { label: 'Syncing…', color: palette.info },
  synced: { label: 'Synced', color: palette.success },
  failed: { label: 'Failed', color: palette.danger },
  conflict: { label: 'Conflict', color: palette.danger },
}

export function SyncBadge({ status }: Props) {
  const { label, color } = config[status]
  return (
    <View style={[s.badge, { backgroundColor: color + '22', borderColor: color + '44' }]}>
      <View style={[s.dot, { backgroundColor: color }]} />
      <Text style={[s.text, { color }]}>{label}</Text>
    </View>
  )
}

const s = StyleSheet.create({
  badge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 99, borderWidth: 1 },
  dot: { width: 5, height: 5, borderRadius: 99 },
  text: { fontSize: 10, fontWeight: '600' },
})
