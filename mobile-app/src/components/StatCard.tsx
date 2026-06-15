import React from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { useApp } from '../context/AppContext'
import { palette } from '../theme/colors'

interface Props {
  label: string
  value: string | number
  accent?: string
  small?: boolean
}

export function StatCard({ label, value, accent, small }: Props) {
  const { colors } = useApp()
  return (
    <View style={[s.card, { backgroundColor: colors.card2, borderColor: colors.border }]}>
      <Text style={[s.val, { color: accent ?? colors.text, fontSize: small ? 22 : 28 }]}>
        {value}
      </Text>
      <Text style={[s.lbl, { color: colors.textMuted }]}>{label}</Text>
    </View>
  )
}

const s = StyleSheet.create({
  card: { flex: 1, borderRadius: 12, borderWidth: 1, padding: 14, alignItems: 'center', minWidth: 80 },
  val: { fontWeight: '700', marginBottom: 4 },
  lbl: { fontSize: 11, textAlign: 'center', lineHeight: 14 },
})
