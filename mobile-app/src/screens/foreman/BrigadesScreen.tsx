import React, { useEffect, useState, useCallback } from 'react'
import {
  View, Text, ScrollView, TouchableOpacity, TextInput,
  StyleSheet, ActivityIndicator, Alert, Platform,
} from 'react-native'
import { useApp } from '../../context/AppContext'
import { foremanApi, type MobileWorker, type UnassignedWorker } from '../../api'
import { palette } from '../../theme/colors'

type Tab = 'my' | 'add'

const fmtTime = (ts: number | null | undefined) => {
  if (!ts) return null
  return new Date(ts).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })
}

// ─── My Workers tab ────────────────────────────────────────────────────────────
function MyWorkersTab({ colors, onRefreshNeeded }: { colors: any; onRefreshNeeded: () => void }) {
  const { cachedWorkers } = useApp()
  const [workers, setWorkers] = useState<MobileWorker[]>(cachedWorkers)
  const [loading, setLoading] = useState(cachedWorkers.length === 0)
  const [shiftSaving, setShiftSaving] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const data = await foremanApi.myWorkers()
      setWorkers(data)
    } catch {
      if (cachedWorkers.length > 0) setWorkers(cachedWorkers)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [])

  const handleRelease = (w: MobileWorker) => {
    Alert.alert('Işçini aýyr', `${w.name} sanawyňyzdan aýrylsyn my?`, [
      { text: 'Ýok', style: 'cancel' },
      {
        text: 'Aýyr', style: 'destructive',
        onPress: async () => {
          try {
            await foremanApi.releaseWorker(w.id)
            setWorkers(prev => prev.filter(x => x.id !== w.id))
            onRefreshNeeded()
          } catch (e: any) { Alert.alert('Ýalňyşlyk', e.message) }
        },
      },
    ])
  }

  const handleShift = async (w: MobileWorker, shift: 'day' | 'night') => {
    if (w.shift === shift || shiftSaving) return
    setShiftSaving(w.id)
    try {
      const updated = await foremanApi.setShift(w.id, shift)
      setWorkers(prev => prev.map(x => x.id === updated.id ? { ...x, shift: updated.shift } : x))
    } catch (e: any) { Alert.alert('Ýalňyşlyk', e.message) }
    finally { setShiftSaving(null) }
  }

  if (loading) return (
    <View style={tw.center}><ActivityIndicator color={palette.primary} /></View>
  )

  if (workers.length === 0) return (
    <View style={tw.center}>
      <Text style={{ fontSize: 48, marginBottom: 12 }}>👷</Text>
      <Text style={[tw.emptyTitle, { color: colors.text }]}>Işçi ýok</Text>
      <Text style={[tw.emptySub, { color: colors.textMuted }]}>
        "Işçi goş" bölümünden işçileri öz sanawyňyza goşuň.
      </Text>
    </View>
  )

  const present = workers.filter(w => w.lastCheckIn)
  const absent = workers.filter(w => !w.lastCheckIn)
  const dayWorkers = workers.filter(w => w.shift === 'day')
  const nightWorkers = workers.filter(w => w.shift === 'night')
  const unshifted = workers.filter(w => !w.shift)

  const renderWorker = (w: MobileWorker) => {
    const checkedIn = !!w.lastCheckIn
    const checkInTime = fmtTime(w.lastCheckIn)
    return (
      <View key={w.id} style={[tw.card, { backgroundColor: colors.card, borderColor: checkedIn ? palette.success + '44' : colors.border }]}>
        <View style={tw.cardTop}>
          <View style={{ flex: 1 }}>
            <Text style={[tw.workerName, { color: colors.text }]}>{w.name}</Text>
            <Text style={[tw.workerMeta, { color: colors.textMuted }]}>
              {w.workerId}{w.profession ? ` · ${w.profession}` : ''}
            </Text>
          </View>
          <View style={tw.rightCol}>
            <View style={[tw.nfcBadge, { backgroundColor: checkedIn ? palette.successLight : palette.dangerLight }]}>
              <Text style={{ fontSize: 11, fontWeight: '700', color: checkedIn ? palette.success : palette.danger }}>
                {checkedIn ? `✓ ${checkInTime ?? 'Işde'}` : '✗ Gelmedi'}
              </Text>
            </View>
            <TouchableOpacity onPress={() => handleRelease(w)} style={tw.releaseBtn}>
              <Text style={{ color: palette.danger, fontSize: 16 }}>✕</Text>
            </TouchableOpacity>
          </View>
        </View>
        <View style={tw.shiftRow}>
          <TouchableOpacity
            style={[tw.shiftBtn, { backgroundColor: w.shift === 'day' ? palette.warning + '30' : colors.card2, borderColor: w.shift === 'day' ? palette.warning : colors.border }]}
            onPress={() => handleShift(w, 'day')}
            disabled={shiftSaving !== null}
          >
            <Text style={{ fontSize: 13 }}>☀️</Text>
            <Text style={[tw.shiftTxt, { color: w.shift === 'day' ? palette.warning : colors.textSecondary }]}>Gündiz</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[tw.shiftBtn, { backgroundColor: w.shift === 'night' ? palette.info + '30' : colors.card2, borderColor: w.shift === 'night' ? palette.info : colors.border }]}
            onPress={() => handleShift(w, 'night')}
            disabled={shiftSaving !== null}
          >
            <Text style={{ fontSize: 13 }}>🌙</Text>
            <Text style={[tw.shiftTxt, { color: w.shift === 'night' ? palette.info : colors.textSecondary }]}>Gije</Text>
          </TouchableOpacity>
        </View>
      </View>
    )
  }

  return (
    <ScrollView
      contentContainerStyle={tw.listContent}
      style={tw.scroll}
    >
      {/* Stats */}
      <View style={[tw.statsBar, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={tw.statItem}>
          <Text style={[tw.statVal, { color: palette.success }]}>{present.length}</Text>
          <Text style={[tw.statLbl, { color: colors.textMuted }]}>Işde</Text>
        </View>
        <View style={[tw.divider, { backgroundColor: colors.border }]} />
        <View style={tw.statItem}>
          <Text style={[tw.statVal, { color: palette.danger }]}>{absent.length}</Text>
          <Text style={[tw.statLbl, { color: colors.textMuted }]}>Gelmedi</Text>
        </View>
        <View style={[tw.divider, { backgroundColor: colors.border }]} />
        <View style={tw.statItem}>
          <Text style={[tw.statVal, { color: colors.text }]}>{workers.length}</Text>
          <Text style={[tw.statLbl, { color: colors.textMuted }]}>Jemi</Text>
        </View>
      </View>

      {dayWorkers.length > 0 && (
        <View>
          <View style={tw.section}><Text style={{ fontSize: 15 }}>☀️</Text><Text style={[tw.sectionTxt, { color: palette.warning }]}>Gündiz ({dayWorkers.length})</Text></View>
          {dayWorkers.map(renderWorker)}
        </View>
      )}
      {nightWorkers.length > 0 && (
        <View>
          <View style={tw.section}><Text style={{ fontSize: 15 }}>🌙</Text><Text style={[tw.sectionTxt, { color: palette.info }]}>Gije ({nightWorkers.length})</Text></View>
          {nightWorkers.map(renderWorker)}
        </View>
      )}
      {unshifted.length > 0 && (
        <View>
          <View style={tw.section}><Text style={{ fontSize: 15 }}>⏳</Text><Text style={[tw.sectionTxt, { color: colors.textSecondary }]}>Şift ýok ({unshifted.length})</Text></View>
          {unshifted.map(renderWorker)}
        </View>
      )}
    </ScrollView>
  )
}

// ─── Add Workers tab ───────────────────────────────────────────────────────────
function AddWorkersTab({ colors, onAdded }: { colors: any; onAdded: () => void }) {
  const [all, setAll] = useState<UnassignedWorker[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    foremanApi.unassignedWorkers()
      .then(setAll)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const toggle = (id: string) => {
    setSelected(prev => {
      const s = new Set(prev)
      s.has(id) ? s.delete(id) : s.add(id)
      return s
    })
  }

  const selectAll = () => {
    setSelected(new Set(filtered.map(w => w.id)))
  }

  const clearAll = () => setSelected(new Set())

  const handleSave = async (shift: 'day' | 'night') => {
    if (selected.size === 0) { Alert.alert('', 'Işçi saýlaň'); return }
    setSaving(true)
    try {
      await foremanApi.claimBulk(Array.from(selected), shift)
      setAll(prev => prev.filter(w => !selected.has(w.id)))
      setSelected(new Set())
      onAdded()
      Alert.alert('Goşuldy', `${selected.size} işçi sanawyňyza goşuldy`)
    } catch (e: any) { Alert.alert('Ýalňyşlyk', e.message) }
    finally { setSaving(false) }
  }

  const filtered = all.filter(w =>
    !search || w.name.toLowerCase().includes(search.toLowerCase()) ||
    w.workerId.toLowerCase().includes(search.toLowerCase()) ||
    (w.profession ?? '').toLowerCase().includes(search.toLowerCase())
  )

  if (loading) return (
    <View style={aw.center}><ActivityIndicator color={palette.primary} /></View>
  )

  if (all.length === 0) return (
    <View style={aw.center}>
      <Text style={{ fontSize: 40, marginBottom: 12 }}>✅</Text>
      <Text style={[aw.emptyTxt, { color: colors.textMuted }]}>Ähli işçiler birikdirilen</Text>
    </View>
  )

  return (
    <View style={aw.root}>
      {/* Search + select all */}
      <View style={aw.topBar}>
        <TextInput
          style={[aw.search, { backgroundColor: colors.card2, borderColor: colors.border, color: colors.text }]}
          placeholder="Gözle..."
          placeholderTextColor={colors.textMuted}
          value={search}
          onChangeText={setSearch}
        />
        <TouchableOpacity
          onPress={selected.size === filtered.length ? clearAll : selectAll}
          style={[aw.selAllBtn, { borderColor: colors.border }]}
        >
          <Text style={{ color: palette.primary, fontSize: 12, fontWeight: '700' }}>
            {selected.size === filtered.length && filtered.length > 0 ? 'Aýyr' : 'Hemmesini saý'}
          </Text>
        </TouchableOpacity>
      </View>

      <Text style={[aw.hint, { color: colors.textMuted }]}>
        {filtered.length} işçi · {selected.size} saýlandy
      </Text>

      {/* Worker list */}
      <ScrollView style={aw.scroll} contentContainerStyle={aw.listContent}>
        {filtered.map(w => {
          const sel = selected.has(w.id)
          return (
            <TouchableOpacity
              key={w.id}
              style={[aw.row, {
                backgroundColor: sel ? palette.primary + '18' : colors.card,
                borderColor: sel ? palette.primary : colors.border,
              }]}
              onPress={() => toggle(w.id)}
              activeOpacity={0.7}
            >
              <View style={[aw.checkbox, { borderColor: sel ? palette.primary : colors.border, backgroundColor: sel ? palette.primary : 'transparent' }]}>
                {sel && <Text style={{ color: '#fff', fontSize: 13, fontWeight: '700' }}>✓</Text>}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[aw.name, { color: colors.text }]}>{w.name}</Text>
                <Text style={[aw.meta, { color: colors.textMuted }]}>
                  {w.workerId}{w.profession ? ` · ${w.profession}` : ''}{w.brigadeName ? ` · ${w.brigadeName}` : ''}
                </Text>
              </View>
            </TouchableOpacity>
          )
        })}
      </ScrollView>

      {/* Bottom action bar */}
      {selected.size > 0 && (
        <View style={[aw.bottomBar, { backgroundColor: colors.card, borderTopColor: colors.border }]}>
          <Text style={[aw.selCount, { color: colors.text }]}>{selected.size} saýlandy</Text>
          <TouchableOpacity
            style={[aw.saveBtn, { backgroundColor: palette.warning, opacity: saving ? 0.6 : 1 }]}
            onPress={() => handleSave('day')}
            disabled={saving}
          >
            {saving ? <ActivityIndicator color="#fff" size="small" />
              : <Text style={aw.saveTxt}>☀️ Gündiz goş</Text>}
          </TouchableOpacity>
          <TouchableOpacity
            style={[aw.saveBtn, { backgroundColor: palette.info, opacity: saving ? 0.6 : 1 }]}
            onPress={() => handleSave('night')}
            disabled={saving}
          >
            {saving ? <ActivityIndicator color="#fff" size="small" />
              : <Text style={aw.saveTxt}>🌙 Gije goş</Text>}
          </TouchableOpacity>
        </View>
      )}
    </View>
  )
}

// ─── Root ──────────────────────────────────────────────────────────────────────
export function BrigadesScreen() {
  const { colors } = useApp()
  const [tab, setTab] = useState<Tab>('my')
  const [unassignedCount, setUnassignedCount] = useState(0)
  const [refreshTick, setRefreshTick] = useState(0)

  useEffect(() => {
    foremanApi.unassignedWorkers()
      .then(d => setUnassignedCount(d.length))
      .catch(() => {})
  }, [refreshTick])

  return (
    <View style={r.root}>
      {/* Tab bar */}
      <View style={[r.tabBar, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <TouchableOpacity
          style={[r.tab, tab === 'my' && r.tabActive, tab === 'my' && { borderBottomColor: palette.primary }]}
          onPress={() => setTab('my')}
        >
          <Text style={[r.tabTxt, { color: tab === 'my' ? palette.primary : colors.textSecondary }]}>👷 Işçilerim</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[r.tab, tab === 'add' && r.tabActive, tab === 'add' && { borderBottomColor: palette.primary }]}
          onPress={() => setTab('add')}
        >
          <Text style={[r.tabTxt, { color: tab === 'add' ? palette.primary : colors.textSecondary }]}>➕ Işçi goş</Text>
          {unassignedCount > 0 && (
            <View style={r.badge}><Text style={r.badgeTxt}>{unassignedCount}</Text></View>
          )}
        </TouchableOpacity>
      </View>

      {/* Content */}
      <View style={r.content}>
        {tab === 'my'
          ? <MyWorkersTab
              key={refreshTick}
              colors={colors}
              onRefreshNeeded={() => setRefreshTick(t => t + 1)}
            />
          : <AddWorkersTab
              colors={colors}
              onAdded={() => { setRefreshTick(t => t + 1); setTab('my') }}
            />
        }
      </View>
    </View>
  )
}

// ─── Styles ────────────────────────────────────────────────────────────────────
const r = StyleSheet.create({
  root: { flex: 1 },
  tabBar: { flexDirection: 'row', borderBottomWidth: 1 },
  tab: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 13, gap: 6, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabActive: {},
  tabTxt: { fontSize: 13, fontWeight: '700' },
  badge: { backgroundColor: palette.danger, borderRadius: 99, minWidth: 18, height: 18, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  badgeTxt: { color: '#fff', fontSize: 10, fontWeight: '700' },
  content: { flex: 1 },
})

const tw = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  emptyTitle: { fontSize: 17, fontWeight: '700', marginBottom: 8 },
  emptySub: { fontSize: 13, textAlign: 'center', lineHeight: 20 },
  scroll: { flex: 1 },
  listContent: { padding: 16, gap: 10, paddingBottom: 32 },
  statsBar: { flexDirection: 'row', borderRadius: 14, borderWidth: 1, padding: 14, marginBottom: 4 },
  statItem: { flex: 1, alignItems: 'center', gap: 2 },
  statVal: { fontSize: 22, fontWeight: '800' },
  statLbl: { fontSize: 11 },
  divider: { width: 1, marginVertical: 4 },
  section: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8, marginBottom: 6 },
  sectionTxt: { fontSize: 13, fontWeight: '700' },
  card: { borderRadius: 12, borderWidth: 1, padding: 12, gap: 10 },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start' },
  workerName: { fontSize: 13, fontWeight: '700' },
  workerMeta: { fontSize: 11, marginTop: 2 },
  rightCol: { alignItems: 'flex-end', gap: 6 },
  nfcBadge: { borderRadius: 99, paddingHorizontal: 8, paddingVertical: 3 },
  releaseBtn: { padding: 4 },
  shiftRow: { flexDirection: 'row', gap: 8 },
  shiftBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, borderWidth: 1, borderRadius: 8, paddingVertical: 7 },
  shiftTxt: { fontSize: 12, fontWeight: '700' },
})

const aw = StyleSheet.create({
  root: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  emptyTxt: { fontSize: 14, textAlign: 'center' },
  topBar: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 4 },
  search: { flex: 1, borderRadius: 10, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 9, fontSize: 13 },
  selAllBtn: { borderRadius: 8, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 9 },
  hint: { fontSize: 12, paddingHorizontal: 16, paddingBottom: 6 },
  scroll: { flex: 1 },
  listContent: { paddingHorizontal: 16, paddingBottom: 120, gap: 6 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 11 },
  checkbox: { width: 22, height: 22, borderRadius: 6, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  name: { fontSize: 13, fontWeight: '700' },
  meta: { fontSize: 11, marginTop: 2 },
  bottomBar: { position: 'absolute', bottom: 0, left: 0, right: 0, flexDirection: 'row', alignItems: 'center', padding: 12, gap: 8, borderTopWidth: 1 },
  selCount: { fontSize: 13, fontWeight: '700', flex: 1 },
  saveBtn: { borderRadius: 10, paddingHorizontal: 14, paddingVertical: 11, alignItems: 'center' },
  saveTxt: { color: '#fff', fontSize: 12, fontWeight: '700' },
})
