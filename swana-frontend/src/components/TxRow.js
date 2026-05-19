import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import Badge from './ui/Badge';
import { C, F, S, R } from '../utils/theme';
import { currency, timeStr } from '../utils/format';

export default function TxRow({ tx, onPress }) {
  const isOut = ['payment', 'cheque_out'].includes(tx.type);
  const isIn  = tx.type === 'receipt';
  const amtColor = isOut ? C.danger : isIn ? C.success : C.warning;
  const prefix   = isOut ? '−' : isIn ? '+' : '';

  return (
    <TouchableOpacity style={st.row} onPress={onPress} activeOpacity={0.7}>
      <View style={[st.dot, { backgroundColor: tx.category_color || C.border }]} />
      <View style={st.body}>
        <Text style={st.desc} numberOfLines={1}>{tx.description}</Text>
        <Text style={st.meta} numberOfLines={1}>
          {[tx.payee, tx.category_name, timeStr(tx.created_at)].filter(Boolean).join(' · ')}
        </Text>
      </View>
      <View style={st.right}>
        <Text style={[st.amount, { color: amtColor }]}>{prefix}{currency(tx.amount)}</Text>
        <Badge status={tx.status} />
      </View>
    </TouchableOpacity>
  );
}

const st = StyleSheet.create({
  row: {
    flexDirection: 'row', alignItems: 'center', gap: S.sm,
    backgroundColor: C.white, borderRadius: R.md, padding: S.md,
    marginBottom: 6, borderWidth: StyleSheet.hairlineWidth, borderColor: C.border,
  },
  dot:    { width: 10, height: 10, borderRadius: R.full, flexShrink: 0 },
  body:   { flex: 1, minWidth: 0 },
  desc:   { fontSize: F.sm, fontWeight: '500', color: C.text },
  meta:   { fontSize: F.xs, color: C.textMuted, marginTop: 2 },
  right:  { alignItems: 'flex-end', gap: 4 },
  amount: { fontSize: F.sm, fontWeight: '700' },
});
