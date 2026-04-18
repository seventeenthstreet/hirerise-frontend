'use client';

/**
 * src/modules/career-advisor/pages/AdvisorChatPage.tsx
 *
 * AI Career Advisor — full-page chat interface.
 *
 * Layout:
 *   ┌─────────────────────────────────────────┐
 *   │  Header (brand + title + back button)   │
 *   ├─────────────────────────────────────────┤
 *   │  Sidebar (context pills)  │ ChatWindow  │
 *   │                           │             │
 *   │  • Recommended Stream     │  messages   │
 *   │  • Top Career             │  ↕ scroll   │
 *   │  • Career Probability     │             │
 *   │  • Top ROI Path           │             │
 *   ├───────────────────────────┴─────────────┤
 *   │            ChatInput (full width)       │
 *   └─────────────────────────────────────────┘
 *
 * On mobile (< 768px) the sidebar collapses above the chat window.
 */

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth }  from '@/features/auth/components/AuthProvider';
import ChatWindow, { type Message } from '../components/ChatWindow';
import ChatInput  from '../components/ChatInput';
import { advisorApi } from '../services/advisor.api';
import { getAnalysisResult } from '@/modules/education/services/education.api';
import type { AnalysisResult } from '@/modules/education/services/education.api';

// ─── Helpers ──────────────────────────────────────────────────────────────────

let _msgId = 0;
function nextId() { return `msg-${++_msgId}`; }

function pct(n?: number | null) {
  if (n == null) return '—';
  return `${Math.round(n)}%`;
}

// ─── Sidebar context pill ─────────────────────────────────────────────────────

interface PillProps { label: string; value: string; color: string; }
function ContextPill({ label, value, color }: PillProps) {
  return (
    <div style={S.pill}>
      <div style={{ ...S.pillDot, background: color }} />
      <div>
        <div style={S.pillLabel}>{label}</div>
        <div style={S.pillValue}>{value}</div>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function AdvisorChatPage() {
  const router        = useRouter();
  const { user }      = useAuth();
  const studentId     = user?.id ?? '';

  const [messages,   setMessages]   = useState<Message[]>([]);
  const [input,      setInput]      = useState('');
  const [isLoading,  setIsLoading]  = useState(false);
  const [welcomeMsg, setWelcomeMsg] = useState<string | null>(null);
  const [analysis,   setAnalysis]   = useState<AnalysisResult | null>(null);
  const [initDone,   setInitDone]   = useState(false);

  // ── On mount: load welcome + history + analysis context ─────────────────
  useEffect(() => {
    if (!studentId) return;

    async function init() {
      try {
        const [welcomeRes, historyRes, analysisRes] = await Promise.allSettled([
          advisorApi.getWelcome(studentId),
          advisorApi.getHistory(studentId),
          getAnalysisResult(studentId),
        ]);

        // Welcome message
        if (welcomeRes.status === 'fulfilled') {
          setWelcomeMsg(welcomeRes.value.message);
        }

        // Restore conversation history
        if (historyRes.status === 'fulfilled') {
          const turns = historyRes.value.conversations;
          if (turns.length > 0) {
            const restored: Message[] = turns.flatMap(t => [
              { id: nextId(), role: 'user'      as const, content: t.user_message },
              { id: nextId(), role: 'assistant' as const, content: t.ai_response  },
            ]);
            setMessages(restored);
          }
        }

        // Analysis context for sidebar
        if (analysisRes.status === 'fulfilled') {
          setAnalysis(analysisRes.value);
        }
      } catch {
        // Non-fatal — advisor still works without these
      } finally {
        setInitDone(true);
      }
    }

    init();
  }, [studentId]);

  // ── Send a message ────────────────────────────────────────────────────────
  const handleSend = useCallback(async () => {
    const trimmed = input.trim();
    if (!trimmed || isLoading || !studentId) return;

    const userMsg: Message = { id: nextId(), role: 'user', content: trimmed };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    try {
      const result = await advisorApi.sendMessage(studentId, trimmed);
      const aiMsg: Message = { id: nextId(), role: 'assistant', content: result.response };
      setMessages(prev => [...prev, aiMsg]);
    } catch (err: unknown) {
      const errorMsg: Message = {
        id:      nextId(),
        role:    'assistant',
        content: 'I\'m having trouble right now. Please try again in a moment.',
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  }, [input, isLoading, studentId]);

  // ── Sidebar context pills from analysis data ──────────────────────────────
  const pills: PillProps[] = [];
  if (analysis) {
    if (analysis.recommended_label) {
      pills.push({ label: 'Recommended Stream', value: analysis.recommended_label, color: '#6ee7b7' });
    }
    if (analysis.top_careers && analysis.top_careers.length > 0) {
      pills.push({ label: 'Top Career', value: analysis.top_careers[0].career, color: '#a5b4fc' });
      pills.push({ label: 'Career Probability', value: pct(analysis.top_careers[0].probability), color: '#fbbf24' });
    }
    if (analysis.education_options && analysis.education_options.length > 0) {
      const top = analysis.education_options[0];
      pills.push({ label: 'Best ROI Path', value: `${top.path} (${top.roi_level})`, color: '#f9a8d4' });
    }
    if (analysis.confidence) {
      pills.push({ label: 'Recommendation Confidence', value: pct(analysis.confidence), color: '#67e8f9' });
    }
  }

  // ── No user guard ─────────────────────────────────────────────────────────
  if (initDone && !studentId) {
    return (
      <div style={S.root}>
        <div style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>
          Please log in to use the AI Career Advisor.
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Global styles — animations */}
      <style>{GLOBAL_CSS}</style>

      <div style={S.root}>
        {/* ── Header ─────────────────────────────────────────────────── */}
        <div style={S.header}>
          <div style={S.headerInner}>
            <div style={S.headerLeft}>
              <button style={S.backBtn} onClick={() => router.back()} aria-label="Back">
                ← Back
              </button>
              <span style={S.headerSep}>|</span>
              <span style={S.brand}>🎓 Career Intelligence</span>
              <span style={S.headerSep}>·</span>
              <span style={S.headerTitle}>
                {user?.user_type === 'student' ? 'AI Career Assessment' : 'AI Career Advisor'}
              </span>
            </div>
            <div style={S.headerBadge}>
              <span style={S.dot} />
              Powered by Claude AI
            </div>
          </div>
        </div>

        {/* ── Body ───────────────────────────────────────────────────── */}
        <div style={S.body}>
          {/* Sidebar */}
          <aside style={S.sidebar}>
            {/* Welcome blurb */}
            <div style={S.sideHeader}>
              <div style={S.aiIcon}>🤖</div>
              <div>
                <div style={S.sideTitle}>
                  {user?.user_type === 'student' ? 'Career Assessment AI' : 'Your AI Advisor'}
                </div>
                <div style={S.sideSub}>
                  {user?.user_type === 'student'
                    ? 'Guided career fit assessment'
                    : 'Personalised to your profile'}
                </div>
              </div>
            </div>

            {/* Context pills */}
            {pills.length > 0 && (
              <div style={S.pillsSection}>
                <div style={S.pillsSectionTitle}>Your Profile Snapshot</div>
                {pills.map(p => <ContextPill key={p.label} {...p} />)}
              </div>
            )}

            {pills.length === 0 && initDone && (
              <div style={S.noPills}>
                <p style={S.noPillsText}>
                  Complete your academic analysis to see your personalised profile here.
                </p>
                <button
                  style={S.analysisBtn}
                  onClick={() => router.push('/education')}
                >
                  Run Analysis →
                </button>
              </div>
            )}

            {/* Tips — role-aware (Issue 7) */}
            <div style={S.tips}>
              <div style={S.tipsTitle}>💡 Try asking</div>
              {(user?.user_type === 'student'
                ? [
                    'Which subjects do I enjoy most?',
                    'What activities excite me?',
                    'Do I prefer technology, people, or research?',
                    'What problems do I enjoy solving?',
                    'What career fits my strengths best?',
                    'Generate my Career Fit Report',
                  ]
                : [
                    'Which stream is best for me?',
                    'What career gives the highest salary?',
                    'Should I choose Computer Science or Commerce?',
                    'What skills should I learn now?',
                    'What is the scope of AI Engineering?',
                  ]
              ).map(q => (
                <button
                  key={q}
                  style={S.tipBtn}
                  onClick={() => setInput(q)}
                >
                  {q}
                </button>
              ))}
            </div>
          </aside>

          {/* Chat panel */}
          <div style={S.chatPanel}>
            {/* Welcome banner (shown before first message) */}
            {messages.length === 0 && initDone && (
              <div style={S.welcomeBanner}>
                <div style={S.welcomeIcon}>{user?.user_type === 'student' ? '🧠' : '✨'}</div>
                {user?.user_type === 'student' ? (
                  <div>
                    <p style={{ ...S.welcomeText, fontWeight: 700, marginBottom: 8 }}>
                      AI Career Assessment
                    </p>
                    <p style={S.welcomeText}>
                      I'll guide you through a series of questions about your interests, strengths,
                      and what excites you — then generate a personalised <strong>Career Fit Report</strong>.
                    </p>
                    <p style={{ ...S.welcomeText, opacity: 0.6, fontSize: 12, marginTop: 8 }}>
                      Start by telling me: <em>Which subjects do you enjoy most?</em>
                    </p>
                  </div>
                ) : (
                  <p style={S.welcomeText}>{welcomeMsg}</p>
                )}
              </div>
            )}

            {/* Message list */}
            <ChatWindow messages={messages} isLoading={isLoading} />

            {/* Input */}
            <ChatInput
              value={input}
              onChange={setInput}
              onSend={handleSend}
              isLoading={isLoading}
            />
          </div>
        </div>
      </div>
    </>
  );
}

// ─── CSS animations ────────────────────────────────────────────────────────────

const GLOBAL_CSS = `
  @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Syne:wght@700;800&display=swap');

  * { box-sizing: border-box; }

  @keyframes fadeSlideIn {
    from { opacity: 0; transform: translateY(8px); }
    to   { opacity: 1; transform: translateY(0);   }
  }

  @keyframes bounce {
    0%, 80%, 100% { transform: translateY(0);    opacity: 0.5; }
    40%           { transform: translateY(-6px); opacity: 1;   }
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  ::-webkit-scrollbar { width: 5px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.12); border-radius: 10px; }

  textarea:focus { border-color: rgba(99,102,241,0.5) !important; box-shadow: 0 0 0 3px rgba(99,102,241,0.15); }

  button:hover { opacity: 0.88; }
`;

// ─── Styles ───────────────────────────────────────────────────────────────────

const S: Record<string, React.CSSProperties> = {
  root: {
    minHeight:  '100vh',
    background: '#080c14',
    fontFamily: "'DM Sans', sans-serif",
    color:      '#f9fafb',
    display:    'flex',
    flexDirection: 'column',
  },

  // Header
  header: {
    background:   '#0d1117',
    borderBottom: '1px solid #1f2937',
    position:     'sticky',
    top:          0,
    zIndex:       50,
    flexShrink:   0,
  },
  headerInner: {
    maxWidth:   1200,
    margin:     '0 auto',
    padding:    '13px 24px',
    display:    'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerLeft: {
    display:    'flex',
    alignItems: 'center',
    gap:        10,
  },
  backBtn: {
    background:   'transparent',
    border:       '1.5px solid #1f2937',
    borderRadius: 8,
    color:        '#6b7280',
    fontSize:     12,
    fontWeight:   600,
    padding:      '5px 12px',
    cursor:       'pointer',
    transition:   'all 0.15s',
  },
  headerSep: {
    color:    '#374151',
    fontSize: 14,
  },
  brand: {
    fontFamily: 'Syne, sans-serif',
    fontWeight: 700,
    fontSize:   14,
    color:      '#f9fafb',
  },
  headerTitle: {
    fontSize:   13,
    color:      '#6b7280',
  },
  headerBadge: {
    display:    'flex',
    alignItems: 'center',
    gap:        6,
    fontSize:   12,
    color:      '#6ee7b7',
    fontWeight: 600,
  },
  dot: {
    width:        7,
    height:       7,
    borderRadius: '50%',
    background:   '#6ee7b7',
    boxShadow:    '0 0 6px #6ee7b7',
    animation:    'none',
  },

  // Body layout
  body: {
    flex:       1,
    display:    'flex',
    maxWidth:   1200,
    width:      '100%',
    margin:     '0 auto',
    overflow:   'hidden',
    height:     'calc(100vh - 52px)',
  },

  // Sidebar
  sidebar: {
    width:        280,
    flexShrink:   0,
    borderRight:  '1px solid rgba(255,255,255,0.07)',
    padding:      '24px 16px',
    overflowY:    'auto',
    display:      'flex',
    flexDirection:'column',
    gap:          20,
    background:   '#0a0f1e',
  },
  sideHeader: {
    display:    'flex',
    alignItems: 'center',
    gap:        12,
    padding:    '12px 14px',
    background: 'linear-gradient(135deg, rgba(5,150,105,0.15), rgba(13,148,136,0.10))',
    borderRadius: 12,
    border:     '1px solid rgba(6,214,160,0.15)',
  },
  aiIcon: {
    fontSize:  28,
    lineHeight: 1,
  },
  sideTitle: {
    fontWeight:   600,
    fontSize:     14,
    color:        '#e2e8f0',
    lineHeight:   1.2,
  },
  sideSub: {
    fontSize: 12,
    color:    '#64748b',
  },

  // Context pills
  pillsSection: {
    display:       'flex',
    flexDirection: 'column',
    gap:           8,
  },
  pillsSectionTitle: {
    fontSize:     11,
    fontWeight:   700,
    color:        '#475569',
    letterSpacing: '0.1em',
    textTransform: 'uppercase' as const,
    marginBottom:  4,
  },
  pill: {
    display:      'flex',
    alignItems:   'flex-start',
    gap:          10,
    padding:      '10px 12px',
    background:   'rgba(255,255,255,0.04)',
    borderRadius: 10,
    border:       '1px solid rgba(255,255,255,0.07)',
  },
  pillDot: {
    width:        8,
    height:       8,
    borderRadius: '50%',
    marginTop:    4,
    flexShrink:   0,
  },
  pillLabel: {
    fontSize:     11,
    color:        '#64748b',
    marginBottom: 2,
    fontWeight:   500,
  },
  pillValue: {
    fontSize:   13,
    color:      '#e2e8f0',
    fontWeight: 600,
  },

  noPills: {
    padding:    '14px 12px',
    background: 'rgba(255,255,255,0.03)',
    borderRadius: 12,
    border:     '1px dashed rgba(255,255,255,0.1)',
    textAlign:  'center' as const,
  },
  noPillsText: {
    fontSize:     13,
    color:        '#64748b',
    lineHeight:   1.55,
    marginBottom: 12,
  },
  analysisBtn: {
    background:   'linear-gradient(135deg, #4f46e5, #7c3aed)',
    border:       'none',
    borderRadius: 8,
    color:        '#fff',
    fontSize:     12.5,
    fontWeight:   700,
    padding:      '8px 16px',
    cursor:       'pointer',
    width:        '100%',
  },

  // Tips section
  tips: {
    display:       'flex',
    flexDirection: 'column',
    gap:           6,
    marginTop:     'auto',
  },
  tipsTitle: {
    fontSize:     12,
    fontWeight:   700,
    color:        '#475569',
    marginBottom: 4,
  },
  tipBtn: {
    background:   'transparent',
    border:       '1px solid rgba(255,255,255,0.08)',
    borderRadius: 8,
    color:        '#6b7280',
    fontSize:     12,
    padding:      '7px 10px',
    cursor:       'pointer',
    textAlign:    'left' as const,
    lineHeight:   1.4,
    transition:   'all 0.15s',
  },

  // Chat panel
  chatPanel: {
    flex:          1,
    display:       'flex',
    flexDirection: 'column',
    overflow:      'hidden',
  },

  // Welcome banner
  welcomeBanner: {
    margin:       '24px 24px 0',
    padding:      '20px 22px',
    background:   'linear-gradient(135deg, rgba(79,70,229,0.15), rgba(124,58,237,0.10))',
    borderRadius: 16,
    border:       '1px solid rgba(99,102,241,0.25)',
    display:      'flex',
    gap:          16,
    alignItems:   'flex-start',
    animation:    'fadeSlideIn 0.4s ease',
  },
  welcomeIcon: {
    fontSize:   24,
    lineHeight: 1,
    flexShrink: 0,
    marginTop:  2,
  },
  welcomeText: {
    fontSize:   14,
    color:      '#cbd5e1',
    lineHeight: 1.65,
    whiteSpace: 'pre-line',
    margin:     0,
  },
};