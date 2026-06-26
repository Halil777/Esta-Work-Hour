import React, { useEffect, useState } from 'react'
import { View, Text, ScrollView, StyleSheet, ActivityIndicator, RefreshControl, Alert } from 'react-native'
import { useApp } from '../../context/AppContext'
import { siteChiefApi, type ExtraHoursRequest } from '../../api'
import { palette } from '../../theme/colors'

export function ReportsScreen() {
  const { colors } = useApp()
  const [requests, setRequests] = useState<ExtraHoursRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const load = async () => {
    try {
      const data = await siteChiefApi.incomingRequests()
      setRequests(data)
    } catch (e: any) {
      Alert.alert('Ýalňyşlyk', e?.message ?? 'Maglumat ýüklemek başartmady')
    } finally {
      setLoading(false); setRefreshing(false)
    }
  }

  useEffect(() => { load() }, [])

  const pending = requests.filter(r => r.status === 'pending').length
  const seen = requests.filter(r => r.status === 'seen').length
  const approved = requests.filter(r => r.status === 'approved').length
  const rejected = requests.filter(r => r.status === 'rejected').length

  const approvedRequests = requests.filter(r => r.status === 'approved')
  const totalApprovedHrs = approvedRequests.reduce((acc, r) => acc + r.items.reduce((a, i) => a + Number(i.extraHours), 0), 0)
  const totalWorkers = new Set(approvedRequests.flatMap(r => r.items.map(i => i.workerEntityId))).size

  // Foreman breakdown
  const foremanMap = new Map<string, { name: string; total: number; approved: number; rejected: number; totalHrs: number }>()
  for (const r of requests) {
    const key = r.foremanWorkerEntityId
    const f = foremanMap.get(key) ?? { name: r.foremanName, total: 0, approved: 0, rejected: 0, totalHrs: 0 }
    f.total++
    if (r.status === 'approved') {
      f.approved++
      f.totalHrs += r.items.reduce((a, i) => a + Number(i.extraHours), 0)
    }
    if (r.status === 'rejected') f.rejected++
    foremanMap.set(key, f)
  }
  const foremanRows = Array.from(foremanMap.values()).sort((a, b) => b.totalHrs - a.totalHrs)

  const todayStr = new Date().toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })

  if (loading) {
    return (
      <View style={[s.center, { backgroundColor: colors.bg }]}>
        <ActivityIndicator color={palette.primary} />
      </View>
    )
  }

  return (
    <ScrollView
      style={[s.root, { backgroundColor: colors.bg }]}
      contentContainerStyle={s.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load() }} />}
    >
      <Text style={[s.pageTitle, { color: colors.text }]}>Mesai Hasabaty</Text>
      <Text style={[s.dateStr, { color: colors.textMuted }]}>{todayStr}</Text>

      <View style={s.summaryGrid}>
        {[
          { label: 'Jemi sorag', val: requests.length, color: colors.text },
          { label: 'Garaşylýar', val: pending + seen, color: palette.warning },
          { label: 'Tassyklandy', val: approved, color: palette.success },
          { label: 'Ret edildi', val: rejected, color: palette.danger },
          { label: 'Tassykl. sagat', val: `${totalApprovedHrs}h`, color: palette.primary },
          { label: 'Işçi (mesai)', val: totalWorkers, color: palette.info },
        ].map(item => (
          <View key={item.label} style={[s.summaryCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[s.summaryVal, { color: item.color }]}>{item.val}</Text>
            <Text style={[s.summaryLbl, { color: colors.textMuted }]}>{item.label}</Text>
          </View>
        ))}
      </View>

      {foremanRows.length > 0 && (
        <View style={[s.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[s.sectionTitle, { color: colors.text }]}>Foreman ýüzünden</Text>
          {foremanRows.map(f => {
            const approvePct = f.total > 0 ? Math.round((f.approved / f.total) * 100) : 0
            return (
              <View key={f.name} style={[s.foremanRow, { borderBottomColor: colors.border }]}>
                <View style={{ flex: 1, gap: 4 }}>
                  <Text style={[s.foremanName, { color: colors.text }]}>{f.name}</Text>
                  <View style={[s.progressBg, { backgroundColor: colors.card2 }]}>
                    <View style={[s.progressFill, {
                      width: `${approvePct}%`,
                      backgroundColor: approvePct >= 70 ? palette.success : approvePct >= 40 ? palette.warning : palette.danger,
                    }]} />
                  </View>
                  <Text style={[s.foremanMeta, { color: colors.textMuted }]}>
                    {f.total} sorag · {f.approved} tassl. · {f.totalHrs}h
                  </Text>
                </View>
                <Text style={[s.foremanPct, { color: colors.textSecondary }]}>{approvePct}%</Text>
              </View>
            )
          })}
        </View>
      )}

      {requests.length === 0 && (
        <Text style={[s.empty, { color: colors.textMuted }]}>Heniz sorag ýok</Text>
      )}
    </ScrollView>
  )
}

const s = StyleSheet.create({
  root: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { padding: 16, gap: 12, paddingBottom: 32 },
  pageTitle: { fontSize: 22, fontWeight: '800' },
  dateStr: { fontSize: 13 },
  summaryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  summaryCard: { width: '47%', borderRadius: 14, borderWidth: 1, padding: 14, alignItems: 'center', gap: 4 },
  summaryVal: { fontSize: 24, fontWeight: '800' },
  summaryLbl: { fontSize: 11, textAlign: 'center' },
  card: { borderRadius: 16, borderWidth: 1, padding: 16 },
  sectionTitle: { fontSize: 15, fontWeight: '700', marginBottom: 12 },
  foremanRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12, borderBottomWidth: 1 },
  foremanName: { fontSize: 13, fontWeight: '600' },
  foremanMeta: { fontSize: 11 },
  foremanPct: { fontSize: 14, fontWeight: '700', minWidth: 40, textAlign: 'right' },
  progressBg: { height: 5, borderRadius: 99, overflow: 'hidden' },
  progressFill: { height: 5 },
  empty: { textAlign: 'center', paddingVertical: 40, fontSize: 14 },
})
