import React from 'react'
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native'
import { useApp } from '../../context/AppContext'
import { StatCard } from '../../components/StatCard'
import { palette } from '../../theme/colors'
import { workers } from '../../data/mockData'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'

export function BrigadirDashboardScreen() {
  const { colors, t, user, attendance } = useApp()

  const myWorkers = workers.filter(w => w.brigadeId === user?.brigadeId)
  const todayAtt = attendance.filter(a => a.brigadeId === user?.brigadeId && a.date === '2026-05-08')
  const presentCount = todayAtt.filter(a => a.status === 'Present' || a.status === 'Late').length
  const absentCount = todayAtt.filter(a => a.status !== 'Present' && a.status !== 'Late' && a.status !== 'NotMarked').length
  const notMarked = myWorkers.length - presentCount - absentCount
  const offlinePending = attendance.filter(a => a.syncStatus === 'local' || a.syncStatus === 'pending').length
  const today = new Date().toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })

  return (
    <ScrollView style={[s.root, { backgroundColor: colors.bg }]} contentContainerStyle={s.content}>
      {/* Header */}
      <View style={[s.headerCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[s.hSub, { color: colors.textMuted }]}>{today}</Text>
        <Text style={[s.hBrigade, { color: colors.text }]}>{user?.brigadeName}</Text>
        <Text style={[s.hObject, { color: colors.textSecondary }]}>{user?.objectName}</Text>
        {offlinePending > 0 && (
          <View style={[s.offlinePill, { backgroundColor: palette.warningLight }]}>
            <View style={[s.dot, { backgroundColor: palette.warning }]} />
            <Text style={[s.offlineTxt, { color: palette.warning }]}>{offlinePending} {t.sync.pendingItems}</Text>
          </View>
        )}
      </View>

      {/* Stats grid */}
      <View style={s.statsRow}>
        <StatCard label={t.dashboard.totalWorkers} value={myWorkers.length} />
        <StatCard label={t.dashboard.presentToday} value={presentCount} accent={palette.success} />
        <StatCard label={t.dashboard.absentToday} value={absentCount} accent={palette.danger} />
        <StatCard label={t.dashboard.notMarked} value={notMarked} accent={palette.warning} small />
      </View>

      {/* Progress bar */}
      <View style={[s.progressCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={s.progressHeader}>
          <Text style={[s.progressLabel, { color: colors.textSecondary }]}>Attendance progress</Text>
          <Text style={[s.progressPct, { color: colors.text }]}>
            {myWorkers.length > 0 ? Math.round(((presentCount + absentCount) / myWorkers.length) * 100) : 0}%
          </Text>
        </View>
        <View style={[s.progressBg, { backgroundColor: colors.border }]}>
          <View style={[s.progressPresent, {
            width: `${myWorkers.length > 0 ? (presentCount / myWorkers.length) * 100 : 0}%`,
            backgroundColor: palette.success,
          }]} />
          <View style={[s.progressAbsent, {
            width: `${myWorkers.length > 0 ? (absentCount / myWorkers.length) * 100 : 0}%`,
            backgroundColor: palette.danger,
          }]} />
        </View>
        <View style={s.legendRow}>
          <View style={s.legendItem}><View style={[s.legendDot, { backgroundColor: palette.success }]} /><Text style={[s.legendTxt, { color: colors.textMuted }]}>{t.common.present}</Text></View>
          <View style={s.legendItem}><View style={[s.legendDot, { backgroundColor: palette.danger }]} /><Text style={[s.legendTxt, { color: colors.textMuted }]}>{t.common.absent}</Text></View>
          <View style={s.legendItem}><View style={[s.legendDot, { backgroundColor: palette.warning }]} /><Text style={[s.legendTxt, { color: colors.textMuted }]}>{t.dashboard.notMarked}</Text></View>
        </View>
      </View>

      {/* Recent scans */}
      <View style={[s.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[s.sectionTitle, { color: colors.text }]}>Recent Scans</Text>
        {attendance.filter(a => a.brigadeId === user?.brigadeId).slice(-5).reverse().map((a) => (
          <View key={a.id} style={[s.scanRow, { borderBottomColor: colors.border }]}>
            <View style={[s.scanDot, { backgroundColor: a.status === 'Present' ? palette.success : palette.danger }]} />
            <View style={s.scanInfo}>
              <Text style={[s.scanName, { color: colors.text }]}>{a.workerName}</Text>
              <Text style={[s.scanMeta, { color: colors.textMuted }]}>{a.method} · {a.syncStatus}</Text>
            </View>
            <Text style={[s.scanStatus, { color: a.status === 'Present' ? palette.success : palette.danger }]}>{a.status}</Text>
          </View>
        ))}
        {attendance.filter(a => a.brigadeId === user?.brigadeId).length === 0 && (
          <Text style={[s.empty, { color: colors.textMuted }]}>{t.common.noData}</Text>
        )}
      </View>
    </ScrollView>
  )
}

const s = StyleSheet.create({
  root: { flex: 1 },
  content: { padding: 16, gap: 12 },
  headerCard: { borderRadius: 16, borderWidth: 1, padding: 20, gap: 4 },
  hSub: { fontSize: 12 },
  hBrigade: { fontSize: 20, fontWeight: '800', marginTop: 2 },
  hObject: { fontSize: 13 },
  offlinePill: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 99, marginTop: 8 },
  dot: { width: 6, height: 6, borderRadius: 99 },
  offlineTxt: { fontSize: 12, fontWeight: '600' },
  statsRow: { flexDirection: 'row', gap: 8 },
  progressCard: { borderRadius: 16, borderWidth: 1, padding: 16, gap: 10 },
  progressHeader: { flexDirection: 'row', justifyContent: 'space-between' },
  progressLabel: { fontSize: 13 },
  progressPct: { fontSize: 13, fontWeight: '700' },
  progressBg: { height: 8, borderRadius: 99, overflow: 'hidden', flexDirection: 'row' },
  progressPresent: { height: 8 },
  progressAbsent: { height: 8 },
  legendRow: { flexDirection: 'row', gap: 16 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendDot: { width: 7, height: 7, borderRadius: 99 },
  legendTxt: { fontSize: 11 },
  card: { borderRadius: 16, borderWidth: 1, padding: 16 },
  sectionTitle: { fontSize: 15, fontWeight: '700', marginBottom: 12 },
  scanRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 9, borderBottomWidth: 1 },
  scanDot: { width: 8, height: 8, borderRadius: 99, flexShrink: 0 },
  scanInfo: { flex: 1 },
  scanName: { fontSize: 13, fontWeight: '600' },
  scanMeta: { fontSize: 11, marginTop: 1 },
  scanStatus: { fontSize: 12, fontWeight: '600' },
  empty: { fontSize: 13, textAlign: 'center', paddingVertical: 20 },
})
