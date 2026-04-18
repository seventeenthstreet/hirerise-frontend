// types/admin.ts
// Domain types for admin CMS entities.
// All timestamps are ISO 8601 strings — normalized by backend.

// ─── Role ─────────────────────────────────────────────────────────────────────

export interface Role {
  id:           string;
  name:         string;
  slug:         string;
  description:  string;
  level:        number;       // seniority: 1=Junior … 5=Principal
  jobFamilyId:  string | null;
  domainId:     string | null; // ← taxonomy extension
  requiredSkillIds: string[];
  skillClusters:   string[];   // ← taxonomy extension
  marketDemand: number | null; // ← taxonomy extension (0-10)
  nextRoles:    string[];      // ← taxonomy extension (role IDs)
  createdAt:    string;
  updatedAt:    string;
}

export type CreateRoleDto = Omit<Role, 'id' | 'createdAt' | 'updatedAt'>;
export type UpdateRoleDto = Partial<CreateRoleDto>;

// ─── Job Family ───────────────────────────────────────────────────────────────

export interface JobFamily {
  id:          string;
  name:        string;
  slug:        string;
  description: string;
  sector:      string;
  domainId:    string | null; // ← taxonomy extension
  createdAt:   string;
  updatedAt:   string;
}

export type CreateJobFamilyDto = Omit<JobFamily, 'id' | 'createdAt' | 'updatedAt'>;
export type UpdateJobFamilyDto = Partial<CreateJobFamilyDto>;

// ─── Education Level ──────────────────────────────────────────────────────────

export interface EducationLevel {
  id:           string;
  name:         string;
  slug:         string;
  description:  string;
  rank:         number;      // 1=High School … 6=PhD
  createdAt:    string;
  updatedAt:    string;
}

export type CreateEducationLevelDto = Omit<EducationLevel, 'id' | 'createdAt' | 'updatedAt'>;
export type UpdateEducationLevelDto = Partial<CreateEducationLevelDto>;

// ─── Salary Benchmark ─────────────────────────────────────────────────────────

export type ExperienceBand = 'junior' | 'mid' | 'senior' | 'lead' | 'principal';

export interface SalaryBenchmark {
  id:           string;
  name:         string;
  roleId:       string;
  region:       string;     // e.g. 'US', 'UK', 'India', 'Global'
  currency:     string;     // ISO 4217 e.g. 'USD', 'INR'
  minSalary:    number;
  maxSalary:    number;
  medianSalary: number;
  year:         number;
  createdAt:    string;
  updatedAt:    string;
}

export type CreateSalaryBenchmarkDto = Omit<SalaryBenchmark, 'id' | 'createdAt' | 'updatedAt'>;
export type UpdateSalaryBenchmarkDto = Partial<CreateSalaryBenchmarkDto>;

// ─── Career Domain ────────────────────────────────────────────────────────────
// NEW — Global Career Taxonomy Layer 1

export interface CareerDomain {
  id:          string;
  name:        string;
  description: string;
  status:      'active' | 'inactive';
  createdAt:   string;
  updatedAt:   string;
}

export type CreateCareerDomainDto = Pick<CareerDomain, 'name' | 'description'>;
export type UpdateCareerDomainDto = Partial<CreateCareerDomainDto>;

// ─── Skill Cluster ────────────────────────────────────────────────────────────
// NEW — Groups related skills under a career domain

export interface SkillCluster {
  id:          string;
  name:        string;
  domainId:    string;       // FK → CareerDomain.id
  description: string;
  status:      'active' | 'inactive';
  createdAt:   string;
  updatedAt:   string;
}

export type CreateSkillClusterDto = Pick<SkillCluster, 'name' | 'domainId' | 'description'>;
export type UpdateSkillClusterDto = Partial<CreateSkillClusterDto>;

// ─── Admin Dashboard Metrics ──────────────────────────────────────────────────

export interface AdminMetrics {
  totalSkills:          number;
  totalRoles:           number;
  totalJobFamilies:     number;
  totalEducationLevels: number;
  totalSalaryRecords:   number;
  totalCareerDomains:   number; // ← new
  totalSkillClusters:   number; // ← new
  totalUsers:           number;
  activeUsers30d:       number;
  lastImportAt:         string | null;  // ISO 8601
}

// ─── CSV Import ───────────────────────────────────────────────────────────────

export type ImportEntity =
  | 'skills'
  | 'roles'
  | 'job-families'
  | 'education-levels'
  | 'salary-benchmarks'
  | 'career-domains'    // ← new
  | 'skill-clusters';   // ← new

export interface ImportResultRow {
  row:     number;
  status:  'created' | 'updated' | 'skipped' | 'error';
  name:    string;
  message: string | null;
}

export interface ImportResult {
  entity:    ImportEntity;
  total:     number;
  created:   number;
  updated:   number;
  skipped:   number;
  errors:    number;
  rows:      ImportResultRow[];
  importedAt: string;
  nextStep:  string | null;   // ← label of the next recommended step
}

// ─── Import Step Status ───────────────────────────────────────────────────────
// Returned by GET /admin/import/status

export interface ImportStepStatus {
  step:        number;
  datasetType: string;
  label:       string;
  count:       number;         // records currently in Firestore
  completed:   boolean;        // count > 0
  deps:        string[];       // dependency labels
  depsUnmet:   boolean;        // true = this step is locked
}

// ─── Graph Admin Types ────────────────────────────────────────────────────────

export type GraphDatasetType =
  | 'roles'
  | 'skills'
  | 'role_skills'
  | 'role_transitions'
  | 'skill_relationships'
  | 'role_education'
  | 'role_salary_market';

export interface GraphMetrics {
  total_roles:               number;
  total_skills:              number;
  total_role_skills:         number;
  total_role_transitions:    number;
  total_skill_relationships: number;
  total_role_education:      number;
  total_salary_records:      number;
  last_import_at:            string | null;
}

export type ImportMode    = 'append' | 'replace';
export type DatasetStatus = 'loaded' | 'partial' | 'missing';

export interface GraphImportError {
  row:     number;
  field:   string;
  type:    'field' | 'duplicate' | 'fk' | 'write';
  message: string;
}

export interface GraphImportResult {
  datasetType:      GraphDatasetType;
  processed:        number;
  importable:       number;
  imported:         number;
  skipped:          number;
  deleted:          number;
  errorCount:       number;
  errors:           GraphImportError[];
  fieldErrors:      GraphImportError[];
  duplicateErrors:  GraphImportError[];
  fkErrors:         GraphImportError[];
  writeErrors:      GraphImportError[];
  importedAt:       string;
  durationMs:       number;
  mode:             ImportMode;
}

export interface GraphPreviewResult {
  datasetType:      GraphDatasetType;
  processed:        number;
  importable:       number;
  errorCount:       number;
  errors:           GraphImportError[];
  fieldErrors:      GraphImportError[];
  duplicateErrors:  GraphImportError[];
  fkErrors:         GraphImportError[];
  preview:          Record<string, unknown>[];
  schema:           { required: string[]; optional: string[] };
  mode:             ImportMode;
}

export interface DatasetStatusEntry {
  dataset:      GraphDatasetType;
  count:        number;
  status:       DatasetStatus;
  last_import:  string | null;
  last_result:  'success' | 'partial' | 'error' | null;
}

export interface GraphValidationIssue {
  id:      string;
  reason?: string;
  [key: string]: unknown;
}

export interface GraphValidationReport {
  valid:        boolean;
  total_issues: number;
  counts: {
    roles:               number;
    skills:              number;
    role_skills:         number;
    role_transitions:    number;
    skill_relationships: number;
    role_education:      number;
    role_salary_market:  number;
  };
  issues: {
    orphan_roles:               string[];
    orphan_skills:              string[];
    broken_role_transitions:    GraphValidationIssue[];
    role_skills_missing_skills: GraphValidationIssue[];
    skill_rels_missing_skills:  GraphValidationIssue[];
    role_edu_missing_roles:     GraphValidationIssue[];
    salary_missing_roles:       GraphValidationIssue[];
  };
  checked_at: string;
}

export interface GraphImportLog {
  id:               string;
  dataset_name:     string;
  rows_processed:   number;
  rows_imported:    number;
  rows_skipped:     number;
  errors_detected:  number;
  field_errors:     number;
  duplicate_errors: number;
  fk_errors:        number;
  write_errors:     number;
  import_mode:      ImportMode;
  deleted_before:   number;
  import_time:      string;
  admin_user_id:    string;
  duration_ms?:     number;
  createdAt?:       string;
}

// ─── Graph Health ─────────────────────────────────────────────────────────────

export interface GraphHealth {
  total_roles:                number;
  roles_with_skills:          number;
  roles_with_transitions:     number;
  roles_with_education:       number;
  roles_with_salary:          number;
  roles_with_skills_pct:      number;
  roles_with_transitions_pct: number;
  roles_with_education_pct:   number;
  roles_with_salary_pct:      number;
  checked_at:                 string;
}

export interface GraphAlert {
  type:    'critical' | 'warn' | 'info';
  code:    string;
  count:   number;
  message: string;
}

export interface GraphAlertsResult {
  alerts:       GraphAlert[];
  alert_count:  number;
  has_critical: boolean;
  has_warnings: boolean;
  checked_at:   string;
}

export interface CareerGraphStats {
  avg_path_depth:    number;
  longest_path:      number;
  shortest_path:     number;
  total_roles:       number;
  total_transitions: number;
  sampled_roles?:    number;
}

// ─── Graph Intelligence Types ─────────────────────────────────────────────────

export interface GraphRoleNode {
  id:              string;
  role_id?:        string;
  role_name:       string;
  role_family?:    string;
  seniority_level?: string;
  description?:    string;
}

export interface GraphTransitionEdge {
  id:               string;
  from_role_id:     string;
  to_role_id:       string;
  probability?:     number;
  years_required?:  number;
  transition_type?: string;
  to_role_id_name?:   string;
  from_role_id_name?: string;
}

export interface GraphSkillNode {
  id:               string;
  skill_id?:        string;
  skill_name:       string;
  skill_category?:  string;
  difficulty_level?: number;
  demand_score?:    number;
}

export interface GraphSkillRelationship {
  id:                string;
  skill_id:          string;
  related_skill_id:  string;
  relationship_type: string;
  strength_score?:   number;
}

export interface CareerGraphData {
  roles:       GraphRoleNode[];
  transitions: GraphTransitionEdge[];
  node_count:  number;
  edge_count:  number;
}

export interface SkillGraphData {
  skills:        GraphSkillNode[];
  relationships: GraphSkillRelationship[];
  node_count:    number;
  edge_count:    number;
}

export interface RoleDetailData {
  role:                 GraphRoleNode;
  skills:               Array<{ skill_id: string; skill_name: string; importance_weight?: number }>;
  outgoing_transitions: GraphTransitionEdge[];
  incoming_transitions: GraphTransitionEdge[];
  salary:               Array<{ country: string; median_salary?: number; p25?: number; p75?: number; currency?: string }>;
  education:            Array<{ education_level: string; match_score?: number }>;
}

export interface SkillDetailData {
  skill:           GraphSkillNode;
  prerequisites:   Array<{ related_skill_id: string; related_skill_id_name: string; strength_score?: number }>;
  advanced_skills: Array<{ skill_id: string; skill_id_name: string; strength_score?: number }>;
  roles:           Array<{ role_id: string; role_name: string; importance_weight?: number }>;
}

export interface PathSimulatorStep {
  step:         number;
  role_id:      string;
  role_name:    string;
  role_family?: string;
  seniority?:   string;
  skills:       Array<{ skill_id: string; skill_name: string }>;
  transition_to_next?: GraphTransitionEdge | null;
}

export interface PathSimulatorResult {
  found:          boolean;
  message?:       string;
  hops?:          number;
  path?:          string[];
  steps:          PathSimulatorStep[];
  current_role?:  string;
  target_role?:   string;
}

export interface RoleImpact {
  role: GraphRoleNode;
  impact: {
    outgoing_transitions: number;
    incoming_transitions: number;
    total_transitions:    number;
    skill_mappings:       number;
    salary_benchmarks:    number;
    education_mappings:   number;
  };
  salary_stats: {
    count:        number;
    countries:    string[];
    median_range: { min: number; max: number };
  } | null;
  education_summary:    Array<{ education_level: string; match_score?: number }>;
  outgoing_transitions: GraphTransitionEdge[];
  incoming_transitions: GraphTransitionEdge[];
  skill_mappings:       Array<{ skill_id: string; importance_weight?: number }>;
}

export interface RoleSearchResult {
  id:           string;
  role_id:      string;
  role_name:    string;
  role_family?: string;
  seniority?:   string;
}
// ─── Market Intelligence ──────────────────────────────────────────────────────

export interface MarketRoleEntry {
  role_id:        string;
  role_name:      string;
  role_family?:   string | null;
  demand_score?:  number;
  demand_label?:  string;
  growth_rate?:   number;
  job_postings?:  number;
  remote_ratio?:  number;
  median_salary?: number;
  country?:       string;
  last_updated?:  string;
}

export interface MarketIntelligenceData {
  top_growing_roles: MarketRoleEntry[];
  top_demand_roles:  MarketRoleEntry[];
  top_salary_roles:  MarketRoleEntry[];
  total_records:     number;
  country:           string;
  generated_at?:     string;
}