'use client';

/**
 * src/app/university/matches/page.tsx
 * Route: /university/matches?universityId=<id>&programId=<optional>
 */

import dynamic from 'next/dynamic';
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';

const StudentMatchesPage = dynamic(
  () => import('@/modules/university-dashboard/pages/StudentMatchesPage'),
  { ssr: false }
);

function Page() {
  const params       = useSearchParams();
  const universityId = params.get('universityId') || '';
  const programId    = params.get('programId')    || undefined;
  return <StudentMatchesPage universityId={universityId} programId={programId} />;
}

export default function UniversityMatchesPage() {
  return (
    <Suspense fallback={null}>
      <Page />
    </Suspense>
  );
}
