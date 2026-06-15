import React, { useEffect, useState } from 'react'
import { View, Text, ScrollView, StyleSheet, ActivityIndicator, RefreshControl } from 'react-native'
import { useApp } from '../../context/AppContext'
import { StatCard } from '../../components/StatCard'
import { siteChiefApi, type ExtraHoursRequest } from '../../api'
import { palette } from '../../theme/colors'

function fmtDate(d: string) {
  try { return new Date(d).toLocaleDateString('tr-TR') } catch { return d }
}

export function SiteChiefDashboardScreen() {
  const { colors, user } = useApp()
  const [requests, setRequests] = useState<ExtraHoursRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const load = async () => {
    try {
      const data = await siteChiefApi.incomingRequests()
      setRequests(data)
    } catch {} finally {
      setLoading(false); setRefreshing(false)
    }
  }

  useEffect(() => { load() }, [])

  const todayStr = new Date().toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })
  const pendingCount = requests.filter(r => r.status === 'pending').length
  const seenCount = requests.filter(r => r.status === 'seen').length
  const approvedCount = requests.filter(r => r.status === 'approved').length
  const rejectedCount = requests.filter(r => r.status === 'rejected').length

  // Group by foreman
  const foremanMap = new Map<string, { name: string; total: number; pending: number }>()
  for (const r of requests) {
    const key = r.foremanWorkerEntityId
    const f = foremanMap.get(key) ?? { name: r.foremanName, total: 0, pending: 0 }
    f.total++
    if (r.status === 'pending' || r.status === 'seen') f.pending++
    foremanMap.set(key, f)
  }
  const foremanRows = Array.from(foremanMap.values()).sort((a, b) => b.pending - a.pending)

  // Recent requests (last 5)
  const recent = [...requests]
    .sort((a, b) => new Date(b.sentAt).getTime() - new Date(a.sentAt).getTime())
    .slice(0, 5)

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
      <View style={[s.headerCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[s.hSub, { color: colors.textMuted }]}>{todayStr}</Text>
        <Text style={[s.hName, { color: colors.text }]}>{user?.name}</Text>
        <Text style={[s.hObject, { color: colors.textSecondary }]}>Esta Construction</Text>
      </View>

      <View style={s.statsRow}>
        <StatCard label="Jemi sorag" value={requests.length} />
        <StatCard label="Garaşylýar" value={pendingCount} accent={palette.warning} />
        <StatCard label="Tassyklandy" value={approvedCount} accent={palette.success} small />
      </View>

      <View style={s.statsRow}>
        <StatCard label="Görüldi" value={seenCount} accent={palette.info} />
        <StatCard label="Ret edildi" value={rejectedCount} accent={palette.danger} />
        <StatCard label="Foremans" value={foremanMap.size} small />
      </View>

      {foremanRows.length > 0 && (
        <View style={[s.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[s.sectionTitle, { color: colors.text }]}>Foreman ýagdaýy</Text>
          {foremanRows.map(f => (
            <View key={f.name} style={[s.foremanRow, { borderBottomColor: colors.border }]}>
              <Text style={[s.foremanName, { color: colors.text }]}>{f.name}</Text>
              <View style={s.foremanRight}>
                <Text style={[s.foremanTotal, { color: colors.textMuted }]}>{f.total} sorag</Text>
                {f.pending > 0 && (
                  <View style={[s.pendingBadge, { backgroundColor: palette.warningLight }]}>
                    <Text style={{ color: palette.warning, fontSize: 11, fontWeight: '700' }}>{f.pending} garaşylýar</Text>
                  </View>
                )}
              </View>
            </View>
          ))}
        </View>
      )}

      {recent.length > 0 && (
        <View style={[s.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[s.sectionTitle, { color: colors.text }]}>Soňky soraglar</Text>
          {recent.map(r => {
            const totalHrs = r.items.reduce((acc, i) => acc + Number(i.extraHours), 0)
            const statusColors: Record<string, string> = {
              pending: palette.warning, seen: palette.info,
              approved: palette.success, rejected: palette.danger,
            }
            const statusLabels: Record<string, string> = {
              pending: 'Garaşylýar', seen: 'Görüldi',
              approved: 'Tassyklandy', rejected: 'Ret edildi',
            }
            return (
              <View key={r.id} style={[s.recentRow, { borderBottomColor: colors.border }]}>
                <View style={{ flex: 1 }}>
                  <Text style={[s.recentForeman, { color: colors.text }]}>{r.foremanName}</Text>
                  <Text style={[s.recentMeta, { color: colors.textMuted }]}>{r.workDate} · {r.items.length} işçi · {totalHrs}h</Text>
                </View>
                <Text style={{ color: statusColors[r.status] ?? colors.textMuted, fontSize: 11, fontWeight: '700' }}>
                  {statusLabels[r.status] ?? r.status}
                </Text>
              </View>
            )
          })}
        </View>
      )}

      {requests.length === 0 && (
        <View style={[s.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[s.empty, { color: colors.textMuted }]}>Heniz sorag ýok</Text>
        </View>
      )}
    </ScrollView>
  )
}

const s = StyleSheet.create({
  root: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { padding: 16, gap: 12 },
  headerCard: { borderRadius: 16, borderWidth: 1, padding: 20, gap: 4 },
  hSub: { fontSize: 12 },
  hName: { fontSize: 20, fontWeight: '800', marginTop: 2 },
  hObject: { fontSize: 13 },
  statsRow: { flexDirection: 'row', gap: 8 },
  card: { borderRadius: 16, borderWidth: 1, padding: 16 },
  sectionTitle: { fontSize: 15, fontWeight: '700', marginBottom: 12 },
  foremanRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: 1 },
  foremanName: { fontSize: 13, fontWeight: '600', flex: 1 },
  foremanRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  foremanTotal: { fontSize: 12 },
  pendingBadge: { borderRadius: 99, paddingHorizontal: 8, paddingVertical: 3 },
  recentRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1 },
  recentForeman: { fontSize: 13, fontWeight: '600' },
  recentMeta: { fontSize: 11, marginTop: 2 },
  empty: { textAlign: 'center', paddingVertical: 16, fontSize: 13 },
})
