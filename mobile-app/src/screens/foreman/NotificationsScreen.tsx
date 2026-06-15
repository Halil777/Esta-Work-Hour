import React, { useEffect, useState } from 'react'
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native'
import { useApp } from '../../context/AppContext'
import { foremanApi, type UnassignedWorker } from '../../api'
import { palette } from '../../theme/colors'

export function NotificationsScreen() {
  const { colors } = useApp()
  const [unassigned, setUnassigned] = useState<UnassignedWorker[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    foremanApi.unassignedWorkers()
      .then(setUnassigned)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <View style={[s.root, { backgroundColor: colors.bg }]}>
        <ActivityIndicator color={palette.primary} style={{ marginTop: 60 }} />
      </View>
    )
  }

  if (unassigned.length === 0) {
    return (
      <View style={[s.root, { backgroundColor: colors.bg }]}>
        <View style={[s.emptyBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={s.icon}>🔔</Text>
          <Text style={[s.title, { color: colors.text }]}>Bildiriş ýok</Text>
          <Text style={[s.sub, { color: colors.textMuted }]}>
            Ähli işçiler foremenalara birikdirilen.
          </Text>
        </View>
      </View>
    )
  }

  return (
    <View style={[s.root, { backgroundColor: colors.bg }]}>
      <View style={[s.alertCard, { backgroundColor: palette.warningLight, borderColor: palette.warning + '44' }]}>
        <Text style={s.alertIcon}>⚠️</Text>
        <View style={{ flex: 1 }}>
          <Text style={[s.alertTitle, { color: palette.warning }]}>
            {unassigned.length} işçi birikdirilmedi
          </Text>
          <Text style={[s.alertSub, { color: palette.warning }]}>
            "Işçiler" sahypasynda öz üstüňe alyp bolýar
          </Text>
        </View>
      </View>

      <View style={[s.listCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[s.listTitle, { color: colors.text }]}>Birikdirilmedik işçiler</Text>
        {unassigned.map(w => (
          <View key={w.id} style={[s.workerRow, { borderBottomColor: colors.border }]}>
            <View style={[s.avatar, { backgroundColor: palette.primary + '22' }]}>
              <Text style={[s.avatarTxt, { color: palette.primary }]}>
                {w.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[s.workerName, { color: colors.text }]}>{w.name}</Text>
              <Text style={[s.workerMeta, { color: colors.textMuted }]}>
                {w.workerId}{w.profession ? ` · ${w.profession}` : ''}
              </Text>
            </View>
          </View>
        ))}
      </View>
    </View>
  )
}

const s = StyleSheet.create({
  root: { flex: 1, padding: 16, gap: 12 },
  emptyBox: { borderRadius: 20, borderWidth: 1, padding: 32, alignItems: 'center', gap: 12, marginTop: 40 },
  icon: { fontSize: 48 },
  title: { fontSize: 18, fontWeight: '700' },
  sub: { fontSize: 13, textAlign: 'center', lineHeight: 20 },
  alertCard: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 14, borderWidth: 1, padding: 16 },
  alertIcon: { fontSize: 28 },
  alertTitle: { fontSize: 14, fontWeight: '700' },
  alertSub: { fontSize: 12, marginTop: 2 },
  listCard: { borderRadius: 16, borderWidth: 1, padding: 16 },
  listTitle: { fontSize: 14, fontWeight: '700', marginBottom: 10 },
  workerRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderBottomWidth: 1 },
  avatar: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  avatarTxt: { fontSize: 12, fontWeight: '700' },
  workerName: { fontSize: 13, fontWeight: '600' },
  workerMeta: { fontSize: 11, marginTop: 1 },
})
