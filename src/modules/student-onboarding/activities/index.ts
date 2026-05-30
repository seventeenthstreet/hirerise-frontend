/**
 * @file front/src/modules/student-onboarding/activities/index.ts
 *
 * BARREL EXPORTS — Activities Module (Phase 3B)
 *
 * Public surface area of the activities sub-module.
 * Only export what other modules need to consume.
 */

// Types
export type {
  ActivityCategory,
  ProficiencyLevel,
  LeadershipLevel,
  AchievementLevel,
  AchievementPosition,
  StudentActivity,
  Achievement,
  TaxonomyCategory,
  TaxonomyActivity,
  ActivitySignalQuality,
  ActivityReflection,
  AddActivityInput,
  UpdateDepthInput,
  AddAchievementInput,
  SaveReflectionInput,
} from './types';

export {
  ACTIVITY_CATEGORIES,
  CATEGORY_LABELS,
  CATEGORY_ICONS,
  PROFICIENCY_LEVELS,
  PROFICIENCY_LABELS,
  LEADERSHIP_LEVELS,
  LEADERSHIP_LABELS,
  ACHIEVEMENT_LEVELS,
  ACHIEVEMENT_LEVEL_LABELS,
  ACHIEVEMENT_POSITIONS,
  ACHIEVEMENT_POSITION_LABELS,
  ActivityErrorCode,
} from './types';

// Hooks
export {
  useActivitiesStep,
  useAddActivity,
  useUpdateActivityDepth,
  useDeleteActivity,
  useAddAchievement,
  useDeleteAchievement,
  useSaveReflection,
  useCommitActivities,
  ACTIVITIES_QUERY_KEY,
  type ActivitiesStepData,
} from './hooks/use-activities';

// API (exposed for advanced consumers — hooks preferred)
export * as activitiesApi from './api/activities.api';
