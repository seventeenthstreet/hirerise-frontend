/**
 * hooks/useIntelligenceQuality.ts
 *
 * Phase 4A — Intelligence Quality hooks.
 *
 * Exposes React Query–powered hooks for the intelligence quality system:
 *
 *   useIntelligenceQualityReport()   — full report (primary hook)
 *   useSignalCoverage()              — coverage profile + explanation
 *   useClusterStability()            — stability profiles + explanations
 *   useClusterDrift()                — drift event + history
 *   useQualityExplainability()       — consolidated human-readable narratives
 *
 * Architecture position:
 *   endpoints → [these hooks] → UI components
 *
 * React Query v5 patterns:
 *   - `select` projects server shape into component-safe shape
 *   - `staleTime` set to 10 min — quality data changes only after assessments
 *   - `gcTime` set to 30 min — survives background tab navigation
 *   - `onError` forwarded via useEffect (v5 pattern, not meta.onError)
 *   - Errors propagate as ApiClientError — handled by ErrorBoundary or caller
 */

import { useEffect } from 'react';
import { useQuery }  from '@tanstack/react-query';
import { queryKeys } from '@/lib/query';
import { intelligenceQualityApi } from '@/lib/api/endpoints/intelligence-quality';
import type {
  QualityReportResponse,
  CoverageProfileResponse,
  StabilityProfilesResponse,
  DriftHistoryResponse,
  ExplainabilityResponse,
  CoverageLevel,
  StabilityLevel,
  DriftLevel,
} from '@/lib/api/endpoints/intelligence-quality';

// ─────────────────────────────────────────────────────────────────────────────
// STALE / GC TIMES
// ─────────────────────────────────────────────────────────────────────────────

const QUALITY_STALE_TIME = 10 * 60 * 1000;  // 10 minutes
const QUALITY_GC_TIME    = 30 * 60 * 1000;  // 30 minutes

// ─────────────────────────────────────────────────────────────────────────────
// SHARED OPTIONS
// ─────────────────────────────────────────────────────────────────────────────

export interface UseIntelligenceQualityOptions {
  enabled?:  boolean;
  onError?:  (err: unknown) => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// HOOK 1: useIntelligenceQualityReport
// Primary hook — fetches the full quality report.
// Use this for dashboard widgets that display multiple quality dimensions at once.
// ─────────────────────────────────────────────────────────────────────────────

export interface UseIntelligenceQualityReportReturn {
  report:          QualityReportResponse | null;
  coverageScore:   number | null;
  coverageLevel:   CoverageLevel | null;
  hasCoverageData: boolean;
  isLoading:       boolean;
  isError:         boolean;
  error:           unknown;
  refetch:         () => void;
}

export function useIntelligenceQualityReport(
  options: UseIntelligenceQualityOptions = {}
): UseIntelligenceQualityReportReturn {
  const { enabled = true, onError } = options;

  const query = useQuery({
    queryKey: queryKeys.intelligenceQuality.report(),
    queryFn:  intelligenceQualityApi.getReport,
    enabled,
    staleTime: QUALITY_STALE_TIME,
    gcTime:    QUALITY_GC_TIME,
    select: (data: QualityReportResponse) => data,
    retry: (failureCount, error: any) => {
      // Don't retry 404 — means no assessment data yet
      if (error?.status === 404) return false;
      return failureCount < 2;
    },
  });

  useEffect(() => {
    if (query.error && onError) onError(query.error);
  }, [query.error, onError]);

  return {
    report:          query.data ?? null,
    coverageScore:   query.data?.coverage?.coverageScore ?? null,
    coverageLevel:   (query.data?.coverage?.coverageLevel ?? null) as CoverageLevel | null,
    hasCoverageData: Boolean(query.data?.coverage),
    isLoading:       query.isLoading,
    isError:         query.isError,
    error:           query.error,
    refetch:         query.refetch,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// HOOK 2: useSignalCoverage
// Focused hook for signal coverage + explanation only.
// Use for the coverage detail panel or onboarding progress indicators.
// ─────────────────────────────────────────────────────────────────────────────

export interface UseSignalCoverageReturn {
  coverage:        CoverageProfileResponse['coverage']    | null;
  explanation:     CoverageProfileResponse['explanation'] | null;
  coverageScore:   number | null;
  coverageLevel:   CoverageLevel | null;
  traitGapCount:   number;
  isLoading:       boolean;
  isError:         boolean;
  error:           unknown;
  refetch:         () => void;
}

export function useSignalCoverage(
  options: UseIntelligenceQualityOptions = {}
): UseSignalCoverageReturn {
  const { enabled = true, onError } = options;

  const query = useQuery({
    queryKey: queryKeys.intelligenceQuality.coverage(),
    queryFn:  intelligenceQualityApi.getCoverage,
    enabled,
    staleTime: QUALITY_STALE_TIME,
    gcTime:    QUALITY_GC_TIME,
    retry: (failureCount, error: any) => {
      if (error?.status === 404) return false;
      return failureCount < 2;
    },
  });

  useEffect(() => {
    if (query.error && onError) onError(query.error);
  }, [query.error, onError]);

  return {
    coverage:      query.data?.coverage    ?? null,
    explanation:   query.data?.explanation ?? null,
    coverageScore: query.data?.coverage?.coverageScore ?? null,
    coverageLevel: (query.data?.coverage?.coverageLevel ?? null) as CoverageLevel | null,
    traitGapCount: query.data?.coverage?.traitGaps?.length ?? 0,
    isLoading:     query.isLoading,
    isError:       query.isError,
    error:         query.error,
    refetch:       query.refetch,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// HOOK 3: useClusterStability
// Cluster stability profiles with per-cluster explanations.
// ─────────────────────────────────────────────────────────────────────────────

export interface UseClusterStabilityReturn {
  stabilityProfiles: StabilityProfilesResponse['stabilityProfiles'];
  primaryCluster:    StabilityProfilesResponse['stabilityProfiles'][0] | null;
  hasStabilityData:  boolean;
  isLoading:         boolean;
  isError:           boolean;
  error:             unknown;
  refetch:           () => void;
}

export function useClusterStability(
  options: UseIntelligenceQualityOptions = {}
): UseClusterStabilityReturn {
  const { enabled = true, onError } = options;

  const query = useQuery({
    queryKey: queryKeys.intelligenceQuality.stability(),
    queryFn:  intelligenceQualityApi.getStability,
    enabled,
    staleTime: QUALITY_STALE_TIME,
    gcTime:    QUALITY_GC_TIME,
    select: (data: StabilityProfilesResponse) => data.stabilityProfiles ?? [],
  });

  useEffect(() => {
    if (query.error && onError) onError(query.error);
  }, [query.error, onError]);

  const profiles = query.data ?? [];

  // Primary = highest stability score
  const primaryCluster = profiles.length
    ? [...profiles].sort(
        (a, b) =>
          (b.explanation?.level === 'HIGH' ? 1 : 0) -
          (a.explanation?.level === 'HIGH' ? 1 : 0)
      )[0] ?? null
    : null;

  return {
    stabilityProfiles: profiles,
    primaryCluster,
    hasStabilityData:  profiles.length > 0,
    isLoading:         query.isLoading,
    isError:           query.isError,
    error:             query.error,
    refetch:           query.refetch,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// HOOK 4: useClusterDrift
// Drift detection result and history.
// ─────────────────────────────────────────────────────────────────────────────

export interface UseClusterDriftReturn {
  latestDrift:      DriftHistoryResponse['latestDrift'];
  driftHistory:     DriftHistoryResponse['driftHistory'];
  driftExplanation: DriftHistoryResponse['driftExplanation'];
  driftLevel:       DriftLevel | null;
  hasDrift:         boolean;
  isLoading:        boolean;
  isError:          boolean;
  error:            unknown;
  refetch:          () => void;
}

export function useClusterDrift(
  options: UseIntelligenceQualityOptions = {}
): UseClusterDriftReturn {
  const { enabled = true, onError } = options;

  const query = useQuery({
    queryKey: queryKeys.intelligenceQuality.drift(),
    queryFn:  intelligenceQualityApi.getDrift,
    enabled,
    staleTime: QUALITY_STALE_TIME,
    gcTime:    QUALITY_GC_TIME,
  });

  useEffect(() => {
    if (query.error && onError) onError(query.error);
  }, [query.error, onError]);

  return {
    latestDrift:      query.data?.latestDrift      ?? null,
    driftHistory:     query.data?.driftHistory     ?? [],
    driftExplanation: query.data?.driftExplanation ?? null,
    driftLevel:       (query.data?.latestDrift?.driftLevel ?? null) as DriftLevel | null,
    hasDrift:         Boolean(query.data?.latestDrift && query.data.latestDrift.driftLevel !== 'None'),
    isLoading:        query.isLoading,
    isError:          query.isError,
    error:            query.error,
    refetch:          query.refetch,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// HOOK 5: useQualityExplainability
// Consolidated narratives hook.
// Primary hook for the explainability panel / assessment quality section.
// ─────────────────────────────────────────────────────────────────────────────

export interface UseQualityExplainabilityReturn {
  explainability:      ExplainabilityResponse | null;
  available:           boolean;
  coverageHeadline:    string | null;
  stabilityProfiles:   ExplainabilityResponse['stability'] | null;
  driftHeadline:       string | null;
  isLoading:           boolean;
  isError:             boolean;
  error:               unknown;
  refetch:             () => void;
}

export function useQualityExplainability(
  options: UseIntelligenceQualityOptions = {}
): UseQualityExplainabilityReturn {
  const { enabled = true, onError } = options;

  const query = useQuery({
    queryKey: queryKeys.intelligenceQuality.explainability(),
    queryFn:  intelligenceQualityApi.getExplainability,
    enabled,
    staleTime: QUALITY_STALE_TIME,
    gcTime:    QUALITY_GC_TIME,
  });

  useEffect(() => {
    if (query.error && onError) onError(query.error);
  }, [query.error, onError]);

  return {
    explainability:    query.data            ?? null,
    available:         query.data?.available ?? false,
    coverageHeadline:  query.data?.coverage?.headline ?? null,
    stabilityProfiles: query.data?.stability ?? null,
    driftHeadline:     query.data?.drift?.headline    ?? null,
    isLoading:         query.isLoading,
    isError:           query.isError,
    error:             query.error,
    refetch:           query.refetch,
  };
}
