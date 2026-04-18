'use client';

/**
 * app/career-dashboard/_sections/CopilotSection.tsx
 */

import { useState, useRef } from 'react';
import { apiFetch } from '@/services/apiClient';
import { useRouter } from 'next/navigation';

const T = {
  card: '#0d1117', border: 'rgba(255,255,255,0.07)',
  text: '#dde4ef', muted: '#5f6d87', dim: '#1a2236',
  blue: '#3c72f8', pink: '#e96caa',
} as const;

const QUICK_PROMPTS = [
  'What skills should I learn next?',
  'How do I increase my salary?',
  'What jobs match my profile?',
  'How long to reach senior level?',
];

interface Message {
  role: 'user' | 'assistant';
  text: string;
}

export default function CopilotSection() {
  const router = useRouter();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput]       = useState('');
  const [loading, setLoading]   = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  async function send(text: string) {
    if (!text.trim() || loading) return;
    const userMsg = text.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', text: userMsg }]);
    setLoading(true);

    try {
      const res = await apiFetch<{ reply?: string; message?: string; response?: string }>('/copilot/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userMsg }),
      });
      const reply = res?.reply ?? res?.message ?? res?.response ?? 'I couldn\'t generate a response right now. Please try again.';
      setMessages(prev => [...prev, { role: 'assistant', text: reply }]);
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', text: 'Something went wrong. Please try again.' }]);
    } finally {
      setLoading(false);
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    }
  }

  return (
    <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, padding: '20px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: T.pink, boxShadow: `0 0 6px ${T.pink}` }} />
          <h2 style={{ fontSize: 15, fontWeight: 600, color: T.text, margin: 0 }}>Ava — AI Career Coach</h2>
        </div>
        <button
          onClick={() => router.push('/advisor')}
          style={{ fontSize: 12, color: T.blue, background: 'transparent', border: 'none', cursor: 'pointer', fontWeight: 600 }}
        >
          Full Session →
        </button>
      </div>

      {/* Message area */}
      <div
        style={{
          minHeight: 120, maxHeight: 240, overflowY: 'auto',
          marginBottom: 12, display: 'flex', flexDirection: 'column', gap: 8,
        }}
      >
        {messages.length === 0 && (
          <div style={{ fontSize: 13, color: T.muted, padding: '12px 0' }}>
            Ask Ava anything about your career…
          </div>
        )}
        {messages.map((m, i) => (
          <div
            key={i}
            style={{
              padding: '10px 14px', borderRadius: 8, fontSize: 13, lineHeight: 1.5,
              maxWidth: '85%',
              alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
              background: m.role === 'user' ? T.blue : T.dim,
              color: T.text,
            }}
          >
            {m.text}
          </div>
        ))}
        {loading && (
          <div style={{ alignSelf: 'flex-start', padding: '10px 14px', background: T.dim, borderRadius: 8 }}>
            <div style={{ display: 'flex', gap: 4 }}>
              {[0, 1, 2].map(d => (
                <div key={d} style={{ width: 6, height: 6, borderRadius: '50%', background: T.muted, animation: 'bounce 1s infinite', animationDelay: `${d * 0.2}s` }} />
              ))}
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Quick prompts */}
      {messages.length === 0 && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
          {QUICK_PROMPTS.map(p => (
            <button
              key={p}
              onClick={() => send(p)}
              style={{
                padding: '6px 10px', background: T.dim, color: T.muted,
                border: `1px solid ${T.border}`, borderRadius: 20,
                fontSize: 11, cursor: 'pointer',
              }}
            >
              {p}
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      <div style={{ display: 'flex', gap: 8 }}>
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') send(input); }}
          placeholder="Ask about your career…"
          style={{
            flex: 1, padding: '10px 14px', background: T.dim,
            border: `1px solid ${T.border}`, borderRadius: 8,
            color: T.text, fontSize: 13, outline: 'none', fontFamily: 'inherit',
          }}
        />
        <button
          onClick={() => send(input)}
          disabled={!input.trim() || loading}
          style={{
            padding: '10px 16px', background: T.blue, color: '#fff',
            border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600,
            cursor: input.trim() ? 'pointer' : 'not-allowed',
            opacity: input.trim() ? 1 : 0.5,
          }}
        >
          →
        </button>
      </div>

      <style>{`@keyframes bounce{0%,100%{transform:translateY(0)}50%{transform:translateY(-4px)}}`}</style>
    </div>
  );
}