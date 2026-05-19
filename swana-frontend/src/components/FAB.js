import React from 'react';
import { TouchableOpacity, Text, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { C, R, S } from '../utils/theme';

export default function FAB({ onPress }) {
  const insets = useSafeAreaInsets();
  return (
    <TouchableOpacity
      style={[st.fab, { bottom: insets.bottom + 72 }]}
      onPress={onPress}
      activeOpacity={0.85}
    >
      <Text style={st.icon}>+</Text>
    </TouchableOpacity>
  );
}

const st = StyleSheet.create({
  fab: {
    position: 'absolute', right: S.xl,
    width: 56, height: 56, borderRadius: R.full,
    backgroundColor: C.primary, alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.22, shadowRadius: 8, elevation: 8,
  },
  icon: { color: '#fff', fontSize: 30, lineHeight: 34, fontWeight: '300' },
});
