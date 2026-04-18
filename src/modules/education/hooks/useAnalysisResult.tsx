import { useState, useEffect, useCallback, useRef } from 'react';
import { educationApi, type AnalysisResult } from '../services/education.api';

export type { AnalysisResult };

const POLL_INTERVAL_MS = 2000;
const MAX_POLLS        = 15;

interface UseAnalysisResultReturn {
  result:       AnalysisResult | null;
  loading:      boolean;
  polling:      boolean;
  pollProgress: number;
  error:        string | null;
  refetch:      () => void;
}

export function useAnalysisResult(studentId: string | undefined): UseAnalysisResultReturn {
  const [result,  setResult]  = useState<AnalysisResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);
  const [polling, setPolling] = useState(false);

  const pollCount = useRef(0);
  const pollTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mounted   = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      if (pollTimer.current) clearTimeout(pollTimer.current);
    };
  }, []);

  const fetchResult = useCallback(async (isPoll = false) => {
    if (!studentId) return;

    if (!isPoll) {
      setLoading(true);
      setError(null);
      pollCount.current = 0;
    }

    try {
      const data = await educationApi.getAnalysisResult(studentId);
      if (!mounted.current) return;

      if (pollTimer.current) clearTimeout(pollTimer.current);
      setResult(data);
      setLoading(false);
      setPolling(false);
      pollCount.current = 0;

    } catch (err: unknown) {
      if (!mounted.current) return;

      const e = err as Record<string, unknown>;
      const isNotReady =
        e?.status === 404 || e?.statusCode === 404 || e?.code === 'ANALYSIS_NOT_FOUND';

      if (isNotReady && pollCount.current < MAX_POLLS) {
        pollCount.current += 1;
        setPolling(true);
        setLoading(true);
        pollTimer.current = setTimeout(() => {
          if (mounted.current) fetchResult(true);
        }, POLL_INTERVAL_MS);
      } else {
        if (pollTimer.current) clearTimeout(pollTimer.current);
        setPolling(false);
        setLoading(false);
        setError(
          isNotReady
            ? 'Analysis is taking longer than expected. Please refresh the page or try again in a moment.'
            : (e?.message as string) || 'We could not load your analysis results. Please try again.'
        );
      }
    }
  }, [studentId]);

  useEffect(() => { fetchResult(false); }, [fetchResult]);

  const refetch = useCallback(() => {
    if (pollTimer.current) clearTimeout(pollTimer.current);
    pollCount.current = 0;
    fetchResult(false);
  }, [fetchResult]);

  const pollProgress = polling
    ? Math.round((pollCount.current / MAX_POLLS) * 100)
    : loading ? 5 : 100;

  return { result, loading, polling, pollProgress, error, refetch };
}