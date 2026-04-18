'use client';

/**
 * src/app/education/skills/[studentId]/page.tsx
 * Route: /education/skills/:studentId
 *
 * Renders the Skill Evolution Engine results for a given student.
 * Delegates all logic and UI to the SkillRecommendations module page.
 */

import dynamic from 'next/dynamic';
import { useParams } from 'next/navigation';
import { Suspense } from 'react';
import type React from 'react';

// ─── Lazy-load the heavy module to keep the route shell lean ──────────────────

const SkillRecommendations = dynamic(
  () => import('@/modules/skill-evolution/pages/SkillRecommendations'),
  {
    ssr: false,
    loading: () => (
      <div style={styles.loadWrap}>
        <div style={styles.spinner} />
        <span style={styles.loadText}>Loading skill recommendations…</span>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    ),
  },
);

// ─── Inner component — reads params inside Suspense boundary ──────────────────

function SkillsPageInner() {
  const params    = useParams();
  const studentId = params?.studentId ? String(params.studentId) : undefined;

  return <SkillRecommendations studentId={studentId} />;
}

// ─── Page export ──────────────────────────────────────────────────────────────

export default function EducationSkillsPage() {
  return (
    <Suspense fallback={<div style={styles.suspenseFallback} />}>
      <SkillsPageInner />
    </Suspense>
  );
}

// ─── Minimal inline styles (no Tailwind dependency on the shell) ──────────────

const styles: Record<string, React.CSSProperties> = {
  suspenseFallback: {
    minHeight: '100vh',
    background: '#080c14',
  },
  loadWrap: {
    minHeight: '100vh',
    background: '#080c14',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
  },
  spinner: {
    width: 36,
    height: 36,
    borderRadius: '50%',
    border: '3px solid #1f2937',
    borderTopColor: '#06b6d4',
    animation: 'spin 0.7s linear infinite',
  },
  loadText: {
    fontSize: 14,
    color: '#6b7280',
    fontFamily: 'sans-serif',
    margin: 0,
  },
};