// features/admin/marketIntelligence/hooks/useMarketIntelligence.ts
//
// TanStack Query hooks for the Market Intelligence admin feature.

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  marketIntelligenceService,
  type MarketApiConfig,
} from '@/services/marketIntelligenceService';

// ─── Query key factory ────────────────────────────────────────────────────────

export const marketIntelKeys = {
  all:         () => ['admin', 'market-intelligence']            as const,
  status:      () => ['admin', 'market-intelligence', 'status'] as const,
  dataSources: () => ['admin', 'market-intelligence', 'sources'] as const,
};

// ─── Status ───────────────────────────────────────────────────────────────────

export function useMarketApiStatus() {
  return useQuery({
    queryKey: marketIntelKeys.status(),
    queryFn:  () => marketIntelligenceService.getStatus(),
    staleTime: 30_000,
    retry: false,
  });
}

// ─── Data sources ─────────────────────────────────────────────────────────────

export function useMarketDataSources() {
  return useQuery({
    queryKey: marketIntelKeys.dataSources(),
    queryFn:  () => marketIntelligenceService.getDataSources(),
    staleTime: 30_000,
  });
}

// ─── Save config ──────────────────────────────────────────────────────────────

export function useSaveMarketConfig() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (config: MarketApiConfig) => marketIntelligenceService.saveConfig(config),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: marketIntelKeys.status() });
      queryClient.invalidateQueries({ queryKey: marketIntelKeys.dataSources() });
    },
  });
}

// ─── Test connection ──────────────────────────────────────────────────────────

export function useTestMarketConnection() {
  return useMutation({
    mutationFn: () => marketIntelligenceService.testConnection(),
  });
}

// ─── Fetch demand ─────────────────────────────────────────────────────────────

export function useFetchMarketDemand() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ role, country }: { role: string; country?: string }) =>
      marketIntelligenceService.fetchDemand(role, country),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: marketIntelKeys.status() });
    },
  });
}