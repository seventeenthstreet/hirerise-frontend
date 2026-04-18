'use client';

/**
 * src/app/school/dashboard/page.tsx
 * Route: /school/dashboard?schoolId=<id>
 *
 * App Router entry point for the School Dashboard.
 * Reads schoolId from the URL search params and passes it to SchoolDashboard.
 */

import dynamic from 'next/dynamic';
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';

const SchoolDashboard = dynamic(
  () => import('@/modules/school-dashboard/pages/SchoolDashboard'),
  {
    ssr: false,
    loading: () => <LoadingScreen />,
  }
);

function LoadingScreen() {
  return (
    <div style={{ minHeight: '100vh', background: '#080c14', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 14 }}>
      <div style={{ width: 36, height: 36, borderRadius: '50%', border: '3px solid #1f2937', borderTopColor: '#a5b4fc', animation: 'spin 0.7s linear infinite' }} />
      <span style={{ fontSize: 14, color: '#6b7280', fontFamily: 'sans-serif' }}>Loading School Dashboard…</span>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

function SchoolDashboardWithParams() {
  const params   = useSearchParams();
  const schoolId = params.get('schoolId') || '';
  return <SchoolDashboard schoolId={schoolId} />;
}

export default function SchoolDashboardPage() {
  return (
    <Suspense fallback={<LoadingScreen />}>
      <SchoolDashboardWithParams />
    </Suspense>
  );
}
