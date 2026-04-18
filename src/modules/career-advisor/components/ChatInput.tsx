'use client';

/**
 * src/modules/career-advisor/components/ChatInput.tsx
 *
 * Message input bar for the AI Career Advisor chat interface.
 *
 * Features:
 *   - Auto-growing textarea (max 4 lines)
 *   - Send on Enter (Shift+Enter = newline)
 *   - Disabled + spinner state while AI is generating
 *   - Character counter warning at 1800+ chars
 *   - Example question chips when input is empty
 */

import React, { useRef, useEffect, KeyboardEvent, ChangeEvent } from 'react';

interface ChatInputProps {
  value:       string;
  onChange:    (val: string) => void;
  onSend:      () => void;
  isLoading:   boolean;
  placeholder?: string;
}

const EXAMPLE_QUESTIONS = [
  'Which stream is best for me?',
  'What career gives the highest salary?',
  'What skills should I learn now?',
  'Is Computer Science better than Commerce?',
];

const MAX_CHARS = 2000;

export default function ChatInput({
  value,
  onChange,
  onSend,
  isLoading,
  placeholder = 'Ask me anything about your career path…',
}: ChatInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea as user types
  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = Math.min(ta.scrollHeight, 120) + 'px';
  }, [value]);

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (!isLoading && value.trim().length > 0) onSend();
    }
  }

  function handleChange(e: ChangeEvent<HTMLTextAreaElement>) {
    if (e.target.value.length <= MAX_CHARS) onChange(e.target.value);
  }

  const charsLeft   = MAX_CHARS - value.length;
  const nearLimit   = charsLeft < 200;
  const canSend     = !isLoading && value.trim().length > 0;

  return (
    <div style={S.wrap}>
      {/* Example chips — shown when input is empty and not loading */}
      {value.length === 0 && !isLoading && (
        <div style={S.chips}>
          {EXAMPLE_QUESTIONS.map(q => (
            <button
              key={q}
              style={S.chip}
              onClick={() => { onChange(q); textareaRef.current?.focus(); }}
            >
              {q}
            </button>
          ))}
        </div>
      )}

      {/* Input row */}
      <div style={S.inputRow}>
        <textarea
          ref={textareaRef}
          style={{
            ...S.textarea,
            opacity: isLoading ? 0.6 : 1,
          }}
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder={isLoading ? 'AI is thinking…' : placeholder}
          disabled={isLoading}
          rows={1}
        />

        {/* Send button */}
        <button
          style={{
            ...S.sendBtn,
            background: canSend
              ? 'linear-gradient(135deg, #4f46e5, #7c3aed)'
              : 'rgba(255,255,255,0.08)',
            cursor: canSend ? 'pointer' : 'not-allowed',
          }}
          onClick={onSend}
          disabled={!canSend}
          aria-label="Send message"
        >
          {isLoading ? (
            <div style={S.spinner} />
          ) : (
            <span style={S.sendIcon}>↑</span>
          )}
        </button>
      </div>

      {/* Character counter */}
      <div style={S.footer}>
        <span style={{ ...S.hint, color: nearLimit ? '#f87171' : 'rgba(255,255,255,0.3)' }}>
          {nearLimit ? `${charsLeft} characters remaining` : 'Enter to send · Shift+Enter for newline'}
        </span>
      </div>
    </div>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const S: Record<string, React.CSSProperties> = {
  wrap: {
    padding:      '16px 20px 12px',
    borderTop:    '1px solid rgba(255,255,255,0.08)',
    background:   'rgba(15,15,30,0.95)',
    backdropFilter: 'blur(12px)',
  },
  chips: {
    display:      'flex',
    flexWrap:     'wrap',
    gap:          8,
    marginBottom: 12,
  },
  chip: {
    background:   'rgba(79,70,229,0.15)',
    border:       '1px solid rgba(79,70,229,0.35)',
    borderRadius: 20,
    color:        '#a5b4fc',
    fontSize:     12.5,
    padding:      '5px 12px',
    cursor:       'pointer',
    transition:   'all 0.15s',
    whiteSpace:   'nowrap',
  },
  inputRow: {
    display:      'flex',
    alignItems:   'flex-end',
    gap:          10,
  },
  textarea: {
    flex:         1,
    background:   'rgba(255,255,255,0.06)',
    border:       '1px solid rgba(255,255,255,0.12)',
    borderRadius: 14,
    color:        '#e2e8f0',
    fontSize:     14.5,
    lineHeight:   1.55,
    padding:      '11px 16px',
    resize:       'none',
    outline:      'none',
    minHeight:    44,
    maxHeight:    120,
    fontFamily:   'inherit',
    transition:   'border-color 0.15s',
  },
  sendBtn: {
    width:        44,
    height:       44,
    borderRadius: 12,
    border:       'none',
    display:      'flex',
    alignItems:   'center',
    justifyContent: 'center',
    flexShrink:   0,
    transition:   'all 0.15s',
  },
  sendIcon: {
    color:      '#fff',
    fontSize:   18,
    fontWeight: 700,
    lineHeight: 1,
  },
  spinner: {
    width:        18,
    height:       18,
    borderRadius: '50%',
    border:       '2px solid rgba(255,255,255,0.25)',
    borderTopColor: '#fff',
    animation:    'spin 0.7s linear infinite',
  },
  footer: {
    marginTop:  8,
    textAlign:  'right' as const,
  },
  hint: {
    fontSize:   11.5,
    transition: 'color 0.2s',
  },
};
