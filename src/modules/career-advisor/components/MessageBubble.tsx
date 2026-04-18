'use client';

/**
 * src/modules/career-advisor/components/MessageBubble.tsx
 *
 * Renders a single chat message — either a user question or an AI response.
 *
 * Props:
 *   role    — 'user' | 'assistant'
 *   content — message text (may contain newlines)
 *   isNew   — if true, plays a subtle fade-in animation (latest AI response)
 */

import React from 'react';

interface MessageBubbleProps {
  role:    'user' | 'assistant';
  content: string;
  isNew?:  boolean;
}

// ─── Avatar ───────────────────────────────────────────────────────────────────

function UserAvatar() {
  return (
    <div style={S.userAvatar}>
      <span style={S.avatarIcon}>👤</span>
    </div>
  );
}

function AIAvatar() {
  return (
    <div style={S.aiAvatar}>
      <span style={S.avatarIcon}>🤖</span>
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function MessageBubble({ role, content, isNew = false }: MessageBubbleProps) {
  const isUser = role === 'user';

  // Convert newlines to <br> elements for rendered output
  const lines = content.split('\n');

  return (
    <div
      style={{
        ...S.row,
        flexDirection: isUser ? 'row-reverse' : 'row',
        animation: isNew ? 'fadeSlideIn 0.3s ease' : 'none',
      }}
    >
      {/* Avatar */}
      {isUser ? <UserAvatar /> : <AIAvatar />}

      {/* Bubble */}
      <div
        style={{
          ...S.bubble,
          ...(isUser ? S.userBubble : S.aiBubble),
          marginLeft:  isUser ? 0 : 12,
          marginRight: isUser ? 12 : 0,
        }}
      >
        {/* Role label */}
        <div style={{ ...S.roleLabel, color: isUser ? '#a78bfa' : '#6ee7b7' }}>
          {isUser ? 'You' : 'AI Career Advisor'}
        </div>

        {/* Message content — preserves line breaks */}
        <div style={S.text}>
          {lines.map((line, i) => (
            <React.Fragment key={i}>
              {line}
              {i < lines.length - 1 && <br />}
            </React.Fragment>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const S: Record<string, React.CSSProperties> = {
  row: {
    display:       'flex',
    alignItems:    'flex-start',
    marginBottom:  24,
    gap:           0,
  },
  userAvatar: {
    width:           36,
    height:          36,
    borderRadius:    '50%',
    background:      'linear-gradient(135deg, #7c3aed, #4f46e5)',
    display:         'flex',
    alignItems:      'center',
    justifyContent:  'center',
    flexShrink:      0,
    marginLeft:      12,
  },
  aiAvatar: {
    width:           36,
    height:          36,
    borderRadius:    '50%',
    background:      'linear-gradient(135deg, #059669, #0d9488)',
    display:         'flex',
    alignItems:      'center',
    justifyContent:  'center',
    flexShrink:      0,
    marginRight:     12,
  },
  avatarIcon: {
    fontSize:  16,
  },
  bubble: {
    maxWidth:     '72%',
    padding:      '14px 18px',
    borderRadius: 16,
    lineHeight:   1.65,
  },
  userBubble: {
    background:         'linear-gradient(135deg, #4f46e5, #7c3aed)',
    borderBottomRightRadius: 4,
    boxShadow:          '0 2px 12px rgba(79,70,229,0.35)',
  },
  aiBubble: {
    background:         'rgba(255,255,255,0.06)',
    border:             '1px solid rgba(255,255,255,0.10)',
    borderBottomLeftRadius: 4,
    boxShadow:          '0 2px 12px rgba(0,0,0,0.20)',
  },
  roleLabel: {
    fontSize:     11,
    fontWeight:   700,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    marginBottom:  6,
    opacity:       0.85,
  },
  text: {
    fontSize:   14.5,
    color:      '#e2e8f0',
    whiteSpace: 'pre-wrap',
    wordBreak:  'break-word',
  },
};
