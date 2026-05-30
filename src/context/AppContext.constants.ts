/**
 * src/context/AppContext.constants.ts
 *
 * Flow ID constants for AppContext.
 * Extracted from AppContext.tsx for Vite Fast Refresh compatibility.
 */

/**
 * Canonical flow identifiers for setFlowId().
 * These map to the funnel names in analytics.ts FUNNELS constants.
 *
 * @example
 * const { setFlowId } = useAppContext();
 * useEffect(() => { setFlowId(FLOW_IDS.ONBOARDING_PROFESSIONAL); }, []);
 */
export const FLOW_IDS = {
  ONBOARDING_PROFESSIONAL: 'onboarding_professional',
  ONBOARDING_STUDENT:      'onboarding_student',
  RESUME_UPLOAD:           'resume_upload',
  DIRECTION_SELECTION:     'direction_selection',
  DASHBOARD:               'dashboard',
} as const;

export type FlowId = typeof FLOW_IDS[keyof typeof FLOW_IDS];