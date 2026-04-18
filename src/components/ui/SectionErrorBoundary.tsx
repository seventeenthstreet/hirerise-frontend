'use client';

/**
 * components/ui/SectionErrorBoundary.tsx
 *
 * Place at: src/components/ui/SectionErrorBoundary.tsx
 *
 * Wraps individual dashboard sections so a single API failure
 * doesn't crash the entire page.
 *
 * Usage:
 *   <SectionErrorBoundary label="Skill Gap">
 *     <SkillGapSection />
 *   </SectionErrorBoundary>
 *
 * Fallback shows "Couldn't load [label] — Retry" with a retry button
 * that resets the error boundary and re-renders the child.
 */

import React, { Component, type ReactNode } from 'react';

interface Props {
  children:  ReactNode;
  label?:    string;       // e.g. "Skill Gap" — shown in fallback message
  compact?:  boolean;      // use a smaller fallback card
}

interface State {
  hasError: boolean;
  errorMsg: string | null;
}

// ─── Design tokens (inline — no Tailwind dependency) ─────────────────────────
const S = {
  card:    { background: '#0d1117', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, padding: '24px 20px', textAlign: 'center' as const },
  compact: { background: '#0d1117', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 8,  padding: '14px 16px', textAlign: 'center' as const },
  title:   { fontSize: 14, fontWeight: 600, color: '#dde4ef', marginBottom: 4  },
  msg:     { fontSize: 12, color: '#5f6d87', marginBottom: 14, lineHeight: 1.5 },
  btn:     {
    padding: '8px 18px', background: 'transparent',
    border: '1px solid rgba(255,255,255,0.12)',
    borderRadius: 8, color: '#dde4ef', fontSize: 13,
    cursor: 'pointer', fontFamily: 'inherit',
  },
};

export class SectionErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, errorMsg: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, errorMsg: error?.message || null };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // Non-fatal — log for observability but don't rethrow
    console.warn(`[SectionErrorBoundary] ${this.props.label || 'Section'} failed:`, error.message);
  }

  reset = () => this.setState({ hasError: false, errorMsg: null });

  render() {
    if (!this.state.hasError) return this.props.children;

    const label   = this.props.label || 'this section';
    const style   = this.props.compact ? S.compact : S.card;

    return (
      <div style={style}>
        <div style={S.title}>Couldn't load {label}</div>
        <div style={S.msg}>
          Something went wrong. Your other data is unaffected.
        </div>
        <button style={S.btn} onClick={this.reset}>
          Retry
        </button>
      </div>
    );
  }
}

/**
 * withErrorBoundary(Component, label?)
 *
 * HOC version for wrapping existing components without changing their JSX.
 *
 * Usage:
 *   const SafeSkillGap = withErrorBoundary(SkillGapSection, 'Skill Gap');
 */
export function withErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  label?: string,
  compact?: boolean
) {
  const displayName = Component.displayName || Component.name || 'Component';

  function WrappedComponent(props: P) {
    return (
      <SectionErrorBoundary label={label || displayName} compact={compact}>
        <Component {...props} />
      </SectionErrorBoundary>
    );
  }

  WrappedComponent.displayName = `WithErrorBoundary(${displayName})`;
  return WrappedComponent;
}