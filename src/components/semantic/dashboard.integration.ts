/**
 * dashboard.integration.ts
 *
 * DASHBOARD INTEGRATION GUIDE — Semantic AI Upgrade
 *
 * This file documents the exact lines to add/change in existing dashboard
 * pages to wire in the 4 new semantic upgrade components.
 * It is NOT a runnable file — treat it as annotated patch instructions.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * PAGE 1: /skill-graph  (frond/src/app/(dashboard)/skill-graph/page.tsx)
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * WHAT TO ADD:
 *   1. Semantic AI-related skills panel (Upgrade 1)
 *   2. Learning paths for missing high-demand skills (Upgrade 4)
 *
 * ADD THESE IMPORTS at the top of skill-graph/page.tsx:
 */

// import { SemanticSkillPanel } from '@/components/semantic/SemanticSkillCard';
// import { LearningPathsPanel } from '@/components/semantic/LearningPathCard';

/*
 * IN THE COMPONENT BODY — after existing skill cards, add:
 *
 * const { data: skillGap } = useSkillGap();
 * const missingSkills = skillGap?.missing_high_demand?.map(s =>
 *   typeof s === 'string' ? s : s.name
 * ) ?? [];
 *
 * IN THE JSX — inside the main grid, after the last SectionCard:
 *
 * {skillGap?.existing_skills && skillGap.existing_skills.length > 0 && (
 *   <div className="col-span-full">
 *     <SemanticSkillPanel
 *       existingSkills={skillGap.existing_skills}
 *       maxSeeds={3}
 *     />
 *   </div>
 * )}
 *
 * {missingSkills.length > 0 && (
 *   <div className="col-span-full">
 *     <LearningPathsPanel
 *       skills={missingSkills}
 *       targetRole={skillGap?.target_role ?? undefined}
 *     />
 *   </div>
 * )}
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * PAGE 2: /job-matches  (frond/src/app/(dashboard)/job-matches/page.tsx)
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * WHAT TO ADD:
 *   Semantic job match panel (Upgrade 2) — either as a tab or a second panel
 *
 * ADD IMPORT:
 */

// import { SemanticJobMatchPanel } from '@/components/semantic/SemanticJobMatchCard';

/*
 * IN THE JSX — render it as a new section below existing job cards.
 * Recommended: use a tab toggle between "Standard" and "AI Semantic" views.
 *
 * SIMPLE DROP-IN (no tabs needed):
 *
 * <div className="mt-6">
 *   <SemanticJobMatchPanel limit={10} minScore={30} />
 * </div>
 *
 * WITH TABS (recommended UX):
 *
 * const [view, setView] = useState<'standard' | 'semantic'>('standard');
 *
 * <div className="flex gap-2 mb-4">
 *   <button
 *     onClick={() => setView('standard')}
 *     className={cn('tab-button', view === 'standard' && 'active')}
 *   >
 *     Standard Match
 *   </button>
 *   <button
 *     onClick={() => setView('semantic')}
 *     className={cn('tab-button', view === 'semantic' && 'active')}
 *   >
 *     ✦ AI Semantic Match
 *   </button>
 * </div>
 *
 * {view === 'standard'  && <StandardJobList />}
 * {view === 'semantic'  && <SemanticJobMatchPanel />}
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * PAGE 3: /career-health  (frond/src/app/(dashboard)/career-health/page.tsx)
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * WHAT TO ADD:
 *   AI Career Insights card (Upgrade 3)
 *
 * ADD IMPORT:
 */

// import { CareerAdviceCard } from '@/components/semantic/CareerAdviceCard';

/*
 * IN THE JSX — as the first or last card in the grid:
 *
 * <CareerAdviceCard className="col-span-full lg:col-span-2" />
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * PAGE 4: /dashboard  (frond/src/app/(dashboard)/dashboard/page.tsx)
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * WHAT TO ADD:
 *   Quick AI insight summary — show the career_insight and key_opportunity
 *
 * ADD IMPORT:
 */

// import { CareerAdviceCard } from '@/components/semantic/CareerAdviceCard';

/*
 * IN THE JSX — alongside ChiOverview or as a featured card:
 *
 * <CareerAdviceCard className="mt-4" />
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * COMPONENT DIRECTORY
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Copy new component files into:
 *   frond/src/components/semantic/
 *     ├── SemanticSkillCard.tsx       (Upgrade 1)
 *     ├── SemanticJobMatchCard.tsx    (Upgrade 2)
 *     ├── CareerAdviceCard.tsx        (Upgrade 3)
 *     └── LearningPathCard.tsx        (Upgrade 4)
 *
 * Copy new hook file into:
 *   frond/src/hooks/useSemanticSkills.ts
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ENVIRONMENT VARIABLES TO ADD
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Backend (.env):
 *   OPENAI_API_KEY=sk-...
 *   FEATURE_SEMANTIC_MATCHING=true
 *
 * Frontend (.env.local):
 *   # No additions needed — uses existing NEXT_PUBLIC_API_BASE_URL
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * SERVER.JS REGISTRATION (ONE LINE)
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * In core/src/server.js, after the last existing route registration,
 * add this single line:
 *
 *   app.use('/api/v1', require('./routes/semantic.routes'));
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * SKILL GRAPH SEMANTIC PATCH (OPTIONAL)
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * In core/src/modules/jobSeeker/skillGraphEngine.service.js,
 * at the very BOTTOM of the file (after module.exports = {...}):
 *
 *   if (process.env.FEATURE_SEMANTIC_MATCHING === 'true') {
 *     require('./skillGraphEngine.semantic.patch').apply(module.exports);
 *   }
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * PACKAGE DEPENDENCIES (backend)
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * The only new runtime dependency is the OpenAI SDK.
 * Supabase pgvector extension must be enabled on the Supabase project.
 *
 *   npm install openai
 *
 * Then run the migration:
 *   psql $DATABASE_URL -f migrations/001_semantic_ai_upgrade.sql
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * FEATURE FLAG ROLLOUT SEQUENCE
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Step 1:  Deploy backend with FEATURE_SEMANTIC_MATCHING=false
 *          (safe — new routes exist but semantic enrichment is off)
 * Step 2:  Run migration SQL
 * Step 3:  Warm embeddings: POST /api/v1/skills/embed with bulk skills list
 * Step 4:  Set FEATURE_SEMANTIC_MATCHING=true, restart backend
 * Step 5:  Deploy frontend with new components
 * Step 6:  Monitor: Redis cache hit rate, OpenAI token usage, match score uplift
 */

export {};