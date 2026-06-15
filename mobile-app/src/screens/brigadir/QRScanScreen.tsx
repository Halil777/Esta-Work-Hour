import React, { useState, useEffect, useRef } from 'react'
import { View, Text, TouchableOpacity, StyleSheet, Vibration, Animated } from 'react-native'
import { CameraView as _CameraView, useCameraPermissions } from 'expo-camera'
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const CameraView = _CameraView as any
import { useApp } from '../../context/AppContext'
import { workers } from '../../data/mockData'
import { palette } from '../../theme/colors'
import type { AttendanceRecord } from '../../types'

type ScanResult = {
  type: 'success' | 'warning' | 'error'
  workerName: string
  workerId: string
  message: string
}

const MOCK_WORKERS = workers.filter(w => w.brigadeId === 'b1')

export function QRScanScreen() {
  const { colors, t, user, attendance, addAttendance, isOnline } = useApp()
  const [permission, requestPermission] = useCameraPermissions()
  const [scanResult, setScanResult] = useState<ScanResult | null>(null)
  const [scanning, setScanning] = useState(true)
  const [mockIdx, setMockIdx] = useState(0)
  const flashAnim = useRef(new Animated.Value(0)).current

  const today = '2026-05-08'

  const flash = (type: 'success' | 'error') => {
    flashAnim.setValue(1)
    Animated.timing(flashAnim, { toValue: 0, duration: 600, useNativeDriver: true }).start()
  }

  const processQR = (token: string) => {
    if (!scanning) return
    setScanning(false)

    const worker = workers.find(w => w.qrToken === token)

    if (!worker) {
      const result: ScanResult = { type: 'error', workerName: 'Unknown', workerId: '', message: t.scan.blockedQR }
      setScanResult(result); flash('error'); Vibration.vibrate(300); return
    }
    if (worker.status === 'Blocked') {
      setScanResult({ type: 'error', workerName: worker.name, workerId: worker.workerId, message: t.scan.blockedQR })
      flash('error'); Vibration.vibrate(300); return
    }
    if (worker.brigadeId !== user?.brigadeId) {
      setScanResult({ type: 'warning', workerName: worker.name, workerId: worker.workerId, message: t.scan.wrongBrigade })
      flash('error'); Vibration.vibrate([0, 100, 100, 100]); return
    }
    const alreadyScanned = attendance.find(a => a.workerId === worker.id && a.date === today)
    if (alreadyScanned) {
      setScanResult({ type: 'warning', workerName: worker.name, workerId: worker.workerId, message: t.scan.alreadyScanned })
      flash('error'); Vibration.vibrate(200); return
    }

    const record: AttendanceRecord = {
      id: `scan-${Date.now()}`,
      workerId: worker.id,
      workerName: worker.name,
      brigadeId: worker.brigadeId,
      date: today,
      status: 'Present',
      method: 'QR',
      syncStatus: isOnline ? 'synced' : 'local',
      timestamp: Date.now(),
      scannedBy: user?.id ?? '',
    }
    addAttendance(record)
    setScanResult({ type: 'success', workerName: worker.name, workerId: worker.workerId, message: isOnline ? t.scan.markedPresent : t.scan.offlineSaved })
    flash('success')
    Vibration.vibrate(100)
  }

  const handleMockScan = () => {
    const w = MOCK_WORKERS[mockIdx % MOCK_WORKERS.length]
    setMockIdx(i => i + 1)
    if (w) processQR(w.qrToken)
  }

  const handleScanNext = () => {
    setScanResult(null)
    setTimeout(() => setScanning(true), 300)
  }

  const resultColor = scanResult?.type === 'success' ? palette.success : scanResult?.type === 'warning' ? palette.warning : palette.danger

  if (!permission) return (
    <View style={[s.center, { backgroundColor: colors.bg }]}>
      <Text style={[s.permText, { color: colors.textMuted }]}>{t.common.loading}</Text>
    </View>
  )

  if (!permission.granted) return (
    <View style={[s.center, { backgroundColor: colors.bg }]}>
      <Text style={{ fontSize: 48, marginBottom: 16 }}>📷</Text>
      <Text style={[s.permText, { color: colors.text }]}>{t.scan.permissionNeeded}</Text>
      <TouchableOpacity style={s.permBtn} onPress={requestPermission}>
        <Text style={s.permBtnTxt}>{t.scan.grantPermission}</Text>
      </TouchableOpacity>
    </View>
  )

  return (
    <View style={[s.root, { backgroundColor: '#000' }]}>
      <CameraView
        style={StyleSheet.absoluteFill}
        facing="back"
        barcodeScannerEnabled={scanning}
        onBarcodeScanned={({ data }: { data: string }) => processQR(data)}
      />

      {/* Overlay */}
      <View style={s.overlay}>
        {/* Finder */}
        <View style={s.finderWrap}>
          <View style={[s.finder, { borderColor: scanning ? palette.primary : resultColor }]}>
            <View style={[s.corner, s.cornerTL, { borderColor: palette.primary }]} />
            <View style={[s.corner, s.cornerTR, { borderColor: palette.primary }]} />
            <View style={[s.corner, s.cornerBL, { borderColor: palette.primary }]} />
            <View style={[s.corner, s.cornerBR, { borderColor: palette.primary }]} />
          </View>
          <Text style={s.scanHint}>{t.scan.scanning}</Text>
        </View>

        {/* Result card */}
        {scanResult && (
          <View style={[s.resultCard, { backgroundColor: colors.card, borderColor: resultColor }]}>
            <View style={[s.resultIcon, { backgroundColor: resultColor + '22' }]}>
              <Text style={{ fontSize: 32 }}>
                {scanResult.type === 'success' ? '✅' : scanResult.type === 'warning' ? '⚠️' : '❌'}
              </Text>
            </View>
            <Text style={[s.resultName, { color: colors.text }]}>{scanResult.workerName}</Text>
            <Text style={[s.resultId, { color: colors.textMuted }]}>{scanResult.workerId}</Text>
            <View style={[s.resultBadge, { backgroundColor: resultColor + '22' }]}>
              <Text style={[s.resultMsg, { color: resultColor }]}>{scanResult.message}</Text>
            </View>
            <TouchableOpacity style={[s.nextBtn, { backgroundColor: palette.primary }]} onPress={handleScanNext}>
              <Text style={s.nextBtnTxt}>{t.scan.scanNext}</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Bottom - mock scan */}
        <View style={s.bottomBar}>
          <TouchableOpacity style={[s.mockBtn, { backgroundColor: palette.primaryLight }]} onPress={handleMockScan}>
            <Text style={[s.mockBtnTxt, { color: palette.primary }]}>🎯 {t.scan.mockScan}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  )
}

const s = StyleSheet.create({
  root: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 16 },
  permText: { fontSize: 16, textAlign: 'center' },
  permBtn: { backgroundColor: palette.primary, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12, marginTop: 8 },
  permBtnTxt: { color: '#fff', fontWeight: '700', fontSize: 15 },
  overlay: { flex: 1, justifyContent: 'space-between', paddingBottom: 40 },
  finderWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 },
  finder: { width: 240, height: 240, borderRadius: 12, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  corner: { position: 'absolute', width: 24, height: 24, borderWidth: 3, borderColor: palette.primary },
  cornerTL: { top: -2, left: -2, borderRightWidth: 0, borderBottomWidth: 0, borderTopLeftRadius: 8 },
  cornerTR: { top: -2, right: -2, borderLeftWidth: 0, borderBottomWidth: 0, borderTopRightRadius: 8 },
  cornerBL: { bottom: -2, left: -2, borderRightWidth: 0, borderTopWidth: 0, borderBottomLeftRadius: 8 },
  cornerBR: { bottom: -2, right: -2, borderLeftWidth: 0, borderTopWidth: 0, borderBottomRightRadius: 8 },
  scanHint: { color: 'rgba(255,255,255,0.7)', fontSize: 13, textAlign: 'center' },
  resultCard: { marginHorizontal: 20, borderRadius: 20, borderWidth: 2, padding: 24, alignItems: 'center', gap: 10, backgroundColor: 'rgba(255,255,255,0.97)' },
  resultIcon: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  resultName: { fontSize: 18, fontWeight: '700', textAlign: 'center' },
  resultId: { fontSize: 12 },
  resultBadge: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 99 },
  resultMsg: { fontSize: 13, fontWeight: '600' },
  nextBtn: { paddingHorizontal: 32, paddingVertical: 12, borderRadius: 12, marginTop: 4 },
  nextBtnTxt: { color: '#fff', fontWeight: '700', fontSize: 15 },
  bottomBar: { alignItems: 'center', paddingHorizontal: 20 },
  mockBtn: { paddingHorizontal: 24, paddingVertical: 12, borderRadius: 99 },
  mockBtnTxt: { fontWeight: '700', fontSize: 14 },
})
