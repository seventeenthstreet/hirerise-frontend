'use client';

/**
 * src/app/employer/dashboard/page.tsx
 * Route: /employer/dashboard?employerId=<id>
 */

import dynamic from 'next/dynamic';
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';

const EmployerDashboard = dynamic(
  () => import('@/modules/employer-dashboard/pages/EmployerDashboard'),
  { ssr: false, loading: () => <LoadingScreen /> }
);

function LoadingScreen() {
  return (
    <div style={{ minHeight: '100vh', background: '#0f172a', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 14 }}>
      <div style={{ width: 36, height: 36, borderRadius: '50%', border: '3px solid #1e293b', borderTopColor: '#3b82f6', animation: 'spin 0.7s linear infinite' }} />
      <span style={{ fontSize: 14, color: '#64748b', fontFamily: 'sans-serif' }}>Loading Employer Dashboard…</span>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

function Page() {
  const params     = useSearchParams();
  const employerId = params.get('employerId') || '';
  return <EmployerDashboard employerId={employerId} />;
}

export default function EmployerDashboardPage() {
  return (
    <Suspense fallback={<LoadingScreen />}>
      <Page />
    </Suspense>
  );
}
