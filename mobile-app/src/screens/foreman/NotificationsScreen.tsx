import React, { useEffect, useState, useCallback } from 'react'
import {
  View, Text, StyleSheet, TouchableOpacity, ActivityIndicator,
  ScrollView, RefreshControl, Modal, TextInput, KeyboardAvoidingView,
  Platform, Pressable,
} from 'react-native'
import { useApp } from '../../context/AppContext'
import { foremanApi, type MissingCheckout, type LateArrival } from '../../api'
import { palette } from '../../theme/colors'

function fmtTime(ms: number) {
  return new Date(ms).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })
}

function initials(name: string) {
  return name.split(' ').map(n => n[0] ?? '').join('').slice(0, 2).toUpperCase()
}

// ─── Note Modal ──────────────────────────────────────────────────────────────
function NoteModal({
  visible, worker, existingNote, onClose, onSave, colors,
}: {
  visible: boolean
  worker: LateArrival | null
  existingNote: string
  onClose: () => void
  onSave: (workerEntityId: string, note: string) => Promise<void>
  colors: any
}) {
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (visible) setNote(existingNote)
  }, [visible, existingNote])

  async function handleSave() {
    if (!worker || !note.trim()) return
    setSaving(true)
    try {
      await onSave(worker.workerEntityId, note.trim())
      onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={nm.overlay} onPress={onClose}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <Pressable onPress={() => {}} style={[nm.sheet, { backgroundColor: colors.card }]}>
            <Text style={[nm.title, { color: colors.text }]}>Sebäp ýaz</Text>
            {worker && (
              <Text style={[nm.sub, { color: colors.textMuted }]}>
                {worker.workerName} · {worker.brigadeName}
              </Text>
            )}
            <TextInput
              style={[nm.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.bg }]}
              placeholder="Meselem: kart ýitirdi, saglyk ýagdaýy..."
              placeholderTextColor={colors.textMuted}
              value={note}
              onChangeText={setNote}
              multiline
              numberOfLines={3}
              autoFocus
            />
            <View style={nm.row}>
              <TouchableOpacity style={[nm.btn, nm.cancel, { borderColor: colors.border }]} onPress={onClose}>
                <Text style={{ color: colors.textMuted, fontWeight: '600' }}>Ýatyr</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[nm.btn, nm.save, { opacity: saving || !note.trim() ? 0.6 : 1 }]}
                onPress={handleSave}
                disabled={saving || !note.trim()}
              >
                {saving
                  ? <ActivityIndicator color="#fff" size="small" />
                  : <Text style={{ color: '#fff', fontWeight: '700' }}>Ýatla</Text>
                }
              </TouchableOpacity>
            </View>
          </Pressable>
        </KeyboardAvoidingView>
      </Pressable>
    </Modal>
  )
}

// ─── Main Screen ─────────────────────────────────────────────────────────────
export function NotificationsScreen() {
  const { colors } = useApp()
  const [missing, setMissing] = useState<MissingCheckout[]>([])
  const [lateData, setLateData] = useState<{
    workers: LateArrival[]
    daySettings: any
    nightSettings: any
    date: string
  } | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  // note modal state
  const [noteWorker, setNoteWorker] = useState<LateArrival | null>(null)
  const [noteVisible, setNoteVisible] = useState(false)

  // today string for saveAbsenceNote
  const today = new Date(Date.now() + 5 * 60 * 60 * 1000).toISOString().slice(0, 10)

  const load = useCallback(async () => {
    try {
      const [mis, late] = await Promise.all([
        foremanApi.missingCheckouts(),
        foremanApi.lateArrivals(),
      ])
      setMissing(mis)
      setLateData(late)
    } catch {
      setMissing([])
      setLateData(null)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  async function handleSaveNote(workerEntityId: string, note: string) {
    await foremanApi.saveAbsenceNote(workerEntityId, today, note)
    // update local state optimistically
    setLateData(prev => {
      if (!prev) return prev
      return {
        ...prev,
        workers: prev.workers.map(w =>
          w.workerEntityId === workerEntityId
            ? { ...w, absenceNote: { note, createdByName: 'Sen', createdBy: '' } }
            : w
        ),
      }
    })
  }

  function openNote(worker: LateArrival) {
    setNoteWorker(worker)
    setNoteVisible(true)
  }

  if (loading) {
    return (
      <View style={[s.root, { backgroundColor: colors.bg }]}>
        <ActivityIndicator color={palette.primary} style={{ marginTop: 60 }} />
      </View>
    )
  }

  const late = lateData?.workers ?? []
  const dayLate = late.filter(w => w.shift === 'day')
  const nightLate = late.filter(w => w.shift === 'night')
  const noShiftLate = late.filter(w => !w.shift)

  const lateDeadline = (shift: 'day' | 'night') => {
    const settings = shift === 'day' ? lateData?.daySettings : lateData?.nightSettings
    if (!settings) return null
    const [h, m] = (settings.startTime as string).split(':').map(Number)
    const grace = settings.graceMinutes ?? 60
    const total = h * 60 + m + grace
    return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
  }

  const hasAnything = missing.length > 0 || late.length > 0

  return (
    <>
      <ScrollView
        style={[s.root, { backgroundColor: colors.bg }]}
        contentContainerStyle={s.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load() }} />}
      >
        {!hasAnything && (
          <View style={[s.emptyBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={s.emptyIcon}>✅</Text>
            <Text style={[s.emptyTitle, { color: colors.text }]}>Bildiriş ýok</Text>
            <Text style={[s.emptySub, { color: colors.textMuted }]}>
              Ähli işçiler wagtynda geldiler we çykyşlaryny bellediler.
            </Text>
          </View>
        )}

        {/* ─── Late Arrivals ─── */}
        {late.length > 0 && (
          <>
            <View style={[s.sectionHeader, { backgroundColor: palette.warning + '22', borderColor: palette.warning + '44' }]}>
              <Text style={s.sectionIcon}>⏰</Text>
              <View style={{ flex: 1 }}>
                <Text style={[s.sectionTitle, { color: palette.warning }]}>
                  {late.length} işçi ise gelmedi
                </Text>
                <Text style={[s.sectionSub, { color: palette.warning }]}>
                  Iş başlangyjyna çenli giriş ýok
                </Text>
              </View>
            </View>

            {[
              { label: 'Gündiz shift', list: dayLate, shift: 'day' as const },
              { label: 'Gije shift', list: nightLate, shift: 'night' as const },
              { label: 'Shift bellenmän', list: noShiftLate, shift: null },
            ].map(({ label, list, shift }) => {
              if (list.length === 0) return null
              const deadline = shift ? lateDeadline(shift) : null
              return (
                <View key={label}>
                  <Text style={[s.groupLabel, { color: colors.textMuted }]}>
                    {label}{deadline ? ` (termin: ${deadline})` : ''}
                  </Text>
                  {list.map(w => (
                    <View key={w.workerEntityId} style={[s.card, { backgroundColor: colors.card, borderColor: palette.warning + '44' }]}>
                      <View style={s.cardTop}>
                        <View style={[s.avatar, { backgroundColor: palette.warning + '22' }]}>
                          <Text style={[s.avatarTxt, { color: palette.warning }]}>{initials(w.workerName)}</Text>
                        </View>
                        <View style={{ flex: 1 }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                            <Text style={[s.workerName, { color: colors.text }]}>{w.workerName}</Text>
                            {w.isStaff && (
                              <View style={[s.badge, { backgroundColor: palette.info + '22' }]}>
                                <Text style={{ color: palette.info, fontSize: 10, fontWeight: '700' }}>STAFF</Text>
                              </View>
                            )}
                          </View>
                          <Text style={[s.workerMeta, { color: colors.textMuted }]}>
                            {w.workerId}{w.profession ? ` · ${w.profession}` : ''}
                          </Text>
                          {w.brigadeName ? (
                            <Text style={[s.workerMeta, { color: colors.textMuted }]}>{w.brigadeName}</Text>
                          ) : null}
                        </View>
                        <TouchableOpacity
                          style={[s.noteBtn, {
                            backgroundColor: w.absenceNote ? palette.success + '22' : palette.warning + '22',
                            borderColor: w.absenceNote ? palette.success + '55' : palette.warning + '55',
                          }]}
                          onPress={() => openNote(w)}
                        >
                          <Text style={{ fontSize: 16 }}>{w.absenceNote ? '✏️' : '📝'}</Text>
                          <Text style={{
                            fontSize: 10, fontWeight: '700',
                            color: w.absenceNote ? palette.success : palette.warning,
                          }}>
                            {w.absenceNote ? 'Sebäp bar' : 'Sebäp ýaz'}
                          </Text>
                        </TouchableOpacity>
                      </View>
                      {w.absenceNote && (
                        <View style={[s.noteBox, { backgroundColor: palette.success + '11', borderColor: palette.success + '33' }]}>
                          <Text style={{ fontSize: 11, color: palette.success, fontWeight: '600' }}>
                            {w.absenceNote.createdByName}: "{w.absenceNote.note}"
                          </Text>
                        </View>
                      )}
                      <View style={[s.missingBadgeRow, { borderTopColor: colors.border }]}>
                        <View style={[s.badge, { backgroundColor: palette.warning + '22' }]}>
                          <Text style={{ color: palette.warning, fontSize: 11, fontWeight: '700' }}>Giriş ýok</Text>
                        </View>
                      </View>
                    </View>
                  ))}
                </View>
              )
            })}
          </>
        )}

        {/* ─── Missing Checkouts ─── */}
        {missing.length > 0 && (
          <>
            <View style={[s.sectionHeader, { backgroundColor: palette.dangerLight, borderColor: palette.danger + '44' }]}>
              <Text style={s.sectionIcon}>⚠️</Text>
              <View style={{ flex: 1 }}>
                <Text style={[s.sectionTitle, { color: palette.danger }]}>
                  {missing.length} işçi çykyş belgisi ýok
                </Text>
                <Text style={[s.sectionSub, { color: palette.danger }]}>
                  Ise gelen wagtdan 14+ sagat geçdi
                </Text>
              </View>
            </View>

            {missing.map(w => (
              <View key={w.workerEntityId} style={[s.card, { backgroundColor: colors.card, borderColor: palette.danger + '33' }]}>
                <View style={s.cardTop}>
                  <View style={[s.avatar, { backgroundColor: palette.danger + '22' }]}>
                    <Text style={[s.avatarTxt, { color: palette.danger }]}>{initials(w.workerName)}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[s.workerName, { color: colors.text }]}>{w.workerName}</Text>
                    <Text style={[s.workerMeta, { color: colors.textMuted }]}>
                      {w.workerId}{w.profession ? ` · ${w.profession}` : ''}
                    </Text>
                    {w.brigadeName ? (
                      <Text style={[s.workerMeta, { color: colors.textMuted }]}>{w.brigadeName}</Text>
                    ) : null}
                  </View>
                  <View style={[s.hoursBadge, { backgroundColor: palette.danger + '22' }]}>
                    <Text style={[s.hoursNum, { color: palette.danger }]}>{w.hoursAgo}h</Text>
                    <Text style={[s.hoursSub, { color: palette.danger }]}>işde</Text>
                  </View>
                </View>
                <View style={[s.timeRow, { borderTopColor: colors.border }]}>
                  <Text style={[s.timeLabel, { color: colors.textMuted }]}>Giriş wagty:</Text>
                  <Text style={[s.timeVal, { color: colors.text }]}>{fmtTime(w.checkInTime)}</Text>
                  <View style={[s.badge, { backgroundColor: palette.dangerLight }]}>
                    <Text style={{ color: palette.danger, fontSize: 11, fontWeight: '700' }}>Çykyş ýok</Text>
                  </View>
                </View>
              </View>
            ))}
          </>
        )}
      </ScrollView>

      <NoteModal
        visible={noteVisible}
        worker={noteWorker}
        existingNote={noteWorker?.absenceNote?.note ?? ''}
        onClose={() => setNoteVisible(false)}
        onSave={handleSaveNote}
        colors={colors}
      />
    </>
  )
}

const s = StyleSheet.create({
  root: { flex: 1 },
  content: { padding: 16, gap: 10, paddingBottom: 32 },
  emptyBox: { borderRadius: 20, borderWidth: 1, padding: 32, alignItems: 'center', gap: 12, marginTop: 40 },
  emptyIcon: { fontSize: 48 },
  emptyTitle: { fontSize: 18, fontWeight: '700' },
  emptySub: { fontSize: 13, textAlign: 'center', lineHeight: 20 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 14, borderWidth: 1, padding: 14, marginTop: 4 },
  sectionIcon: { fontSize: 26 },
  sectionTitle: { fontSize: 14, fontWeight: '700' },
  sectionSub: { fontSize: 12, marginTop: 2 },
  groupLabel: { fontSize: 11, fontWeight: '600', textTransform: 'uppercase', marginTop: 8, marginBottom: 4, marginLeft: 2 },
  card: { borderRadius: 14, borderWidth: 1, padding: 14, gap: 10 },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  avatar: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  avatarTxt: { fontSize: 13, fontWeight: '700' },
  workerName: { fontSize: 14, fontWeight: '600' },
  workerMeta: { fontSize: 11, marginTop: 1 },
  badge: { borderRadius: 99, paddingHorizontal: 7, paddingVertical: 3 },
  noteBtn: { borderRadius: 10, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 6, alignItems: 'center', gap: 2 },
  noteBox: { borderRadius: 8, borderWidth: 1, padding: 8 },
  missingBadgeRow: { flexDirection: 'row', borderTopWidth: 1, paddingTop: 8 },
  hoursBadge: { borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6, alignItems: 'center' },
  hoursNum: { fontSize: 18, fontWeight: '800' },
  hoursSub: { fontSize: 10, fontWeight: '600' },
  timeRow: { flexDirection: 'row', alignItems: 'center', gap: 8, borderTopWidth: 1, paddingTop: 8 },
  timeLabel: { fontSize: 12 },
  timeVal: { fontSize: 13, fontWeight: '600', flex: 1 },
})

const nm = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: '#00000066', justifyContent: 'center', padding: 24 },
  sheet: { borderRadius: 20, padding: 24, gap: 14 },
  title: { fontSize: 17, fontWeight: '700' },
  sub: { fontSize: 13, marginTop: -8 },
  input: {
    borderWidth: 1, borderRadius: 12, padding: 12,
    fontSize: 14, minHeight: 80, textAlignVertical: 'top',
  },
  row: { flexDirection: 'row', gap: 10 },
  btn: { flex: 1, borderRadius: 12, paddingVertical: 13, alignItems: 'center', justifyContent: 'center' },
  cancel: { borderWidth: 1 },
  save: { backgroundColor: palette.primary },
})
