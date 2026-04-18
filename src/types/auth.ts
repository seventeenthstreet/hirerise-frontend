// types/auth.ts — Updated for onboarding completion system

export type UserTier = 'free' | 'pro' | 'enterprise';
export type UserRole = 'user' | 'contributor' | 'admin' | 'super_admin' | 'MASTER_ADMIN';
export type UserType = 'student' | 'professional';

/** Shape returned by GET /api/v1/users/me → data.user */
export interface BackendUser {
  id:                   string;
  uid:                  string; // @deprecated — use id (Supabase migration)
  email:                string;
  displayName:          string | null;
  photoURL:             string | null;
  tier:                 UserTier;
  planAmount:           number | null;
  aiCreditsRemaining:   number;
  reportUnlocked:       boolean;
  resumeUploaded:       boolean;
  chiScore:             number | null;
  subscriptionStatus:   'active' | 'inactive' | 'cancelled' | 'past_due';
  subscriptionProvider: string | null;
  subscriptionId:       string | null;
  createdAt:            string;
  updatedAt:            string;
  role?:                UserRole | null;
  admin?:               boolean;

  // Optional career profile fields
  location?:        string | null;
  targetRole?:      string | null;
  experienceYears?: number | null;
  bio?:             string | null;
  careerGoal?:      string | null;

  // ── Onboarding routing fields ────────────────────────────────────────────
  user_type?:                       UserType | null;
  student_onboarding_complete?:     boolean;
  professional_onboarding_complete?: boolean;

  // ── NEW: Unified onboarding completion fields ────────────────────────────
  /** True once the user completes the unified /onboarding flow. */
  onboardingCompleted?:   boolean;
  onboarding_completed?:  boolean;   // snake_case alias from DB

  /** Last step reached — used to resume mid-flow on next login. */
  onboarding_step?:       string | null;

  /** 0–100 profile strength score, calculated on completion. */
  profileStrength?:       number;
  profile_strength?:      number;
}

/** Full /users/me response envelope */
export interface MeResponse {
  user: BackendUser;
  credits: {
    remaining:     number;
    remainingUses: Record<string, number> | null;
  };
  quota: {
    remaining: Record<string, number> | null;
    resetDate: string;
  };
}

/** What AuthContext exposes to the app */
export interface AuthState {
  user:             BackendUser | null;
  role:             UserRole | null;
  plan:             UserTier;
  isAuthenticated:  boolean;
  isAdmin:          boolean;
  isMasterAdmin:    boolean;
  isContributor:    boolean;
  isLoading:        boolean;
}