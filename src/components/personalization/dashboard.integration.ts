'use client';

/**
 * dashboard.integration.ts — Personalization Engine Integration Guide
 *
 * This file documents exactly how to wire the personalization engine
 * into the existing dashboard modules. It is NOT runnable — treat it
 * as annotated patch instructions.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * OVERVIEW: How personalization enhances existing modules
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * The AI Personalization Engine sits ALONGSIDE existing engines. It does
 * two things per dashboard module:
 *
 *   1. TRACKS behavior: When a user clicks a job, views a skill, or explores
 *      a career path, a behavior event is fired via trackEvent().
 *
 *   2. BOOSTS results: Existing results (job matches, opportunities) are
 *      re-ordered based on the user's behavior profile. This is additive —
 *      it never removes items, only reorders them.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * MODULE 1: Job Matches (/job-matches)
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * ADD IMPORTS at top of job-matches/page.tsx:
 */

// import { useTrackBehaviorEvent, PersonalizationSignalBadge } from '@/hooks/usePersonalization';
// import { PersonalizationSignalBadge } from '@/components/personalization/PersonalizedRecommendations';

/*
 * IN COMPONENT BODY:
 *   const { trackEvent } = useTrackBehaviorEvent();
 *
 * ON JOB CARD CLICK — add to onClick handler of each job card:
 *   trackEvent({
 *     event_type:   'job_click',
 *     entity_type:  'role',
 *     entity_id:    job.id,
 *     entity_label: job.title,
 *     metadata:     { match_score: job.match_score, source: 'job_matches_page' },
 *   });
 *
 * ON JOB APPLY CLICK — add to Apply button handler:
 *   trackEvent({
 *     event_type:   'job_apply',
 *     entity_type:  'role',
 *     entity_id:    job.id,
 *     entity_label: job.title,
 *     metadata:     { company: job.company },
 *   });
 *
 * IN JSX — add signal badge at top of the page, before the job list:
 *   <PersonalizationSignalBadge className="mb-3" />
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * MODULE 2: Opportunity Radar (/opportunity-radar)
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * ON OPPORTUNITY CLICK:
 *   trackEvent({
 *     event_type:   'opportunity_click',
 *     entity_type:  'opportunity',
 *     entity_id:    opp.role.toLowerCase().replace(/\s+/g, '_'),
 *     entity_label: opp.role,
 *     metadata:     { opportunity_score: opp.opportunity_score, industry: opp.industry },
 *   });
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * MODULE 3: Skill Graph (/skill-graph)
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * ON SKILL PILL CLICK:
 *   trackEvent({
 *     event_type:   'skill_view',
 *     entity_type:  'skill',
 *     entity_id:    skillName.toLowerCase(),
 *     entity_label: skillName,
 *   });
 *
 * ON LEARNING PATH CARD EXPAND:
 *   trackEvent({
 *     event_type:   'learning_path_start',
 *     entity_type:  'skill',
 *     entity_id:    skill.toLowerCase(),
 *     entity_label: skill,
 *   });
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * MODULE 4: Career Advice Card
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * WHEN ADVICE IS READ (on component mount or scroll into view):
 *   trackEvent({
 *     event_type: 'advice_read',
 *     entity_type: 'module',
 *     entity_id:   'career_advice',
 *   });
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * MODULE 5: Dashboard page (/dashboard)
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * ADD PERSONALIZED PANEL to main dashboard:
 *
 *   import { PersonalizedRecommendationsPanel } from
 *     '@/components/personalization/PersonalizedRecommendations';
 *
 *   // In JSX, as a featured section:
 *   <PersonalizedRecommendationsPanel topN={5} className="col-span-full" />
 *
 * TRACK MODULE USAGE — fire when user scrolls to / interacts with any module:
 *   trackEvent({
 *     event_type:  'dashboard_module_usage',
 *     entity_type: 'module',
 *     entity_id:   'job_matches',   // or 'skill_graph', 'opportunity_radar', etc.
 *   });
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * NEW PAGE: /personalized-careers
 * ─────────────────────────────────────────────────────────────────────────────
 *
 *   // frond/src/app/(dashboard)/personalized-careers/page.tsx
 *   import { PersonalizedRecommendationsPanel } from
 *     '@/components/personalization/PersonalizedRecommendations';
 *
 *   export default function PersonalizedCareersPage() {
 *     return (
 *       <div className="max-w-2xl mx-auto py-6 px-4">
 *         <PersonalizedRecommendationsPanel topN={10} />
 *       </div>
 *     );
 *   }
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * COMPONENT FILE LOCATIONS
 * ─────────────────────────────────────────────────────────────────────────────
 *
 *   src/hooks/usePersonalization.ts                           ← hooks
 *   src/components/personalization/PersonalizedRecommendations.tsx ← UI
 *   src/app/(dashboard)/personalized-careers/page.tsx        ← new page (optional)
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * SERVER.JS REGISTRATION — TWO LINES
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * In core/src/server.js, after existing route registrations, add:
 *
 *   app.use(API_PREFIX, authenticate,
 *     require('./modules/personalization/personalization.routes'));
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * SIDEBAR NAVIGATION
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * In frond/src/components/layout/Sidebar.tsx, add after job-matches entry:
 *
 *   { href: '/personalized-careers', label: 'For You', icon: <SparklesIcon /> }
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ENV VARIABLES — No new variables needed
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * The personalization engine uses:
 *   - SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY  (already set)
 *   - CACHE_PROVIDER=redis + REDIS_*            (already set)
 *   - Firebase config                           (already set)
 *
 * No new environment variables required.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * PRIVACY NOTES
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * - user_behavior_events stores event_type, entity_id, and metadata only
 * - No PII is stored in behavior events beyond userId
 * - Aggregated signals (preferred_roles, preferred_skills) are normalized scores
 * - Raw event sequences are never surfaced to the user
 * - RLS ensures users can only read/write their own rows
 * - Events older than 30 days are excluded from profile analysis (ANALYSIS_WINDOW_DAYS)
 * - Consider adding a pg_cron job to DELETE FROM user_behavior_events
 *   WHERE timestamp < NOW() - INTERVAL '90 days' for data retention
 */

export {};
