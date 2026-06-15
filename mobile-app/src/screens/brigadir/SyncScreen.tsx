import React, { useState } from 'react'
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native'
import { useApp } from '../../context/AppContext'
import { SyncBadge } from '../../components/SyncBadge'
import { palette } from '../../theme/colors'

export function SyncScreen() {
  const { colors, t, attendance, syncQueue, isOnline, syncNow } = useApp()
  const [syncing, setSyncing] = useState(false)

  const pendingAtt = attendance.filter(a => a.syncStatus === 'local' || a.syncStatus === 'pending')
  const totalPending = pendingAtt.length + syncQueue.filter(i => i.status === 'pending').length

  const handleSync = async () => {
    setSyncing(true)
    await syncNow()
    setSyncing(false)
  }

  return (
    <ScrollView style={[s.root, { backgroundColor: colors.bg }]} contentContainerStyle={s.content}>
      {/* Status card */}
      <View style={[s.statusCard, { backgroundColor: isOnline ? palette.successLight : palette.dangerLight, borderColor: isOnline ? palette.success : palette.danger }]}>
        <Text style={{ fontSize: 32 }}>{isOnline ? '🌐' : '📵'}</Text>
        <View>
          <Text style={[s.statusTitle, { color: isOnline ? palette.success : palette.danger }]}>
            {isOnline ? t.sync.connected : t.sync.noConnection}
          </Text>
          <Text style={[s.statusSub, { color: isOnline ? palette.success : palette.danger }]}>
            {totalPending > 0 ? `${totalPending} ${t.sync.pendingItems}` : t.sync.allSynced}
          </Text>
        </View>
      </View>

      {/* Sync button */}
      <TouchableOpacity
        style={[s.syncBtn, { backgroundColor: palette.primary, opacity: (!isOnline || syncing) ? 0.5 : 1 }]}
        onPress={handleSync}
        disabled={!isOnline || syncing}
      >
        {syncing
          ? <ActivityIndicator color="#fff" />
          : <Text style={s.syncBtnTxt}>🔄 {t.sync.syncNow}</Text>
        }
      </TouchableOpacity>

      {/* Pending attendance */}
      <View style={[s.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[s.sectionTitle, { color: colors.text }]}>Pending Attendance ({pendingAtt.length})</Text>
        {pendingAtt.length === 0 && <Text style={[s.empty, { color: colors.textMuted }]}>{t.sync.allSynced}</Text>}
        {pendingAtt.map(a => (
          <View key={a.id} style={[s.row, { borderBottomColor: colors.border }]}>
            <View style={s.rowInfo}>
              <Text style={[s.rowName, { color: colors.text }]}>{a.workerName}</Text>
              <Text style={[s.rowMeta, { color: colors.textMuted }]}>{a.date} · {a.method} · {a.status}</Text>
            </View>
            <SyncBadge status={a.syncStatus} />
          </View>
        ))}
      </View>

      {/* Queue */}
      {syncQueue.length > 0 && (
        <View style={[s.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[s.sectionTitle, { color: colors.text }]}>Sync Queue ({syncQueue.length})</Text>
          {syncQueue.map(item => (
            <View key={item.id} style={[s.row, { borderBottomColor: colors.border }]}>
              <View style={s.rowInfo}>
                <Text style={[s.rowName, { color: colors.text }]}>{item.type}</Text>
                <Text style={[s.rowMeta, { color: colors.textMuted }]}>{new Date(item.timestamp).toLocaleTimeString('ru-RU')}</Text>
              </View>
              <SyncBadge status={item.status} />
            </View>
          ))}
        </View>
      )}

      {/* Stats */}
      <View style={[s.statsCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[s.sectionTitle, { color: colors.text }]}>Attendance Summary</Text>
        {(['synced', 'local', 'pending', 'failed'] as const).map(status => {
          const count = attendance.filter(a => a.syncStatus === status).length
          return (
            <View key={status} style={s.statRow}>
              <SyncBadge status={status} />
              <Text style={[s.statCount, { color: colors.text }]}>{count} records</Text>
            </View>
          )
        })}
      </View>
    </ScrollView>
  )
}

const s = StyleSheet.create({
  root: { flex: 1 },
  content: { padding: 16, gap: 12 },
  statusCard: { flexDirection: 'row', alignItems: 'center', gap: 16, padding: 20, borderRadius: 16, borderWidth: 1 },
  statusTitle: { fontSize: 16, fontWeight: '700' },
  statusSub: { fontSize: 13, marginTop: 2 },
  syncBtn: { borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
  syncBtnTxt: { color: '#fff', fontWeight: '700', fontSize: 15 },
  card: { borderRadius: 16, borderWidth: 1, padding: 16 },
  sectionTitle: { fontSize: 15, fontWeight: '700', marginBottom: 12 },
  empty: { textAlign: 'center', paddingVertical: 12, fontSize: 13 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderBottomWidth: 1 },
  rowInfo: { flex: 1 },
  rowName: { fontSize: 13, fontWeight: '600' },
  rowMeta: { fontSize: 11, marginTop: 1 },
  statsCard: { borderRadius: 16, borderWidth: 1, padding: 16, gap: 8 },
  statRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 6 },
  statCount: { fontSize: 13, fontWeight: '600' },
})
