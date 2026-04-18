'use client';

/**
 * hooks/useJdMatch.ts
 *
 * Calls POST /api/v1/career/jd-match
 *
 * NLP-based JD matching — no AI call, no premium gate.
 * Caller must provide userProfile + rawJobDescription.
 *
 * The backend uses TF-IDF keyword extraction + stem matching to score
 * how well the user's skills align with the job description.
 *
 * Response shape:
 *   matchScore          — 0-100 composite (keywords 60% + experience 30% + education 10%)
 *   matchCategory       — 'excellent_match' | 'good_match' | 'partial_match' | 'low_match'
 *   matchedKeywords[]   — JD keywords the user already has
 *   missingKeywords[]   — JD keywords the user is missing
 *   keywordAnalysis     — { totalExtracted, matched, missing, matchScore }
 *   experienceAnalysis  — { requiredYears, userYears, gap, meets, matchScore }
 *   educationAnalysis   — { required, user, meets }
 *   improvementSuggestions[] — { type, priority, action, impact }
 *   summary             — one-sentence summary
 */

import { useState, useCallback } from 'react';
import { apiFetch }              from '@/services/apiClient';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ImprovementSuggestion {
  type:     string;
  priority: 'high' | 'medium' | 'low';
  action:   string;
  impact:   string;
}

export interface JdMatchResult {
  matchScore:    number;
  matchCategory: 'excellent_match' | 'good_match' | 'partial_match' | 'low_match';
  keywordAnalysis: {
    totalExtracted: number;
    matched:        number;
    missing:        number;
    matchScore:     number;
  };
  matchedKeywords:         string[];
  missingKeywords:         string[];
  experienceAnalysis: {
    requiredYears: number | null;
    userYears:     number;
    gap:           number;
    meets:         boolean;
    matchScore:    number;
  };
  educationAnalysis: {
    required: string | null;
    user:     string | null;
    meets:    boolean;
  };
  improvementSuggestions: ImprovementSuggestion[];
  summary: string;
}

export interface JdMatchUserProfile {
  skills:           Array<{ name: string }>;
  totalExperience?: number;
  educationLevel?:  'high_school' | 'diploma' | 'bachelors' | 'masters' | 'mba' | 'phd';
}

export interface JdMatchState {
  data:      JdMatchResult | null;
  loading:   boolean;
  error:     string | null;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useJdMatch() {
  const [state, setState] = useState<JdMatchState>({
    data:    null,
    loading: false,
    error:   null,
  });

  const match = useCallback(async (
    userProfile:        JdMatchUserProfile,
    rawJobDescription:  string,
  ) => {
    if (!rawJobDescription || rawJobDescription.trim().length < 50) {
      setState(s => ({ ...s, error: 'Job description must be at least 50 characters.' }));
      return;
    }
    if (!userProfile.skills?.length) {
      setState(s => ({ ...s, error: 'Your profile has no skills. Upload your CV first.' }));
      return;
    }

    setState({ data: null, loading: true, error: null });

    try {
      const result = await apiFetch<{ data: JdMatchResult }>(
        '/career/jd-match',
        {
          method: 'POST',
          body:   JSON.stringify({ userProfile, rawJobDescription }),
        },
      );
      // apiClient unwraps { success, data } → result IS the data
      setState({ data: result as unknown as JdMatchResult, loading: false, error: null });
    } catch (err: any) {
      setState({
        data:    null,
        loading: false,
        error:   err?.message ?? 'JD analysis failed. Please try again.',
      });
    }
  }, []);

  const reset = useCallback(() => {
    setState({ data: null, loading: false, error: null });
  }, []);

  return { ...state, match, reset };
}