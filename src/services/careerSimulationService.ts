/**
 * services/careerSimulationService.ts
 *
 * Frontend API client for the Career Digital Twin module.
 * Wraps all /api/career/simulations and /api/career/future-paths calls.
 *
 * All methods throw on non-2xx responses so callers can use try/catch or
 * React Query's error handling.
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export interface UserProfile {
  role:               string;
  skills?:            string[];
  experience_years?:  number;
  industry?:          string;
  salary_current?:    number;
}

export interface RoleDetail {
  role:               string;
  years_to_reach:     number;
  cumulative_years:   number;
  required_skills:    string[];
  skills_to_acquire:  string[];
  salary_lakhs:       number;
  salary_display:     string;
  automation_risk:    number;
  risk_level:         'Low' | 'Medium' | 'High';
  growth_score:       number;
}

export interface CareerPath {
  strategy_id:        string;
  strategy_label:     string;
  path:               string[];
  roles_detail:       RoleDetail[];
  next_role:          string | null;
  salary_projection:  string;
  salary_lakhs:       number;
  growth_score:       number;
  risk_level:         'Low' | 'Medium' | 'High';
  skills_required:    string[];
  transition_months:  number;
  total_years:        number;
  narrative?:         string;
  key_milestone?:     string;
}

export interface SimulationMeta {
  role:             string;
  experience_years: number;
  industry:         string | null;
  simulated_at:     string;
  path_count:       number;
  engine_version:   string;
}

export interface SimulationResult {
  career_paths:   CareerPath[];
  meta:           SimulationMeta;
  simulation_id?: string | null;
  cached:         boolean;
}

export interface SimulationRecord {
  id:                string;
  user_id:           string;
  career_path:       CareerPath[];
  salary_projection: string | null;
  risk_level:        'Low' | 'Medium' | 'High';
  growth_score:      number;
  meta:              SimulationMeta;
  created_at:        string | null;
}

export interface RunSimulationOptions {
  userProfile:       UserProfile;
  marketData?:       Record<string, unknown>;
  includeNarrative?: boolean;
  forceRefresh?:     boolean;
}

import { apiFetch } from '@/services/apiClient';

// ─── Service methods ──────────────────────────────────────────────────────────

/**
 * runSimulation
 *
 * Calls POST /api/v1/career/simulations and returns the full simulation
 * result including all career paths.
 */
export async function runSimulation(
  opts: RunSimulationOptions
): Promise<SimulationResult> {
  const response = await apiFetch<{ success: boolean; data: SimulationResult }>(
    '/career/simulations',
    {
      method: 'POST',
      body:   JSON.stringify(opts),
    }
  );
  return response.data;
}

/**
 * getSimulations
 *
 * Fetches simulation history for the current user.
 * GET /api/v1/career/simulations?limit=N
 */
export async function getSimulations(limit = 10): Promise<SimulationRecord[]> {
  const response = await apiFetch<{ success: boolean; data: SimulationRecord[] }>(
    `/career/simulations?limit=${limit}`
  );
  return response.data;
}

/**
 * getFuturePaths
 *
 * Quick path preview via query params.
 * GET /api/v1/career/future-paths
 */
export async function getFuturePaths(
  role:             string,
  skills:           string[] = [],
  experience_years  = 0,
  industry          = ''
): Promise<CareerPath[]> {
  const params = new URLSearchParams({
    role,
    skills:           skills.join(','),
    experience_years: String(experience_years),
    industry,
  });
  const response = await apiFetch<{ career_paths: CareerPath[] }>(
    `/career/future-paths?${params.toString()}`
  );
  return response.career_paths;
}

/**
 * invalidateCache
 *
 * Busts the server-side simulation cache for the current user + role.
 * Call after profile updates.
 */
export async function invalidateSimulationCache(role: string): Promise<void> {
  await apiFetch('/career/simulations/cache', {
    method: 'DELETE',
    body:   JSON.stringify({ role }),
  });
}