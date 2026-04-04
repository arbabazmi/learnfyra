/**
 * @file src/hooks/useApi.ts
 * @description Generic data-fetching hook that manages loading, error, and
 * data state for any async API call. Re-fetches automatically when deps change.
 */

import { useState, useEffect, useCallback } from 'react';
import type { ApiError } from '@/types';

interface UseApiState<T> {
  data: T | null;
  isLoading: boolean;
  error: ApiError | null;
  /** Manually re-triggers the fetcher. Useful for pull-to-refresh patterns. */
  refetch: () => void;
}

/**
 * Executes an async fetcher function and tracks its loading/error/data states.
 * Automatically re-runs whenever the provided deps array changes (same
 * semantics as useEffect deps).
 *
 * @example
 * const { data, isLoading, error, refetch } = useApi(
 *   () => api.getUsers({ role: 'teacher' }),
 *   [roleFilter],
 * );
 *
 * @param fetcher - Async function that returns the data to load
 * @param deps - Dependency array that triggers a re-fetch on change (default [])
 * @returns UseApiState containing data, isLoading, error, and refetch
 */
export function useApi<T>(fetcher: () => Promise<T>, deps: unknown[] = []): UseApiState<T> {
  const [data, setData] = useState<T | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<ApiError | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await fetcher();
      setData(result);
    } catch (err) {
      setError(err as ApiError);
    } finally {
      setIsLoading(false);
    }
    // The fetcher reference itself is not included in deps — callers control
    // re-fetch frequency through the explicit deps array.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => {
    load();
  }, [load]);

  return { data, isLoading, error, refetch: load };
}
