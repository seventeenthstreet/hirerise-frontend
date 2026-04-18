// hooks/admin/useAdminMetrics.ts
// Fetches GET /admin/metrics for the admin dashboard stat cards.

import { useQuery } from '@tanstack/react-query';
import { adminService } from '@/services/adminService';

export const ADMIN_METRICS_KEY = ['admin', 'metrics'] as const;

export function useAdminMetrics() {
  return useQuery({
    queryKey:  ADMIN_METRICS_KEY,
    queryFn:   () => adminService.getMetrics(),
    staleTime: 60 * 1000, // 1 min
    retry:     1,
  });
}