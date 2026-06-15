import React, { useEffect, useState } from 'react'
import { View, Text, ScrollView, StyleSheet, ActivityIndicator, RefreshControl } from 'react-native'
import { useApp } from '../../context/AppContext'
import { siteChiefApi, type ExtraHoursRequest } from '../../api'
import { palette } from '../../theme/colors'

export function SiteChiefAttendanceScreen() {
  const { colors, t } = useApp()
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

  // Derive unique workers from approved/pending extra-hours requests
  const workerMap = new Map<string, { name: string; workerId: string; foremanName: string; totalExtraHrs: number }>()
  for (const req of requests) {
    for (const item of req.items) {
      const existing = workerMap.get(item.workerEntityId)
      if (existing) {
        if (req.status === 'approved') existing.totalExtraHrs += Number(item.extraHours)
      } else {
        workerMap.set(item.workerEntityId, {
          name: item.workerName,
          workerId: item.workerId,
          foremanName: req.foremanName,
          totalExtraHrs: req.status === 'approved' ? Number(item.extraHours) : 0,
        })
      }
    }
  }
  const workerRows = Array.from(workerMap.values()).sort((a, b) => a.name.localeCompare(b.name))

  const totalExtraHrs = workerRows.reduce((acc, w) => acc + w.totalExtraHrs, 0)

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
      <View style={[s.statsBar, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={s.statItem}>
          <Text style={[s.statVal, { color: palette.primary }]}>{workerRows.length}</Text>
          <Text style={[s.statLbl, { color: colors.textMuted }]}>Işçi (mesai)</Text>
        </View>
        <View style={[s.divider, { backgroundColor: colors.border }]} />
        <View style={s.statItem}>
          <Text style={[s.statVal, { color: palette.success }]}>{totalExtraHrs}h</Text>
          <Text style={[s.statLbl, { color: colors.textMuted }]}>Tassykl. mesai</Text>
        </View>
        <View style={[s.divider, { backgroundColor: colors.border }]} />
        <View style={s.statItem}>
          <Text style={[s.statVal, { color: colors.text }]}>{requests.length}</Text>
          <Text style={[s.statLbl, { color: colors.textMuted }]}>Jemi sorag</Text>
        </View>
      </View>

      <View style={[s.infoBox, { backgroundColor: palette.infoLight, borderColor: palette.info + '44' }]}>
        <Text style={{ color: palette.info, fontSize: 12 }}>
          Bu sahypa mesai soraglaryndan hasaplanan işçi sanawy görkezýär. Doly gatnaşyk görüntiisi admin panelinde elýeterli.
        </Text>
      </View>

      {workerRows.length === 0 ? (
        <Text style={[s.empty, { color: colors.textMuted }]}>{t.common.noData}</Text>
      ) : (
        workerRows.map(w => (
          <View key={w.workerId} style={[s.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={s.cardHeader}>
              <View style={{ flex: 1 }}>
                <Text style={[s.workerName, { color: colors.text }]}>{w.name}</Text>
                <Text style={[s.workerMeta, { color: colors.textMuted }]}>{w.workerId} · {w.foremanName}</Text>
              </View>
              {w.totalExtraHrs > 0 && (
                <View style={[s.hrsBadge, { backgroundColor: palette.successLight }]}>
                  <Text style={{ color: palette.success, fontSize: 12, fontWeight: '700' }}>+{w.totalExtraHrs}h</Text>
                </View>
              )}
            </View>
          </View>
        ))
      )}
    </ScrollView>
  )
}

const s = StyleSheet.create({
  root: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { padding: 16, gap: 10, paddingBottom: 32 },
  statsBar: { flexDirection: 'row', padding: 16, borderRadius: 16, borderWidth: 1 },
  statItem: { flex: 1, alignItems: 'center', gap: 2 },
  statVal: { fontSize: 22, fontWeight: '800' },
  statLbl: { fontSize: 11 },
  divider: { width: 1, marginVertical: 4 },
  infoBox: { borderRadius: 10, borderWidth: 1, padding: 12 },
  empty: { textAlign: 'center', paddingVertical: 40, fontSize: 14 },
  card: { borderRadius: 14, borderWidth: 1, padding: 14 },
  cardHeader: { flexDirection: 'row', alignItems: 'center' },
  workerName: { fontSize: 14, fontWeight: '600' },
  workerMeta: { fontSize: 11, marginTop: 2 },
  hrsBadge: { borderRadius: 99, paddingHorizontal: 10, paddingVertical: 4 },
})
