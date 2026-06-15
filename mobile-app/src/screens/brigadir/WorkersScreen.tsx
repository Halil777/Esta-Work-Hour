import React, { useState } from 'react'
import { View, Text, ScrollView, TouchableOpacity, TextInput, Modal, StyleSheet } from 'react-native'
import { useApp } from '../../context/AppContext'
import { workers } from '../../data/mockData'
import { StatusBadge } from '../../components/StatusBadge'
import { SyncBadge } from '../../components/SyncBadge'
import { palette } from '../../theme/colors'
import type { AttendanceStatus, AttendanceRecord } from '../../types'

const ABSENCE_REASONS: AttendanceStatus[] = ['Absent', 'Late', 'Medical', 'SickLeave', 'Vacation', 'Unauthorized', 'NoInfo']

export function WorkersScreen() {
  const { colors, t, user, attendance, addAttendance, isOnline } = useApp()
  const [search, setSearch] = useState('')
  const [selectedWorker, setSelectedWorker] = useState<typeof workers[0] | null>(null)
  const [showModal, setShowModal] = useState(false)

  const myWorkers = workers.filter(w => w.brigadeId === user?.brigadeId)
  const filtered = myWorkers.filter(w =>
    w.name.toLowerCase().includes(search.toLowerCase()) ||
    w.workerId.toLowerCase().includes(search.toLowerCase())
  )

  const getRecord = (workerId: string) =>
    attendance.find(a => a.workerId === workerId && a.date === '2026-05-08')

  const markWorker = (status: AttendanceStatus) => {
    if (!selectedWorker) return
    const record: AttendanceRecord = {
      id: `manual-${Date.now()}`,
      workerId: selectedWorker.id,
      workerName: selectedWorker.name,
      brigadeId: selectedWorker.brigadeId,
      date: '2026-05-08',
      status,
      method: 'Manual',
      syncStatus: isOnline ? 'synced' : 'local',
      timestamp: Date.now(),
      scannedBy: user?.id ?? '',
    }
    addAttendance(record)
    setShowModal(false)
    setSelectedWorker(null)
  }

  const statusLabel: Record<AttendanceStatus, string> = {
    Absent: t.attendance.markAbsent, Late: t.attendance.markLate, Medical: t.attendance.medical,
    SickLeave: t.attendance.sickLeave, Vacation: t.attendance.vacation,
    Unauthorized: t.attendance.unauthorized, NoInfo: t.attendance.noInfo,
    Present: t.attendance.markPresent, Transferred: 'Transferred', NotMarked: 'Not Marked',
  }

  return (
    <View style={[s.root, { backgroundColor: colors.bg }]}>
      {/* Search */}
      <View style={[s.searchWrap, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={{ color: colors.textMuted }}>🔍</Text>
        <TextInput
          style={[s.searchInput, { color: colors.text }]}
          value={search}
          onChangeText={setSearch}
          placeholder={t.common.search}
          placeholderTextColor={colors.textMuted}
        />
      </View>

      <ScrollView contentContainerStyle={s.list}>
        {filtered.map((w) => {
          const rec = getRecord(w.id)
          const marked = !!rec
          return (
            <TouchableOpacity
              key={w.id}
              style={[s.workerCard, { backgroundColor: colors.card, borderColor: marked ? colors.border : palette.warning + '44' }]}
              onPress={() => { setSelectedWorker(w); setShowModal(true) }}
            >
              <View style={[s.avatar, { backgroundColor: palette.primaryLight }]}>
                <Text style={[s.avatarTxt, { color: palette.primary }]}>{w.name.split(' ').map(n => n[0]).join('').slice(0, 2)}</Text>
              </View>
              <View style={s.workerInfo}>
                <Text style={[s.workerName, { color: colors.text }]}>{w.name}</Text>
                <Text style={[s.workerMeta, { color: colors.textMuted }]}>{w.workerId} · {w.profession}</Text>
                {marked && rec && (
                  <View style={s.recordRow}>
                    <StatusBadge type="attendance" value={rec.status} label={statusLabel[rec.status]} />
                    <Text style={[s.method, { color: colors.textMuted }]}>{rec.method}</Text>
                    <SyncBadge status={rec.syncStatus} />
                  </View>
                )}
              </View>
              {w.status === 'Blocked' && (
                <View style={[s.blockedBadge, { backgroundColor: palette.dangerLight }]}>
                  <Text style={[s.blockedTxt, { color: palette.danger }]}>Blocked</Text>
                </View>
              )}
              {!marked && w.status === 'Active' && (
                <View style={[s.notMarkedBadge, { backgroundColor: palette.warningLight }]}>
                  <Text style={[s.notMarkedTxt, { color: palette.warning }]}>!</Text>
                </View>
              )}
            </TouchableOpacity>
          )
        })}
      </ScrollView>

      {/* Manual mark modal */}
      <Modal visible={showModal} transparent animationType="slide">
        <TouchableOpacity style={s.modalOverlay} activeOpacity={1} onPress={() => setShowModal(false)}>
          <View style={[s.modalBox, { backgroundColor: colors.card }]}>
            <Text style={[s.modalTitle, { color: colors.text }]}>{t.attendance.manualMark}</Text>
            <Text style={[s.modalWorker, { color: colors.textSecondary }]}>{selectedWorker?.name}</Text>

            <TouchableOpacity
              style={[s.optBtn, { backgroundColor: palette.successLight, borderColor: palette.success }]}
              onPress={() => markWorker('Present')}
            >
              <Text style={[s.optTxt, { color: palette.success }]}>✓ {t.attendance.markPresent}</Text>
            </TouchableOpacity>

            {ABSENCE_REASONS.map(r => (
              <TouchableOpacity
                key={r}
                style={[s.optBtn, { backgroundColor: colors.card2, borderColor: colors.border }]}
                onPress={() => markWorker(r)}
              >
                <Text style={[s.optTxt, { color: colors.text }]}>{statusLabel[r]}</Text>
              </TouchableOpacity>
            ))}

            <TouchableOpacity style={[s.cancelBtn, { borderColor: colors.border }]} onPress={() => setShowModal(false)}>
              <Text style={[s.cancelTxt, { color: colors.textSecondary }]}>{t.common.cancel}</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  )
}

const s = StyleSheet.create({
  root: { flex: 1 },
  searchWrap: { flexDirection: 'row', alignItems: 'center', gap: 10, margin: 16, marginBottom: 8, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12, borderWidth: 1 },
  searchInput: { flex: 1, fontSize: 14 },
  list: { paddingHorizontal: 16, paddingBottom: 24, gap: 8 },
  workerCard: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, padding: 14, borderRadius: 14, borderWidth: 1 },
  avatar: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  avatarTxt: { fontSize: 14, fontWeight: '700' },
  workerInfo: { flex: 1, gap: 4 },
  workerName: { fontSize: 14, fontWeight: '600' },
  workerMeta: { fontSize: 12 },
  recordRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  method: { fontSize: 10 },
  blockedBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 99 },
  blockedTxt: { fontSize: 11, fontWeight: '600' },
  notMarkedBadge: { width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  notMarkedTxt: { fontSize: 13, fontWeight: '800' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  modalBox: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, gap: 10 },
  modalTitle: { fontSize: 17, fontWeight: '700', marginBottom: 4 },
  modalWorker: { fontSize: 14, marginBottom: 8 },
  optBtn: { borderRadius: 12, borderWidth: 1, paddingVertical: 13, paddingHorizontal: 16 },
  optTxt: { fontSize: 14, fontWeight: '600', textAlign: 'center' },
  cancelBtn: { borderRadius: 12, borderWidth: 1, paddingVertical: 13, marginTop: 4 },
  cancelTxt: { fontSize: 14, textAlign: 'center' },
})
