// src/services/adminService.ts
//
// SECURITY: Admin-only API contract layer.
// Firebase-free, Supabase-safe, SSR-compatible.
// All auth/session forwarding must remain inside apiFetch.

import { apiFetch } from './apiClient';

import type {
  PaginatedResponse,
  CmsQueryParams,
} from '@/types/api';

import type { MeResponse } from '@/types/auth';

import type { Skill, CreateSkillDto, UpdateSkillDto } from '@/types/skills';

import type {
  Role,
  CreateRoleDto,
  UpdateRoleDto,
  JobFamily,
  CreateJobFamilyDto,
  UpdateJobFamilyDto,
  EducationLevel,
  CreateEducationLevelDto,
  UpdateEducationLevelDto,
  SalaryBenchmark,
  CreateSalaryBenchmarkDto,
  UpdateSalaryBenchmarkDto,
  CareerDomain,
  CreateCareerDomainDto,
  UpdateCareerDomainDto,
  SkillCluster,
  CreateSkillClusterDto,
  UpdateSkillClusterDto,
  AdminMetrics,
  ImportEntity,
  ImportResult,
  ImportStepStatus,
  GraphDatasetType,
  GraphMetrics,
  GraphImportResult,
  GraphPreviewResult,
  GraphValidationReport,
  GraphImportLog,
  ImportMode,
  DatasetStatusEntry,
  GraphHealth,
  GraphAlertsResult,
  CareerGraphStats,
  CareerGraphData,
  RoleDetailData,
  SkillGraphData,
  SkillDetailData,
  PathSimulatorResult,
  RoleSearchResult,
  RoleImpact,
  MarketIntelligenceData,
} from '@/types/admin';

function encodeId(id: string): string {
  return encodeURIComponent(id);
}

function buildCmsQuery(params: CmsQueryParams = {}): string {
  const query = new URLSearchParams();

  if (params.page !== undefined) {
    query.set('page', String(params.page));
  }

  if (params.limit !== undefined) {
    query.set('limit', String(params.limit));
  }

  if (params.search) {
    query.set('search', params.search);
  }

  if (params.category) {
    query.set('category', params.category);
  }

  const qs = query.toString();
  return qs ? `?${qs}` : '';
}

function buildFormDataUpload(file: File, extra?: Record<string, string>) {
  const form = new FormData();
  form.append('file', file);

  if (extra) {
    for (const [key, value] of Object.entries(extra)) {
      form.append(key, value);
    }
  }

  return form;
}

export const adminService = {
  // ─────────────────────────────────────────────
  // Auth
  // ─────────────────────────────────────────────
  getMe(): Promise<MeResponse> {
    return apiFetch<MeResponse>('/users/me');
  },

  // ─────────────────────────────────────────────
  // Skills
  // ─────────────────────────────────────────────
  listSkills(
    params: CmsQueryParams = {}
  ): Promise<PaginatedResponse<Skill>> {
    return apiFetch(
      `/admin/cms/skills${buildCmsQuery(params)}`
    );
  },

  getSkill(id: string): Promise<Skill> {
    return apiFetch(`/admin/cms/skills/${encodeId(id)}`);
  },

  createSkill(data: CreateSkillDto): Promise<Skill> {
    return apiFetch('/admin/cms/skills', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  updateSkill(
    id: string,
    data: UpdateSkillDto
  ): Promise<Skill> {
    return apiFetch(`/admin/cms/skills/${encodeId(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  },

  deleteSkill(id: string): Promise<null> {
    return apiFetch(`/admin/cms/skills/${encodeId(id)}`, {
      method: 'DELETE',
    });
  },

  // ─────────────────────────────────────────────
  // Roles
  // ─────────────────────────────────────────────
  listRoles(
    params: CmsQueryParams = {}
  ): Promise<PaginatedResponse<Role>> {
    return apiFetch(
      `/admin/cms/roles${buildCmsQuery(params)}`
    );
  },

  getRole(id: string): Promise<Role> {
    return apiFetch(`/admin/cms/roles/${encodeId(id)}`);
  },

  createRole(data: CreateRoleDto): Promise<Role> {
    return apiFetch('/admin/cms/roles', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  updateRole(
    id: string,
    data: UpdateRoleDto
  ): Promise<Role> {
    return apiFetch(`/admin/cms/roles/${encodeId(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  },

  deleteRole(id: string): Promise<null> {
    return apiFetch(`/admin/cms/roles/${encodeId(id)}`, {
      method: 'DELETE',
    });
  },

  // ─────────────────────────────────────────────
  // Job Families
  // ─────────────────────────────────────────────
  listJobFamilies(
    params: CmsQueryParams = {}
  ): Promise<PaginatedResponse<JobFamily>> {
    return apiFetch(
      `/admin/cms/job-families${buildCmsQuery(params)}`
    );
  },

  getJobFamily(id: string): Promise<JobFamily> {
    return apiFetch(
      `/admin/cms/job-families/${encodeId(id)}`
    );
  },

  createJobFamily(
    data: CreateJobFamilyDto
  ): Promise<JobFamily> {
    return apiFetch('/admin/cms/job-families', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  updateJobFamily(
    id: string,
    data: UpdateJobFamilyDto
  ): Promise<JobFamily> {
    return apiFetch(
      `/admin/cms/job-families/${encodeId(id)}`,
      {
        method: 'PATCH',
        body: JSON.stringify(data),
      }
    );
  },

  deleteJobFamily(id: string): Promise<null> {
    return apiFetch(
      `/admin/cms/job-families/${encodeId(id)}`,
      {
        method: 'DELETE',
      }
    );
  },

  // ─────────────────────────────────────────────
  // Education Levels
  // ─────────────────────────────────────────────
  listEducationLevels(
    params: CmsQueryParams = {}
  ): Promise<PaginatedResponse<EducationLevel>> {
    return apiFetch(
      `/admin/cms/education-levels${buildCmsQuery(params)}`
    );
  },

  createEducationLevel(
    data: CreateEducationLevelDto
  ): Promise<EducationLevel> {
    return apiFetch('/admin/cms/education-levels', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  updateEducationLevel(
    id: string,
    data: UpdateEducationLevelDto
  ): Promise<EducationLevel> {
    return apiFetch(
      `/admin/cms/education-levels/${encodeId(id)}`,
      {
        method: 'PATCH',
        body: JSON.stringify(data),
      }
    );
  },

  deleteEducationLevel(id: string): Promise<null> {
    return apiFetch(
      `/admin/cms/education-levels/${encodeId(id)}`,
      {
        method: 'DELETE',
      }
    );
  },

  // ─────────────────────────────────────────────
  // Salary Benchmarks
  // ─────────────────────────────────────────────
  listSalaryBenchmarks(
    params: CmsQueryParams = {}
  ): Promise<PaginatedResponse<SalaryBenchmark>> {
    return apiFetch(
      `/admin/cms/salary-benchmarks${buildCmsQuery(params)}`
    );
  },

  createSalaryBenchmark(
    data: CreateSalaryBenchmarkDto
  ): Promise<SalaryBenchmark> {
    return apiFetch('/admin/cms/salary-benchmarks', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  updateSalaryBenchmark(
    id: string,
    data: UpdateSalaryBenchmarkDto
  ): Promise<SalaryBenchmark> {
    return apiFetch(
      `/admin/cms/salary-benchmarks/${encodeId(id)}`,
      {
        method: 'PATCH',
        body: JSON.stringify(data),
      }
    );
  },

  deleteSalaryBenchmark(id: string): Promise<null> {
    return apiFetch(
      `/admin/cms/salary-benchmarks/${encodeId(id)}`,
      {
        method: 'DELETE',
      }
    );
  },

  // ─────────────────────────────────────────────
  // Career Domains
  // ─────────────────────────────────────────────
  listCareerDomains(
    params: CmsQueryParams = {}
  ): Promise<PaginatedResponse<CareerDomain>> {
    return apiFetch(
      `/admin/cms/career-domains${buildCmsQuery(params)}`
    );
  },

  getCareerDomain(id: string): Promise<CareerDomain> {
    return apiFetch(
      `/admin/cms/career-domains/${encodeId(id)}`
    );
  },

  createCareerDomain(
    data: CreateCareerDomainDto
  ): Promise<CareerDomain> {
    return apiFetch('/admin/cms/career-domains', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  updateCareerDomain(
    id: string,
    data: UpdateCareerDomainDto
  ): Promise<CareerDomain> {
    return apiFetch(
      `/admin/cms/career-domains/${encodeId(id)}`,
      {
        method: 'PATCH',
        body: JSON.stringify(data),
      }
    );
  },

  deleteCareerDomain(id: string): Promise<null> {
    return apiFetch(
      `/admin/cms/career-domains/${encodeId(id)}`,
      {
        method: 'DELETE',
      }
    );
  },

  // ─────────────────────────────────────────────
  // Skill Clusters
  // ─────────────────────────────────────────────
  listSkillClusters(
    params: CmsQueryParams = {}
  ): Promise<PaginatedResponse<SkillCluster>> {
    return apiFetch(
      `/admin/cms/skill-clusters${buildCmsQuery(params)}`
    );
  },

  getSkillCluster(id: string): Promise<SkillCluster> {
    return apiFetch(
      `/admin/cms/skill-clusters/${encodeId(id)}`
    );
  },

  createSkillCluster(
    data: CreateSkillClusterDto
  ): Promise<SkillCluster> {
    return apiFetch('/admin/cms/skill-clusters', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  updateSkillCluster(
    id: string,
    data: UpdateSkillClusterDto
  ): Promise<SkillCluster> {
    return apiFetch(
      `/admin/cms/skill-clusters/${encodeId(id)}`,
      {
        method: 'PATCH',
        body: JSON.stringify(data),
      }
    );
  },

  deleteSkillCluster(id: string): Promise<null> {
    return apiFetch(
      `/admin/cms/skill-clusters/${encodeId(id)}`,
      {
        method: 'DELETE',
      }
    );
  },

  // ─────────────────────────────────────────────
  // Metrics
  // ─────────────────────────────────────────────
  getMetrics(): Promise<AdminMetrics> {
    return apiFetch('/admin/metrics');
  },

  // ─────────────────────────────────────────────
  // CSV Import
  // ─────────────────────────────────────────────
  importCsv(
    entity: ImportEntity,
    file: File
  ): Promise<ImportResult> {
    return apiFetch(`/admin/import/${entity}`, {
      method: 'POST',
      body: buildFormDataUpload(file),
    });
  },

  getImportStatus(): Promise<ImportStepStatus[]> {
    return apiFetch('/admin/import/status');
  },

  // ─────────────────────────────────────────────
  // Graph Admin
  // ─────────────────────────────────────────────
  getGraphMetrics(): Promise<GraphMetrics> {
    return apiFetch('/admin/graph/metrics');
  },

  importGraphCsv(
    datasetType: GraphDatasetType,
    file: File,
    mode: ImportMode = 'append'
  ): Promise<GraphImportResult> {
    return apiFetch(
      `/admin/graph/import/${datasetType}`,
      {
        method: 'POST',
        body: buildFormDataUpload(file, { mode }),
      }
    );
  },

  previewGraphCsv(
    datasetType: GraphDatasetType,
    file: File,
    mode: ImportMode = 'append'
  ): Promise<GraphPreviewResult> {
    return apiFetch(
      `/admin/graph/preview/${datasetType}`,
      {
        method: 'POST',
        body: buildFormDataUpload(file, { mode }),
      }
    );
  },

  getDatasetStatuses(): Promise<DatasetStatusEntry[]> {
    return apiFetch('/admin/graph/dataset-statuses');
  },

  getGraphHealth(): Promise<GraphHealth> {
    return apiFetch('/admin/graph/health');
  },

  getGraphAlerts(): Promise<GraphAlertsResult> {
    return apiFetch('/admin/graph/alerts');
  },

  getCareerGraphStats(): Promise<CareerGraphStats> {
    return apiFetch('/admin/graph/stats');
  },

  validateGraph(): Promise<GraphValidationReport> {
    return apiFetch('/admin/graph/validate');
  },

  getGraphImportLogs(
    limit = 50
  ): Promise<{ logs: GraphImportLog[]; count: number }> {
    return apiFetch(
      `/admin/graph/import-logs?limit=${limit}`
    );
  },

  // ─────────────────────────────────────────────
  // Graph Intelligence
  // ─────────────────────────────────────────────
  getCareerGraph(): Promise<CareerGraphData> {
    return apiFetch(
      '/admin/graph-intelligence/career-graph'
    );
  },

  getRoleDetail(roleId: string): Promise<RoleDetailData> {
    return apiFetch(
      `/admin/graph-intelligence/career-graph/roles/${encodeId(
        roleId
      )}`
    );
  },

  getSkillGraph(): Promise<SkillGraphData> {
    return apiFetch(
      '/admin/graph-intelligence/skill-graph'
    );
  },

  getSkillDetail(
    skillId: string
  ): Promise<SkillDetailData> {
    return apiFetch(
      `/admin/graph-intelligence/skill-graph/skills/${encodeId(
        skillId
      )}`
    );
  },

  simulateCareerPath(params: {
    current_role_id: string;
    target_role_id: string;
    max_hops?: number;
  }): Promise<PathSimulatorResult> {
    return apiFetch(
      '/admin/graph-intelligence/simulate-path',
      {
        method: 'POST',
        body: JSON.stringify(params),
      }
    );
  },

  searchGraphRoles(
    q: string,
    limit = 20
  ): Promise<{ roles: RoleSearchResult[]; count: number }> {
    const qs = new URLSearchParams({
      q,
      limit: String(limit),
    });

    return apiFetch(
      `/admin/graph-intelligence/roles/search?${qs}`
    );
  },

  getRoleImpact(roleId: string): Promise<RoleImpact> {
    return apiFetch(
      `/admin/graph-intelligence/role-impact/${encodeId(
        roleId
      )}`
    );
  },

  getMarketIntelligence(
    country?: string | null
  ): Promise<MarketIntelligenceData> {
    const qs = country
      ? `?country=${encodeURIComponent(country)}`
      : '';

    return apiFetch(
      `/admin/graph-intelligence/market-intelligence${qs}`
    );
  },
};