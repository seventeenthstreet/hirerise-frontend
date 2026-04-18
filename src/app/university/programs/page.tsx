'use client';

/**
 * src/app/university/programs/page.tsx
 * Route: /university/programs?universityId=<id>
 */

import dynamic from 'next/dynamic';
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';

const ProgramsPage = dynamic(
  () => import('@/modules/university-dashboard/pages/ProgramsPage'),
  { ssr: false }
);

function Page() {
  const params       = useSearchParams();
  const universityId = params.get('universityId') || '';
  return <ProgramsPage universityId={universityId} />;
}

export default function UniversityProgramsPage() {
  return (
    <Suspense fallback={null}>
      <Page />
    </Suspense>
  );
}
