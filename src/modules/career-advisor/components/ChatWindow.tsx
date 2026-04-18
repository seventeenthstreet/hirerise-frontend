'use client';

/**
 * src/modules/career-advisor/components/ChatWindow.tsx
 *
 * Scrollable message list for the AI Career Advisor.
 *
 * Renders all messages in chronological order, auto-scrolls to
 * the latest message, and shows a typing indicator while the AI
 * is generating a response.
 */

import React, { useEffect, useRef } from 'react';
import MessageBubble from './MessageBubble';

export interface Message {
  id:      string;
  role:    'user' | 'assistant';
  content: string;
}

interface ChatWindowProps {
  messages:   Message[];
  isLoading:  boolean;
}

// ─── Typing indicator ─────────────────────────────────────────────────────────

function TypingIndicator() {
  return (
    <div style={S.typingRow}>
      <div style={S.typingAvatar}>🤖</div>
      <div style={S.typingBubble}>
        <div style={S.dot1} />
        <div style={S.dot2} />
        <div style={S.dot3} />
      </div>
    </div>
  );
}

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptyState() {
  return (
    <div style={S.empty}>
      <div style={S.emptyIcon}>💬</div>
      <p style={S.emptyText}>Your conversation will appear here.</p>
      <p style={S.emptyHint}>Use the example questions below to get started.</p>
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function ChatWindow({ messages, isLoading }: ChatWindowProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  // Scroll to bottom whenever messages change or loading state changes
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  return (
    <div style={S.window}>
      {messages.length === 0 && !isLoading ? (
        <EmptyState />
      ) : (
        <>
          {messages.map((msg, idx) => (
            <MessageBubble
              key={msg.id}
              role={msg.role}
              content={msg.content}
              isNew={idx === messages.length - 1 && msg.role === 'assistant'}
            />
          ))}

          {isLoading && <TypingIndicator />}
        </>
      )}

      {/* Scroll anchor */}
      <div ref={bottomRef} />
    </div>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const S: Record<string, React.CSSProperties> = {
  window: {
    flex:       1,
    overflowY:  'auto',
    padding:    '24px 24px 12px',
    display:    'flex',
    flexDirection: 'column',
    scrollbarWidth: 'thin',
    scrollbarColor: 'rgba(255,255,255,0.15) transparent',
  },

  // Typing indicator
  typingRow: {
    display:    'flex',
    alignItems: 'flex-end',
    gap:        12,
    marginBottom: 24,
  },
  typingAvatar: {
    width:          36,
    height:         36,
    borderRadius:   '50%',
    background:     'linear-gradient(135deg, #059669, #0d9488)',
    display:        'flex',
    alignItems:     'center',
    justifyContent: 'center',
    fontSize:       16,
    flexShrink:     0,
  },
  typingBubble: {
    display:      'flex',
    alignItems:   'center',
    gap:          5,
    background:   'rgba(255,255,255,0.06)',
    border:       '1px solid rgba(255,255,255,0.10)',
    borderRadius: 16,
    borderBottomLeftRadius: 4,
    padding:      '14px 18px',
  },
  dot1: {
    width: 8, height: 8, borderRadius: '50%',
    background: '#6ee7b7',
    animation: 'bounce 1.2s infinite',
    animationDelay: '0s',
  },
  dot2: {
    width: 8, height: 8, borderRadius: '50%',
    background: '#6ee7b7',
    animation: 'bounce 1.2s infinite',
    animationDelay: '0.2s',
  },
  dot3: {
    width: 8, height: 8, borderRadius: '50%',
    background: '#6ee7b7',
    animation: 'bounce 1.2s infinite',
    animationDelay: '0.4s',
  },

  // Empty state
  empty: {
    flex:           1,
    display:        'flex',
    flexDirection:  'column',
    alignItems:     'center',
    justifyContent: 'center',
    textAlign:      'center',
    padding:        40,
  },
  emptyIcon: {
    fontSize:     48,
    marginBottom: 16,
    opacity:      0.6,
  },
  emptyText: {
    color:        '#94a3b8',
    fontSize:     16,
    marginBottom: 8,
    fontWeight:   500,
  },
  emptyHint: {
    color:    '#64748b',
    fontSize: 13.5,
  },
};
