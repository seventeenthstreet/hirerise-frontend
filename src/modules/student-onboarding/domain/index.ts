/**
 * @file src/modules/student-onboarding/domain/index.ts
 *
 * STUDENT ONBOARDING DOMAIN LAYER — PUBLIC API
 * ─────────────────────────────────────────────
 * Canonical import point for all student-onboarding domain types,
 * constants, and contracts.
 *
 * CONSUMERS:
 *   - AI recommendation engine
 *   - Adaptive assessment engine
 *   - Scoring orchestration
 *   - Analytics
 *   - Career intelligence
 *
 * USAGE:
 *   import type { OnboardingStep, EducationLevel } from '@/modules/student-onboarding/domain';
 *   import { STEP_REGISTRY, resolveStep }          from '@/modules/student-onboarding/domain';
 *   import type { ConfidenceTier, ReadinessScore }  from '@/modules/student-onboarding/domain';
 *
 * ARCHITECTURE:
 *   domain/ is a PURE re-export layer in Phase 2.
 *   It establishes the stable public API without moving code.
 *   Phase 3 may consolidate implementations here.
 */

// ── Enums & base types ───────────────────────────────────────────────────────
export * from './enums';

// ── Step registry & utilities ────────────────────────────────────────────────
export * from './constants';

// ── Scoring contracts ─────────────────────────────────────────────────────────
export * from './scoring';
