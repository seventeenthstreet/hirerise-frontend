'use client';

/**
 * src/app/(dashboard)/opportunities/page.tsx
 * Route: /opportunities (inside the authenticated dashboard layout)
 *
 * Full-page opportunities view for students.
 * Extends the widget shown on the main dashboard.
 */

import dynamic from 'next/dynamic';
import { Suspense } from 'react';

const OpportunitiesSection = dynamic(
  () => import('@/features/dashboard/components/OpportunitiesSection'),
  { ssr: false }
);

export default function OpportunitiesPage() {
  return (
    <div style={S.page}>
      <div style={S.header}>
        <div style={S.title}>Your Opportunities</div>
        <div style={S.sub}>
          AI-matched universities and careers based on your stream, skills, and cognitive profile
        </div>
      </div>
      <Suspense fallback={null}>
        <OpportunitiesSection />
      </Suspense>
    </div>
  );
}

const S: Record<string, React.CSSProperties> = {
  page:   { minHeight: '100vh', background: '#0f172a', padding: '32px 24px', fontFamily: 'inherit' },
  header: { marginBottom: 28 },
  title:  { fontSize: 26, fontWeight: 700, color: '#f1f5f9', marginBottom: 6 },
  sub:    { fontSize: 14, color: '#64748b' },
};

// React import needed for CSSProperties
import React from 'react';
