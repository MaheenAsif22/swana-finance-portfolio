import React from 'react';
import { View, Text, TextInput, StyleSheet } from 'react-native';
import { C, F, S, R } from '../../utils/theme';

export default function Input({ label, error, style, inputStyle, ...props }) {
  return (
    <View style={[st.wrap, style]}>
      {label ? <Text style={st.label}>{label}</Text> : null}
      <TextInput
        style={[st.input, error && { borderColor: C.danger }, inputStyle]}
        placeholderTextColor={C.textLight}
        {...props}
      />
      {error ? <Text style={st.err}>{error}</Text> : null}
    </View>
  );
}

const st = StyleSheet.create({
  wrap:  { marginBottom: S.md },
  label: { fontSize: F.sm, color: C.textMuted, fontWeight: '500', marginBottom: 6 },
  input: {
    borderWidth: 1, borderColor: C.border, borderRadius: R.md,
    paddingHorizontal: S.md, paddingVertical: S.sm + 2,
    fontSize: F.base, color: C.text, backgroundColor: C.white,
  },
  err: { fontSize: F.xs, color: C.danger, marginTop: 3 },
});
