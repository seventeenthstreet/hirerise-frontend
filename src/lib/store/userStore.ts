/**
 * lib/store/userStore.ts
 *
 * Global Zustand store for user + resume UI state.
 *
 * AUTHORITY RULE (critical):
 *   This store is NEVER the authority for routing decisions.
 *   Routing (AuthGuard, dashboard redirects) reads ONLY from AuthContext,
 *   which is populated by the server-verified /users/me response.
 *   This store exists purely for UI state: resume upload progress, score,
 *   display name — things that would otherwise require prop-drilling.
 *
 * HYDRATION:
 *   hydrateFromProfile() is called once in AuthProvider after /users/me
 *   resolves. It mirrors the server's onboarding_completed field exactly
 *   (no local inference) so there is never a disagreement.
 *
 * PERSISTENCE:
 *   Persisted to sessionStorage (cleared on tab close).
 *   reset() is called on sign-out BEFORE the auth state updates, ensuring
 *   stale data is never visible to the next session in the same tab.
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

// ─── Types ────────────────────────────────────────────────────────────────────

export type ResumeStatus = 'none' | 'uploaded' | 'processing' | 'scored' | 'error';
export type UserType     = 'student' | 'professional' | null;

interface ResumeState {
  resumeId:     string | null;
  fileName:     string | null;
  status:       ResumeStatus;
  score:        number | null;
  roleFit:      string | null;
  uploadedAt:   string | null;
  pollJobId:    string | null;
}

interface UserStoreState {
  // ── User identity (UI display only — NOT used for routing) ────────────────
  userId:       string | null;
  userType:     UserType;
  displayName:  string | null;
  email:        string | null;

  // ── Resume state ──────────────────────────────────────────────────────────
  resume:       ResumeState;

  // ── Onboarding (mirrors server value — NOT used for routing) ──────────────
  // Read this only for UI display (e.g. progress bars).
  // For routing, always use AuthContext: user.onboardingCompleted.
  onboardingComplete: boolean;
  careerGoal:         string | null;

  // ── Actions ───────────────────────────────────────────────────────────────
  setUser:               (user: Partial<Pick<UserStoreState, 'userId' | 'userType' | 'displayName' | 'email'>>) => void;
  setResume:             (resume: Partial<ResumeState>) => void;
  setResumeStatus:       (status: ResumeStatus) => void;
  setScore:              (score: number, roleFit: string) => void;
  setPollJobId:          (jobId: string | null) => void;
  setOnboardingComplete: (careerGoal?: string) => void;
  hydrateFromProfile:    (profile: any) => void;
  reset:                 () => void;
}

// ─── Initial state ────────────────────────────────────────────────────────────

const INITIAL_RESUME: ResumeState = {
  resumeId:   null,
  fileName:   null,
  status:     'none',
  score:      null,
  roleFit:    null,
  uploadedAt: null,
  pollJobId:  null,
};

const INITIAL_STATE = {
  userId:             null,
  userType:           null  as UserType,
  displayName:        null,
  email:              null,
  resume:             INITIAL_RESUME,
  onboardingComplete: false,
  careerGoal:         null,
};

// ─── Store ────────────────────────────────────────────────────────────────────

export const useUserStore = create<UserStoreState>()(
  persist(
    (set) => ({
      ...INITIAL_STATE,

      // ── Actions ─────────────────────────────────────────────────────────

      setUser: (user) => set((state) => ({ ...state, ...user })),

      setResume: (resume) => set((state) => ({
        resume: { ...state.resume, ...resume },
      })),

      setResumeStatus: (status) => set((state) => ({
        resume: { ...state.resume, status },
      })),

      setScore: (score, roleFit) => set((state) => ({
        resume: { ...state.resume, score, roleFit, status: 'scored' },
      })),

      setPollJobId: (pollJobId) => set((state) => ({
        resume: { ...state.resume, pollJobId },
      })),

      setOnboardingComplete: (careerGoal) => set({
        onboardingComplete: true,
        careerGoal: careerGoal || null,
      }),

      /**
       * hydrateFromProfile(profile)
       *
       * Called by AuthProvider after /users/me resolves, and by useProfile()
       * hook when TanStack Query returns fresh data.
       *
       * CRITICAL: onboardingComplete mirrors the EXACT same logic AuthGuard uses.
       * These two blocks MUST stay in sync — a divergence causes redirect loops
       * (AuthGuard sees "incomplete", store sees "complete", or vice versa).
       *
       * ⚠️  If you change the onboarding logic here, update AuthGuard too:
       *   src/features/auth/components/AuthGuard.tsx → isOnboardingComplete
       *
       * This store field is FOR UI DISPLAY ONLY (progress bars, banners).
       * Routing decisions always read from AuthContext — never from this store.
       *
       * @param profile — the MeResponse.user object from the backend
       */
      hydrateFromProfile: (profile: any) => {
        if (!profile) return;

        // ⚠️  MUST match AuthGuard's isOnboardingComplete check exactly.
        // See: src/features/auth/components/AuthGuard.tsx
        //
        // SINGLE SOURCE OF TRUTH: Only trust explicit server-side completion flags.
        // Do NOT infer from resumeUploaded or user_type — those can be truthy
        // for users who never finished onboarding, causing AuthGuard to bypass
        // /onboarding and land the user in a broken dashboard state.
        const onboardingComplete =
          profile.onboardingCompleted  === true ||
          profile.onboarding_completed === true;

        const resumeUploaded = profile.resumeUploaded || profile.resume?.uploaded || false;
        const latestResume   = profile.resume || {};

        console.log('[userStore] 💧 hydrateFromProfile:', {
          userId:            profile.id || profile.uid,
          onboardingComplete,
          resumeUploaded,
          userType:          profile.user_type ?? null,
        });

        set({
          userId:      profile.id      || profile.uid || null,
          userType:    profile.user_type               || null,
          displayName: profile.displayName || profile.name || null,
          email:       profile.email                   || null,
          onboardingComplete,
          careerGoal:  profile.careerGoal              || null,
          resume: {
            resumeId:   latestResume.resumeId || profile.latestResumeId || null,
            fileName:   latestResume.fileName || null,
            status:     resumeUploaded ? 'uploaded' : 'none',
            score:      profile.resumeScore   || null,
            roleFit:    profile.detectedProfession || profile.currentJobTitle || null,
            uploadedAt: latestResume.uploadedAt || null,
            pollJobId:  null,
          },
        });
      },

      /**
       * reset()
       *
       * Called by AuthProvider on sign-out BEFORE clearing auth state.
       * Wipes all persisted data so the next session in this tab starts clean.
       */
      reset: () => {
        console.log('[userStore] 🧹 reset() called — clearing all persisted state');
        set(INITIAL_STATE);
      },
    }),
    {
      name:    'hirerise-user',
      storage: createJSONStorage(() => sessionStorage),
      partialize: (state) => ({
        // Persist only display fields + resume status — never routing-sensitive state.
        // Routing always comes from the server via AuthContext.
        userId:             state.userId,
        userType:           state.userType,
        displayName:        state.displayName,
        onboardingComplete: state.onboardingComplete,
        careerGoal:         state.careerGoal,
        resume: {
          resumeId:   state.resume.resumeId,
          fileName:   state.resume.fileName,
          status:     state.resume.status,
          score:      state.resume.score,
          roleFit:    state.resume.roleFit,
          uploadedAt: state.resume.uploadedAt,
          pollJobId:  null,
        },
      }),
    }
  )
);

// ─── Convenience selectors ────────────────────────────────────────────────────

/** True if a resume has been uploaded (any status except 'none') */
export const selectHasResume = (s: UserStoreState) => s.resume.status !== 'none';

/** True if resume has been fully scored */
export const selectIsScored  = (s: UserStoreState) => s.resume.status === 'scored';

/** Resume score, or null if not yet scored */
export const selectScore     = (s: UserStoreState) => s.resume.score;

/**
 * selectNeedsOnboarding
 *
 * FOR UI DISPLAY ONLY (e.g. showing a "complete your profile" banner).
 * Do NOT use this for route guards — use AuthContext.user.onboardingCompleted.
 */
export const selectNeedsOnboarding = (s: UserStoreState) =>
  !s.userType || !s.onboardingComplete;