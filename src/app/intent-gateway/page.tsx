'use client';

/**
 * app/intent-gateway/page.tsx
 *
 * Intent Gateway — shown once after login.
 * Asks the user "What would you like help with today?"
 * Saves direction to backend + localStorage, then redirects.
 *
 * ROUTING LOGIC:
 *   education → /education/onboarding
 *   career    → /dashboard
 *   market    → /market-insights
 *
 * SKIP LOGIC:
 *   If user already has user_direction set (from API or localStorage),
 *   this page redirects immediately without rendering.
 *
 * DO NOT modify existing dashboard, career engines, or admin routes.
 */

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { intentGatewayService } from '@/services/intentGatewayService';
import type { UserDirection } from '@/types/intentGateway';
import { useAuth } from '@/features/auth/components/AuthProvider';

// ─── Intent card definitions ──────────────────────────────────────────────────

interface IntentOption {
  id: UserDirection;
  title: string;
  description: string;
  detail: string;
  icon: string;
  accentColor: string;
  route: string;
  tag: string;
}

const INTENT_OPTIONS: IntentOption[] = [
  {
    id: 'education',
    title: 'Educational Direction',
    description: 'Help me choose the right stream or course.',
    detail: 'Get AI guidance on which degree, certification, or learning path aligns with your interests and the job market.',
    icon: '🎓',
    accentColor: '#06b6d4',   // cyan
    route: '/education/onboarding',
    tag: 'Courses · Degrees · Streams',
  },
  {
    id: 'career',
    title: 'Career Path Guidance',
    description: 'Analyse my career path and skills.',
    detail: 'Upload your CV, get a Career Health Index score, identify skill gaps, and see personalised role recommendations.',
    icon: '🚀',
    accentColor: '#6366f1',   // indigo — matches existing dashboard brand
    route: '/dashboard',
    tag: 'CHI · Skill Gaps · Role Match',
  },
  {
    id: 'market',
    title: 'Market Intelligence',
    description: 'See job demand and salary trends.',
    detail: 'Explore live market data — which skills are rising, where salaries are heading, and which cities are hiring most.',
    icon: '📊',
    accentColor: '#10b981',   // emerald
    route: '/market-insights',
    tag: 'Salaries · Demand · Trends',
  },
];

// ─── Route map (single source of truth, also used by middleware) ──────────────
export const DIRECTION_ROUTES: Record<UserDirection, string> = {
  education: '/education/onboarding',
  career:    '/dashboard',
  market:    '/market-insights',
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function IntentGateway() {
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();

  const [selected, setSelected]   = useState<UserDirection | null>(null);
  const [saving, setSaving]       = useState(false);
  const [error, setError]         = useState<string | null>(null);
  const [mounted, setMounted]     = useState(false);

  // Staggered entrance animation state
  const [visibleCards, setVisibleCards] = useState<number[]>([]);

  // ── On mount: check if direction already stored ───────────────────────────
  useEffect(() => {
    setMounted(true);

    // 1. Check localStorage first (instant, no network)
    const cached = intentGatewayService.getDirectionFromCache();
    if (cached) {
      router.replace(DIRECTION_ROUTES[cached]);
      return;
    }

    // 2. If user is loaded and has direction in their profile, redirect
    const userWithDir = user as (typeof user & { user_direction?: UserDirection | null });
    if (!authLoading && userWithDir?.user_direction) {
      const dir = userWithDir.user_direction as UserDirection;
      intentGatewayService.cacheDirection(dir); // warm the cache
      router.replace(DIRECTION_ROUTES[dir]);
      return;
    }

    // 3. Otherwise stagger card reveal
    INTENT_OPTIONS.forEach((_, i) => {
      setTimeout(() => setVisibleCards(prev => [...prev, i]), 150 + i * 110);
    });
  }, [authLoading, user, router]);

  // ── Confirm selection ─────────────────────────────────────────────────────
  const handleConfirm = useCallback(async () => {
    if (!selected || saving) return;
    setSaving(true);
    setError(null);

    try {
      // Save to backend (updates users/{uid}.user_direction in Firestore)
      await intentGatewayService.saveDirection(selected);
      // Cache locally so future loads skip gateway instantly
      intentGatewayService.cacheDirection(selected);
      // Navigate to chosen destination
      await router.push(DIRECTION_ROUTES[selected]);
    } catch (e) {
      setError('Could not save your selection. Please try again.');
      setSaving(false);
    }
  }, [selected, saving, router]);

  // ── Guard: wait for auth ──────────────────────────────────────────────────
  if (!mounted || authLoading) {
    return <GatewayShell><LoadingPulse /></GatewayShell>;
  }

  return (
    <>
      <GatewayShell>
        {/* Header text */}
        <header className="ig-header">
          <div className="ig-eyebrow">Welcome back{user?.displayName ? `, ${user.displayName.split(' ')[0]}` : ''}</div>
          <h1 className="ig-headline">What would you like<br />help with today?</h1>
          <p className="ig-subtext">
            Choose your focus area. You can change this later in settings.
          </p>
        </header>

        {/* Cards */}
        <div className="ig-cards" role="radiogroup" aria-label="Select your intent">
          {INTENT_OPTIONS.map((option, i) => (
            <IntentCard
              key={option.id}
              option={option}
              isSelected={selected === option.id}
              isVisible={visibleCards.includes(i)}
              onSelect={() => setSelected(option.id)}
            />
          ))}
        </div>

        {/* CTA */}
        <div className="ig-cta-row">
          {error && <p className="ig-error">{error}</p>}
          <button
            className="ig-confirm-btn"
            disabled={!selected || saving}
            onClick={handleConfirm}
            data-active={!!selected}
            aria-busy={saving}
          >
            {saving ? (
              <span className="ig-btn-inner">
                <span className="ig-spinner" />
                Redirecting…
              </span>
            ) : selected ? (
              <span className="ig-btn-inner">
                Continue with {INTENT_OPTIONS.find(o => o.id === selected)?.title}
                <span className="ig-btn-arrow">→</span>
              </span>
            ) : (
              'Select an option to continue'
            )}
          </button>
          <p className="ig-skip-note">
            Your choice is saved — you won't see this screen again.
          </p>
        </div>
      </GatewayShell>

      <style>{GATEWAY_STYLES}</style>
    </>
  );
}

// ─── IntentCard ───────────────────────────────────────────────────────────────

interface IntentCardProps {
  option: IntentOption;
  isSelected: boolean;
  isVisible: boolean;
  onSelect: () => void;
}

function IntentCard({ option, isSelected, isVisible, onSelect }: IntentCardProps) {
  return (
    <button
      role="radio"
      aria-checked={isSelected}
      className="ig-card"
      data-selected={isSelected}
      data-visible={isVisible}
      onClick={onSelect}
      style={{ '--accent': option.accentColor } as React.CSSProperties}
    >
      {/* Selection ring indicator */}
      <div className="ig-card-radio">
        <div className="ig-card-radio-dot" />
      </div>

      {/* Icon */}
      <div className="ig-card-icon">{option.icon}</div>

      {/* Content */}
      <div className="ig-card-body">
        <h2 className="ig-card-title">{option.title}</h2>
        <p className="ig-card-desc">{option.description}</p>
        <p className="ig-card-detail">{option.detail}</p>
        <div className="ig-card-tag">{option.tag}</div>
      </div>

      {/* Selected overlay line */}
      <div className="ig-card-line" />
    </button>
  );
}

// ─── Shell wrapper ────────────────────────────────────────────────────────────

function GatewayShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="ig-root">
      <div className="ig-bg-mesh" aria-hidden />
      <main className="ig-container">{children}</main>
    </div>
  );
}

function LoadingPulse() {
  return (
    <div className="ig-loading">
      <div className="ig-loading-dot" />
      <div className="ig-loading-dot" style={{ animationDelay: '0.15s' }} />
      <div className="ig-loading-dot" style={{ animationDelay: '0.3s' }} />
    </div>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const GATEWAY_STYLES = `
  /* Root */
  .ig-root {
    min-height: 100vh;
    background: #080c14;
    display: flex;
    align-items: center;
    justify-content: center;
    font-family: 'DM Sans', sans-serif;
    position: relative;
    overflow: hidden;
    padding: 40px 24px;
  }

  /* Atmospheric background mesh */
  .ig-bg-mesh {
    position: fixed;
    inset: 0;
    background:
      radial-gradient(ellipse 80% 50% at 20% 20%, rgba(99,102,241,0.12) 0%, transparent 60%),
      radial-gradient(ellipse 60% 40% at 80% 80%, rgba(16,185,129,0.08) 0%, transparent 60%),
      radial-gradient(ellipse 50% 60% at 50% 50%, rgba(6,182,212,0.05) 0%, transparent 70%);
    pointer-events: none;
    z-index: 0;
  }

  .ig-container {
    position: relative;
    z-index: 1;
    width: 100%;
    max-width: 960px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 40px;
  }

  /* Header */
  .ig-header {
    text-align: center;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
  }

  .ig-eyebrow {
    font-family: 'DM Sans', sans-serif;
    font-size: 13px;
    font-weight: 500;
    color: #6366f1;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    background: rgba(99,102,241,0.1);
    padding: 4px 14px;
    border-radius: 20px;
    border: 1px solid rgba(99,102,241,0.2);
  }

  .ig-headline {
    font-family: 'Syne', sans-serif;
    font-size: clamp(28px, 4vw, 46px);
    font-weight: 800;
    color: #f9fafb;
    line-height: 1.15;
    letter-spacing: -0.02em;
    margin: 0;
  }

  .ig-subtext {
    font-size: 15px;
    color: #6b7280;
    margin: 0;
    max-width: 380px;
    line-height: 1.6;
  }

  /* Cards grid */
  .ig-cards {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 16px;
    width: 100%;
  }

  @media (max-width: 768px) {
    .ig-cards { grid-template-columns: 1fr; max-width: 440px; }
  }

  /* Individual card */
  .ig-card {
    position: relative;
    background: rgba(17, 24, 39, 0.8);
    border: 1.5px solid rgba(255,255,255,0.06);
    border-radius: 20px;
    padding: 28px 24px 24px;
    text-align: left;
    cursor: pointer;
    display: flex;
    flex-direction: column;
    gap: 16px;
    transition: transform 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease;
    backdrop-filter: blur(8px);

    /* Entrance animation */
    opacity: 0;
    transform: translateY(20px);
  }

  .ig-card[data-visible="true"] {
    animation: cardReveal 0.5s ease forwards;
  }

  @keyframes cardReveal {
    to { opacity: 1; transform: translateY(0); }
  }

  .ig-card:hover {
    transform: translateY(-3px);
    border-color: color-mix(in srgb, var(--accent) 40%, transparent);
    box-shadow: 0 8px 40px color-mix(in srgb, var(--accent) 12%, transparent);
  }

  .ig-card[data-selected="true"] {
    border-color: var(--accent);
    background: color-mix(in srgb, var(--accent) 8%, #111827);
    box-shadow:
      0 0 0 1px var(--accent),
      0 8px 40px color-mix(in srgb, var(--accent) 20%, transparent);
    transform: translateY(-3px);
  }

  /* Radio indicator */
  .ig-card-radio {
    position: absolute;
    top: 16px;
    right: 16px;
    width: 20px;
    height: 20px;
    border-radius: 50%;
    border: 2px solid rgba(255,255,255,0.15);
    display: flex;
    align-items: center;
    justify-content: center;
    transition: border-color 0.2s;
  }

  .ig-card[data-selected="true"] .ig-card-radio {
    border-color: var(--accent);
    background: color-mix(in srgb, var(--accent) 20%, transparent);
  }

  .ig-card-radio-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--accent);
    opacity: 0;
    transform: scale(0);
    transition: all 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
  }

  .ig-card[data-selected="true"] .ig-card-radio-dot {
    opacity: 1;
    transform: scale(1);
  }

  /* Icon */
  .ig-card-icon {
    font-size: 36px;
    line-height: 1;
    filter: grayscale(0.2);
  }

  /* Body */
  .ig-card-body {
    display: flex;
    flex-direction: column;
    gap: 8px;
    flex: 1;
  }

  .ig-card-title {
    font-family: 'Syne', sans-serif;
    font-size: 17px;
    font-weight: 700;
    color: #f3f4f6;
    margin: 0;
    line-height: 1.3;
    transition: color 0.2s;
  }

  .ig-card[data-selected="true"] .ig-card-title {
    color: color-mix(in srgb, var(--accent) 90%, white);
  }

  .ig-card-desc {
    font-size: 13px;
    font-weight: 600;
    color: #9ca3af;
    margin: 0;
    line-height: 1.4;
    font-style: italic;
  }

  .ig-card-detail {
    font-size: 13px;
    color: #4b5563;
    margin: 0;
    line-height: 1.65;
  }

  .ig-card-tag {
    margin-top: 4px;
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.05em;
    color: var(--accent);
    opacity: 0.7;
    text-transform: uppercase;
  }

  /* Selected accent line at bottom */
  .ig-card-line {
    position: absolute;
    bottom: 0;
    left: 20px;
    right: 20px;
    height: 2px;
    border-radius: 2px;
    background: var(--accent);
    transform: scaleX(0);
    transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
    transform-origin: center;
  }

  .ig-card[data-selected="true"] .ig-card-line {
    transform: scaleX(1);
  }

  /* CTA row */
  .ig-cta-row {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
    width: 100%;
    max-width: 440px;
  }

  .ig-error {
    color: #ef4444;
    font-size: 13px;
    text-align: center;
  }

  .ig-confirm-btn {
    width: 100%;
    padding: 15px 28px;
    border-radius: 12px;
    border: none;
    font-family: 'DM Sans', sans-serif;
    font-size: 15px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s ease;
    background: rgba(255,255,255,0.06);
    color: #4b5563;
    letter-spacing: 0.01em;
  }

  .ig-confirm-btn[data-active="true"] {
    background: linear-gradient(135deg, #6366f1, #8b5cf6);
    color: white;
    box-shadow: 0 4px 24px rgba(99,102,241,0.35);
  }

  .ig-confirm-btn[data-active="true"]:hover:not(:disabled) {
    transform: translateY(-1px);
    box-shadow: 0 8px 32px rgba(99,102,241,0.45);
  }

  .ig-confirm-btn:disabled {
    cursor: not-allowed;
    opacity: 0.7;
  }

  .ig-btn-inner {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
  }

  .ig-btn-arrow {
    font-size: 18px;
    transition: transform 0.2s;
  }

  .ig-confirm-btn:hover .ig-btn-arrow {
    transform: translateX(3px);
  }

  .ig-spinner {
    width: 16px;
    height: 16px;
    border: 2px solid rgba(255,255,255,0.3);
    border-top-color: white;
    border-radius: 50%;
    animation: spin 0.7s linear infinite;
  }

  @keyframes spin { to { transform: rotate(360deg); } }

  .ig-skip-note {
    font-size: 12px;
    color: #374151;
    text-align: center;
    margin: 0;
  }

  /* Loading */
  .ig-loading {
    display: flex;
    gap: 8px;
    align-items: center;
    justify-content: center;
    padding: 60px;
  }

  .ig-loading-dot {
    width: 8px;
    height: 8px;
    background: #374151;
    border-radius: 50%;
    animation: pulse 1.2s ease-in-out infinite;
  }

  @keyframes pulse {
    0%, 100% { opacity: 0.3; transform: scale(0.8); }
    50% { opacity: 1; transform: scale(1); }
  }
`;