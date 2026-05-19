import React from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { C, S, R } from '../../utils/theme';

export default function Card({ children, style, onPress }) {
  const El = onPress ? TouchableOpacity : View;
  return (
    <El style={[st.card, style]} onPress={onPress} activeOpacity={0.7}>
      {children}
    </El>
  );
}

const st = StyleSheet.create({
  card: {
    backgroundColor: C.white, borderRadius: R.lg,
    borderWidth: StyleSheet.hairlineWidth, borderColor: C.border,
    padding: S.lg, marginBottom: S.sm,
  },
});
