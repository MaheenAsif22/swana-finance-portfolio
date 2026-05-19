import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { C, F, S, R } from '../utils/theme';
import { currency } from '../utils/format';

export default function BalanceCard({ daily, onPostBalance }) {
  const hasOpening = !!daily?.opening_balance;

  return (
    <View style={st.card}>
      <Text style={st.cardLabel}>{hasOpening ? "Today's Cash Balance" : 'No opening balance posted'}</Text>
      <Text style={st.cardAmount}>{currency(daily?.closing_balance ?? 0)}</Text>

      <View style={st.pills}>
        <Pill label="Opening"  value={currency(daily?.opening_balance ?? 0)} />
        <Pill label="Received" value={'+' + currency(daily?.total_received ?? 0)} bright />
        <Pill label="Spent"    value={'−' + currency(daily?.total_paid    ?? 0)} dim />
      </View>

      {!hasOpening && (
        <TouchableOpacity style={st.postBtn} onPress={onPostBalance}>
          <Text style={st.postBtnText}>+ Post opening balance</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

function Pill({ label, value, bright, dim }) {
  return (
    <View style={st.pill}>
      <Text style={st.pillLabel}>{label}</Text>
      <Text style={[st.pillValue, bright && { color: '#8EF5CB' }, dim && { color: '#FFB3B3' }]}>
        {value}
      </Text>
    </View>
  );
}

const st = StyleSheet.create({
  card:      { backgroundColor: C.primary, borderRadius: R.xl, padding: S.xl, marginBottom: S.lg },
  cardLabel: { color: 'rgba(255,255,255,.75)', fontSize: F.sm, marginBottom: 4 },
  cardAmount:{ color: '#fff', fontSize: F.xxl, fontWeight: '700', marginBottom: S.md },
  pills:     { flexDirection: 'row', gap: S.sm },
  pill:      { flex: 1, backgroundColor: 'rgba(255,255,255,.14)', borderRadius: R.md, padding: S.sm, alignItems: 'center' },
  pillLabel: { color: 'rgba(255,255,255,.65)', fontSize: F.xs, marginBottom: 2 },
  pillValue: { color: '#fff', fontSize: F.xs + 1, fontWeight: '600' },
  postBtn:   { marginTop: S.md, backgroundColor: 'rgba(255,255,255,.2)', borderRadius: R.md, padding: S.sm, alignItems: 'center' },
  postBtnText: { color: '#fff', fontSize: F.sm, fontWeight: '600' },
});
