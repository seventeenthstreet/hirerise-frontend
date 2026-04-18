'use client';

/**
 * src/app/school/students/page.tsx
 * Route: /school/students?schoolId=<id>
 */

import dynamic from 'next/dynamic';
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';

const StudentsPage = dynamic(
  () => import('@/modules/school-dashboard/pages/StudentsPage'),
  {
    ssr: false,
    loading: () => (
      <div style={{ minHeight: '100vh', background: '#080c14', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ width: 32, height: 32, borderRadius: '50%', border: '3px solid #1f2937', borderTopColor: '#6ee7b7', animation: 'spin 0.7s linear infinite' }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    ),
  }
);

function StudentsPageWithParams() {
  const params   = useSearchParams();
  const schoolId = params.get('schoolId') || '';
  const role     = params.get('role') || '';
  return <StudentsPage schoolId={schoolId} userRole={role} />;
}

export default function SchoolStudentsPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: '100vh', background: '#080c14' }} />}>
      <StudentsPageWithParams />
    </Suspense>
  );
}
