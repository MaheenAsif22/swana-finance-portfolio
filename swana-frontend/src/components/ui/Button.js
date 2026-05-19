import React from 'react';
import { TouchableOpacity, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { C, F, S, R } from '../../utils/theme';

const VARIANTS = {
  primary:   { bg: C.primary,  text: '#fff', border: C.primary  },
  secondary: { bg: C.surface,  text: C.text, border: C.border   },
  danger:    { bg: C.danger,   text: '#fff', border: C.danger    },
  ghost:     { bg: 'transparent', text: C.primary, border: C.primary },
  success:   { bg: C.success,  text: '#fff', border: C.success   },
};

export default function Button({ label, onPress, variant = 'primary', loading, disabled, style }) {
  const v = VARIANTS[variant] || VARIANTS.primary;
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.8}
      style={[st.btn, { backgroundColor: v.bg, borderColor: v.border }, (disabled || loading) && st.dim, style]}
    >
      {loading
        ? <ActivityIndicator color={v.text} size="small" />
        : <Text style={[st.label, { color: v.text }]}>{label}</Text>}
    </TouchableOpacity>
  );
}

const st = StyleSheet.create({
  btn:   { paddingVertical: S.md, paddingHorizontal: S.xl, borderRadius: R.md, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  label: { fontSize: F.base, fontWeight: '600' },
  dim:   { opacity: 0.45 },
});
