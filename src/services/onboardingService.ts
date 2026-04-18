// services/onboardingService.ts
// Calls /api/v1/onboarding/* endpoints.
// Architecture rule: never construct auth headers — apiFetch handles it.

import { apiFetch } from './apiClient';

// ── Structured logger (browser-safe) ─────────────────────────────────────────
// Uses console.info/error so logs appear in DevTools and are picked up by
// browser log-forwarding agents (Datadog RUM, Sentry, etc.).

function logStep(step: string, meta?: Record<string, unknown>) {
  console.info(`[Onboarding] ${step}`, meta ?? {});
}

function logStepError(step: string, error: unknown, meta?: Record<string, unknown>) {
  console.error(`[Onboarding] ${step} failed`, {
    error: error instanceof Error ? error.message : String(error),
    ...meta,
  });
}

// ── Types ─────────────────────────────────────────────────────────────────────

export interface SkillEntry {
  name:        string;
  proficiency: 'beginner' | 'intermediate' | 'advanced' | 'expert';
  unverified?: boolean; // true = user-typed custom skill, not from role catalogue
}

export interface EducationEntry {
  qualificationName: string;
  institution: string;
  yearOfGraduation?: number | null;
  specialization?: string | null;
  certifications?: string[];
  gradeType?: 'gpa' | 'percentage' | 'classification' | 'cgpa' | null;
  gradeValue?: string | null;
}

export interface ExperienceEntry {
  jobTitle: string;
  company: string;
  startDate: string; // YYYY-MM
  endDate?: string | null;
  isCurrent: boolean;
  industryId?: string | null;
  jobFunction?: string | null;
  responsibilities?: string[];
  achievements?: { metric: string; action: string; context?: string }[];
}

export interface ConsentPayload {
  consentGiven: boolean;
  consentVersion: string;
  referralSource?: string | null;
}

export interface QuickStartPayload {
  jobTitle: string;
  company: string;
  startDate: string; // YYYY-MM
  isCurrent?: boolean;
  expectedRoleIds: string[];
  skills?: SkillEntry[];
  // Role DB IDs (replaces free text)
  currentRoleId?:     string;
  targetRoleId?:      string;
  // P1-10: free-text bypass — used when role came from static fallback (DB unseeded)
  targetRoleFreeText?: string;
  // Fresher mode
  isFresher?:         boolean;
  educationLevel?:    string;
  graduationYear?:    number | null;
}

export interface EducationExperiencePayload {
  education: EducationEntry[];
  experience: ExperienceEntry[];
  skills: SkillEntry[];
  expectedRoleIds: string[];
  targetRoleId?: string | null;
  targetRoleFreeText?: string; // P1-10: bypass validateRolesExist when role is from static fallback
  selfDeclaredSeniority?: string | null;
  currentSalaryLPA?: number | null;
  preferredWorkLocation?: string | null;
  workMode?: 'remote' | 'hybrid' | 'onsite' | null;
}

export interface PersonalDetailsPayload {
  fullName: string;
  email: string;
  phone?: string | null;
  city?: string | null;
  country?: string | null;
  linkedInUrl?: string | null;
  portfolioUrl?: string | null;
  languages?: string[];
  careerObjective?: string | null;
}

export interface RoleSuggestion {
  roleId:     string;  // backend field name (database row id)
  id?:        string;  // alias — some endpoints use id instead of roleId
  title:      string;
  confidence: number;
  category?:  string | null;
}

// ── Service ───────────────────────────────────────────────────────────────────

export const onboardingService = {
  /** POST /api/v1/onboarding/consent */
  async saveConsent(payload: ConsentPayload) {
    logStep('saveConsent', { consentVersion: payload.consentVersion });
    try {
      const result = await apiFetch<{ step: string; consentVersion: string }>('/onboarding/consent', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      logStep('saveConsent complete', { step: result.step });
      return result;
    } catch (err) {
      logStepError('saveConsent', err);
      throw err;
    }
  },

  /** POST /api/v1/onboarding/quick-start */
  async saveQuickStart(payload: QuickStartPayload) {
    logStep('saveQuickStart', { jobTitle: payload.jobTitle });
    try {
      const result = await apiFetch<{ step: string; chiStatus: string }>('/onboarding/quick-start', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      logStep('saveQuickStart complete', { step: result.step, chiStatus: result.chiStatus });
      return result;
    } catch (err) {
      logStepError('saveQuickStart', err);
      throw err;
    }
  },

  /** POST /api/v1/onboarding/education-experience */
  async saveEducationAndExperience(payload: EducationExperiencePayload) {
    logStep('saveEducationAndExperience', { educationCount: payload.education.length, experienceCount: payload.experience.length });
    try {
      const result = await apiFetch<{ step: string }>('/onboarding/education-experience', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      logStep('saveEducationAndExperience complete', { step: result.step });
      return result;
    } catch (err) {
      logStepError('saveEducationAndExperience', err);
      throw err;
    }
  },

  /** POST /api/v1/onboarding/personal-details */
  async savePersonalDetails(payload: PersonalDetailsPayload) {
    logStep('savePersonalDetails', { hasPhone: !!payload.phone, hasLinkedIn: !!payload.linkedInUrl });
    try {
      const result = await apiFetch<{ step: string }>('/onboarding/personal-details', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      logStep('savePersonalDetails complete', { step: result.step });
      return result;
    } catch (err) {
      logStepError('savePersonalDetails', err);
      throw err;
    }
  },

  /** POST /api/v1/onboarding/upload-cv  (multipart) */
  async uploadCv(file: File) {
    logStep('uploadCv', { fileName: file.name, fileSize: file.size });
    const form = new FormData();
    form.append('resume', file, file.name);
    try {
      const result = await apiFetch<{
        resumeId: string;
        fileUrl:  string | null;
        step:     string;
        message:  string;
        /** Pre-extracted CV data — use to pre-fill the personal details form */
        extractedDetails: {
          fullName:            string | null;
          email:               string | null;
          phone:               string | null;
          city:                string | null;
          country:             string | null;
          linkedInUrl:         string | null;
          portfolioUrl:        string | null;
          languages:           string[];
          professionalSummary: string | null;
          skills: Array<{ name: string; proficiency?: string }>;
          /** Career fields extracted from CV */
          jobTitle:            string | null;
          industry:            string | null;
          educationLevel:      string | null;
          yearsExperience:     number | null;
        } | null;
      }>('/onboarding/upload-cv', {
        method: 'POST',
        body:   form,
        headers: {}, // CRITICAL: let browser set multipart/form-data boundary automatically
        skipRetry: true,
      });
      logStep('uploadCv complete', { resumeId: result.resumeId, hasExtractedDetails: !!result.extractedDetails });
      return result;
    } catch (err) {
      logStepError('uploadCv', err, { fileName: file.name });
      throw err;
    }
  },

  /** POST /api/v1/onboarding/career-report */
  async generateCareerReport() {
    logStep('generateCareerReport');
    try {
      const result = await apiFetch<{ step: string; chiStatus: string }>('/onboarding/career-report', {
        method: 'POST',
      });
      logStep('generateCareerReport complete', { step: result.step, chiStatus: result.chiStatus });
      return result;
    } catch (err) {
      logStepError('generateCareerReport', err);
      throw err;
    }
  },

  /** GET /api/v1/onboarding/suggest-roles?q=<title> */
  suggestRoles(query: string): Promise<{ suggestions: RoleSuggestion[] }> {
    return apiFetch<{ suggestions: RoleSuggestion[] }>(
      `/onboarding/suggest-roles?q=${encodeURIComponent(query)}&limit=8`
    );
  },

  /** GET /api/v1/onboarding/progress */
  async getProgress() {
    try {
      const result = await apiFetch<{ step: string; completedSteps: string[] }>('/onboarding/progress');
      logStep('getProgress', { currentStep: result.step, completedCount: result.completedSteps.length });
      return result;
    } catch (err) {
      logStepError('getProgress', err);
      throw err;
    }
  },

  /** GET /api/v1/onboarding/chi-ready */
  getChiReady() {
    return apiFetch<{ ready: boolean; score?: number }>('/onboarding/chi-ready');
  },

  /** PATCH /api/v1/onboarding/draft */
  async saveDraft(payload: Record<string, unknown>) {
    try {
      const result = await apiFetch<{ step: string }>('/onboarding/draft', {
        method: 'PATCH',
        body: JSON.stringify(payload),
      });
      logStep('saveDraft complete');
      return result;
    } catch (err) {
      logStepError('saveDraft', err);
      throw err;
    }
  },

  /**
   * POST /api/v1/onboarding/complete
   *
   * Explicitly marks onboarding as completed. Must be called for the CV-upload
   * path (which has no career report step). Writes onboardingCompleted: true
   * to both users/{id} and userProfiles/{id} in Supabase so GET /users/me
   * returns the correct flag and the dashboard redirect loop is broken.
   */
  async complete(): Promise<{ step: string; message: string }> {
    logStep('complete');
    try {
      const result = await apiFetch<{ step: string; message: string }>('/onboarding/complete', {
        method: 'POST',
      });
      logStep('complete — onboarding marked done', { step: result.step });
      return result;
    } catch (err) {
      logStepError('complete', err);
      throw err;
    }
  },
};
// ─── Roles search (used by RoleAutocomplete) ──────────────────────────────────
// Calls GET /api/v1/roles/search?q= which always reflects the live Supabase
// roles table. Falls back to the static list only when the API fails.

export interface RoleSearchResult {
  id:      string;
  title:   string;
  aliases: string[];
}

export const rolesSearchService = {
  /** GET /api/v1/roles/search?q=<query>&limit=10 */
  search(q: string): Promise<{ roles: RoleSearchResult[] }> {
    return apiFetch<{ roles: RoleSearchResult[] }>(
      `/roles/search?q=${encodeURIComponent(q.trim())}&limit=10`,
    );
  },
};

// ── Role Skills ──────────────────────────────────────────────────────────────

export interface RoleSkill {
  name:     string;
  category?: string;
  source?:  'supabase' | 'builtin';
}

export const roleSkillsService = {
  /** GET /api/v1/skills/role/:roleId */
  async getForRole(roleId: string): Promise<{ role: { id: string; title: string }; skills: RoleSkill[]; source: string }> {
    return apiFetch(`/skills/role/${encodeURIComponent(roleId)}`);
  },
};