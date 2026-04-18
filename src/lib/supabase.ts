/**
 * lib/supabase.ts
 *
 * Supabase service-role client — server-side ONLY.
 *
 * SQL (run once in Supabase SQL Editor):
 * ─────────────────────────────────────────────────────────────
 * create table if not exists resumes (
 *   id            uuid        primary key default gen_random_uuid(),
 *   user_id       text        not null,
 *   content       jsonb       not null,
 *   ats_score     int         default 0,
 *   ats_breakdown jsonb,
 *   template_id   text        default 'modern',
 *   customization jsonb,
 *   target_role   text,
 *   source        text        default 'generated',
 *   version       int         default 1,
 *   is_primary    boolean     default true,
 *   soft_deleted  boolean     default false,
 *   created_at    timestamptz default now(),
 *   updated_at    timestamptz default now()
 * );
 * create index if not exists resumes_user_id_idx on resumes(user_id);
 *
 * -- Supabase Storage bucket for resume photos
 * insert into storage.buckets (id, name, public) values ('resume-photos', 'resume-photos', true)
 * on conflict do nothing;
 * ─────────────────────────────────────────────────────────────
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';

// ─── Domain types ──────────────────────────────────────────────────────────────

export interface ResumePersonalInfo {
  name:      string;
  email:     string;
  phone:     string;
  location:  string;
  linkedin:  string;
  website:   string;
  photo_url: string; // optional — empty string means no photo
}

export interface ResumeExperience {
  id:       string;
  jobTitle: string;
  company:  string;
  period:   string;
  bullets:  string[];
}

export interface ResumeEducation {
  id:     string;
  degree: string;
  school: string;
  year:   string;
  grade?: string;
}

export interface ResumeContent {
  personalInfo: ResumePersonalInfo;
  summary:      string;
  experience:   ResumeExperience[];
  skills:       string[];
  education:    ResumeEducation[];
  targetRole:   string;
}

export interface AtsSuggestion {
  id:       string;
  type:     'keyword' | 'verb' | 'metric' | 'format' | 'skills';
  title:    string;
  detail:   string;
  impact:   string;
  premium?: boolean;
}

export interface AtsBreakdown {
  keywordMatch:    number;
  contentStrength: number;
  skillsRelevance: number;
  formatting:      number;
  overall:         number;
  missingKeywords: string[];
  suggestions:     AtsSuggestion[];
}

export type TemplateId = 'modern' | 'minimal' | 'ats' | 'creative' | 'executive' | 'modern-photo';

export interface ResumeCustomization {
  fontSize:     'small' | 'medium' | 'large';
  colorTheme:   'light' | 'dark' | 'accent';
  showPhoto:    boolean;
  accentColor:  string;
  sectionOrder: string[];
  hiddenSections: string[];
}

export const DEFAULT_CUSTOMIZATION: ResumeCustomization = {
  fontSize:       'medium',
  colorTheme:     'light',
  showPhoto:      false,
  accentColor:    '#2563eb',
  sectionOrder:   ['summary', 'experience', 'skills', 'education'],
  hiddenSections: [],
};

export interface DbResume {
  id:            string;
  user_id:       string;
  content:       ResumeContent;
  ats_score:     number | null;
  ats_breakdown: AtsBreakdown | null;
  template_id:   TemplateId;
  customization: ResumeCustomization | null;
  target_role:   string | null;
  source:        'generated' | 'uploaded' | 'manual';
  version:       number;
  is_primary:    boolean;
  soft_deleted:  boolean;
  created_at:    string;
  updated_at:    string;
}

// ─── Validation ────────────────────────────────────────────────────────────────

export class ResumeValidationError extends Error {
  constructor(public readonly fields: string[]) {
    super(`Resume is missing required fields: ${fields.join(', ')}`);
    this.name = 'ResumeValidationError';
  }
}

export function validateResumeForExport(resume: ResumeContent): void {
  const missing: string[] = [];
  if (!resume.personalInfo?.name?.trim())  missing.push('name');
  if (!resume.personalInfo?.email?.trim()) missing.push('email');
  if (missing.length > 0) throw new ResumeValidationError(missing);
}

// ─── Client singleton ─────────────────────────────────────────────────────────

let _client: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient {
  if (_client) return _client;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local');
  }
  _client = createClient(url, key, { auth: { persistSession: false } });
  return _client;
}

export const supabase = new Proxy({} as SupabaseClient, {
  get(_t, prop) { return (getSupabaseClient() as any)[prop]; },
});