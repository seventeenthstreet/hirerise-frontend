/**
 * @file features/student-onboarding/index.ts
 *
 * PUBLIC API SURFACE — Student Onboarding Feature (Phase 3)
 * ══════════════════════════════════════════════════════════
 *
 * WHAT THIS FEATURE LAYER ADDS (Phase 3 additions marked with ★):
 *   - useStudentOnboardingFlow (orchestration)
 *   - useResumeOnboarding (resume detection)
 *   - PHASE2_UNIMPLEMENTED_STEPS constant
 *   - isStepImplemented() utility
 *   ★ isSupportedSessionVersion() — version compatibility helper
 *   ★ SUPPORTED_ONBOARDING_VERSIONS — version registry
 *   ★ logOnboardingEvent() — structured diagnostics
 */

export {
  useStudentOnboardingFlow,
  useResumeOnboarding,
  isStepImplemented,
  PHASE2_UNIMPLEMENTED_STEPS,
  // Re-exports from module layer
  useStudentOnboardingSession,
  useEducationProfile,
  useSaveEducationProfile,
  useUpdateOnboardingStep,
  studentOnboardingQueryKeys,
} from './hooks';

export type {
  UseStudentOnboardingFlowReturn,
  UseResumeOnboardingReturn,
  UseStudentOnboardingSessionReturn,
  UseEducationProfileReturn,
  UseSaveEducationProfileReturn,
  UseUpdateOnboardingStepReturn,
  StudentOnboardingQueryKey,
} from './hooks';

// ★ Version Guard exports
export {
  isSupportedSessionVersion,
  SUPPORTED_ONBOARDING_VERSIONS,
  buildVersionMismatchDetail,
} from './lib/version-guard';

export type {
  SupportedOnboardingVersion,
  VersionMismatchDetail,
} from './lib/version-guard';

// ★ Diagnostics exports
export { logOnboardingEvent, _resetDiagnosticDeduplication } from './lib/onboarding-diagnostics';

export type {
  OnboardingEventName,
  DiagnosticSeverity,
  OnboardingDiagnosticEvent,
} from './lib/onboarding-diagnostics';

// ★ Hardening types (version compatibility additions)
export type {
  VersionCompatibilityState,
  VersionMismatchInfo,
} from './lib/onboarding-hardening.types';

// ★ Snapshot diagnostics
export {
  captureOnboardingSnapshot,
  buildRecoverySnapshot,
  createOnboardingSnapshot,
  sanitizeSnapshotPayload,
  getSnapshotBuffer,
  readSessionStorageSnapshots,
  clearSessionStorageSnapshots,
  _resetSnapshotDeduplication,
  SNAPSHOT_SCENARIOS,
  SNAPSHOT_SEVERITY_MAP,
} from './lib/onboarding-snapshot';

export type {
  SnapshotScenario,
  SnapshotSeverity,
  OnboardingSnapshot,
  SnapshotInput,
  SnapshotOnboardingState,
  SnapshotRecoveryState,
  SnapshotDiagnosticsState,
} from './lib/onboarding-snapshot';