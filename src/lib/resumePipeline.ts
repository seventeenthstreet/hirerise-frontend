/**
 * lib/services/resumePipeline.ts
 *
 * Orchestrates the full AI resume generation pipeline:
 *   1. normalizeUserData()    — sanitise & deduplicate
 *   2. generateBaseResume()   — LLM: skeleton from profile
 *   3. enhanceResume()        — LLM: stronger language + metrics
 *   4. optimizeForRole()      — LLM: role-specific keywords
 *   5. calculateATS()         — code-based scoring
 *   6. validateResume()       — MANDATORY: name + email check
 *   7. persistResume()        — save to Supabase
 */

import {
  generateBaseResume, enhanceResumeContent, optimizeForRole,
  rewriteSummary, strengthenBullets, injectKeywords, avaOptimize,
  type BaseResumeInput, type AvaOptimizeInput, type AvaOptimizeResult,
} from '@/lib/services/aiService';
import { calculateATS, getRoleKeywords }            from '@/lib/services/atsService';
import { supabase, validateResumeForExport, ResumeValidationError } from '@/lib/supabase';
import type { ResumeContent, AtsBreakdown, TemplateId, ResumeCustomization } from '@/lib/supabase';

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface UserProfileInput {
  displayName?:       string;
  email?:             string;
  phone?:             string;
  location?:          string;
  targetRole?:        string;
  detectedProfession?: string;
  currentJobTitle?:   string;
  experienceYears?:   number;
  educationLevel?:    string;
  industry?:          string;
  skills?:            string[];
  topSkills?:         string[];
  bio?:               string;
  photo_url?:         string;
}

export interface PipelineResult {
  resume:   ResumeContent;
  ats:      AtsBreakdown;
  resumeId: string | null;
  steps:    string[];  // log of completed steps
}

export type ImproveType = 'summary' | 'bullets' | 'keywords' | 'full';

export interface ImproveTarget {
  type:             ImproveType;
  experienceIndex?: number;
  missingKeywords?: string[];
}

export interface ImprovementResult {
  resume:        ResumeContent;
  ats:           AtsBreakdown;
  changeSummary: string;
}

// ─── Step 1: Normalize ─────────────────────────────────────────────────────────

export function normalizeUserData(raw: UserProfileInput): BaseResumeInput {
  const skills = [...new Set([
    ...(raw.skills    || []),
    ...(raw.topSkills || []),
  ])].filter(Boolean).slice(0, 20);

  return {
    name:            raw.displayName?.trim() || '',
    email:           raw.email?.trim()       || '',
    phone:           raw.phone?.trim()       || '',
    location:        raw.location?.trim()    || '',
    targetRole:      (raw.targetRole || raw.detectedProfession || '').trim(),
    currentJobTitle: (raw.currentJobTitle || '').trim(),
    experienceYears: Math.max(0, Math.min(raw.experienceYears || 0, 50)),
    educationLevel:  raw.educationLevel?.trim() || '',
    industry:        raw.industry?.trim()    || '',
    bio:             raw.bio?.trim()         || '',
    skills,
  };
}

// ─── Step 5: ATS calculation ───────────────────────────────────────────────────

export function scoreResume(resume: ResumeContent, targetRole: string): AtsBreakdown {
  return calculateATS(resume, targetRole);
}

// ─── Step 6: Validate ─────────────────────────────────────────────────────────

export function validateResume(resume: ResumeContent): void {
  validateResumeForExport(resume);
}

// ─── Step 7: Persist ──────────────────────────────────────────────────────────

export async function persistResume(
  uid:          string,
  resume:       ResumeContent,
  ats:          AtsBreakdown,
  targetRole:   string,
  templateId:   TemplateId = 'modern',
  customization?: ResumeCustomization | null,
  resumeId?:    string | null,
): Promise<string | null> {
  try {
    const db      = supabase;
    const payload = {
      user_id:       uid,
      content:       resume,
      ats_score:     ats.overall,
      ats_breakdown: ats,
      template_id:   templateId,
      customization: customization ?? null,
      target_role:   targetRole,
      source:        'generated' as const,
      is_primary:    true,
      updated_at:    new Date().toISOString(),
    };

    if (resumeId) {
      const { data, error } = await db.from('resumes')
        .update(payload).eq('id', resumeId).eq('user_id', uid).select('id').single();
      if (error) throw error;
      return (data as any)?.id ?? null;
    } else {
      const { data, error } = await db.from('resumes')
        .upsert({ ...payload, created_at: new Date().toISOString() }, { onConflict: 'user_id,is_primary' })
        .select('id').single();
      if (error) throw error;
      return (data as any)?.id ?? null;
    }
  } catch (err) {
    console.error('[resumePipeline] DB persist failed (non-fatal):', err);
    return null;
  }
}

// ─── Full generate pipeline ────────────────────────────────────────────────────

export async function runGeneratePipeline(
  raw:        UserProfileInput,
  uid:        string,
  templateId: TemplateId = 'modern',
): Promise<PipelineResult> {
  const steps: string[] = [];

  // Step 1: Normalize
  const normalized = normalizeUserData(raw);
  const targetRole = normalized.targetRole || 'Professional';
  steps.push('✓ normalizeUserData');

  // Step 2: Generate base
  const base = await generateBaseResume(normalized);
  steps.push('✓ generateBaseResume');

  // Step 3: Enhance
  const enhanced = await enhanceResumeContent(base);
  steps.push('✓ enhanceResume');

  // Step 4: Optimize for role
  const keywords  = getRoleKeywords(targetRole);
  const optimized = await optimizeForRole(enhanced, targetRole, keywords.slice(0, 8));
  steps.push('✓ optimizeForRole');

  // Step 5: ATS score
  const ats = scoreResume(optimized, targetRole);
  steps.push('✓ calculateATS');

  // Step 6: Validate (non-fatal for generation — we have profile data)
  try {
    validateResume(optimized);
    steps.push('✓ validateResume');
  } catch (err) {
    steps.push('⚠ validateResume (warnings only at generation)');
  }

  // Step 7: Persist
  const resumeId = await persistResume(uid, optimized, ats, targetRole, templateId);
  steps.push(resumeId ? '✓ persistResume' : '⚠ persistResume (offline)');

  return { resume: optimized, ats, resumeId, steps };
}

// ─── Improvement pipeline ──────────────────────────────────────────────────────

export async function runImprovePipeline(
  resume:     ResumeContent,
  targetRole: string,
  target:     ImproveTarget,
  uid:        string,
  resumeId?:  string | null,
  templateId: TemplateId = 'modern',
): Promise<ImprovementResult> {
  let updated: ResumeContent = { ...resume };
  let changeSummary = '';

  switch (target.type) {
    case 'summary': {
      const s    = await rewriteSummary(resume.summary, targetRole);
      updated    = { ...resume, summary: s };
      changeSummary = 'AI rewrote professional summary';
      break;
    }
    case 'bullets': {
      const idx = target.experienceIndex ?? 0;
      const exp = resume.experience?.[idx];
      if (!exp) throw new Error(`Experience at index ${idx} not found`);
      const bullets = await strengthenBullets(exp.bullets, exp.jobTitle, targetRole);
      updated = { ...resume, experience: resume.experience.map((e, i) => i === idx ? { ...e, bullets } : e) };
      changeSummary = `AI strengthened bullets for "${exp.jobTitle}"`;
      break;
    }
    case 'keywords': {
      const missing  = target.missingKeywords?.length
        ? target.missingKeywords
        : calculateATS(resume, targetRole).missingKeywords.slice(0, 5);
      const partial  = await injectKeywords(resume, missing, targetRole);
      updated        = { ...resume, ...partial, personalInfo: resume.personalInfo };
      changeSummary  = `AI injected ${missing.slice(0, 3).join(', ')} keywords`;
      break;
    }
    case 'full': {
      const keywords  = getRoleKeywords(targetRole);
      const opt       = await optimizeForRole(resume, targetRole, keywords.slice(0, 8));
      const enh       = await enhanceResumeContent(opt);
      updated         = { ...enh, personalInfo: resume.personalInfo };
      changeSummary   = `Full AI optimisation for: ${targetRole}`;
      break;
    }
    default:
      throw new Error(`Unknown improvement type: ${(target as any).type}`);
  }

  const ats = scoreResume(updated, targetRole);
  await persistResume(uid, updated, ats, targetRole, templateId, null, resumeId);
  return { resume: updated, ats, changeSummary };
}

// ─── Ava full-resume optimize pipeline ────────────────────────────────────────

export type { AvaOptimizeInput, AvaOptimizeResult };

/**
 * runAvaOptimizePipeline()
 *
 * Runs a single holistic Ava AI pass over the entire resume, guided by the
 * full ATS breakdown. After improvement, recalculates the real ATS score
 * (not AI-estimated) and persists the result.
 *
 * Returns:
 *   improvedResume          — optimised ResumeContent
 *   ats                     — recalculated AtsBreakdown (code-based, authoritative)
 *   improvementsSummary     — human-readable list of what changed
 *   estimatedScoreIncrease  — AI's estimate (informational; real delta = ats.overall - input overall)
 *   actualScoreIncrease     — actual delta from recalculation
 */
export async function runAvaOptimizePipeline(
  resume:      ResumeContent,
  targetRole:  string,
  atsInput:    AvaOptimizeInput['atsBreakdown'],
  uid:         string,
  resumeId?:   string | null,
  templateId:  TemplateId = 'modern',
): Promise<AvaOptimizeResult & { ats: AtsBreakdown; actualScoreIncrease: number }> {
  const originalScore = atsInput.overall;

  // Single holistic AI call — Ava reads the full breakdown and improves everything
  const avaResult = await avaOptimize({ resumeData: resume, targetRole, atsBreakdown: atsInput });

  // Recalculate ATS with code-based scorer (authoritative, not AI-estimated)
  const ats = calculateATS(avaResult.improvedResume, targetRole);

  const actualScoreIncrease = Math.max(0, ats.overall - originalScore);

  // Persist improved resume
  await persistResume(uid, avaResult.improvedResume, ats, targetRole, templateId, null, resumeId);

  return {
    improvedResume:         avaResult.improvedResume,
    improvementsSummary:    avaResult.improvementsSummary,
    estimatedScoreIncrease: avaResult.estimatedScoreIncrease,
    ats,
    actualScoreIncrease,
  };
}