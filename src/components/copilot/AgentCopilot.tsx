'use client';

/**
 * AgentCopilot.tsx — Multi-Agent Copilot UI Components
 *
 * Exports:
 *   useAgentAsk      — hook: POST /copilot/agent/ask
 *   useAgentAnalyze  — hook: POST /copilot/agent/analyze
 *   AgentCopilotChat — chat interface with agent badge attribution
 *   AgentAnalysisPanel — structured full-analysis display
 *
 * Dashboard integration:
 *   /copilot page  → <AgentCopilotChat />
 *   /dashboard     → <AgentAnalysisPanel /> (compact summary)
 *
 * File: src/components/copilot/AgentCopilot.tsx
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/services/apiClient';
import { cn } from '@/utils/cn';

// ─── Types ────────────────────────────────────────────────────────────────────

interface JobMatch {
  title:          string;
  match_score:    number;
  missing_skills: string[];
  salary:         { min?: number; max?: number } | null;
}

interface Opportunity {
  role:         string;
  growth_score: number;
  match_score:  number | null;
  growth_trend: string | null;
  salary:       string | null;
}

interface AgentResponse {
  session_id:        string;
  intent_detected:   string;
  agents_used:       string[];
  agent_errors:      Array<{ agent: string; error: string }>;
  skills_to_learn:   string[];
  adjacent_skills:   string[];
  job_matches:       JobMatch[];
  career_risk:       string | null;
  risk_score:        number | null;
  opportunities:     Opportunity[];
  trending_skills:   Array<{ skill: string; demand_score: number }>;
  ai_recommendation: string;
  confidence:        number;
  data_completeness: number;
  duration_ms:       number;
  _cached?:          boolean;
}

// ─── Hooks ────────────────────────────────────────────────────────────────────

export function useAgentAsk() {
  return useMutation({
    mutationFn: (payload: { message: string; session_id?: string; force_refresh?: boolean }) =>
      apiFetch<AgentResponse>('/copilot/agent/ask', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(payload),
      }),
  });
}

export function useAgentAnalyze(opts: { force_refresh?: boolean } = {}) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () =>
      apiFetch<AgentResponse>('/copilot/agent/analyze', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ force_refresh: opts.force_refresh ?? false }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['agent', 'history'] });
    },
  });
}

// ─── Agent badge helpers ──────────────────────────────────────────────────────

const AGENT_STYLE: Record<string, string> = {
  SkillIntelligenceAgent:  'bg-blue-50   border-blue-200   text-blue-700',
  JobMatchingAgent:        'bg-emerald-50 border-emerald-200 text-emerald-700',
  MarketIntelligenceAgent: 'bg-amber-50  border-amber-200  text-amber-700',
  CareerRiskAgent:         'bg-rose-50   border-rose-200   text-rose-700',
  OpportunityRadarAgent:   'bg-violet-50 border-violet-200 text-violet-700',
  CareerAdvisorAgent:      'bg-indigo-50 border-indigo-200 text-indigo-700',
};

const AGENT_SHORT: Record<string, string> = {
  SkillIntelligenceAgent:  'Skills',
  JobMatchingAgent:        'Jobs',
  MarketIntelligenceAgent: 'Market',
  CareerRiskAgent:         'Risk',
  OpportunityRadarAgent:   'Radar',
  CareerAdvisorAgent:      'Advisor',
};

function AgentBadge({ name }: { name: string }) {
  return (
    <span className={cn('inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold', AGENT_STYLE[name] || 'bg-surface-50 border-surface-200 text-surface-600')}>
      {AGENT_SHORT[name] || name}
    </span>
  );
}

const RISK_STYLE: Record<string, string> = {
  Low:      'bg-emerald-50 border-emerald-200 text-emerald-700',
  Moderate: 'bg-amber-50   border-amber-200   text-amber-700',
  High:     'bg-rose-50    border-rose-200    text-rose-700',
  Critical: 'bg-rose-100   border-rose-300    text-rose-800',
};

// ─── Section card ─────────────────────────────────────────────────────────────

function Section({ title, bar, children }: {
  title: string; bar: string; children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-surface-100 bg-white shadow-sm overflow-hidden">
      <div className={cn('h-0.5', bar)} />
      <div className="p-3.5">
        <p className="mb-2.5 text-[10px] font-bold uppercase tracking-wide text-surface-500">{title}</p>
        {children}
      </div>
    </div>
  );
}

// ─── Loading skeleton ─────────────────────────────────────────────────────────

function Skeleton() {
  return (
    <div className="space-y-3">
      {[...Array(3)].map((_, i) => (
        <div key={i} className="rounded-xl border border-surface-100 bg-white p-4 animate-pulse">
          <div className="mb-2 h-3 w-24 rounded bg-surface-100" />
          <div className="space-y-1.5">
            <div className="h-3 w-full rounded bg-surface-100" />
            <div className="h-3 w-3/4 rounded bg-surface-100" />
          </div>
        </div>
      ))}
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// AgentAnalysisPanel — structured full-analysis card
// ═════════════════════════════════════════════════════════════════════════════

export function AgentAnalysisPanel({ className }: { className?: string }) {
  const { mutate, isPending, data, error } = useAgentAnalyze();

  return (
    <div className={cn('space-y-3', className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-600">
            <svg className="h-4.5 w-4.5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="3"/>
              <path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83"/>
            </svg>
          </div>
          <div>
            <p className="text-sm font-bold text-surface-900">Multi-Agent Analysis</p>
            <p className="text-[10px] text-surface-400 uppercase tracking-wide">6 Specialist AI Agents</p>
          </div>
        </div>
        <button
          onClick={() => mutate()}
          disabled={isPending}
          className="flex items-center gap-1.5 rounded-xl bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-50 transition-colors"
        >
          {isPending
            ? <><div className="h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" />Running…</>
            : 'Run Analysis'}
        </button>
      </div>

      {isPending && <Skeleton />}
      {error && <p className="rounded-xl border border-rose-100 bg-rose-50 p-3 text-xs text-rose-600">Analysis failed — please try again.</p>}

      {data && (
        <>
          {/* Agents row */}
          <div className="flex flex-wrap gap-1">
            {data.agents_used.map((a: string) => <AgentBadge key={a} name={a} />)}
            <span className="ml-auto text-[10px] text-surface-400 self-center">{Math.round(data.confidence * 100)}% confidence · {data.duration_ms}ms</span>
          </div>

          {/* AI Recommendation */}
          {data.ai_recommendation && (
            <div className="rounded-xl border border-indigo-100 bg-indigo-50 p-3.5">
              <p className="mb-1 text-[10px] font-bold uppercase tracking-wide text-indigo-600">✦ AI Recommendation</p>
              <p className="text-sm leading-relaxed text-indigo-900">{data.ai_recommendation}</p>
            </div>
          )}

          {/* 2×2 grid */}
          <div className="grid grid-cols-2 gap-2.5">
            {data.skills_to_learn.length > 0 && (
              <Section title="Skills to Learn" bar="bg-gradient-to-r from-blue-400 to-cyan-400">
                <div className="flex flex-wrap gap-1">
                  {data.skills_to_learn.slice(0, 5).map((s: string) => (
                    <span key={s} className="rounded-full border border-blue-100 bg-blue-50 px-2 py-0.5 text-[11px] font-medium text-blue-700">+ {s}</span>
                  ))}
                </div>
              </Section>
            )}

            {data.job_matches.length > 0 && (
              <Section title="Job Matches" bar="bg-gradient-to-r from-emerald-400 to-teal-400">
                <div className="space-y-1.5">
                  {data.job_matches.slice(0, 3).map((j: JobMatch, i: number) => (
                    <div key={i} className="flex items-center justify-between">
                      <span className="text-xs text-surface-700 truncate">{j.title}</span>
                      <span className={cn('ml-2 text-xs font-bold shrink-0', j.match_score >= 70 ? 'text-emerald-600' : j.match_score >= 50 ? 'text-amber-600' : 'text-surface-400')}>
                        {j.match_score}%
                      </span>
                    </div>
                  ))}
                </div>
              </Section>
            )}

            {data.career_risk && (
              <Section title="Career Risk" bar="bg-gradient-to-r from-rose-400 to-orange-400">
                <span className={cn('rounded-full border px-2.5 py-1 text-xs font-semibold', RISK_STYLE[data.career_risk] || RISK_STYLE.Moderate)}>
                  {data.career_risk} {data.risk_score !== null ? `· ${data.risk_score}/100` : ''}
                </span>
              </Section>
            )}

            {data.opportunities.length > 0 && (
              <Section title="Opportunities" bar="bg-gradient-to-r from-violet-400 to-purple-400">
                <div className="space-y-1.5">
                  {data.opportunities.slice(0, 3).map((o: Opportunity, i: number) => (
                    <div key={i} className="flex items-center justify-between">
                      <span className="text-xs text-surface-700 truncate">{o.role}</span>
                      <div className="ml-2 flex items-center gap-1 shrink-0">
                        {o.salary && <span className="text-[10px] font-semibold text-emerald-600">{o.salary}</span>}
                        <span className="text-xs font-bold text-violet-600">{o.growth_score}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </Section>
            )}
          </div>

          {data._cached && <p className="text-right text-[10px] text-surface-300">Cached · intent: {data.intent_detected}</p>}
        </>
      )}
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// AgentCopilotChat — question-driven chat interface
// ═════════════════════════════════════════════════════════════════════════════

interface Message {
  role:      'user' | 'agent';
  content:   string;
  result?:   AgentResponse;
  timestamp: Date;
}

export function AgentCopilotChat({ className }: { className?: string }) {
  const [messages,       setMessages]       = useState<Message[]>([]);
  const [input,          setInput]          = useState('');
  const [sessionId,      setSessionId]      = useState<string | null>(null);
  const [showSuggestions, setShowSuggestions] = useState(true);
  const bottomRef  = useRef<HTMLDivElement>(null);
  const { mutate: ask, isPending } = useAgentAsk();

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const send = useCallback((text: string) => {
    const msg = text.trim();
    if (!msg || isPending) return;

    setInput('');
    setShowSuggestions(false);
    setMessages(prev => [...prev, { role: 'user', content: msg, timestamp: new Date() }]);

    ask({ message: msg, session_id: sessionId || undefined }, {
      onSuccess: (data) => {
        if (data?.session_id && !sessionId) setSessionId(data.session_id);
        setMessages(prev => [...prev, {
          role:      'agent',
          content:   data?.ai_recommendation || 'Analysis complete.',
          result:    data,
          timestamp: new Date(),
        }]);
      },
      onError: () => {
        setMessages(prev => [...prev, {
          role: 'agent', content: 'Something went wrong. Please try again.', timestamp: new Date(),
        }]);
      },
    });
  }, [input, isPending, ask, sessionId]);

  const SUGGESTIONS = [
    'What skills should I learn next?',
    'Which jobs match my profile?',
    'What is my career risk?',
    'Show me emerging opportunities',
    'What salary can I expect?',
  ];

  return (
    <div className={cn('flex flex-col overflow-hidden rounded-2xl border border-surface-100 bg-white shadow-sm', className)} style={{ height: 580 }}>
      {/* Header */}
      <div className="flex shrink-0 items-center gap-3 border-b border-surface-100 bg-gradient-to-r from-indigo-50 to-violet-50 px-4 py-3">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-indigo-600">
          <svg className="h-4 w-4 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="3"/>
            <path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83"/>
          </svg>
        </div>
        <div>
          <p className="text-sm font-bold text-surface-900">Career Copilot</p>
          <p className="text-[10px] text-surface-400">Multi-Agent · 6 Specialist AIs</p>
        </div>
      </div>

      {/* Messages */}
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-3">
        {messages.length === 0 && showSuggestions && (
          <div className="space-y-1.5 pt-1">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-surface-400">Suggested</p>
            {SUGGESTIONS.map(s => (
              <button key={s} onClick={() => send(s)}
                className="block w-full rounded-xl border border-indigo-100 bg-indigo-50 px-3 py-2 text-left text-xs text-indigo-600 transition-colors hover:bg-indigo-100">
                {s}
              </button>
            ))}
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className={cn('flex', msg.role === 'user' ? 'justify-end' : 'justify-start')}>
            <div className={cn('max-w-[85%] rounded-2xl px-4 py-3 text-sm',
              msg.role === 'user'
                ? 'rounded-br-sm bg-indigo-600 text-white'
                : 'rounded-bl-sm border border-surface-100 bg-white text-surface-800 shadow-sm'
            )}>
              <p className="leading-relaxed">{msg.content}</p>
              {msg.result && (
                <div className="mt-2 flex flex-wrap gap-1 border-t border-surface-100 pt-2">
                  {msg.result.agents_used.map(a => <AgentBadge key={a} name={a} />)}
                </div>
              )}
              <p className={cn('mt-1 text-[9px]', msg.role === 'user' ? 'text-right text-indigo-200' : 'text-surface-300')}>
                {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
          </div>
        ))}

        {isPending && (
          <div className="flex justify-start">
            <div className="rounded-2xl rounded-bl-sm border border-surface-100 bg-white px-4 py-3 shadow-sm">
              <div className="flex h-4 items-center gap-1">
                {[0,1,2].map(i => (
                  <div key={i} className="h-1.5 w-1.5 animate-bounce rounded-full bg-indigo-400"
                    style={{ animationDelay: `${i * 0.15}s` }} />
                ))}
              </div>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="shrink-0 border-t border-surface-100 px-4 py-3">
        <div className="flex gap-2">
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && send(input)}
            placeholder="Ask about your career, skills, or opportunities…"
            disabled={isPending}
            className="flex-1 rounded-xl border border-surface-200 bg-surface-50 px-3 py-2 text-sm placeholder-surface-400 transition-colors focus:border-indigo-400 focus:bg-white focus:outline-none"
          />
          <button
            onClick={() => send(input)}
            disabled={!input.trim() || isPending}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-600 text-white transition-colors hover:bg-indigo-700 disabled:opacity-40"
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="22" y1="2" x2="11" y2="13"/>
              <polygon points="22 2 15 22 11 13 2 9 22 2"/>
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}