'use client';

/**
 * components/settings/DirectionResetCard.tsx
 *
 * Step 5: "Change my focus area" card for the Settings page.
 *
 * Allows users to reset their intent gateway selection.
 * On click → clears direction from server + localStorage
 *           → redirects to /intent-gateway so they can reselect.
 *
 * Drop this into your existing Settings page — no modifications to Settings itself needed.
 * Example usage:
 *   import { DirectionResetCard } from '@/components/settings/DirectionResetCard';
 *   <DirectionResetCard />
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { intentGatewayService } from '@/services/intentGatewayService';
import type { UserDirection } from '@/types/intentGateway';

const DIRECTION_LABELS: Record<UserDirection, string> = {
  education: '🎓 Educational Direction',
  career:    '🚀 Career Path Guidance',
  market:    '📊 Market Intelligence',
};

interface DirectionResetCardProps {
  currentDirection?: UserDirection | null;
}

export function DirectionResetCard({ currentDirection }: DirectionResetCardProps) {
  const router   = useRouter();
  const [loading, setLoading] = useState(false);
  const [error,   setError  ] = useState<string | null>(null);

  async function handleReset() {
    setLoading(true);
    setError(null);
    try {
      await intentGatewayService.resetDirection();
      await router.push('/intent-gateway');
    } catch {
      setError('Could not reset your focus area. Please try again.');
      setLoading(false);
    }
  }

  return (
    <div style={styles.card}>
      <div style={styles.cardContent}>
        <div>
          <p style={styles.label}>Your Focus Area</p>
          <p style={styles.current}>
            {currentDirection
              ? DIRECTION_LABELS[currentDirection]
              : 'Not set'}
          </p>
          <p style={styles.hint}>
            Change this to see a different view when you log in.
          </p>
        </div>
        <button
          onClick={handleReset}
          disabled={loading}
          style={{
            ...styles.btn,
            ...(loading ? styles.btnDisabled : {}),
          }}
        >
          {loading ? 'Resetting…' : 'Change Focus Area'}
        </button>
      </div>
      {error && <p style={styles.error}>{error}</p>}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  card: {
    background: 'rgba(17,24,39,0.8)',
    border: '1.5px solid rgba(255,255,255,0.07)',
    borderRadius: 16,
    padding: '20px 24px',
    fontFamily: "'DM Sans', sans-serif",
  },
  cardContent: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
    flexWrap: 'wrap',
  },
  label: {
    fontSize: 12,
    fontWeight: 600,
    color: '#6b7280',
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
    margin: '0 0 4px',
  },
  current: {
    fontSize: 16,
    fontWeight: 600,
    color: '#f3f4f6',
    margin: '0 0 4px',
  },
  hint: {
    fontSize: 13,
    color: '#4b5563',
    margin: 0,
  },
  btn: {
    padding: '10px 20px',
    borderRadius: 10,
    border: '1.5px solid rgba(255,255,255,0.1)',
    background: 'transparent',
    color: '#9ca3af',
    fontSize: 14,
    fontWeight: 500,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    transition: 'all 0.2s',
  },
  btnDisabled: {
    opacity: 0.5,
    cursor: 'not-allowed',
  },
  error: {
    marginTop: 12,
    color: '#ef4444',
    fontSize: 13,
  },
};