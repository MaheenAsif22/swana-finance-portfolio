import axios from 'axios';

const BASE = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3001';

const client = axios.create({ baseURL: `${BASE}/api`, timeout: 15000 });

// Token is stored on globalThis so the interceptor always reads the latest value
client.interceptors.request.use((cfg) => {
  if (globalThis.__token) cfg.headers.Authorization = `Bearer ${globalThis.__token}`;
  return cfg;
});

// Normalise error messages
client.interceptors.response.use(
  (r) => r,
  (err) => {
    const msg = err.response?.data?.error || err.message || 'Network error';
    return Promise.reject(new Error(msg));
  }
);

export default client;
