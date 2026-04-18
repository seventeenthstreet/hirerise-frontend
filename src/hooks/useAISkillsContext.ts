/**
 * hooks/useAISkillsContext.ts
 *
 * UNIFIED AI SKILLS CONTEXT — single source of truth.
 *
 * Merges data from:
 *   - useCareerHealth  → chi.topSkills (skills the user has), chi.skillGaps
 *   - useSkillGap      → gap.missing_high_demand (AI-detected missing skills)
 *   - useResumes       → resume.extractedSkills (skills from CV)
 *   - useProfile       → user profile
 *
 * Exposes:
 *   - userSkills       string[]   — all skills the user currently has
 *   - missingSkills    MissingSkill[]  — AI-recommended skills to add
 *   - addSkill(name)   — one-click: updates profile + invalidates CHI + resume
 *   - removeSkill(name)
 *   - isAdding         boolean
 *   - addedSkills      Set<string>  — optimistic UI state
 */

'use client';

import { useState, useCallback, useMemo } from 'react';
import { useQueryClient }  from '@tanstack/react-query';
import { useCareerHealth, CAREER_HEALTH_KEY } from './useCareerHealth';
import { useSkillGap }     from './useSkillGraph';
import { useResumes, RESUMES_KEY }      from './useResumes';
import { useProfile, PROFILE_KEY }      from './useProfile';
import { apiFetch }        from '@/services/apiClient';
import type { MissingSkill } from './useSkillGraph';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AISkillsContext {
  /** All skills the user currently has (from CHI + resume) */
  userSkills:     string[];
  /** AI-detected missing skills sorted by demand score */
  missingSkills:  MissingSkill[];
  /** Adjacent / next-level skills worth exploring */
  suggestedSkills: string[];
  /** One-click add skill — updates profile + resume JSON + invalidates dashboard */
  addSkill:       (skillName: string) => Promise<void>;
  removeSkill:    (skillName: string) => Promise<void>;
  /** Skills added this session (optimistic) */
  addedSkills:    Set<string>;
  removedSkills:  Set<string>;
  isAdding:       boolean;
  isLoading:      boolean;
  /** Whether we have enough AI data to show the personalised view */
  hasAIContext:   boolean;
  /** The role these missing skills are calculated for */
  targetRole:     string | null;
  refetchAll:     () => void;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useAISkillsContext(): AISkillsContext {
  const qc = useQueryClient();

  const { data: chi,     isLoading: chiLoading     } = useCareerHealth();
  const { data: gapData, isLoading: gapLoading     } = useSkillGap();
  const { data: resumes, isLoading: resumeLoading  } = useResumes();
  const { data: profile, isLoading: profileLoading } = useProfile();

  const [addedSkills,   setAddedSkills]   = useState<Set<string>>(new Set());
  const [removedSkills, setRemovedSkills] = useState<Set<string>>(new Set());
  const [isAdding,      setIsAdding]      = useState(false);

  const isLoading = chiLoading || gapLoading || resumeLoading || profileLoading;

  // ── Derive user's current skill set ─────────────────────────────────────────
  const userSkills = useMemo<string[]>(() => {
    const fromChi     = chi?.topSkills ?? [];
    const fromResume  = resumes?.items?.[0]?.extractedSkills ?? [];
    const fromProfile = ((profile?.user as any)?.skills ?? []) as string[];

    // Merge, deduplicate, apply session mutations
    const merged = Array.from(new Set([...fromChi, ...fromResume, ...fromProfile]));
    return merged
      .concat(Array.from(addedSkills))
      .filter(s => !removedSkills.has(s));
  }, [chi, resumes, profile, addedSkills, removedSkills]);

  // ── Derive missing skills from AI analysis ───────────────────────────────────
  const missingSkills = useMemo<MissingSkill[]>(() => {
    const raw = gapData?.missing_high_demand ?? [];
    const userSet = new Set(userSkills.map(s => s.toLowerCase()));
    return raw
      .filter(s => !userSet.has(s.name.toLowerCase()))
      .filter(s => !addedSkills.has(s.name))
      .sort((a, b) => (b.demand_score ?? 0) - (a.demand_score ?? 0));
  }, [gapData, userSkills, addedSkills]);

  // ── Suggested (adjacent) skills ──────────────────────────────────────────────
  const suggestedSkills = useMemo<string[]>(() => {
    const adj  = gapData?.adjacent_skills ?? [];
    const next: string[] = [];
    const userSet = new Set(userSkills.map(s => s.toLowerCase()));
    return Array.from(new Set([...adj, ...next]))
      .filter(s => !userSet.has(s.toLowerCase()))
      .slice(0, 8);
  }, [gapData, userSkills]);

  const targetRole = useMemo(() =>
    chi?.detectedProfession ??
    (profile?.user as any)?.targetRole ??
    null,
  [chi, profile]);

  const hasAIContext = !isLoading && (missingSkills.length > 0 || userSkills.length > 0);

  // ── Add skill ─────────────────────────────────────────────────────────────────
  const addSkill = useCallback(async (skillName: string) => {
    if (addedSkills.has(skillName)) return;
    setIsAdding(true);

    // 1. Optimistic update immediately
    setAddedSkills(prev => new Set([...prev, skillName]));
    setRemovedSkills(prev => { const n = new Set(prev); n.delete(skillName); return n; });

    try {
      const currentSkills = Array.from(
        new Set([...userSkills, skillName])
      );

      // 2. PATCH /api/v1/users/me — persist to profile
      await apiFetch('/users/me', {
        method: 'PATCH',
        body: JSON.stringify({ skills: currentSkills }),
      });

      // 3. Invalidate all downstream caches so dashboard metrics refresh
      await Promise.all([
        qc.invalidateQueries({ queryKey: CAREER_HEALTH_KEY }),
        qc.invalidateQueries({ queryKey: PROFILE_KEY }),
        qc.invalidateQueries({ queryKey: RESUMES_KEY }),
        qc.invalidateQueries({ queryKey: ['skill-gap'] }),
        qc.invalidateQueries({ queryKey: ['skills'] }),
      ]);
    } catch (err) {
      // Roll back optimistic update on failure
      setAddedSkills(prev => { const n = new Set(prev); n.delete(skillName); return n; });
      console.error('[useAISkillsContext] addSkill failed:', err);
      throw err;
    } finally {
      setIsAdding(false);
    }
  }, [addedSkills, userSkills, qc]);

  // ── Remove skill ──────────────────────────────────────────────────────────────
  const removeSkill = useCallback(async (skillName: string) => {
    setIsAdding(true);

    // Optimistic update
    setRemovedSkills(prev => new Set([...prev, skillName]));
    setAddedSkills(prev => { const n = new Set(prev); n.delete(skillName); return n; });

    try {
      const updatedSkills = userSkills.filter(s => s !== skillName);
      await apiFetch('/users/me', {
        method: 'PATCH',
        body: JSON.stringify({ skills: updatedSkills }),
      });
      await Promise.all([
        qc.invalidateQueries({ queryKey: CAREER_HEALTH_KEY }),
        qc.invalidateQueries({ queryKey: PROFILE_KEY }),
      ]);
    } catch (err) {
      setRemovedSkills(prev => { const n = new Set(prev); n.delete(skillName); return n; });
      console.error('[useAISkillsContext] removeSkill failed:', err);
      throw err;
    } finally {
      setIsAdding(false);
    }
  }, [userSkills, qc]);

  const refetchAll = useCallback(() => {
    qc.invalidateQueries({ queryKey: CAREER_HEALTH_KEY });
    qc.invalidateQueries({ queryKey: ['skill-gap'] });
    qc.invalidateQueries({ queryKey: RESUMES_KEY });
    qc.invalidateQueries({ queryKey: PROFILE_KEY });
  }, [qc]);

  return {
    userSkills,
    missingSkills,
    suggestedSkills,
    addSkill,
    removeSkill,
    addedSkills,
    removedSkills,
    isAdding,
    isLoading,
    hasAIContext,
    targetRole,
    refetchAll,
  };
}