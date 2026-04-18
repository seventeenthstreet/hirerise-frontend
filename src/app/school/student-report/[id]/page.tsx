'use client';

/**
 * src/app/school/student-report/[id]/page.tsx
 * Route: /school/student-report/:studentId?schoolId=<id>
 */

import dynamic from 'next/dynamic';
import { useParams, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';

const StudentReportPage = dynamic(
  () => import('@/modules/school-dashboard/pages/StudentReportPage'),
  {
    ssr: false,
    loading: () => (
      <div style={{ minHeight: '100vh', background: '#080c14', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 14 }}>
        <div style={{ width: 36, height: 36, borderRadius: '50%', border: '3px solid #1f2937', borderTopColor: '#6ee7b7', animation: 'spin 0.7s linear infinite' }} />
        <span style={{ fontSize: 14, color: '#6b7280', fontFamily: 'sans-serif' }}>Loading student report…</span>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    ),
  }
);

function ReportWithParams() {
  const params      = useParams();
  const searchParams = useSearchParams();
  const studentId   = String(params?.id || '');
  const schoolId    = searchParams.get('schoolId') || '';
  return <StudentReportPage schoolId={schoolId} studentId={studentId} />;
}

export default function StudentReportRoutePage() {
  return (
    <Suspense fallback={<div style={{ minHeight: '100vh', background: '#080c14' }} />}>
      <ReportWithParams />
    </Suspense>
  );
}
