/**
 * @file front/src/modules/student-onboarding/activities/types/index.ts
 *
 * TYPE OWNERSHIP — Activities & Achievement Intelligence (Phase 3B)
 * ──────────────────────────────────────────────────────────────────
 * Single source of truth for all activity-domain types in the frontend module.
 *
 * THREE-TIER TYPE ARCHITECTURE:
 *   Tier 1 — DB Layer (Raw)     — exact DB column shapes, prefixed Db*
 *   Tier 2 — Domain Layer       — camelCase, normalized, crosses API → Hook boundary
 *   Tier 3 — Request/Response   — what hooks send and receive
 *
 * ENUM SAFETY CONTRACT:
 *   All enum values MUST mirror:
 *   • backend constants/activities.js
 *   • SQL enums in migration 20260523000001_student_activities_phase3b.sql
 *
 * DO NOT:
 *   - Import Supabase client here
 *   - Add UI state types here
 *   - Add recommendation types here
 */

// ─────────────────────────────────────────────────────────────────────────────
// ENUM CONSTANTS
// Mirror of: backend constants/activities.js + SQL enums
// ─────────────────────────────────────────────────────────────────────────────

export const ACTIVITY_CATEGORIES = [
  'technical',
  'creative',
  'leadership',
  'academic',
  'social',
  'athletic',
] as const;

export type ActivityCategory = (typeof ACTIVITY_CATEGORIES)[number];

export const CATEGORY_LABELS: Record<ActivityCategory, string> = {
  technical:  'Technical',
  creative:   'Creative',
  leadership: 'Leadership',
  academic:   'Academic',
  social:     'Social Impact',
  athletic:   'Sports & Athletics',
};

export const CATEGORY_ICONS: Record<ActivityCategory, string> = {
  technical:  '⚙️',
  creative:   '🎨',
  leadership: '🏛️',
  academic:   '📚',
  social:     '🤝',
  athletic:   '🏆',
};

// ── Proficiency ───────────────────────────────────────────────────────────────

export const PROFICIENCY_LEVELS = [
  'beginner',
  'developing',
  'proficient',
  'advanced',
  'expert',
] as const;

export type ProficiencyLevel = (typeof PROFICIENCY_LEVELS)[number];

export const PROFICIENCY_LABELS: Record<ProficiencyLevel, string> = {
  beginner:   'Beginner',
  developing: 'Developing',
  proficient: 'Proficient',
  advanced:   'Advanced',
  expert:     'Expert',
};

export const PROFICIENCY_DESCRIPTIONS: Record<ProficiencyLevel, string> = {
  beginner:   'Just started or very basic familiarity',
  developing: 'Learning the fundamentals',
  proficient: 'Comfortable — can work independently',
  advanced:   'Strong skills, mentors others',
  expert:     'Top-tier, recognized or competition-level',
};

// ── Leadership ────────────────────────────────────────────────────────────────

export const LEADERSHIP_LEVELS = [
  'none',
  'participant',
  'coordinator',
  'lead',
  'captain',
  'founder',
] as const;

export type LeadershipLevel = (typeof LEADERSHIP_LEVELS)[number];

export const LEADERSHIP_LABELS: Record<LeadershipLevel, string> = {
  none:        'No leadership role',
  participant: 'Participant',
  coordinator: 'Coordinator',
  lead:        'Lead / Head',
  captain:     'Captain / President',
  founder:     'Founder',
};

// ── Achievement Levels ────────────────────────────────────────────────────────

export const ACHIEVEMENT_LEVELS = [
  'participation',
  'school',
  'inter_school',
  'district',
  'state',
  'national',
  'international',
] as const;

export type AchievementLevel = (typeof ACHIEVEMENT_LEVELS)[number];

export const ACHIEVEMENT_LEVEL_LABELS: Record<AchievementLevel, string> = {
  participation: 'Participation',
  school:        'School Level',
  inter_school:  'Inter-School',
  district:      'District / City',
  state:         'State',
  national:      'National',
  international: 'International',
};

// ── Achievement Positions ─────────────────────────────────────────────────────

export const ACHIEVEMENT_POSITIONS = [
  'participant',
  'finalist',
  'runner_up',
  'winner',
] as const;

export type AchievementPosition = (typeof ACHIEVEMENT_POSITIONS)[number];

export const ACHIEVEMENT_POSITION_LABELS: Record<AchievementPosition, string> = {
  participant: 'Participant',
  finalist:    'Finalist',
  runner_up:   'Runner-up',
  winner:      'Winner / 1st Place',
};

// ─────────────────────────────────────────────────────────────────────────────
// TIER 1 — DB LAYER (Raw)
// Never used in hooks or UI components.
// ─────────────────────────────────────────────────────────────────────────────

export interface DbActivityTaxonomyRow {
  readonly activity_key:   string;
  readonly display_name:   string;
  readonly category:       string;
  readonly description:    string | null;
  readonly tags:           string[];
  readonly display_order:  number;
}

export interface DbStudentActivity {
  readonly id:                string;
  readonly user_id:           string;
  readonly activity_key:      string;
  readonly activity_category: string;
  readonly proficiency_level: string | null;
  readonly duration_months:   number | null;
  readonly weekly_frequency:  number | null;
  readonly currently_active:  boolean;
  readonly leadership_level:  string;
  readonly is_partial:        boolean;
  readonly signal_score:      number | null;
  readonly created_at:        string;
  readonly updated_at:        string;
}

export interface DbAchievement {
  readonly id:                   string;
  readonly user_id:              string;
  readonly student_activity_id:  string;
  readonly achievement_title:    string;
  readonly achievement_level:    string;
  readonly achievement_position: string | null;
  readonly achievement_year:     number | null;
  readonly normalized_score:     number | null;
  readonly created_at:           string;
  readonly updated_at:           string;
}

export interface DbReflection {
  readonly id:                        string;
  readonly user_id:                   string;
  readonly favorite_activity_key:     string | null;
  readonly pursue_seriously_key:      string | null;
  readonly proudest_achievement_text: string | null;
  readonly updated_at:                string;
}

// ─────────────────────────────────────────────────────────────────────────────
// TIER 2 — DOMAIN LAYER (Normalized)
// Camelcase. Crosses the API → Hook boundary.
// ─────────────────────────────────────────────────────────────────────────────

/** A single activity from the backend-driven taxonomy. */
export interface TaxonomyActivity {
  readonly activityKey:  string;
  readonly displayName:  string;
  readonly description:  string | null;
  readonly tags:         string[];
  readonly displayOrder: number;
}

/** A taxonomy group containing activities for one category. */
export interface TaxonomyCategory {
  readonly category:   ActivityCategory;
  readonly activities: TaxonomyActivity[];
}

/** The student's current activity record — combines activity + depth data. */
export interface StudentActivity {
  readonly id:               string;
  readonly activityKey:      string;
  readonly activityCategory: ActivityCategory;
  readonly proficiencyLevel: ProficiencyLevel | null;
  readonly durationMonths:   number | null;
  readonly weeklyFrequency:  number | null;
  readonly currentlyActive:  boolean;
  readonly leadershipLevel:  LeadershipLevel;
  readonly isPartial:        boolean;
  readonly updatedAt:        string;
}

/** A single achievement record. */
export interface Achievement {
  readonly id:                  string;
  readonly studentActivityId:   string;
  readonly achievementTitle:    string;
  readonly achievementLevel:    AchievementLevel;
  readonly achievementPosition: AchievementPosition | null;
  readonly achievementYear:     number | null;
  readonly createdAt:           string;
}

/** Optional reflection signals from Step 5. */
export interface ActivityReflection {
  readonly favoriteActivityKey:    string | null;
  readonly pursuesSeriouslyKey:    string | null;
  readonly proudestAchievementText: string | null;
  readonly updatedAt:              string;
}

/** Signal quality summary returned by every mutation endpoint. */
export interface ActivitySignalQuality {
  readonly totalCount:      number;
  readonly committedCount:  number;
  readonly hasAchievements: boolean;
  readonly hasLeadership:   boolean;
  readonly isSufficient:    boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// TIER 3 — REQUEST / RESPONSE MODELS
// ─────────────────────────────────────────────────────────────────────────────

// ── GET /step/activities ──────────────────────────────────────────────────────

export interface GetActivitiesResponse {
  readonly ok:            boolean;
  readonly taxonomy:      Record<string, { category: string; activities: DbActivityTaxonomyRow[] }>;
  readonly activities:    DbStudentActivity[];
  readonly achievements:  DbAchievement[];
  readonly reflection:    DbReflection | null;
  readonly signal_quality: {
    readonly total_count:      number;
    readonly committed_count:  number;
    readonly has_achievements: boolean;
    readonly has_leadership:   boolean;
    readonly is_sufficient:    boolean;
  };
}

// ── POST /step/activities/add ─────────────────────────────────────────────────

export interface AddActivityInput {
  readonly activityKey:      string;
  readonly activityCategory: ActivityCategory;
  readonly proficiencyLevel?: ProficiencyLevel | null;
  readonly durationMonths?:  number | null;
  readonly weeklyFrequency?: number | null;
  readonly currentlyActive?: boolean;
  readonly leadershipLevel?: LeadershipLevel;
  readonly isPartial:        boolean;
}

export interface AddActivityResponse {
  readonly ok:            boolean;
  readonly activity:      DbStudentActivity;
  readonly signal_quality: GetActivitiesResponse['signal_quality'];
}

// ── PUT /step/activities/:key/depth ──────────────────────────────────────────

export interface UpdateDepthInput {
  readonly activityCategory: ActivityCategory;
  readonly proficiencyLevel: ProficiencyLevel;
  readonly durationMonths?:  number | null;
  readonly weeklyFrequency?: number | null;
  readonly currentlyActive:  boolean;
  readonly leadershipLevel:  LeadershipLevel;
  readonly isPartial:        boolean;
}

export type UpdateDepthResponse = AddActivityResponse;

// ── POST /step/activities/:key/achievements ───────────────────────────────────

export interface AddAchievementInput {
  readonly achievementTitle:    string;
  readonly achievementLevel:    AchievementLevel;
  readonly achievementPosition?: AchievementPosition | null;
  readonly achievementYear?:    number | null;
}

export interface AddAchievementResponse {
  readonly ok:          boolean;
  readonly achievement: DbAchievement;
}

// ── POST /step/activities/reflection ─────────────────────────────────────────

export interface SaveReflectionInput {
  readonly favoriteActivityKey?:    string | null;
  readonly pursuesSeriouslyKey?:    string | null;
  readonly proudestAchievementText?: string | null;
}

export interface SaveReflectionResponse {
  readonly ok:         boolean;
  readonly reflection: DbReflection;
}

// ── POST /step/activities/commit ──────────────────────────────────────────────

export interface CommitActivitiesResponse {
  readonly ok:            boolean;
  readonly session:       { current_step: string };
  readonly next_step:     string;
  readonly signal_quality: GetActivitiesResponse['signal_quality'];
}

// ─────────────────────────────────────────────────────────────────────────────
// ERROR TYPES
// ─────────────────────────────────────────────────────────────────────────────

export const ActivityErrorCode = {
  FETCH_FAILED:           'ACTIVITY_FETCH_FAILED',
  ADD_FAILED:             'ACTIVITY_ADD_FAILED',
  UPDATE_FAILED:          'ACTIVITY_UPDATE_FAILED',
  DELETE_FAILED:          'ACTIVITY_DELETE_FAILED',
  ACHIEVEMENT_ADD_FAILED: 'ACHIEVEMENT_ADD_FAILED',
  ACHIEVEMENT_DEL_FAILED: 'ACHIEVEMENT_DELETE_FAILED',
  REFLECTION_FAILED:      'REFLECTION_SAVE_FAILED',
  COMMIT_FAILED:          'ACTIVITY_COMMIT_FAILED',
  INSUFFICIENT_SIGNAL:    'ACTIVITY_INSUFFICIENT_SIGNAL',
} as const;

export type ActivityErrorCode = (typeof ActivityErrorCode)[keyof typeof ActivityErrorCode];