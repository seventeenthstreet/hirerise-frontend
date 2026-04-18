'use client';

/**
 * src/app/advisor/page.tsx
 * Route: /advisor
 *
 * App Router entry point — dynamically imports AdvisorChatPage so the
 * component (which relies on browser APIs + Firebase auth) is never
 * server-rendered.
 */

import dynamic from 'next/dynamic';

const AdvisorChatPage = dynamic(
  () => import('@/modules/career-advisor/pages/AdvisorChatPage'),
  {
    ssr: false,
    loading: () => (
      <div
        style={{
          minHeight:       '100vh',
          background:      '#080c14',
          display:         'flex',
          alignItems:      'center',
          justifyContent:  'center',
          flexDirection:   'column',
          gap:             16,
          fontFamily:      "'DM Sans', sans-serif",
          color:           '#6b7280',
        }}
      >
        <div
          style={{
            width:        36,
            height:       36,
            borderRadius: '50%',
            border:       '3px solid #1f2937',
            borderTopColor: '#6ee7b7',
            animation:    'spin 0.7s linear infinite',
          }}
        />
        <span style={{ fontSize: 14 }}>Loading your AI Career Advisor…</span>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    ),
  }
);

export default function AdvisorPage() {
  return <AdvisorChatPage />;
}
