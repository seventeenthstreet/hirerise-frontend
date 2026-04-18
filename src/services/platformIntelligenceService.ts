// src/services/platformIntelligenceService.ts
//
// Typed API client for the Platform Intelligence & Control Center.
// All calls go through apiFetch — auth headers handled automatically.

import { apiFetch } from './apiClient';

const BASE = '/admin/platform-intelligence';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AISettings {
  primary_model:  string;
  fallback_model: string;
  temperature:    number;
  max_tokens:     number;
  analysis_mode:  string;
  updated_at?:    string;
}

export interface MarketSource {
  id?:              string;
  name:             string;
  api_key:          string;
  endpoint:         string;
  region:           string;
  update_frequency: string;
  status:           'active' | 'inactive';
  created_at?:      string;
}

export interface CareerDataset {
  id?:          string;
  dataset_name: string;
  dataset_type: string;
  file_url:     string;
  version:      string;
  uploaded_at?: string;
}

export interface CHIWeights {
  skill_weight:      number;
  experience_weight: number;
  market_weight:     number;
  salary_weight:     number;
  education_weight:  number;
  updated_at?:       string;
}

export interface SkillTaxonomyNode {
  id?:             string;
  skill_name:      string;
  parent_skill_id: string | null;
  category:        string;
  created_at?:     string;
}

export interface CareerPath {
  id?:              string;
  from_role:        string;
  to_role:          string;
  required_skills:  string[];
  min_experience:   number;
  salary_range:     string;
  probability_score:number;
  created_at?:      string;
}

export interface TrainingSource {
  id?:           string;
  provider_name: string;
  course_name:   string;
  mapped_skill:  string;
  difficulty:    string;
  duration:      string;
  cost:          number;
  link:          string;
  created_at?:   string;
}

export interface SubscriptionPlan {
  id?:                    string;
  plan_name:              string;
  monthly_price:          number;
  career_analyses_limit:  number;
  resume_scans_limit:     number;
  market_reports_limit:   number;
  api_calls_limit:        number;
  updated_at?:            string;
}

export interface AIUsageAnalytics {
  summary:   { total_requests: number; total_tokens: number; total_cost: number; active_users: number };
  by_day:    { date: string; count: number }[];
  by_model:  { model: string; count: number }[];
  by_action: { action: string; count: number }[];
  recent:    any[];
}

export interface FeatureFlag {
  id?:          string;
  feature_name: string;
  enabled:      boolean;
  updated_at?:  string;
}

export interface AIPrompt {
  id?:         string;
  prompt_name: string;
  prompt_text: string;
  engine:      string;
  version:     string;
  updated_at?: string;
}

// ─── Service ──────────────────────────────────────────────────────────────────

export const piService = {
  // 1. AI Settings
  getAISettings:    (): Promise<AISettings>            => apiFetch(`${BASE}/ai-settings`),
  saveAISettings:   (d: Partial<AISettings>)           => apiFetch(`${BASE}/ai-settings`, { method: 'POST', body: JSON.stringify(d) }),

  // 2. Market Sources
  listMarketSources:   ()                              => apiFetch<MarketSource[]>(`${BASE}/market-sources`),
  createMarketSource:  (d: Omit<MarketSource, 'id'>)   => apiFetch<MarketSource>(`${BASE}/market-sources`, { method: 'POST', body: JSON.stringify(d) }),
  updateMarketSource:  (id: string, d: Partial<MarketSource>) => apiFetch<MarketSource>(`${BASE}/market-sources/${id}`, { method: 'PUT', body: JSON.stringify(d) }),
  deleteMarketSource:  (id: string)                    => apiFetch(`${BASE}/market-sources/${id}`, { method: 'DELETE' }),

  // 3. Career Datasets
  listCareerDatasets:  ()                              => apiFetch<CareerDataset[]>(`${BASE}/career-datasets`),
  createCareerDataset: (d: Omit<CareerDataset, 'id'>) => apiFetch<CareerDataset>(`${BASE}/career-datasets`, { method: 'POST', body: JSON.stringify(d) }),
  updateCareerDataset: (id: string, d: Partial<CareerDataset>) => apiFetch<CareerDataset>(`${BASE}/career-datasets/${id}`, { method: 'PUT', body: JSON.stringify(d) }),
  deleteCareerDataset: (id: string)                   => apiFetch(`${BASE}/career-datasets/${id}`, { method: 'DELETE' }),

  // 4. CHI Weights
  getCHIWeights:    (): Promise<CHIWeights>            => apiFetch(`${BASE}/chi-weights`),
  saveCHIWeights:   (d: CHIWeights)                   => apiFetch(`${BASE}/chi-weights`, { method: 'POST', body: JSON.stringify(d) }),

  // 5. Skill Taxonomy
  listSkillTaxonomy:   ()                              => apiFetch<SkillTaxonomyNode[]>(`${BASE}/skill-taxonomy`),
  createSkillTaxonomy: (d: Omit<SkillTaxonomyNode,'id'>) => apiFetch<SkillTaxonomyNode>(`${BASE}/skill-taxonomy`, { method: 'POST', body: JSON.stringify(d) }),
  updateSkillTaxonomy: (id: string, d: Partial<SkillTaxonomyNode>) => apiFetch<SkillTaxonomyNode>(`${BASE}/skill-taxonomy/${id}`, { method: 'PUT', body: JSON.stringify(d) }),
  deleteSkillTaxonomy: (id: string)                   => apiFetch(`${BASE}/skill-taxonomy/${id}`, { method: 'DELETE' }),

  // 6. Career Paths
  listCareerPaths:   ()                               => apiFetch<CareerPath[]>(`${BASE}/career-paths`),
  createCareerPath:  (d: Omit<CareerPath,'id'>)       => apiFetch<CareerPath>(`${BASE}/career-paths`, { method: 'POST', body: JSON.stringify(d) }),
  updateCareerPath:  (id: string, d: Partial<CareerPath>) => apiFetch<CareerPath>(`${BASE}/career-paths/${id}`, { method: 'PUT', body: JSON.stringify(d) }),
  deleteCareerPath:  (id: string)                     => apiFetch(`${BASE}/career-paths/${id}`, { method: 'DELETE' }),

  // 7. Training Sources
  listTrainingSources:   ()                           => apiFetch<TrainingSource[]>(`${BASE}/training-sources`),
  createTrainingSource:  (d: Omit<TrainingSource,'id'>) => apiFetch<TrainingSource>(`${BASE}/training-sources`, { method: 'POST', body: JSON.stringify(d) }),
  updateTrainingSource:  (id: string, d: Partial<TrainingSource>) => apiFetch<TrainingSource>(`${BASE}/training-sources/${id}`, { method: 'PUT', body: JSON.stringify(d) }),
  deleteTrainingSource:  (id: string)                 => apiFetch(`${BASE}/training-sources/${id}`, { method: 'DELETE' }),

  // 8. Subscription Plans
  listSubscriptionPlans: ()                           => apiFetch<SubscriptionPlan[]>(`${BASE}/subscription-plans`),
  saveSubscriptionPlan:  (plan: string, d: Partial<SubscriptionPlan>) => apiFetch<SubscriptionPlan>(`${BASE}/subscription-plans/${plan}`, { method: 'PUT', body: JSON.stringify(d) }),

  // 9. AI Usage
  getAIUsageAnalytics: (days = 30): Promise<AIUsageAnalytics> => apiFetch(`${BASE}/ai-usage?days=${days}`),

  // 10. Feature Flags
  listFeatureFlags:    ()                             => apiFetch<FeatureFlag[]>(`${BASE}/feature-flags`),
  setFeatureFlag:      (feature: string, enabled: boolean) => apiFetch<FeatureFlag>(`${BASE}/feature-flags/${feature}`, { method: 'PUT', body: JSON.stringify({ enabled }) }),
  bulkSetFeatureFlags: (flags: { feature_name: string; enabled: boolean }[]) =>
    apiFetch(`${BASE}/feature-flags/bulk`, { method: 'POST', body: JSON.stringify({ flags }) }),

  // 11. AI Prompts
  listAIPrompts:   ()                                 => apiFetch<AIPrompt[]>(`${BASE}/ai-prompts`),
  getAIPrompt:     (id: string)                       => apiFetch<AIPrompt>(`${BASE}/ai-prompts/${id}`),
  createAIPrompt:  (d: Omit<AIPrompt,'id'>)           => apiFetch<AIPrompt>(`${BASE}/ai-prompts`, { method: 'POST', body: JSON.stringify(d) }),
  updateAIPrompt:  (id: string, d: Partial<AIPrompt>) => apiFetch<AIPrompt>(`${BASE}/ai-prompts/${id}`, { method: 'PUT', body: JSON.stringify(d) }),
  deleteAIPrompt:  (id: string)                       => apiFetch(`${BASE}/ai-prompts/${id}`, { method: 'DELETE' }),
};
