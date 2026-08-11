/**
 * components/onboarding/OnboardingEscapeHatch.tsx
 *
 * TEMPORARY WORKAROUND
 * WP-AV-02E
 *
 * Remove after the Direction Resume Defect has been fully resolved
 * and certified.
 *
 * WP-AV-02EA — Temporary Onboarding Navigation Controls
 *
 * PURPOSE:
 *   Gives users mid-onboarding (Professional or Student, before the
 *   Dashboard is reached) a persistent, always-visible escape path:
 *   "Change Direction" and "Logout".
 *
 * THIS COMPONENT DOES NOT:
 *   - Implement direction switching — it calls the existing
 *     useOnboardingDirectionSwitch() hook (hooks/onboarding).
 *   - Implement logout — it calls the existing useLogout() hook
 *     (hooks/useLogout.ts).
 *   - Introduce any new route, guard, or business logic.
 *   - Render on completed-onboarding sessions (see completion guard below),
 *     matching the guard already enforced inside useOnboardingDirectionSwitch.
 *
 * PLACEMENT:
 *   Mounted once, in layouts/OnboardingLayout.tsx, which already wraps
 *   every /onboarding/* route (Professional welcome/profile/guided-builder,
 *   Student profile/build steps, and the career sub-flow) for both flows.
 *   This is the single shared insertion point — no per-page wiring needed.
 *
 * REMOVAL:
 *   Delete this file and remove the single <OnboardingEscapeHatch /> usage
 *   from OnboardingLayout.tsx. No other files reference it.
 */

import { useAppContext } from '@/context/AppContext';
import { useOnboardingDirectionSwitch } from '@/hooks/onboarding/useOnboardingDirectionSwitch';
import { useLogout } from '@/hooks/useLogout';
import { Button } from '@/components/ui/Button';

export function OnboardingEscapeHatch() {
  const { user } = useAppContext();
  const { switchDirection, isSwitching } = useOnboardingDirectionSwitch();
  const logout = useLogout();

  // Same completion guard useOnboardingDirectionSwitch enforces internally —
  // once onboarding is complete, this temporary control has no reason to render.
  const onboardingComplete =
    user?.onboarding_completed ||
    user?.student_onboarding_complete ||
    user?.professional_onboarding_complete;

  if (onboardingComplete) return null;

  return (
    <div className="sticky bottom-0 left-0 right-0 z-40 border-t border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="mx-auto flex max-w-2xl flex-col items-center gap-2 px-4 py-3 sm:flex-row sm:justify-between">
        <span className="text-xs text-muted-foreground">Need something else?</span>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void switchDirection()}
            isLoading={isSwitching}
          >
            Change Direction
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => void logout()}
          >
            Logout
          </Button>
        </div>
      </div>
    </div>
  );
}
