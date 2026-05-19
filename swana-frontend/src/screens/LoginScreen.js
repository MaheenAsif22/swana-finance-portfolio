import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, KeyboardAvoidingView, Platform, Alert, ActivityIndicator,
} from 'react-native';
import { login } from '../api/auth.api';
import { useAuthStore } from '../store/auth.store';
import { C, F, S, R } from '../utils/theme';

export default function LoginScreen() {
  const setAuth = useAuthStore((s) => s.setAuth);
  const [username, setUsername] = useState('');
  const [pin,      setPin]      = useState('');
  const [loading,  setLoading]  = useState(false);

  async function submit() {
    if (!username.trim() || !pin.trim()) {
      Alert.alert('Required', 'Enter username and PIN.');
      return;
    }
    setLoading(true);
    try {
      const { data } = await login(username.trim().toLowerCase(), pin.trim());
      await setAuth(data.user, data.token);
    } catch (e) {
      Alert.alert('Login failed', e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView style={st.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={st.inner}>

        {/* Logo */}
        <View style={st.logoWrap}>
          <View style={st.logo}><Text style={st.logoText}>SF</Text></View>
          <Text style={st.appName}>Swana Finance</Text>
          <Text style={st.tagline}>Factory Cash Management</Text>
        </View>

        {/* Form */}
        <View style={st.form}>
          <Text style={st.label}>Username</Text>
          <TextInput
            style={st.input}
            value={username}
            onChangeText={setUsername}
            placeholder="e.g. zahid"
            autoCapitalize="none"
            autoCorrect={false}
            placeholderTextColor={C.textLight}
            returnKeyType="next"
          />

          <Text style={[st.label, { marginTop: S.md }]}>PIN</Text>
          <TextInput
            style={st.input}
            value={pin}
            onChangeText={setPin}
            placeholder="••••"
            keyboardType="number-pad"
            secureTextEntry
            maxLength={6}
            placeholderTextColor={C.textLight}
            returnKeyType="done"
            onSubmitEditing={submit}
          />

          <TouchableOpacity
            style={[st.btn, loading && { opacity: 0.6 }]}
            onPress={submit}
            disabled={loading}
            activeOpacity={0.85}
          >
            {loading
              ? <ActivityIndicator color="#fff" />
              : <Text style={st.btnText}>Sign In</Text>}
          </TouchableOpacity>
        </View>

        {/* Demo hint */}
        <View style={st.hint}>
          <Text style={st.hintTitle}>Demo logins</Text>
          <Text style={st.hintRow}>usman (owner) · PIN: 1234</Text>
          <Text style={st.hintRow}>zahid (cashier) · PIN: 0000</Text>
        </View>

      </View>
    </KeyboardAvoidingView>
  );
}

const st = StyleSheet.create({
  root:     { flex: 1, backgroundColor: C.bg },
  inner:    { flex: 1, justifyContent: 'center', paddingHorizontal: S.xxl },

  logoWrap: { alignItems: 'center', marginBottom: S.xxl },
  logo:     { width: 70, height: 70, borderRadius: R.xl, backgroundColor: C.primary, alignItems: 'center', justifyContent: 'center', marginBottom: S.md },
  logoText: { color: '#fff', fontSize: F.xl, fontWeight: '700' },
  appName:  { fontSize: F.xl, fontWeight: '700', color: C.text },
  tagline:  { fontSize: F.sm, color: C.textMuted, marginTop: 4 },

  form:     { backgroundColor: C.white, borderRadius: R.xl, padding: S.xl, borderWidth: StyleSheet.hairlineWidth, borderColor: C.border, marginBottom: S.lg },
  label:    { fontSize: F.sm, color: C.textMuted, fontWeight: '500', marginBottom: 6 },
  input:    { borderWidth: 1, borderColor: C.border, borderRadius: R.md, paddingHorizontal: S.md, paddingVertical: S.sm + 2, fontSize: F.base, color: C.text, backgroundColor: C.surface },
  btn:      { backgroundColor: C.primary, borderRadius: R.md, paddingVertical: S.md + 2, alignItems: 'center', marginTop: S.lg },
  btnText:  { color: '#fff', fontSize: F.base, fontWeight: '700' },

  hint:     { backgroundColor: C.primaryBg, borderRadius: R.md, padding: S.md, alignItems: 'center' },
  hintTitle:{ fontSize: F.xs, fontWeight: '700', color: C.primary, marginBottom: 4 },
  hintRow:  { fontSize: F.xs, color: C.primary, marginBottom: 2 },
});
