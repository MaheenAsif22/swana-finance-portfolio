import React, { useState } from 'react';
import { View, Text, StyleSheet, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { postBalance } from '../api/reports.api';
import Input  from '../components/ui/Input';
import Button from '../components/ui/Button';
import { C, F, S, R } from '../utils/theme';

export default function PostBalanceScreen({ navigation }) {
  const [amount,  setAmount]  = useState('');
  const [loading, setLoading] = useState(false);

  async function submit() {
    const n = +amount;
    if (!amount || isNaN(n) || n < 0) { Alert.alert('Invalid', 'Enter a valid amount (0 or more).'); return; }
    setLoading(true);
    try {
      await postBalance(n);
      Alert.alert('Done', `Opening balance ₨ ${n.toLocaleString()} posted for today.`,
        [{ text: 'OK', onPress: () => navigation.goBack() }]);
    } catch (e) {
      Alert.alert('Error', e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView style={st.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={st.inner}>
        <Text style={st.heading}>Today's opening balance</Text>
        <Text style={st.sub}>Physical cash in hand at start of day</Text>

        <View style={st.amountRow}>
          <Text style={st.rupee}>₨</Text>
          <Input
            style={{ flex: 1, marginBottom: 0 }}
            inputStyle={st.amountInput}
            value={amount}
            onChangeText={setAmount}
            keyboardType="numeric"
            placeholder="0"
            autoFocus
          />
        </View>

        <Button label="Post Balance" onPress={submit} loading={loading} style={{ marginTop: S.xl }} />
        <Button label="Cancel" variant="ghost" onPress={() => navigation.goBack()} style={{ marginTop: S.sm }} />
      </View>
    </KeyboardAvoidingView>
  );
}

const st = StyleSheet.create({
  root:      { flex: 1, backgroundColor: C.bg },
  inner:     { flex: 1, padding: S.xl, justifyContent: 'center' },
  heading:   { fontSize: F.lg, fontWeight: '700', color: C.text, marginBottom: 4 },
  sub:       { fontSize: F.sm, color: C.textMuted, marginBottom: S.xl },
  amountRow: { flexDirection: 'row', alignItems: 'center', gap: S.sm },
  rupee:     { fontSize: 34, fontWeight: '300', color: C.textMuted },
  amountInput: { fontSize: 34, fontWeight: '500', borderWidth: 0, backgroundColor: 'transparent', height: 56 },
});
