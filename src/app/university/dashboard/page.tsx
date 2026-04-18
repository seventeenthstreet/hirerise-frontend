'use client';

/**
 * src/app/university/dashboard/page.tsx
 * Route: /university/dashboard?universityId=<id>
 */

import dynamic from 'next/dynamic';
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';

const UniversityDashboard = dynamic(
  () => import('@/modules/university-dashboard/pages/UniversityDashboard'),
  { ssr: false, loading: () => <LoadingScreen label="University Dashboard" /> }
);

function LoadingScreen({ label = 'Loading…' }: { label?: string }) {
  return (
    <div style={{ minHeight: '100vh', background: '#0f172a', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 14 }}>
      <div style={{ width: 36, height: 36, borderRadius: '50%', border: '3px solid #1e293b', borderTopColor: '#3b82f6', animation: 'spin 0.7s linear infinite' }} />
      <span style={{ fontSize: 14, color: '#64748b', fontFamily: 'sans-serif' }}>Loading {label}…</span>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

function Page() {
  const params       = useSearchParams();
  const universityId = params.get('universityId') || '';
  return <UniversityDashboard universityId={universityId} />;
}

export default function UniversityDashboardPage() {
  return (
    <Suspense fallback={<LoadingScreen label="University Dashboard" />}>
      <Page />
    </Suspense>
  );
}
