'use client';

/**
 * CareerCopilot.tsx — Grounded Career Copilot Chat Component
 *
 * Chat UI for the RAG-grounded Career Copilot.
 *
 * Features:
 *   - Shows data availability indicator (which engines have data)
 *   - Displays confidence score and source attribution per response
 *   - Shows "refused" state with actionable guidance when data is missing
 *   - Maintains conversation session across messages
 *   - Tracks behavior events for personalization engine
 *
 * Usage (new page at /copilot):
 *   import CareerCopilot from '@/components/copilot/CareerCopilot';
 *   export default function CopilotPage() { return <CareerCopilot />; }
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { apiFetch } from '@/services/apiClient';
import { cn } from '@/utils/cn';

// ─── Types ────────────────────────────────────────────────────────────────────

interface CopilotMessage {
  role:             'user' | 'assistant';
  content:          string;
  data_sources?:    string[];
  confidence?:      number;
  was_grounded?:    boolean;
  refused?:         boolean;
  signal_strength?: string;
  timestamp:        Date;
}

interface WelcomeData {
  message:                  string;
  user_name:                string | null;
  data_sources_available:   string[];
  data_completeness:        number;
}

interface ChatResponse {
  response:          string;
  data_sources:      string[];
  confidence:        number;
  data_completeness: number;
  signal_strength:   string;
  was_grounded:      boolean;
  refused:           boolean;
  conversation_id:   string;
}

// ─── Source badge ─────────────────────────────────────────────────────────────

const SOURCE_LABELS: Record<string, string> = {
  user_profile:            'Profile',
  chi_score:               'CHI',
  skill_gaps:              'Skills',
  job_matches:             'Jobs',
  opportunity_radar:       'Radar',
  risk_analysis:           'Risk',
  salary_benchmarks:       'Salary',
  personalization_profile: 'Interests',
};

function SourceBadge({ source }: { source: string }) {
  return (
    <span className="rounded-full bg-violet-50 border border-violet-200 px-2 py-0.5 text-[10px] font-semibold text-violet-700">
      {SOURCE_LABELS[source] || source}
    </span>
  );
}

// ─── Confidence indicator ─────────────────────────────────────────────────────

function ConfidenceBar({ confidence }: { confidence: number }) {
  const pct   = Math.round(confidence * 100);
  const color = pct >= 70 ? 'bg-emerald-400' : pct >= 40 ? 'bg-amber-400' : 'bg-rose-400';
  return (
    <div className="flex items-center gap-1.5">
      <div className="w-16 h-1 rounded-full bg-surface-100 overflow-hidden">
        <div className={cn('h-full rounded-full', color)} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-[10px] text-surface-400">{pct}%</span>
    </div>
  );
}

// ─── Data availability panel ──────────────────────────────────────────────────

function DataAvailabilityPanel({ sources, completeness }: {
  sources:      string[];
  completeness: number;
}) {
  const allSources = Object.keys(SOURCE_LABELS);
  const pct        = Math.round(completeness * 100);

  return (
    <div className="rounded-xl border border-surface-100 bg-surface-50 p-3 mb-3">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] font-semibold text-surface-500 uppercase tracking-wide">
          Platform Data Available
        </span>
        <span className={cn(
          'text-[11px] font-semibold',
          pct >= 60 ? 'text-emerald-600' : pct >= 30 ? 'text-amber-600' : 'text-rose-500'
        )}>{pct}% complete</span>
      </div>
      <div className="flex flex-wrap gap-1">
        {allSources.map(src => (
          <span key={src} className={cn(
            'rounded-full px-2 py-0.5 text-[10px] border font-medium',
            sources.includes(src)
              ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
              : 'bg-surface-100 border-surface-200 text-surface-400 line-through'
          )}>
            {SOURCE_LABELS[src]}
          </span>
        ))}
      </div>
    </div>
  );
}

// ─── Message bubble ───────────────────────────────────────────────────────────

function MessageBubble({ msg }: { msg: CopilotMessage }) {
  const isUser = msg.role === 'user';

  return (
    <div className={cn('flex', isUser ? 'justify-end' : 'justify-start')}>
      <div className={cn(
        'max-w-[85%] rounded-2xl px-4 py-3 text-sm',
        isUser
          ? 'bg-violet-600 text-white rounded-br-sm'
          : msg.refused
            ? 'bg-amber-50 border border-amber-200 text-amber-800 rounded-bl-sm'
            : 'bg-white border border-surface-100 text-surface-800 rounded-bl-sm shadow-sm'
      )}>
        {/* Refused indicator */}
        {msg.refused && (
          <div className="flex items-center gap-1.5 mb-2">
            <svg className="h-3.5 w-3.5 text-amber-500 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
            </svg>
            <span className="text-[10px] font-bold text-amber-600 uppercase tracking-wide">
              Insufficient Data
            </span>
          </div>
        )}

        {/* Response text */}
        <p className="leading-relaxed whitespace-pre-wrap">{msg.content}</p>

        {/* Source attribution footer */}
        {!isUser && msg.data_sources && msg.data_sources.length > 0 && (
          <div className="mt-2.5 pt-2 border-t border-surface-100 space-y-1.5">
            <div className="flex items-center justify-between">
              <div className="flex flex-wrap gap-1">
                {msg.data_sources.map(s => <SourceBadge key={s} source={s} />)}
              </div>
              {msg.confidence !== undefined && (
                <ConfidenceBar confidence={msg.confidence} />
              )}
            </div>
            {msg.was_grounded && (
              <p className="text-[10px] text-surface-400">
                ✓ Grounded in your platform data
              </p>
            )}
          </div>
        )}

        {/* Timestamp */}
        <p className={cn(
          'text-[9px] mt-1.5',
          isUser ? 'text-violet-200 text-right' : 'text-surface-300'
        )}>
          {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </p>
      </div>
    </div>
  );
}

// ─── Suggested questions ──────────────────────────────────────────────────────

const SUGGESTED_QUESTIONS = [
  'What career should I move into?',
  'What skills should I learn next?',
  'Which job matches my profile best?',
  'What are my highest risk factors?',
  'What salary can I expect?',
];

// ══════════════════════════════════════════════════════════════════════════════
// Main component
// ══════════════════════════════════════════════════════════════════════════════

export default function CareerCopilot({ className }: { className?: string }) {
  const [messages,        setMessages]        = useState<CopilotMessage[]>([]);
  const [input,           setInput]           = useState('');
  const [conversationId,  setConversationId]  = useState<string | null>(null);
  const [showSuggestions, setShowSuggestions] = useState(true);
  const bottomRef  = useRef<HTMLDivElement>(null);
  const inputRef   = useRef<HTMLTextAreaElement>(null);

  // Welcome message + data availability
  const { data: welcome } = useQuery<WelcomeData>({
    queryKey: ['copilot', 'welcome'],
    queryFn:  () => apiFetch<WelcomeData>('/copilot/welcome'),
    staleTime: 5 * 60 * 1000,
  });

  // Add welcome message on load
  useEffect(() => {
    if (welcome && messages.length === 0) {
      setMessages([{
        role:      'assistant',
        content:   welcome.message,
        timestamp: new Date(),
      }]);
    }
  }, [welcome]);

  // Auto-scroll to bottom
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Chat mutation
  const chatMutation = useMutation({
    mutationFn: (payload: { message: string; conversation_id?: string }) =>
      apiFetch<ChatResponse>('/copilot/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }),
    onSuccess: (data) => {
      // Store conversation ID for follow-up turns
      // apiFetch unwraps { success, data } — so `data` here IS the ChatResponse directly
      if (data.conversation_id && !conversationId) {
        setConversationId(data.conversation_id);
      }

      setMessages(prev => [...prev, {
        role:            'assistant',
        content:         data.response || 'Something went wrong. Please try again.',
        data_sources:    data.data_sources     || [],
        confidence:      data.confidence,
        was_grounded:    data.was_grounded,
        refused:         data.refused,
        signal_strength: data.signal_strength,
        timestamp:       new Date(),
      }]);
    },
    onError: () => {
      setMessages(prev => [...prev, {
        role:      'assistant',
        content:   'I\'m having trouble connecting right now. Please try again in a moment.',
        timestamp: new Date(),
      }]);
    },
  });

  const sendMessage = useCallback((text: string) => {
    const trimmed = text.trim();
    if (!trimmed || chatMutation.isPending) return;

    setShowSuggestions(false);
    setInput('');

    // Add user message immediately
    setMessages(prev => [...prev, {
      role:      'user',
      content:   trimmed,
      timestamp: new Date(),
    }]);

    chatMutation.mutate({
      message:         trimmed,
      conversation_id: conversationId || undefined,
    });
  }, [chatMutation, conversationId]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(input);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  return (
    <div className={cn('flex flex-col h-full max-h-[700px] rounded-2xl border border-surface-100 bg-white shadow-sm overflow-hidden', className)}>
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-surface-100 bg-gradient-to-r from-violet-50 to-indigo-50 shrink-0">
        <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-violet-600">
          <svg className="h-4 w-4 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 2a10 10 0 0 1 10 10c0 5.52-4.48 10-10 10S2 17.52 2 12 6.48 2 12 2z"/><path d="M12 8v4l3 3"/>
          </svg>
        </div>
        <div className="flex-1">
          <p className="text-sm font-bold text-surface-900">Career Copilot</p>
          <p className="text-[10px] text-surface-400 uppercase tracking-wide">
            RAG-Grounded · Answers from your data only
          </p>
        </div>
        {welcome && (
          <div className={cn(
            'rounded-full px-2 py-1 text-[10px] font-semibold',
            welcome.data_completeness >= 0.6 ? 'bg-emerald-100 text-emerald-700' :
            welcome.data_completeness >= 0.3 ? 'bg-amber-100 text-amber-700' :
                                               'bg-rose-100 text-rose-600'
          )}>
            {Math.round(welcome.data_completeness * 100)}% data
          </div>
        )}
      </div>

      {/* Data availability panel */}
      {welcome && welcome.data_completeness > 0 && (
        <div className="px-4 pt-3 shrink-0">
          <DataAvailabilityPanel
            sources={welcome.data_sources_available}
            completeness={welcome.data_completeness}
          />
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 min-h-0">
        {messages.map((msg, i) => (
          <MessageBubble key={i} msg={msg} />
        ))}

        {/* Typing indicator */}
        {chatMutation.isPending && (
          <div className="flex justify-start">
            <div className="bg-white border border-surface-100 rounded-2xl rounded-bl-sm px-4 py-3 shadow-sm">
              <div className="flex gap-1 items-center h-4">
                {[0, 1, 2].map(i => (
                  <div key={i} className="h-1.5 w-1.5 rounded-full bg-violet-400 animate-bounce"
                    style={{ animationDelay: `${i * 0.15}s` }} />
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Suggested questions (shown when no messages yet) */}
        {showSuggestions && messages.length <= 1 && (
          <div className="space-y-1.5 mt-2">
            <p className="text-[10px] text-surface-400 uppercase tracking-wide font-semibold">Suggested questions</p>
            {SUGGESTED_QUESTIONS.map(q => (
              <button
                key={q}
                onClick={() => sendMessage(q)}
                className="block w-full text-left text-xs text-violet-600 bg-violet-50 hover:bg-violet-100 border border-violet-100 rounded-xl px-3 py-2 transition-colors"
              >
                {q}
              </button>
            ))}
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="border-t border-surface-100 px-4 py-3 shrink-0">
        <form onSubmit={handleSubmit} className="flex gap-2 items-end">
          <textarea
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about your career, skills, or job matches…"
            rows={1}
            className="flex-1 resize-none rounded-xl border border-surface-200 bg-surface-50 px-3 py-2 text-sm text-surface-800 placeholder-surface-400 focus:outline-none focus:border-violet-400 focus:bg-white transition-colors"
            style={{ maxHeight: '96px' }}
            disabled={chatMutation.isPending}
          />
          <button
            type="submit"
            disabled={!input.trim() || chatMutation.isPending}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-violet-600 text-white disabled:opacity-40 hover:bg-violet-700 transition-colors"
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
            </svg>
          </button>
        </form>
        <p className="mt-1.5 text-[10px] text-surface-300 text-center">
          Answers are grounded in your HireRise platform data only
        </p>
      </div>
    </div>
  );
}