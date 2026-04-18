/**
 * dashboard.integration.ts — Multi-Agent Copilot Integration Guide
 *
 * Exact wiring instructions to integrate the multi-agent system into
 * the existing HireRise dashboard and server.js.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * FOLDER STRUCTURE
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * src/modules/career-copilot/
 *   agents/
 *     baseAgent.js                  ← abstract base class
 *     skillIntelligenceAgent.js     ← SkillGraphEngine + SemanticSkillEngine
 *     jobMatchingAgent.js           ← JobMatchingEngine + SemanticJobMatchingEngine
 *     marketIntelligenceAgent.js    ← LaborMarketIntelligenceEngine
 *     riskAndRadarAgents.js         ← CareerRiskAgent + OpportunityRadarAgent
 *     careerAdvisorAgent.js         ← LLM synthesis of all outputs
 *   coordinator/
 *     careerAgentCoordinator.js     ← intent routing + parallel dispatch
 *   routes/
 *     agentCoordinator.routes.js    ← all 5 API endpoints
 *
 * src/components/copilot/
 *   AgentCopilot.tsx                ← AgentCopilotChat + AgentAnalysisPanel
 *
 * core/src/migration/
 *   006_multi_agent_system.sql      ← agent_responses + agent_sessions tables
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * STEP 1 — Run migration
 * ─────────────────────────────────────────────────────────────────────────────
 *
 *   psql $DATABASE_URL -f core/src/migration/006_multi_agent_system.sql
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * STEP 2 — Register routes in server.js
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Find the existing copilot route registration in server.js:
 *
 *   app.use(`${API_PREFIX}/copilot`, authenticate,
 *     require('./modules/career-copilot/routes/careerCopilot.routes'));
 *
 * ADD the agent routes on the SAME prefix (additive — does not replace existing):
 *
 *   // ── Multi-Agent Career Copilot ────────────────────────────────────────
 *   // POST /api/v1/copilot/agent/ask          — question-driven routing
 *   // POST /api/v1/copilot/agent/analyze      — full analysis (all agents)
 *   // GET  /api/v1/copilot/agent/status       — agent registry
 *   // POST /api/v1/copilot/agent/cache/clear  — cache invalidation
 *   // GET  /api/v1/copilot/agent/history      — session history
 *   app.use(`${API_PREFIX}/copilot`, authenticate,
 *     require('./modules/career-copilot/routes/agentCoordinator.routes'));
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * STEP 3 — Invalidate agent cache on CV upload
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * In src/modules/resume/resume.service.js (or resume.controller.js),
 * after a successful CV parse:
 *
 *   const { invalidateUserCache } = require('../career-copilot/coordinator/careerAgentCoordinator');
 *   invalidateUserCache(userId).catch(() => {}); // fire and forget
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * STEP 4 — Dashboard: add AgentAnalysisPanel
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * In src/app/(dashboard)/dashboard/page.tsx:
 *
 *   import { AgentAnalysisPanel } from '@/components/copilot/AgentCopilot';
 *
 *   // Add below the existing career health card:
 *   <AgentAnalysisPanel className="col-span-full" />
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * STEP 5 — Copilot page: replace or extend with AgentCopilotChat
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * In src/app/(dashboard)/copilot/page.tsx:
 *
 *   import { AgentCopilotChat } from '@/components/copilot/AgentCopilot';
 *
 *   export default function CopilotPage() {
 *     return (
 *       <div className="max-w-2xl mx-auto py-6 px-4">
 *         <AgentCopilotChat className="h-[600px]" />
 *       </div>
 *     );
 *   }
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * STEP 6 — Trigger agent cache clear from existing pages
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * After CV upload completes, call from the frontend:
 *
 *   await fetch('/api/v1/copilot/agent/cache/clear', { method: 'POST',
 *     headers: { Authorization: `Bearer ${token}` } });
 *
 * Or use the existing useTrackBehaviorEvent pattern:
 *   const clear = () => apiFetch('/copilot/agent/cache/clear', { method: 'POST' });
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * BACKWARD COMPATIBILITY
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * All existing endpoints remain untouched:
 *   POST /api/v1/copilot/chat          ← RAG grounded chat (unchanged)
 *   GET  /api/v1/copilot/welcome       ← (unchanged)
 *   GET  /api/v1/copilot/history/:id   ← (unchanged)
 *   GET  /api/v1/copilot/context       ← (unchanged)
 *
 * The multi-agent endpoints are NEW, additive routes on the same prefix:
 *   POST /api/v1/copilot/agent/ask
 *   POST /api/v1/copilot/agent/analyze
 *   GET  /api/v1/copilot/agent/status
 *   POST /api/v1/copilot/agent/cache/clear
 *   GET  /api/v1/copilot/agent/history
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ENV VARIABLES — no new variables required
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * The multi-agent system uses the same env vars already configured:
 *   SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY   ← already set
 *   CACHE_PROVIDER + REDIS_*                   ← already set
 *   ANTHROPIC_MODEL (or default)               ← already set
 *   FEATURE_SEMANTIC_MATCHING=true             ← optional, enables semantic agents
 */

export {};
