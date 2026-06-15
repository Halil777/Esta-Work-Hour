import React, { useEffect, useState } from 'react'
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  Modal, TextInput, ActivityIndicator, RefreshControl, Alert,
} from 'react-native'
import { useApp } from '../../context/AppContext'
import { foremanApi, type ExtraHoursRequest, type MobileWorker, type SiteChiefOption } from '../../api'
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

// ─── Create Request Modal ──────────────────────────────────────────────────────
function CreateModal({
  visible, onClose, onCreated, colors,
}: {
  visible: boolean
  onClose: () => void
  onCreated: () => void
  colors: any
}) {
  const [siteChiefs, setSiteChiefs] = useState<SiteChiefOption[]>([])
  const [workers, setWorkers] = useState<MobileWorker[]>([])
  const [siteChiefId, setSiteChiefId] = useState('')
  const [workDate, setWorkDate] = useState(new Date().toISOString().split('T')[0])
  const [note, setNote] = useState('')
  const [selectedWorkers, setSelectedWorkers] = useState<Map<string, number>>(new Map())
  const [saving, setSaving] = useState(false)
  const [step, setStep] = useState<'form' | 'workers'>('form')

  useEffect(() => {
    if (visible) {
      foremanApi.siteChiefs().then(setSiteChiefs).catch(() => {})
      foremanApi.myWorkers().then(setWorkers).catch(() => {})
    }
  }, [visible])

  const toggleWorker = (id: string) => {
    setSelectedWorkers(prev => {
      const m = new Map(prev)
      if (m.has(id)) m.delete(id)
      else m.set(id, 2)
      return m
    })
  }

  const setHours = (id: string, h: number) => {
    setSelectedWorkers(prev => {
      const m = new Map(prev)
      m.set(id, Math.max(0.5, Math.min(12, h)))
      return m
    })
  }

  const handleCreate = async () => {
    if (!siteChiefId) { Alert.alert('Ýalňyşlyk', 'Site Chief saýlaň'); return }
    if (selectedWorkers.size === 0) { Alert.alert('Ýalňyşlyk', 'Işçi saýlaň'); return }
    setSaving(true)
    try {
      await foremanApi.createRequest({
        siteChiefWorkerEntityId: siteChiefId,
        workDate,
        note: note || undefined,
        items: Array.from(selectedWorkers.entries()).map(([workerEntityId, extraHours]) => ({ workerEntityId, extraHours })),
      })
      onCreated()
      onClose()
      setSiteChiefId(''); setNote(''); setSelectedWorkers(new Map()); setStep('form')
    } catch (e: any) {
      Alert.alert('Ýalňyşlyk', e.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={sm.overlay}>
        <View style={[sm.box, { backgroundColor: colors.card }]}>
          <View style={sm.header}>
            <Text style={[sm.title, { color: colors.text }]}>Täze Mesai Soragy</Text>
            <TouchableOpacity onPress={onClose}>
              <Text style={{ color: colors.textMuted, fontSize: 20 }}>✕</Text>
            </TouchableOpacity>
          </View>

          {step === 'form' ? (
            <ScrollView style={{ maxHeight: 420 }}>
              <Text style={[sm.label, { color: colors.textSecondary }]}>Site Chief *</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  {siteChiefs.map(sc => (
                    <TouchableOpacity
                      key={sc.id}
                      style={[sm.pill, { backgroundColor: siteChiefId === sc.id ? palette.primary : colors.card2, borderColor: siteChiefId === sc.id ? palette.primary : colors.border }]}
                      onPress={() => setSiteChiefId(sc.id)}
                    >
                      <Text style={{ color: siteChiefId === sc.id ? '#fff' : colors.text, fontSize: 13, fontWeight: '600' }}>{sc.name}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>

              <Text style={[sm.label, { color: colors.textSecondary }]}>Iş senesi</Text>
              <TextInput
                style={[sm.input, { backgroundColor: colors.card2, borderColor: colors.border, color: colors.text }]}
                value={workDate}
                onChangeText={setWorkDate}
                placeholder="2026-05-15"
                placeholderTextColor={colors.textMuted}
              />

              <Text style={[sm.label, { color: colors.textSecondary }]}>Sebäp (islege görä)</Text>
              <TextInput
                style={[sm.input, { backgroundColor: colors.card2, borderColor: colors.border, color: colors.text, height: 72, textAlignVertical: 'top' }]}
                value={note}
                onChangeText={setNote}
                multiline
                placeholder="Extra sagat sebäbi..."
                placeholderTextColor={colors.textMuted}
              />

              <TouchableOpacity
                style={[sm.btn, { backgroundColor: palette.primary }]}
                onPress={() => setStep('workers')}
              >
                <Text style={sm.btnTxt}>Işçi saýla →</Text>
              </TouchableOpacity>
            </ScrollView>
          ) : (
            <>
              <ScrollView style={{ maxHeight: 380 }}>
                <Text style={[sm.label, { color: colors.textSecondary, marginBottom: 8 }]}>Işçi saýla ({selectedWorkers.size} saýlanan)</Text>
                {workers.map(w => {
                  const sel = selectedWorkers.has(w.id)
                  const hrs = selectedWorkers.get(w.id) ?? 2
                  return (
                    <View key={w.id} style={[sm.workerRow, { borderColor: sel ? palette.primary : colors.border, backgroundColor: sel ? palette.primary + '11' : undefined }]}>
                      <TouchableOpacity style={sm.workerCheck} onPress={() => toggleWorker(w.id)}>
                        <View style={[sm.checkbox, { borderColor: sel ? palette.primary : colors.border, backgroundColor: sel ? palette.primary : 'transparent' }]}>
                          {sel && <Text style={{ color: '#fff', fontSize: 12 }}>✓</Text>}
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={[{ color: colors.text, fontSize: 13, fontWeight: '600' }]}>{w.name}</Text>
                          <Text style={{ color: colors.textMuted, fontSize: 11 }}>{w.workerId}</Text>
                        </View>
                      </TouchableOpacity>
                      {sel && (
                        <View style={sm.hrsRow}>
                          <TouchableOpacity onPress={() => setHours(w.id, hrs - 0.5)} style={sm.hrsBtn}>
                            <Text style={{ color: palette.primary, fontSize: 18 }}>−</Text>
                          </TouchableOpacity>
                          <Text style={[sm.hrsVal, { color: colors.text }]}>{hrs}h</Text>
                          <TouchableOpacity onPress={() => setHours(w.id, hrs + 0.5)} style={sm.hrsBtn}>
                            <Text style={{ color: palette.primary, fontSize: 18 }}>+</Text>
                          </TouchableOpacity>
                        </View>
                      )}
                    </View>
                  )
                })}
              </ScrollView>
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
                <TouchableOpacity style={[sm.btn, { flex: 1, backgroundColor: colors.card2 }]} onPress={() => setStep('form')}>
                  <Text style={[sm.btnTxt, { color: colors.text }]}>← Yzyna</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[sm.btn, { flex: 2, backgroundColor: palette.primary, opacity: saving ? 0.7 : 1 }]}
                  onPress={handleCreate}
                  disabled={saving}
                >
                  {saving ? <ActivityIndicator color="#fff" size="small" /> : <Text style={sm.btnTxt}>Iber ✓</Text>}
                </TouchableOpacity>
              </View>
            </>
          )}
        </View>
      </View>
    </Modal>
  )
}

// ─── Main Screen ──────────────────────────────────────────────────────────────
export function ForemanOvertimeScreen() {
  const { colors, t } = useApp()
  const [requests, setRequests] = useState<ExtraHoursRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [filter, setFilter] = useState<ExtraHoursRequest['status'] | 'all'>('all')
  const [showCreate, setShowCreate] = useState(false)

  const load = async () => {
    try {
      const data = await foremanApi.myRequests()
      setRequests(data)
    } catch {} finally {
      setLoading(false); setRefreshing(false)
    }
  }

  useEffect(() => { load() }, [])

  const filtered = filter === 'all' ? requests : requests.filter(r => r.status === filter)
  const FILTERS: (ExtraHoursRequest['status'] | 'all')[] = ['all', 'pending', 'seen', 'approved', 'rejected']

  return (
    <View style={[s.root, { backgroundColor: colors.bg }]}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.filterBar} contentContainerStyle={s.filterContent}>
        {FILTERS.map(f => {
          const meta = f === 'all' ? { label: t.common.all } : STATUS_META[f]
          return (
            <TouchableOpacity
              key={f}
              style={[s.filterBtn, { backgroundColor: filter === f ? palette.primary : colors.card, borderColor: filter === f ? palette.primary : colors.border }]}
              onPress={() => setFilter(f)}
            >
              <Text style={[s.filterTxt, { color: filter === f ? '#fff' : colors.textSecondary }]}>{meta.label}</Text>
            </TouchableOpacity>
          )
        })}
      </ScrollView>

      <TouchableOpacity style={[s.newBtn, { backgroundColor: palette.primary }]} onPress={() => setShowCreate(true)}>
        <Text style={s.newBtnTxt}>+ Täze sorag</Text>
      </TouchableOpacity>

      {loading ? (
        <View style={s.center}><ActivityIndicator color={palette.primary} /></View>
      ) : (
        <ScrollView
          contentContainerStyle={s.content}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load() }} />}
        >
          {filtered.length === 0 && <Text style={[s.empty, { color: colors.textMuted }]}>{t.common.noData}</Text>}
          {filtered.map(r => {
            const meta = STATUS_META[r.status]
            const totalHrs = r.items.reduce((acc, i) => acc + Number(i.extraHours), 0)
            return (
              <View key={r.id} style={[s.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <View style={s.cardHeader}>
                  <View>
                    <Text style={[s.cardDate, { color: colors.text }]}>{r.workDate}</Text>
                    <Text style={[s.cardSub, { color: colors.textSecondary }]}>→ {r.siteChiefName}</Text>
                  </View>
                  <View style={[s.statusPill, { backgroundColor: meta.bg }]}>
                    <Text style={{ color: meta.color, fontSize: 12, fontWeight: '700' }}>{meta.label}</Text>
                  </View>
                </View>
                <View style={s.statsRow}>
                  <Text style={[s.statChip, { color: colors.textSecondary }]}>{r.items.length} işçi</Text>
                  <Text style={[s.statChip, { color: palette.primary }]}>{totalHrs}h jemi</Text>
                </View>
                {r.note ? <Text style={[s.note, { color: colors.textMuted }]}>{r.note}</Text> : null}
                <Text style={[s.meta, { color: colors.textMuted }]}>{fmtDate(r.sentAt)}</Text>
              </View>
            )
          })}
        </ScrollView>
      )}

      <CreateModal visible={showCreate} onClose={() => setShowCreate(false)} onCreated={load} colors={colors} />
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
  newBtn: { marginHorizontal: 16, marginBottom: 8, borderRadius: 12, paddingVertical: 11, alignItems: 'center' },
  newBtnTxt: { color: '#fff', fontWeight: '700', fontSize: 14 },
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
})

const sm = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', justifyContent: 'flex-end' },
  box: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, gap: 12, maxHeight: '90%' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  title: { fontSize: 17, fontWeight: '700' },
  label: { fontSize: 12, fontWeight: '600', marginBottom: 6 },
  input: { borderRadius: 10, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 11, fontSize: 14, marginBottom: 12 },
  pill: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 99, borderWidth: 1 },
  btn: { borderRadius: 12, paddingVertical: 13, alignItems: 'center' },
  btnTxt: { color: '#fff', fontWeight: '700', fontSize: 14 },
  workerRow: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 6 },
  workerCheck: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  checkbox: { width: 22, height: 22, borderRadius: 6, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  hrsRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  hrsBtn: { padding: 4 },
  hrsVal: { fontSize: 14, fontWeight: '700', minWidth: 30, textAlign: 'center' },
})
