/**
 * lib/interviewTypes.ts
 *
 * Shared Interview Prep types — used by both API routes and UI components.
 * Centralised here so routes don't import from each other (Next.js restriction).
 */

export type QuestionCategory =
  | 'behavioural'
  | 'technical'
  | 'situational'
  | 'motivation'
  | 'strength_gap';

export interface InterviewQuestion {
  id:              string;
  category:        QuestionCategory;
  question:        string;
  intent:          string;
  suggestedAnswer: string;
  keyPoints:       string[];
  tips:            string[];
  difficulty:      'easy' | 'medium' | 'hard';
}

export interface GenerateInterviewResult {
  questions:  InterviewQuestion[];
  role:       string;
  difficulty: 'entry' | 'mid' | 'senior';
}

export interface EvaluationResult {
  score:        number;
  grade:        'A' | 'B' | 'C' | 'D' | 'F';
  strengths:    string[];
  improvements: string[];
  betterAnswer: string;
  avaCoaching:  string;
  keyPointsHit: boolean[];
}