/**
 * src/services/academicHooks.usage.ts
 *
 * USAGE EXAMPLES — Academic React Query Hook Layer
 * ─────────────────────────────────────────────────
 * This file documents how to integrate Phase 3 hooks into Phase 4 UI components.
 * It is NOT imported at runtime — it exists as a reference for contributors.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * 1. TAXONOMY — CASCADING SELECTORS
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * In a multi-step form where each selector depends on the previous:
 *
 *   import {
 *     useCountries,
 *     useRegions,
 *     useBoards,
 *     useStreams,
 *     useSubjects,
 *     useLanguages,
 *   } from '@/hooks';
 *
 *   function AcademicSetupStep() {
 *     const [countryCode, setCountryCode] = useState<string>();
 *     const [regionCode,  setRegionCode]  = useState<string>();
 *     const [boardCode,   setBoardCode]   = useState<string>();
 *     const [streamId,    setStreamId]    = useState<string>();
 *
 *     const { data: countries, isLoading: loadingCountries } = useCountries();
 *     const { data: regions,   isLoading: loadingRegions  }  = useRegions(countryCode);
 *     const { data: boards,    isLoading: loadingBoards   }  = useBoards(regionCode, countryCode);
 *     const { data: streams,   isLoading: loadingStreams  }  = useStreams(boardCode, countryCode);
 *     const { data: subjects,  isLoading: loadingSubjects }  = useSubjects(streamId);
 *     const { data: languages, isLoading: loadingLanguages } = useLanguages(regionCode, countryCode);
 *
 *     // Each hook is disabled until its dependency is set.
 *     // No manual enabled juggling needed in the component.
 *   }
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * 2. ONBOARDING PROFILE READ
 * ─────────────────────────────────────────────────────────────────────────────
 *
 *   import { useStudentAcademicProfile } from '@/hooks';
 *   import { useUser } from '@/context/AppContext'; // your auth context
 *
 *   function OnboardingShell() {
 *     const { user } = useUser();
 *     const {
 *       profile,
 *       isLoading,
 *       isOnboardingDone,
 *       isReady,
 *     } = useStudentAcademicProfile(user?.id);
 *
 *     if (isLoading) return <Spinner />;
 *     if (isOnboardingDone) return <Redirect to="/dashboard" />;
 *     return <OnboardingFlow profile={profile} />;
 *   }
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * 3. SAVE PROFILE MUTATION
 * ─────────────────────────────────────────────────────────────────────────────
 *
 *   import { useSaveAcademicProfile } from '@/hooks';
 *
 *   function ProfileStep({ userId }: { userId: string }) {
 *     const { mutate, isPending, isError, error } = useSaveAcademicProfile(userId);
 *
 *     function handleSubmit(formData: AcademicSetupFormData) {
 *       mutate({
 *         country_code: formData.country,
 *         region_code:  formData.region,
 *         board_code:   formData.board,
 *         stream_code:  formData.streamCode,
 *         stream_id:    formData.streamId,
 *         class_level:  formData.classLevel,
 *       });
 *     }
 *
 *     return (
 *       <form onSubmit={handleSubmit}>
 *         {isError && <ErrorBanner message={error?.message} />}
 *         <Button disabled={isPending} type="submit">
 *           {isPending ? 'Saving…' : 'Continue'}
 *         </Button>
 *       </form>
 *     );
 *   }
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * 4. SAVE SUBJECTS — OPTIMISTIC UPDATE
 * ─────────────────────────────────────────────────────────────────────────────
 *
 *   import { useSaveSubjects } from '@/hooks';
 *
 *   function SubjectSelectionStep({
 *     userId,
 *     availableSubjects,
 *   }: { userId: string; availableSubjects: StudentSubjectEntry[] }) {
 *
 *     const [selected, setSelected] = useState<string[]>([]);
 *     const { mutate, isPending } = useSaveSubjects(userId, availableSubjects);
 *
 *     // Optimistic update fires immediately in onMutate — UI reflects the
 *     // selection before the network call returns. If the server rejects,
 *     // the previous state is automatically restored.
 *     function handleSave() {
 *       mutate({ subject_ids: selected });
 *     }
 *   }
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * 5. COMPLETE ONBOARDING
 * ─────────────────────────────────────────────────────────────────────────────
 *
 *   import { useCompleteOnboarding } from '@/hooks';
 *
 *   function FinalStep({ userId }: { userId: string }) {
 *     const { mutate, isPending, isSuccess } = useCompleteOnboarding(userId);
 *
 *     // Replay-safe: if already completed the backend returns was_replay: true
 *     // and the cache is refreshed — router can redirect on isSuccess.
 *     useEffect(() => {
 *       if (isSuccess) router.push('/dashboard');
 *     }, [isSuccess]);
 *
 *     return <Button onClick={() => mutate()} disabled={isPending}>Finish</Button>;
 *   }
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * 6. LOGOUT — CLEAR ONBOARDING CACHE
 * ─────────────────────────────────────────────────────────────────────────────
 *
 *   import { createAcademicInvalidationService } from '@/hooks';
 *   import { useQueryClient } from '@tanstack/react-query';
 *
 *   function useLogout() {
 *     const queryClient = useQueryClient();
 *     const { user }    = useUser();
 *
 *     return async function logout() {
 *       const invalidate = createAcademicInvalidationService(queryClient);
 *       if (user?.id) invalidate.clearOnboardingCache(user.id);
 *       await supabase.auth.signOut();
 *     };
 *   }
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * 7. TELEMETRY — SWAP IN A REAL PROVIDER
 * ─────────────────────────────────────────────────────────────────────────────
 *
 *   import { setTelemetrySink } from '@/telemetry/academicTelemetry';
 *   import posthog from 'posthog-js';
 *
 *   // Call once at app startup, after user consent is obtained:
 *   setTelemetrySink({
 *     capture(event) {
 *       posthog.capture(event.event, {
 *         correlationId: event.correlationId,
 *         ...event,
 *       });
 *     },
 *   });
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * 8. PROVIDERS INTEGRATION
 * ─────────────────────────────────────────────────────────────────────────────
 *
 *   // In Providers.tsx — replace the manual new QueryClient({}) call:
 *   import { createAcademicQueryClient } from '@/services/academicQueryProvider';
 *
 *   const [queryClient] = useState(() => createAcademicQueryClient());
 *
 *   // The academic hooks will inherit the default retry predicate and gcTime.
 *   // Per-hook overrides (taxonomy: 30 min, onboarding: 0 min) still apply.
 */

export {};
