import React from 'react'
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native'
import { useApp } from '../context/AppContext'
import { palette } from '../theme/colors'
import type { Language } from '../types'

export function SettingsScreen() {
  const { colors, t, user, language, theme, setLanguage, toggleTheme, logout } = useApp()

  const LANGS: { code: Language; label: string; native: string }[] = [
    { code: 'ru', label: 'Russian', native: 'Русский' },
    { code: 'en', label: 'English', native: 'English' },
    { code: 'tk', label: 'Turkmen', native: 'Türkmen' },
  ]

  return (
    <ScrollView style={[s.root, { backgroundColor: colors.bg }]} contentContainerStyle={s.content}>
      {/* Profile */}
      <View style={[s.profileCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={[s.avatar, { backgroundColor: palette.primaryLight }]}>
          <Text style={[s.avatarTxt, { color: palette.primary }]}>
            {user?.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
          </Text>
        </View>
        <View>
          <Text style={[s.userName, { color: colors.text }]}>{user?.name}</Text>
          <Text style={[s.userRole, { color: colors.textSecondary }]}>{user?.role}</Text>
          <Text style={[s.userObj, { color: colors.textMuted }]}>{user?.objectName}</Text>
        </View>
      </View>

      {/* Theme */}
      <View style={[s.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[s.sectionTitle, { color: colors.text }]}>{t.common.settings}</Text>
        <View style={[s.row, { borderBottomColor: colors.border }]}>
          <Text style={[s.rowLabel, { color: colors.text }]}>Theme</Text>
          <TouchableOpacity
            style={[s.themeToggle, { backgroundColor: theme === 'dark' ? '#1A2335' : '#E2E8F0' }]}
            onPress={toggleTheme}
          >
            <Text style={{ fontSize: 16 }}>{theme === 'dark' ? '🌙' : '☀️'}</Text>
            <Text style={[s.themeTxt, { color: colors.textSecondary }]}>{theme === 'dark' ? 'Dark' : 'Light'}</Text>
          </TouchableOpacity>
        </View>

        <View style={s.langSection}>
          <Text style={[s.rowLabel, { color: colors.text }]}>Language</Text>
          <View style={s.langRow}>
            {LANGS.map(l => (
              <TouchableOpacity
                key={l.code}
                style={[s.langBtn, { backgroundColor: language === l.code ? palette.primary : colors.card2, borderColor: language === l.code ? palette.primary : colors.border }]}
                onPress={() => setLanguage(l.code)}
              >
                <Text style={[s.langBtnTxt, { color: language === l.code ? '#fff' : colors.textSecondary }]}>{l.native}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </View>

      {/* Object info */}
      {user?.objectName && (
        <View style={[s.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[s.sectionTitle, { color: colors.text }]}>Object</Text>
          <View style={[s.row, { borderBottomColor: colors.border }]}>
            <Text style={[s.rowLabel, { color: colors.textSecondary }]}>Site</Text>
            <Text style={[s.rowVal, { color: colors.text }]}>{user.objectName}</Text>
          </View>
          {user.brigadeName && (
            <View style={[s.row, { borderBottomColor: colors.border }]}>
              <Text style={[s.rowLabel, { color: colors.textSecondary }]}>Brigade</Text>
              <Text style={[s.rowVal, { color: colors.text }]}>{user.brigadeName}</Text>
            </View>
          )}
          <View style={[s.row, { borderBottomColor: 'transparent' }]}>
            <Text style={[s.rowLabel, { color: colors.textSecondary }]}>Role</Text>
            <View style={[s.roleBadge, { backgroundColor: palette.primaryLight }]}>
              <Text style={[s.roleTxt, { color: palette.primary }]}>{user.role}</Text>
            </View>
          </View>
        </View>
      )}

      {/* Logout */}
      <TouchableOpacity style={[s.logoutBtn, { backgroundColor: palette.dangerLight, borderColor: palette.danger }]} onPress={logout}>
        <Text style={[s.logoutTxt, { color: palette.danger }]}>🚪 {t.common.logout}</Text>
      </TouchableOpacity>
    </ScrollView>
  )
}

const s = StyleSheet.create({
  root: { flex: 1 },
  content: { padding: 16, gap: 12, paddingBottom: 40 },
  profileCard: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 18, borderRadius: 16, borderWidth: 1 },
  avatar: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
  avatarTxt: { fontSize: 18, fontWeight: '700' },
  userName: { fontSize: 17, fontWeight: '700' },
  userRole: { fontSize: 13, marginTop: 2 },
  userObj: { fontSize: 12, marginTop: 1 },
  section: { borderRadius: 16, borderWidth: 1, padding: 16, gap: 0 },
  sectionTitle: { fontSize: 15, fontWeight: '700', marginBottom: 14 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1 },
  rowLabel: { fontSize: 14 },
  rowVal: { fontSize: 14, fontWeight: '500' },
  themeToggle: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 99 },
  themeTxt: { fontSize: 13, fontWeight: '500' },
  langSection: { paddingVertical: 10, gap: 10 },
  langRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  langBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 99, borderWidth: 1 },
  langBtnTxt: { fontSize: 13, fontWeight: '600' },
  roleBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 99 },
  roleTxt: { fontSize: 13, fontWeight: '600' },
  logoutBtn: { borderRadius: 14, borderWidth: 1, paddingVertical: 14, alignItems: 'center' },
  logoutTxt: { fontSize: 15, fontWeight: '700' },
})
