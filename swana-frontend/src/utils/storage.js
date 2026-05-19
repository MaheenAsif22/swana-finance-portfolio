// Cross-platform secure storage.
// On native (iOS/Android): uses expo-secure-store (encrypted keychain).
// On web: falls back to localStorage (since SecureStore doesn't exist in browsers).
//
// This module exposes the same async API on every platform so callers
// don't need to branch on Platform.OS themselves.

import { Platform } from 'react-native';

let impl;

if (Platform.OS === 'web') {
  // ── Web fallback ───────────────────────────────────────────────
  // localStorage is synchronous; we wrap in Promises to match the
  // SecureStore signature. Guarded so SSR/Node environments don't crash.
  const hasLS = typeof window !== 'undefined' && !!window.localStorage;

  impl = {
    async getItemAsync(key) {
      if (!hasLS) return null;
      return window.localStorage.getItem(key);
    },
    async setItemAsync(key, value) {
      if (!hasLS) return;
      window.localStorage.setItem(key, value);
    },
    async deleteItemAsync(key) {
      if (!hasLS) return;
      window.localStorage.removeItem(key);
    },
  };
} else {
  // ── Native (iOS/Android) ───────────────────────────────────────
  // Lazy require so web bundles never try to load the native module.
  // eslint-disable-next-line global-require
  const SecureStore = require('expo-secure-store');

  impl = {
    getItemAsync:    (key)        => SecureStore.getItemAsync(key),
    setItemAsync:    (key, value) => SecureStore.setItemAsync(key, value),
    deleteItemAsync: (key)        => SecureStore.deleteItemAsync(key),
  };
}

export const getItemAsync    = impl.getItemAsync;
export const setItemAsync    = impl.setItemAsync;
export const deleteItemAsync = impl.deleteItemAsync;

export default impl;
