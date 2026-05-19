import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { C, F, S } from '../../utils/theme';

export default function EmptyState({ icon = '📭', title, subtitle }) {
  return (
    <View style={st.wrap}>
      <Text style={st.icon}>{icon}</Text>
      <Text style={st.title}>{title}</Text>
      {subtitle ? <Text style={st.sub}>{subtitle}</Text> : null}
    </View>
  );
}

const st = StyleSheet.create({
  wrap:  { alignItems: 'center', paddingVertical: 60 },
  icon:  { fontSize: 44, marginBottom: S.md },
  title: { fontSize: F.md, fontWeight: '600', color: C.text },
  sub:   { fontSize: F.sm, color: C.textMuted, marginTop: 6, textAlign: 'center', paddingHorizontal: S.xl },
});
