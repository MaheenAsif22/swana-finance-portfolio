import { create } from 'zustand';
import * as Storage from '../utils/storage';

const KEY = 'swana_token';

// Persist token across restarts. Uses SecureStore on iOS/Android,
// localStorage on web. See src/utils/storage.js.
async function saveToken(token) {
  globalThis.__token = token;
  try { await Storage.setItemAsync(KEY, token); } catch {}
}

async function clearToken() {
  globalThis.__token = null;
  try { await Storage.deleteItemAsync(KEY); } catch {}
}

export const useAuthStore = create((set) => ({
  user:  null,
  token: null,
  ready: false,   // true once we've checked persistent storage

  // Called on app boot
  hydrate: async () => {
    try {
      const token = await Storage.getItemAsync(KEY);
      if (token) {
        globalThis.__token = token;
        // Validate token — import lazily to avoid circular deps
        const { me } = await import('../api/auth.api');
        const { data: user } = await me();
        set({ user, token, ready: true });
        return;
      }
    } catch {}
    set({ ready: true });
  },

  setAuth: async (user, token) => {
    await saveToken(token);
    set({ user, token });
  },

  logout: async () => {
    await clearToken();
    set({ user: null, token: null });
  },
}));
