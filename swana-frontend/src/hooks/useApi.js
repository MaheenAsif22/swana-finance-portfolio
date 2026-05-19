import { useState, useCallback } from 'react';

/**
 * useApi(apiFn)
 * Returns { run, data, loading, error }
 * run(...args) calls apiFn(...args), stores result in data.
 */
export function useApi(apiFn) {
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState(null);

  const run = useCallback(async (...args) => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFn(...args);
      setData(res.data);
      return res.data;
    } catch (e) {
      setError(e.message);
      throw e;
    } finally {
      setLoading(false);
    }
  }, [apiFn]);

  return { run, data, loading, error };
}
