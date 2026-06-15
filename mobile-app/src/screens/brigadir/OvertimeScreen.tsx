import React, { useState } from 'react'
import { View, Text, ScrollView, TouchableOpacity, TextInput, Modal, StyleSheet } from 'react-native'
import { useApp } from '../../context/AppContext'
import { workers } from '../../data/mockData'
import { StatusBadge } from '../../components/StatusBadge'
import { palette } from '../../theme/colors'
import type { OvertimeRequest } from '../../types'

export function BrigadirOvertimeScreen() {
  const { colors, t, user, overtimeRequests, addOvertimeRequest } = useApp()
  const [showNew, setShowNew] = useState(false)
  const [selectedWorkers, setSelectedWorkers] = useState<string[]>([])
  const [hours, setHours] = useState('2')
  const [reason, setReason] = useState('deadline')
  const [comment, setComment] = useState('')

  const myOT = overtimeRequests.filter(r => r.brigadeId === user?.brigadeId)
  const myWorkers = workers.filter(w => w.brigadeId === user?.brigadeId && w.status === 'Active')

  const toggleWorker = (id: string) => setSelectedWorkers(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id])

  const handleSubmit = () => {
    if (selectedWorkers.length === 0) return
    const req: OvertimeRequest = {
      id: `ot-${Date.now()}`,
      brigadeId: user?.brigadeId ?? '',
      brigadeName: user?.brigadeName ?? '',
      date: '2026-05-08',
      workers: myWorkers.filter(w => selectedWorkers.includes(w.id)).map(w => ({ id: w.id, name: w.name, hours: Number(hours) })),
      reason,
      comment,
      status: 'Draft',
      createdBy: user?.name ?? '',
      createdAt: new Date().toLocaleString('ru-RU'),
    }
    addOvertimeRequest(req)
    setShowNew(false)
    setSelectedWorkers([])
    setHours('2')
    setComment('')
  }

  const reasonLabels = t.overtime.reasons

  return (
    <View style={[s.root, { backgroundColor: colors.bg }]}>
      <View style={s.topBar}>
        <Text style={[s.header, { color: colors.text }]}>{t.overtime.title}</Text>
        <TouchableOpacity style={[s.newBtn, { backgroundColor: palette.primary }]} onPress={() => setShowNew(true)}>
          <Text style={s.newBtnTxt}>+ {t.overtime.newRequest}</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={s.list}>
        {myOT.length === 0 && (
          <Text style={[s.empty, { color: colors.textMuted }]}>{t.common.noData}</Text>
        )}
        {myOT.map(req => (
          <View key={req.id} style={[s.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={s.cardHeader}>
              <Text style={[s.cardDate, { color: colors.text }]}>{req.date}</Text>
              <StatusBadge type="overtime" value={req.status} label={t.overtime[req.status.toLowerCase() as keyof typeof t.overtime] as string ?? req.status} />
            </View>
            <Text style={[s.cardBrigade, { color: colors.textSecondary }]}>{req.brigadeName}</Text>
            <Text style={[s.cardReason, { color: colors.textMuted }]}>{reasonLabels[req.reason as keyof typeof reasonLabels] ?? req.reason}</Text>
            <View style={s.workerList}>
              {req.workers.map(w => (
                <View key={w.id} style={[s.workerPill, { backgroundColor: colors.card2 }]}>
                  <Text style={[s.workerPillTxt, { color: colors.text }]}>{w.name}</Text>
                  <Text style={[s.workerPillHrs, { color: palette.primary }]}>{w.hours}h</Text>
                </View>
              ))}
            </View>
            {req.reviewComment && (
              <View style={[s.reviewBox, { backgroundColor: colors.card2 }]}>
                <Text style={[s.reviewBy, { color: colors.textMuted }]}>{req.reviewedBy}:</Text>
                <Text style={[s.reviewComment, { color: colors.textSecondary }]}>{req.reviewComment}</Text>
              </View>
            )}
          </View>
        ))}
      </ScrollView>

      {/* New OT Modal */}
      <Modal visible={showNew} transparent animationType="slide">
        <View style={s.modalOverlay}>
          <View style={[s.modalBox, { backgroundColor: colors.card }]}>
            <Text style={[s.modalTitle, { color: colors.text }]}>{t.overtime.newRequest}</Text>

            <Text style={[s.fieldLabel, { color: colors.textSecondary }]}>{t.overtime.selectWorkers}</Text>
            <ScrollView style={s.workerScroll} nestedScrollEnabled>
              {myWorkers.map(w => (
                <TouchableOpacity
                  key={w.id}
                  style={[s.checkRow, { borderBottomColor: colors.border }]}
                  onPress={() => toggleWorker(w.id)}
                >
                  <View style={[s.checkbox, { borderColor: colors.border, backgroundColor: selectedWorkers.includes(w.id) ? palette.primary : 'transparent' }]}>
                    {selectedWorkers.includes(w.id) && <Text style={s.checkMark}>✓</Text>}
                  </View>
                  <Text style={[s.checkName, { color: colors.text }]}>{w.name}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <Text style={[s.fieldLabel, { color: colors.textSecondary }]}>{t.overtime.enterHours}</Text>
            <TextInput
              style={[s.input, { backgroundColor: colors.card2, borderColor: colors.border, color: colors.text }]}
              value={hours}
              onChangeText={setHours}
              keyboardType="numeric"
              placeholder="2"
              placeholderTextColor={colors.textMuted}
            />

            <Text style={[s.fieldLabel, { color: colors.textSecondary }]}>{t.overtime.selectReason}</Text>
            <View style={s.reasonRow}>
              {Object.entries(reasonLabels).map(([k, v]) => (
                <TouchableOpacity
                  key={k}
                  style={[s.reasonBtn, { backgroundColor: reason === k ? palette.primaryLight : colors.card2, borderColor: reason === k ? palette.primary : colors.border }]}
                  onPress={() => setReason(k)}
                >
                  <Text style={[s.reasonTxt, { color: reason === k ? palette.primary : colors.textSecondary }]}>{v}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={[s.fieldLabel, { color: colors.textSecondary }]}>{t.overtime.addComment}</Text>
            <TextInput
              style={[s.input, s.textarea, { backgroundColor: colors.card2, borderColor: colors.border, color: colors.text }]}
              value={comment}
              onChangeText={setComment}
              multiline
              numberOfLines={3}
              placeholder={t.overtime.addComment}
              placeholderTextColor={colors.textMuted}
            />

            <View style={s.modalBtns}>
              <TouchableOpacity style={[s.cancelBtn, { borderColor: colors.border }]} onPress={() => setShowNew(false)}>
                <Text style={[s.cancelTxt, { color: colors.textSecondary }]}>{t.common.cancel}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.submitBtn, { backgroundColor: palette.primary, opacity: selectedWorkers.length === 0 ? 0.5 : 1 }]} onPress={handleSubmit} disabled={selectedWorkers.length === 0}>
                <Text style={s.submitTxt}>{t.overtime.sendToChief}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  )
}

const s = StyleSheet.create({
  root: { flex: 1 },
  topBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16 },
  header: { fontSize: 20, fontWeight: '700' },
  newBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10 },
  newBtnTxt: { color: '#fff', fontWeight: '700', fontSize: 13 },
  list: { paddingHorizontal: 16, paddingBottom: 32, gap: 10 },
  empty: { textAlign: 'center', paddingVertical: 40, fontSize: 14 },
  card: { borderRadius: 16, borderWidth: 1, padding: 16, gap: 8 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardDate: { fontSize: 15, fontWeight: '700' },
  cardBrigade: { fontSize: 13 },
  cardReason: { fontSize: 12 },
  workerList: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  workerPill: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 99 },
  workerPillTxt: { fontSize: 12, fontWeight: '500' },
  workerPillHrs: { fontSize: 12, fontWeight: '700' },
  reviewBox: { borderRadius: 8, padding: 10, gap: 2 },
  reviewBy: { fontSize: 11, fontWeight: '600' },
  reviewComment: { fontSize: 12 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  modalBox: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, gap: 12, maxHeight: '90%' },
  modalTitle: { fontSize: 18, fontWeight: '700', marginBottom: 4 },
  fieldLabel: { fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  workerScroll: { maxHeight: 160 },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, borderBottomWidth: 1 },
  checkbox: { width: 20, height: 20, borderRadius: 5, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  checkMark: { color: '#fff', fontSize: 13, fontWeight: '700' },
  checkName: { fontSize: 14 },
  input: { borderRadius: 10, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 11, fontSize: 14 },
  textarea: { height: 72, textAlignVertical: 'top' },
  reasonRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  reasonBtn: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 99, borderWidth: 1 },
  reasonTxt: { fontSize: 12, fontWeight: '500' },
  modalBtns: { flexDirection: 'row', gap: 10, marginTop: 4 },
  cancelBtn: { flex: 1, borderRadius: 12, borderWidth: 1, paddingVertical: 13, alignItems: 'center' },
  cancelTxt: { fontSize: 14 },
  submitBtn: { flex: 2, borderRadius: 12, paddingVertical: 13, alignItems: 'center' },
  submitTxt: { color: '#fff', fontWeight: '700', fontSize: 14 },
})
