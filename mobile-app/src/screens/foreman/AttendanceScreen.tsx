import React, { useEffect, useState } from 'react'
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator, RefreshControl } from 'react-native'
import { useApp } from '../../context/AppContext'
import { foremanApi, type MobileWorker } from '../../api'
import { palette } from '../../theme/colors'
import { cacheSet, cacheGet } from '../../offline'

const fmtTime = (ts: number | null | undefined) => {
  if (!ts) return '—'
  return new Date(ts).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })
}

const fmtHours = (ms: number | null | undefined) => {
  if (!ms || ms <= 0) return null
  const totalMin = Math.round(ms / 60000)
  const h = Math.floor(totalMin / 60)
  const m = totalMin % 60
  if (h === 0) return `${m} min`
  if (m === 0) return `${h} sag`
  return `${h} sag ${m} min`
}

export function ForemanAttendanceScreen() {
  const { colors, t } = useApp()
  const [workers, setWorkers] = useState<MobileWorker[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [filter, setFilter] = useState<'all' | 'present' | 'absent'>('all')
  const [error, setError] = useState('')
  const [stale, setStale] = useState(false)

  const load = async () => {
    try {
      const data = await foremanApi.myWorkers()
      setWorkers(data)
      setError('')
      setStale(false)
      await cacheSet('foreman:workers', data)
    } catch (e: any) {
      const cached = await cacheGet<MobileWorker[]>('foreman:workers')
      if (cached) {
        setWorkers(cached)
        setStale(true)
        setError('')
      } else {
        setError(e.message ?? 'Ýalňyşlyk')
      }
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => { load() }, [])

  const onRefresh = () => { setRefreshing(true); load() }

  const filtered = workers.filter(w => {
    if (filter === 'present') return !!w.lastCheckIn
    if (filter === 'absent') return !w.lastCheckIn
    return true
  })

  const presentCount = workers.filter(w => w.lastCheckIn).length

  return (
    <View style={[s.root, { backgroundColor: colors.bg }]}>
      {stale && (
        <View style={{ backgroundColor: '#FFF7ED', borderBottomWidth: 1, borderBottomColor: palette.warning, padding: 8 }}>
          <Text style={{ color: palette.warning, fontSize: 12, textAlign: 'center' }}>
            📵 Offline — Soňky göçürilen maglumat görkezilýär
          </Text>
        </View>
      )}
      {/* Filter pills */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.filterBar} contentContainerStyle={s.filterContent}>
        {(['all', 'present', 'absent'] as const).map(f => {
          const labels = { all: t.common.all, present: 'Işde bar', absent: 'Ýok' }
          return (
            <TouchableOpacity
              key={f}
              style={[s.filterBtn, { backgroundColor: filter === f ? palette.primary : colors.card, borderColor: filter === f ? palette.primary : colors.border }]}
              onPress={() => setFilter(f)}
            >
              <Text style={[s.filterTxt, { color: filter === f ? '#fff' : colors.textSecondary }]}>{labels[f]}</Text>
            </TouchableOpacity>
          )
        })}
        <View style={[s.filterBtn, { backgroundColor: colors.card2, borderColor: colors.border }]}>
          <Text style={{ color: palette.success, fontSize: 13, fontWeight: '700' }}>{presentCount}/{workers.length}</Text>
        </View>
      </ScrollView>

      {loading ? (
        <View style={s.center}>
          <ActivityIndicator color={palette.primary} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={s.content}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
          {error ? (
            <View style={[s.errorBox, { backgroundColor: palette.dangerLight }]}>
              <Text style={{ color: palette.danger, fontSize: 13 }}>{error}</Text>
            </View>
          ) : null}

          {filtered.length === 0 && (
            <Text style={[s.empty, { color: colors.textMuted }]}>{t.common.noData}</Text>
          )}

          {filtered.map(w => {
            const present = !!w.lastCheckIn
            return (
              <View key={w.id} style={[s.card, { backgroundColor: colors.card, borderColor: present ? palette.success + '44' : colors.border }]}>
                <View style={s.cardHeader}>
                  <View style={s.cardLeft}>
                    <Text style={[s.workerName, { color: colors.text }]}>{w.name}</Text>
                    <Text style={[s.workerMeta, { color: colors.textMuted }]}>{w.workerId} · {w.profession || '—'}</Text>
                    {w.brigadeName ? <Text style={[s.workerMeta, { color: colors.textSecondary }]}>{w.brigadeName}</Text> : null}
                  </View>
                  <View style={[s.statusBadge, { backgroundColor: present ? palette.successLight : palette.dangerLight }]}>
                    <Text style={{ color: present ? palette.success : palette.danger, fontSize: 12, fontWeight: '700' }}>
                      {present ? 'Işde' : 'Ýok'}
                    </Text>
                  </View>
                </View>

                {present && (
                  <View style={s.timeRow}>
                    <Text style={[s.timeLabel, { color: colors.textMuted }]}>Giriş:</Text>
                    <Text style={[s.timeVal, { color: palette.success }]}>{fmtTime(w.lastCheckIn)}</Text>
                    {w.lastCheckOut && (
                      <>
                        <Text style={[s.timeLabel, { color: colors.textMuted }]}>  Çykyş:</Text>
                        <Text style={[s.timeVal, { color: palette.warning }]}>{fmtTime(w.lastCheckOut)}</Text>
                      </>
                    )}
                    {fmtHours(w.todayHoursMs) && (
                      <>
                        <Text style={[s.timeLabel, { color: colors.textMuted }]}>  Saat:</Text>
                        <Text style={[s.timeVal, { color: palette.primary }]}>{fmtHours(w.todayHoursMs)}</Text>
                      </>
                    )}
                  </View>
                )}
              </View>
            )
          })}
        </ScrollView>
      )}
    </View>
  )
}

const s = StyleSheet.create({
  root: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 60 },
  filterBar: { maxHeight: 56 },
  filterContent: { paddingHorizontal: 16, paddingVertical: 10, gap: 8 },
  filterBtn: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 99, borderWidth: 1 },
  filterTxt: { fontSize: 13, fontWeight: '600' },
  content: { padding: 16, gap: 10, paddingBottom: 32 },
  errorBox: { borderRadius: 10, padding: 12, marginBottom: 8 },
  empty: { textAlign: 'center', paddingVertical: 40, fontSize: 14 },
  card: { borderRadius: 14, borderWidth: 1, padding: 14, gap: 8 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  cardLeft: { flex: 1, gap: 2 },
  workerName: { fontSize: 14, fontWeight: '700' },
  workerMeta: { fontSize: 12 },
  statusBadge: { borderRadius: 99, paddingHorizontal: 10, paddingVertical: 4, marginLeft: 8 },
  timeRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 4 },
  timeLabel: { fontSize: 11 },
  timeVal: { fontSize: 12, fontWeight: '700' },
})
