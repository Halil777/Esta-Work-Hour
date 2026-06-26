import React, { useEffect, useState } from 'react'
import {
  View, Text, ScrollView, TouchableOpacity, Modal,
  StyleSheet, ActivityIndicator, RefreshControl, Alert,
} from 'react-native'
import { useApp } from '../../context/AppContext'
import { siteChiefApi, type ExtraHoursRequest } from '../../api'
import { palette } from '../../theme/colors'

type StatusMeta = { label: string; color: string; bg: string }
const STATUS_META: Record<ExtraHoursRequest['status'], StatusMeta> = {
  pending:  { label: 'Garaşylýar', color: palette.warning,  bg: palette.warningLight },
  seen:     { label: 'Görüldi',    color: palette.info,     bg: palette.infoLight },
  approved: { label: 'Tassyklandy', color: palette.success, bg: palette.successLight },
  rejected: { label: 'Ret edildi', color: palette.danger,   bg: palette.dangerLight },
}

function fmtDate(d: string) {
  try { return new Date(d).toLocaleDateString('tr-TR') } catch { return d }
}

export function ApprovalsScreen() {
  const { colors, t } = useApp()
  const [requests, setRequests] = useState<ExtraHoursRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [filter, setFilter] = useState<ExtraHoursRequest['status'] | 'all'>('pending')
  const [selected, setSelected] = useState<ExtraHoursRequest | null>(null)
  const [saving, setSaving] = useState(false)

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

  const openRequest = async (req: ExtraHoursRequest) => {
    setSelected(req)
    if (req.status === 'pending') {
      try {
        const updated = await siteChiefApi.markSeen(req.id)
        setRequests(prev => prev.map(r => r.id === updated.id ? updated : r))
        setSelected(updated)
      } catch {}
    }
  }

  const handleAction = async (action: 'approved' | 'rejected') => {
    if (!selected) return
    setSaving(true)
    try {
      const updated = await siteChiefApi.takeAction(selected.id, action)
      setRequests(prev => prev.map(r => r.id === updated.id ? updated : r))
      setSelected(null)
    } catch (e: any) {
      Alert.alert('Ýalňyşlyk', e.message)
    } finally {
      setSaving(false)
    }
  }

  const FILTERS: (ExtraHoursRequest['status'] | 'all')[] = ['all', 'pending', 'seen', 'approved', 'rejected']
  const filtered = filter === 'all' ? requests : requests.filter(r => r.status === filter)
  const pendingCount = requests.filter(r => r.status === 'pending').length

  return (
    <View style={[s.root, { backgroundColor: colors.bg }]}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.filterBar} contentContainerStyle={s.filterContent}>
        {FILTERS.map(f => {
          const label = f === 'all' ? t.common.all : STATUS_META[f].label
          return (
            <TouchableOpacity
              key={f}
              style={[s.filterBtn, { backgroundColor: filter === f ? palette.primary : colors.card, borderColor: filter === f ? palette.primary : colors.border }]}
              onPress={() => setFilter(f)}
            >
              <Text style={[s.filterTxt, { color: filter === f ? '#fff' : colors.textSecondary }]}>{label}</Text>
              {f === 'pending' && pendingCount > 0 && (
                <View style={s.badge}><Text style={s.badgeTxt}>{pendingCount}</Text></View>
              )}
            </TouchableOpacity>
          )
        })}
      </ScrollView>

      {loading ? (
        <View style={s.center}><ActivityIndicator color={palette.primary} /></View>
      ) : (
        <ScrollView
          contentContainerStyle={s.content}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load() }} />}
        >
          {filtered.length === 0 && <Text style={[s.empty, { color: colors.textMuted }]}>{t.common.noData}</Text>}
          {filtered.map(req => {
            const meta = STATUS_META[req.status]
            const totalHrs = req.items.reduce((acc, i) => acc + Number(i.extraHours), 0)
            return (
              <TouchableOpacity
                key={req.id}
                style={[s.card, { backgroundColor: colors.card, borderColor: req.status === 'pending' ? palette.warning + '55' : colors.border }]}
                onPress={() => openRequest(req)}
              >
                <View style={s.cardHeader}>
                  <View>
                    <Text style={[s.cardDate, { color: colors.text }]}>{req.workDate}</Text>
                    <Text style={[s.cardSub, { color: colors.textSecondary }]}>Foreman: {req.foremanName}</Text>
                  </View>
                  <View style={[s.statusPill, { backgroundColor: meta.bg }]}>
                    <Text style={{ color: meta.color, fontSize: 12, fontWeight: '700' }}>{meta.label}</Text>
                  </View>
                </View>
                <View style={s.statsRow}>
                  <Text style={[s.statChip, { color: colors.textSecondary }]}>{req.items.length} işçi</Text>
                  <Text style={[s.statChip, { color: palette.primary }]}>{totalHrs}h jemi</Text>
                </View>
                {req.note ? <Text style={[s.note, { color: colors.textMuted }]}>{req.note}</Text> : null}
                <Text style={[s.meta, { color: colors.textMuted }]}>{fmtDate(req.sentAt)}</Text>
              </TouchableOpacity>
            )
          })}
        </ScrollView>
      )}

      {/* Detail / Action Modal */}
      <Modal visible={!!selected} transparent animationType="slide">
        <View style={s.overlay}>
          <View style={[s.box, { backgroundColor: colors.card }]}>
            <View style={s.modalHeader}>
              <Text style={[s.modalTitle, { color: colors.text }]}>Mesai soragy</Text>
              <TouchableOpacity onPress={() => setSelected(null)}>
                <Text style={{ color: colors.textMuted, fontSize: 20 }}>✕</Text>
              </TouchableOpacity>
            </View>

            {selected && (
              <ScrollView style={{ maxHeight: 460 }}>
                <View style={[s.infoRow, { borderBottomColor: colors.border }]}>
                  <Text style={[s.infoLabel, { color: colors.textMuted }]}>Foreman</Text>
                  <Text style={[s.infoVal, { color: colors.text }]}>{selected.foremanName}</Text>
                </View>
                <View style={[s.infoRow, { borderBottomColor: colors.border }]}>
                  <Text style={[s.infoLabel, { color: colors.textMuted }]}>Iş senesi</Text>
                  <Text style={[s.infoVal, { color: colors.text }]}>{selected.workDate}</Text>
                </View>
                {selected.note ? (
                  <View style={[s.infoRow, { borderBottomColor: colors.border }]}>
                    <Text style={[s.infoLabel, { color: colors.textMuted }]}>Sebäp</Text>
                    <Text style={[s.infoVal, { color: colors.text, flex: 1 }]}>{selected.note}</Text>
                  </View>
                ) : null}
                <View style={[s.infoRow, { borderBottomColor: colors.border }]}>
                  <Text style={[s.infoLabel, { color: colors.textMuted }]}>Ýagdaý</Text>
                  <View style={[s.statusPill, { backgroundColor: STATUS_META[selected.status].bg }]}>
                    <Text style={{ color: STATUS_META[selected.status].color, fontSize: 12, fontWeight: '700' }}>
                      {STATUS_META[selected.status].label}
                    </Text>
                  </View>
                </View>

                <Text style={[s.workerSectionTitle, { color: colors.textSecondary }]}>Işçiler ({selected.items.length})</Text>
                {selected.items.map(item => (
                  <View key={item.id} style={[s.workerRow, { borderColor: colors.border, backgroundColor: colors.card2 }]}>
                    <View style={{ flex: 1 }}>
                      <Text style={[{ color: colors.text, fontSize: 13, fontWeight: '600' }]}>{item.workerName}</Text>
                      <Text style={{ color: colors.textMuted, fontSize: 11 }}>{item.workerId}</Text>
                      {item.description ? (
                        <Text style={{ color: colors.textSecondary, fontSize: 12, marginTop: 3, fontStyle: 'italic' }}>
                          "{item.description}"
                        </Text>
                      ) : null}
                    </View>
                    <View style={[s.hrsPill, { backgroundColor: palette.primary + '22' }]}>
                      <Text style={{ color: palette.primary, fontWeight: '700', fontSize: 14 }}>{item.extraHours}h</Text>
                    </View>
                  </View>
                ))}

                {(selected.status === 'pending' || selected.status === 'seen') && (
                  <View style={s.actionBtns}>
                    <TouchableOpacity
                      style={[s.actionBtn, { backgroundColor: palette.successLight, borderColor: palette.success, opacity: saving ? 0.6 : 1 }]}
                      onPress={() => handleAction('approved')}
                      disabled={saving}
                    >
                      {saving ? <ActivityIndicator color={palette.success} size="small" /> : (
                        <Text style={[s.actionBtnTxt, { color: palette.success }]}>✓ Tassykla</Text>
                      )}
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[s.actionBtn, { backgroundColor: palette.dangerLight, borderColor: palette.danger, opacity: saving ? 0.6 : 1 }]}
                      onPress={() => handleAction('rejected')}
                      disabled={saving}
                    >
                      {saving ? <ActivityIndicator color={palette.danger} size="small" /> : (
                        <Text style={[s.actionBtnTxt, { color: palette.danger }]}>✕ Ret et</Text>
                      )}
                    </TouchableOpacity>
                  </View>
                )}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </View>
  )
}

const s = StyleSheet.create({
  root: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 60 },
  filterBar: { maxHeight: 56 },
  filterContent: { paddingHorizontal: 16, paddingVertical: 10, gap: 8 },
  filterBtn: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 7, borderRadius: 99, borderWidth: 1, gap: 6 },
  filterTxt: { fontSize: 13, fontWeight: '600' },
  badge: { backgroundColor: palette.danger, borderRadius: 99, minWidth: 18, height: 18, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  badgeTxt: { color: '#fff', fontSize: 10, fontWeight: '700' },
  content: { padding: 16, gap: 10, paddingBottom: 32 },
  empty: { textAlign: 'center', paddingVertical: 40, fontSize: 14 },
  card: { borderRadius: 16, borderWidth: 1, padding: 16, gap: 8 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  cardDate: { fontSize: 15, fontWeight: '700' },
  cardSub: { fontSize: 12, marginTop: 2 },
  statusPill: { borderRadius: 99, paddingHorizontal: 10, paddingVertical: 4 },
  statsRow: { flexDirection: 'row', gap: 10 },
  statChip: { fontSize: 12, fontWeight: '600' },
  note: { fontSize: 12 },
  meta: { fontSize: 11 },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', justifyContent: 'flex-end' },
  box: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, gap: 12, maxHeight: '90%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  modalTitle: { fontSize: 17, fontWeight: '700' },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1 },
  infoLabel: { fontSize: 12, fontWeight: '600' },
  infoVal: { fontSize: 13, fontWeight: '500' },
  workerSectionTitle: { fontSize: 12, fontWeight: '600', marginTop: 12, marginBottom: 8 },
  workerRow: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 6 },
  hrsPill: { borderRadius: 99, paddingHorizontal: 12, paddingVertical: 4 },
  actionBtns: { flexDirection: 'row', gap: 10, marginTop: 16 },
  actionBtn: { flex: 1, borderRadius: 12, borderWidth: 1, paddingVertical: 13, alignItems: 'center' },
  actionBtnTxt: { fontSize: 14, fontWeight: '700' },
})
