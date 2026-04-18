'use client';

/**
 * src/app/intelligence/page.tsx
 * Route: /intelligence
 *
 * App Router entry point for the Global Career Intelligence Dashboard.
 * Dynamically imported (browser-only) — avoids SSR issues with SVG animations
 * and auth-gated API calls.
 */

import dynamic from 'next/dynamic';

const GlobalInsightsDashboard = dynamic(
  () => import('@/modules/career-intelligence/pages/GlobalInsightsDashboard'),
  {
    ssr: false,
    loading: () => (
      <div style={{
        minHeight: '100vh',
        background: '#080c14',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'column',
        gap: 16,
      }}>
        <div style={{
          width: 44,
          height: 44,
          borderRadius: '50%',
          border: '3px solid #1f2937',
          borderTopColor: '#06b6d4',
          animation: 'spin 0.8s linear infinite',
        }} />
        <p style={{
          fontSize: 13,
          color: '#6b7280',
          fontFamily: "'DM Sans', sans-serif",
          margin: 0,
        }}>
          Loading Global Career Intelligence…
        </p>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    ),
  }
);

export default function IntelligencePage() {
  return <GlobalInsightsDashboard />;
}