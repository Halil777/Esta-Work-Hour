import React, { useEffect, useState } from 'react'
import { View, Text, ScrollView, StyleSheet, ActivityIndicator, RefreshControl } from 'react-native'
import { useApp } from '../../context/AppContext'
import { StatCard } from '../../components/StatCard'
import { foremanApi, type MobileWorker } from '../../api'
import { palette } from '../../theme/colors'

export function ForemanDashboardScreen() {
  const { colors, t, user } = useApp()
  const [workers, setWorkers] = useState<MobileWorker[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')

  const load = async () => {
    try {
      const data = await foremanApi.myWorkers()
      setWorkers(data)
      setError('')
    } catch (e: any) {
      setError(e.message ?? 'Ýalňyşlyk')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => { load() }, [])

  const onRefresh = () => { setRefreshing(true); load() }

  const presentCount = workers.filter(w => w.lastCheckIn).length
  const absentCount = workers.filter(w => !w.lastCheckIn).length
  const todayStr = new Date().toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })

  // Brigade breakdown
  const brigadeMap = new Map<string, { name: string; total: number; present: number }>()
  for (const w of workers) {
    const key = w.brigadeName || '—'
    const b = brigadeMap.get(key) ?? { name: key, total: 0, present: 0 }
    b.total++
    if (w.lastCheckIn) b.present++
    brigadeMap.set(key, b)
  }
  const brigadeRows = Array.from(brigadeMap.values()).sort((a, b) => b.total - a.total)

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
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <View style={[s.headerCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[s.hSub, { color: colors.textMuted }]}>{todayStr}</Text>
        <Text style={[s.hName, { color: colors.text }]}>{user?.name}</Text>
        <Text style={[s.hObject, { color: colors.textSecondary }]}>Esta Construction</Text>
      </View>

      {error ? (
        <View style={[s.errorBox, { backgroundColor: palette.dangerLight }]}>
          <Text style={{ color: palette.danger, fontSize: 13 }}>{error}</Text>
        </View>
      ) : null}

      <View style={s.statsRow}>
        <StatCard label="Jemi işçi" value={workers.length} />
        <StatCard label="Işde bar" value={presentCount} accent={palette.success} />
        <StatCard label="Ýok" value={absentCount} accent={palette.danger} small />
      </View>

      <View style={[s.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[s.sectionTitle, { color: colors.text }]}>Ekip ýagdaýy</Text>
        {brigadeRows.length === 0 ? (
          <Text style={[s.empty, { color: colors.textMuted }]}>Maglumat ýok</Text>
        ) : brigadeRows.map(b => {
          const rate = b.total > 0 ? Math.round((b.present / b.total) * 100) : 0
          return (
            <View key={b.name} style={[s.brigadeRow, { borderBottomColor: colors.border }]}>
              <View style={s.brigadeInfo}>
                <Text style={[s.brigadeName, { color: colors.text }]}>{b.name}</Text>
                <View style={[s.progressBg, { backgroundColor: colors.card2 }]}>
                  <View style={[s.progressFill, {
                    width: `${rate}%` as any,
                    backgroundColor: rate >= 90 ? palette.success : rate >= 60 ? palette.warning : palette.danger,
                  }]} />
                </View>
                <Text style={[s.progressTxt, { color: colors.textMuted }]}>{b.present}/{b.total} işçi · {rate}%</Text>
              </View>
            </View>
          )
        })}
      </View>
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
  errorBox: { borderRadius: 10, padding: 12 },
  statsRow: { flexDirection: 'row', gap: 8 },
  card: { borderRadius: 16, borderWidth: 1, padding: 16 },
  sectionTitle: { fontSize: 15, fontWeight: '700', marginBottom: 12 },
  empty: { textAlign: 'center', paddingVertical: 16, fontSize: 13 },
  brigadeRow: { paddingVertical: 12, borderBottomWidth: 1 },
  brigadeInfo: { gap: 4 },
  brigadeName: { fontSize: 14, fontWeight: '700' },
  progressBg: { height: 5, borderRadius: 99, overflow: 'hidden', marginTop: 4 },
  progressFill: { height: 5 },
  progressTxt: { fontSize: 11 },
})
