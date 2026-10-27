"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { api, errorMessage } from "./api-client";

/**
 * GET `path` and keep the result. A null path waits (for a search param, say). A newer path
 * always wins over a slower answer to an older one.
 */
export function useApi<T>(path: string | null) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(path !== null);
  const latest = useRef(0);

  const load = useCallback(async () => {
    if (path === null) return;
    const id = ++latest.current;
    setLoading(true);
    try {
      const result = await api<T>(path);
      if (id !== latest.current) return;
      setData(result);
      setError(null);
    } catch (err) {
      if (id === latest.current) setError(errorMessage(err));
    } finally {
      if (id === latest.current) setLoading(false);
    }
  }, [path]);

  useEffect(() => {
    void load();
  }, [load]);

  return { data, error, loading, reload: load, setData };
}
