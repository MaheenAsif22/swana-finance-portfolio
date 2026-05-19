import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { STATUS, R } from '../../utils/theme';

export default function Badge({ status, label }) {
  const s = STATUS[status] || { bg: '#eee', text: '#666', label: status };
  return (
    <View style={[st.wrap, { backgroundColor: s.bg }]}>
      <Text style={[st.text, { color: s.text }]}>{label ?? s.label}</Text>
    </View>
  );
}

const st = StyleSheet.create({
  wrap: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: R.full, alignSelf: 'flex-start' },
  text: { fontSize: 11, fontWeight: '600' },
});
