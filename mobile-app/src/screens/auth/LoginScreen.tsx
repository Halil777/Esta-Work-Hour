import React, { useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator,
} from 'react-native'
import { useApp } from '../../context/AppContext'
import { authApi } from '../../api'
import { palette } from '../../theme/colors'

export function LoginScreen() {
  const { colors, t, login, setLanguage, language, toggleTheme, theme } = useApp()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleLogin = async () => {
    if (!username.trim() || !password.trim()) {
      setError(t.auth.error)
      return
    }
    setError('')
    setLoading(true)
    try {
      const res = await authApi.login(username.trim(), password.trim())
      const roleMap: Record<string, 'Foreman' | 'SiteChief'> = {
        foreman: 'Foreman',
        site_chief: 'SiteChief',
      }
      login({
        id: res.workerEntityId,
        name: res.name,
        role: roleMap[res.role] ?? 'Foreman',
        objectId: '',
        objectName: 'Esta Construction',
        email: username.trim(),
      }, res.access_token)
    } catch (e: any) {
      setError(e.message ?? t.auth.error)
    } finally {
      setLoading(false)
    }
  }

  const s = makeStyles(colors)

  const LANGS: Array<{ code: typeof language; label: string }> = [
    { code: 'ru', label: 'RU' },
    { code: 'en', label: 'EN' },
    { code: 'tk', label: 'TK' },
  ]

  return (
    <KeyboardAvoidingView style={[s.root, { backgroundColor: colors.bg }]} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
        {/* Top controls */}
        <View style={s.topBar}>
          <View style={s.langRow}>
            {LANGS.map(l => (
              <TouchableOpacity key={l.code} style={[s.langBtn, language === l.code && s.langBtnActive]} onPress={() => setLanguage(l.code)}>
                <Text style={[s.langTxt, { color: language === l.code ? '#fff' : colors.textSecondary }]}>{l.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <TouchableOpacity style={s.themeBtn} onPress={toggleTheme}>
            <Text style={{ fontSize: 18 }}>{theme === 'dark' ? '☀️' : '🌙'}</Text>
          </TouchableOpacity>
        </View>

        {/* Brand */}
        <View style={s.brand}>
          <View style={s.logoBox}>
            <Text style={s.logoText}>E</Text>
          </View>
          <Text style={[s.brandName, { color: colors.text }]}>{t.auth.title}</Text>
          <Text style={[s.brandSub, { color: colors.textMuted }]}>{t.auth.subtitle}</Text>
        </View>

        {/* Card */}
        <View style={[s.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          {/* Username */}
          <View style={s.field}>
            <Text style={[s.label, { color: colors.textSecondary }]}>{t.auth.username}</Text>
            <TextInput
              style={[s.input, { backgroundColor: colors.input, borderColor: colors.border, color: colors.text }]}
              value={username}
              onChangeText={setUsername}
              placeholder="bayram"
              placeholderTextColor={colors.textMuted}
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>

          {/* Password */}
          <View style={s.field}>
            <Text style={[s.label, { color: colors.textSecondary }]}>{t.auth.password}</Text>
            <View style={s.passWrap}>
              <TextInput
                style={[s.input, s.passInput, { backgroundColor: colors.input, borderColor: colors.border, color: colors.text }]}
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPass}
                placeholder="••••••••"
                placeholderTextColor={colors.textMuted}
                autoCapitalize="none"
              />
              <TouchableOpacity style={s.eyeBtn} onPress={() => setShowPass(v => !v)}>
                <Text style={{ color: colors.textMuted, fontSize: 16 }}>{showPass ? '🙈' : '👁'}</Text>
              </TouchableOpacity>
            </View>
          </View>

          {error !== '' && (
            <View style={[s.errorBox, { backgroundColor: palette.dangerLight }]}>
              <Text style={[s.errorTxt, { color: palette.danger }]}>{error}</Text>
            </View>
          )}

          <TouchableOpacity style={[s.loginBtn, loading && s.loginBtnDisabled]} onPress={handleLogin} disabled={loading}>
            {loading
              ? <ActivityIndicator color="#fff" size="small" />
              : <Text style={s.loginTxt}>{t.auth.login}</Text>
            }
          </TouchableOpacity>
        </View>

        <View style={[s.demoCard, { backgroundColor: colors.card2, borderColor: colors.border }]}>
          <Text style={[s.demoTitle, { color: colors.textSecondary }]}>Maglumat</Text>
          <Text style={[s.demoUser, { color: colors.textMuted, fontSize: 12 }]}>
            Username we paroly Admin paneldan beriň:{'\n'}Workers → işçi saýla → 🔑 button
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const makeStyles = (colors: import('../../theme/colors').ThemeColors) => StyleSheet.create({
  root: { flex: 1 },
  scroll: { flexGrow: 1, paddingHorizontal: 20, paddingVertical: 40, justifyContent: 'center' },
  topBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32 },
  langRow: { flexDirection: 'row', gap: 6 },
  langBtn: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, backgroundColor: 'transparent' },
  langBtnActive: { backgroundColor: palette.primary },
  langTxt: { fontSize: 12, fontWeight: '600' },
  themeBtn: { padding: 6 },
  brand: { alignItems: 'center', marginBottom: 32 },
  logoBox: { width: 56, height: 56, borderRadius: 16, backgroundColor: palette.primary, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  logoText: { fontSize: 28, fontWeight: '800', color: '#fff' },
  brandName: { fontSize: 22, fontWeight: '800', marginBottom: 4 },
  brandSub: { fontSize: 13 },
  card: { borderRadius: 16, borderWidth: 1, padding: 24, marginBottom: 16, gap: 16 },
  field: { gap: 6 },
  label: { fontSize: 12, fontWeight: '500' },
  input: { borderRadius: 10, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14 },
  passWrap: { position: 'relative' },
  passInput: { paddingRight: 44 },
  eyeBtn: { position: 'absolute', right: 12, top: 12 },
  errorBox: { borderRadius: 8, padding: 10 },
  errorTxt: { fontSize: 12 },
  loginBtn: { backgroundColor: palette.primary, borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 4 },
  loginBtnDisabled: { opacity: 0.7 },
  loginTxt: { color: '#fff', fontWeight: '700', fontSize: 15 },
  demoCard: { borderRadius: 14, borderWidth: 1, padding: 16, gap: 8 },
  demoTitle: { fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 },
  demoRow: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 4 },
  demoUser: { fontSize: 13, fontWeight: '700' },
  demoSlash: { fontSize: 13 },
  demoPass: { fontSize: 13, flex: 1 },
  demoRole: { marginLeft: 4 },
  demoRoleTxt: { fontSize: 11, fontWeight: '600' },
})
