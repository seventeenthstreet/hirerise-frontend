// hooks/useResumeBuilder.ts
//
// State management hook for the Resume Intelligence Engine.
//
// Responsibilities:
//   - Single source of truth for builder state (resumeData, ats, template)
//   - Persists to /api/v1/resumes/builder-draft (debounced, non-blocking)
//   - Exposes AI improvement actions (summary, bullets, full)
//   - Tracks version history for rollback
//   - Computes ATS score locally for instant feedback

'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { apiFetch }       from '@/services/apiClient';
import { RESUMES_KEY }    from './useResumes';
import { CAREER_HEALTH_KEY } from './useCareerHealth';

// ─── Types ────────────────────────────────────────────────────────────────────

export type TemplateId = 'modern' | 'minimal' | 'ats' | 'creative' | 'executive';

export interface PersonalInfo {
  name:     string;
  email:    string;
  phone:    string;
  location: string;
  linkedin: string;
  website:  string;
}

export interface ExperienceItem {
  id:       string;
  jobTitle: string;
  company:  string;
  period:   string;
  bullets:  string[];
}

export interface EducationItem {
  id:     string;
  degree: string;
  school: string;
  year:   string;
  grade?: string;
}

export interface ResumeData {
  personalInfo: PersonalInfo;
  summary:      string;
  experience:   ExperienceItem[];
  skills:       string[];
  education:    EducationItem[];
  targetRole:   string;
}

export interface AtsBreakdown {
  keywordMatch:    number;
  formatting:      number;
  contentStrength: number;
  overall:         number;
  missingKeywords: string[];
  weakPhrases:     string[];
  suggestions:     string[];
}

export interface ResumeVersion {
  id:            string;
  versionNumber: number;
  changeSummary: string;
  atsScore:      number;
  createdAt:     string;
  content:       ResumeData;
}

export type AiImproveTarget = 'summary' | 'bullets' | 'full';
export type BuilderStatus   = 'idle' | 'loading' | 'editing' | 'saving' | 'error';
export type ExportFormat    = 'pdf' | 'docx';

interface UseResumeBuilderOptions {
  hasResume:     boolean;
  resumeId?:     string | null;
  initialData?:  ResumeData | null;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useResumeBuilder({
  hasResume, resumeId, initialData,
}: UseResumeBuilderOptions) {
  const qc = useQueryClient();

  // ── Core state ─────────────────────────────────────────────────────────────
  const [status,      setStatus]      = useState<BuilderStatus>('idle');
  const [resumeData,  setResumeData]  = useState<ResumeData | null>(initialData ?? null);
  const [ats,         setAts]         = useState<AtsBreakdown | null>(null);
  const [template,    setTemplate]    = useState<TemplateId>('modern');
  const [targetRole,  setTargetRole]  = useState<string>(initialData?.targetRole ?? '');
  const [error,       setError]       = useState<string | null>(null);
  const [versions,    setVersions]    = useState<ResumeVersion[]>([]);
  const [improving,   setImproving]   = useState<AiImproveTarget | null>(null);
  const [exporting,   setExporting]   = useState(false);

  // Debounce ref for auto-save
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── ATS recomputation ──────────────────────────────────────────────────────
  // Runs client-side on every edit for instant feedback.
  // Server-side score is computed on save for persistence.
  useEffect(() => {
    if (!resumeData) return;
    setAts(computeAtsHeuristic(resumeData, targetRole));
  }, [resumeData, targetRole]);

  // ── Auto-save (debounced, 1.5s) ────────────────────────────────────────────
  useEffect(() => {
    if (!resumeData || status !== 'editing') return;

    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      try {
        await apiFetch('/resumes/builder-draft', {
          method: 'PUT',
          body: JSON.stringify({
            resumeId,
            resumeData,
            templateId: template,
            atsScore:   ats?.overall,
          }),
        });
      } catch { /* non-fatal auto-save failure */ }
    }, 1500);

    return () => { if (saveTimer.current) clearTimeout(saveTimer.current); };
  }, [resumeData, template, ats?.overall]);

  // ── Load resume ────────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    setStatus('loading');
    setError(null);

    try {
      let data: ResumeData;

      if (hasResume && resumeId) {
        // Flow A: parse the uploaded CV into structured ResumeData
        const res = await apiFetch<{ parsed: ResumeData; versions: ResumeVersion[] }>(
          '/resumes/parse-for-builder',
          { method: 'POST', body: JSON.stringify({ resumeId }) },
        );
        data = res.parsed;
        setVersions(res.versions ?? []);
      } else {
        // Flow B: generate from profile/onboarding data
        const res = await apiFetch<{ generated: ResumeData }>(
          '/resumes/generate-from-profile',
        );
        data = res.generated;
      }

      setResumeData(data);
      setTargetRole(data.targetRole ?? '');
      setStatus('editing');
    } catch (err) {
      setError((err as Error)?.message ?? 'Failed to load resume data.');
      setStatus('error');
    }
  }, [hasResume, resumeId]);

  // ── AI improvement ─────────────────────────────────────────────────────────
  const improve = useCallback(async (target: AiImproveTarget) => {
    if (!resumeData) return;
    setImproving(target);

    try {
      const res = await apiFetch<{ improved: Partial<ResumeData>; changeSummary: string }>(
        '/resumes/ai-improve',
        {
          method: 'POST',
          body: JSON.stringify({ target, resumeData, targetRole }),
        },
      );

      // Merge improved sections into existing data
      setResumeData(prev => prev ? { ...prev, ...res.improved } : prev);

      // Add a version snapshot
      const newVersion: ResumeVersion = {
        id:            `ver_${Date.now()}`,
        versionNumber: (versions[0]?.versionNumber ?? 0) + 1,
        changeSummary: res.changeSummary ?? `AI improved ${target}`,
        atsScore:      ats?.overall ?? 0,
        createdAt:     new Date().toISOString(),
        content:       { ...resumeData, ...res.improved } as ResumeData,
      };
      setVersions(prev => [newVersion, ...prev].slice(0, 20)); // keep last 20
    } catch (err) {
      // Non-fatal — user still has original content
    } finally {
      setImproving(null);
    }
  }, [resumeData, targetRole, ats, versions]);

  // ── Rollback to version ────────────────────────────────────────────────────
  const rollback = useCallback((version: ResumeVersion) => {
    setResumeData(version.content);
    setTargetRole(version.content.targetRole ?? '');
  }, []);

  // ── Export ─────────────────────────────────────────────────────────────────
  const exportResume = useCallback(async (format: ExportFormat) => {
    if (!resumeData) return;
    setExporting(true);

    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_BASE_URL ?? ''}/api/v1/resumes/export`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ resumeData, templateId: template, format }),
        },
      );

      if (!response.ok) throw new Error('Export failed');

      const blob = await response.blob();
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href     = url;
      a.download = `${(resumeData.personalInfo.name || 'resume').replace(/\s+/g, '_')}.${format}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      // Invalidate caches so dashboard reflects the export
      qc.invalidateQueries({ queryKey: RESUMES_KEY });
    } catch { /* non-fatal */ } finally {
      setExporting(false);
    }
  }, [resumeData, template, qc]);

  // ── Update helpers ─────────────────────────────────────────────────────────
  const updateData = useCallback((patch: Partial<ResumeData>) => {
    setResumeData(prev => prev ? { ...prev, ...patch } : prev);
  }, []);

  const updateTargetRole = useCallback((role: string) => {
    setTargetRole(role);
    updateData({ targetRole: role });
  }, [updateData]);

  return {
    // State
    status, resumeData, ats, template, targetRole,
    error, versions, improving, exporting,

    // Actions
    load,
    improve,
    rollback,
    exportResume,
    updateData,
    updateTargetRole,
    setTemplate,
    setStatus,
    setResumeData,
  };
}

// ─── Client-side ATS heuristic ────────────────────────────────────────────────
// Gives instant feedback as the user types. Server computes the authoritative
// score on save and stores it in the DB.

function computeAtsHeuristic(data: ResumeData, targetRole: string): AtsBreakdown {
  const allText = [
    data.summary,
    data.experience.flatMap(e => e.bullets).join(' '),
    data.skills.join(' '),
  ].join(' ').toLowerCase();

  const roleKeywords = getRoleKeywords(targetRole || data.personalInfo.name || '');

  const matched   = roleKeywords.filter(kw => allText.includes(kw.toLowerCase()));
  const missing   = roleKeywords
    .filter(kw => !allText.includes(kw.toLowerCase()))
    .slice(0, 8);

  const kw = roleKeywords.length > 0
    ? Math.round((matched.length / roleKeywords.length) * 100)
    : 50;

  const formatting = Math.min(100,
    60
    + (data.personalInfo.email    ? 10 : 0)
    + (data.personalInfo.phone    ? 10 : 0)
    + (data.experience.length > 0 ? 10 : 0)
    + (data.education.length  > 0 ? 10 : 0),
  );

  const bulletCount      = data.experience.flatMap(e => e.bullets).filter(b => b.trim()).length;
  const contentStrength  = Math.min(100,
    40
    + Math.min(bulletCount * 5, 30)
    + (data.summary.length > 100 ? 15 : 5)
    + (data.skills.length  > 5   ? 15 : data.skills.length * 2),
  );

  const overall = Math.round(kw * 0.4 + formatting * 0.3 + contentStrength * 0.3);

  const suggestions: string[] = [];
  if (kw < 60)                   suggestions.push(`Add ${targetRole}-specific keywords`);
  if (bulletCount < 6)           suggestions.push('Aim for 2–4 bullet points per role');
  if (data.summary.length < 80)  suggestions.push('Expand professional summary (3–5 sentences)');
  if (data.skills.length < 8)    suggestions.push('Add more skills — ATS scanners count them directly');
  if (!data.personalInfo.linkedin) suggestions.push('Add your LinkedIn URL');

  return {
    keywordMatch: kw, formatting, contentStrength, overall,
    missingKeywords: missing,
    weakPhrases: [],
    suggestions,
  };
}

function getRoleKeywords(role: string): string[] {
  const r = role.toLowerCase();
  if (/accountant|finance|banking|audit/.test(r)) {
    return ['financial reporting', 'budgeting', 'forecasting', 'GST', 'tally',
            'SAP', 'IFRS', 'audit', 'tax compliance', 'accounts payable',
            'reconciliation', 'MIS', 'excel'];
  }
  if (/engineer|developer|software/.test(r)) {
    return ['react', 'typescript', 'node.js', 'sql', 'aws', 'docker',
            'ci/cd', 'api', 'git', 'agile', 'testing', 'performance'];
  }
  if (/manager|director|head|vp/.test(r)) {
    return ['team leadership', 'stakeholder management', 'project management',
            'budget', 'strategy', 'KPIs', 'cross-functional', 'delivery'];
  }
  if (/marketing|growth|seo/.test(r)) {
    return ['SEO', 'content strategy', 'campaigns', 'analytics', 'ROI',
            'conversion', 'brand', 'digital marketing', 'social media'];
  }
  return ['leadership', 'communication', 'analysis', 'strategy', 'management',
          'delivery', 'results', 'collaboration'];
}