'use client';

/**
 * src/app/employer/pipeline/page.tsx
 * Route: /employer/pipeline?employerId=<id>
 */

import dynamic from 'next/dynamic';
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';

const TalentPipelinePage = dynamic(
  () => import('@/modules/employer-dashboard/pages/TalentPipelinePage'),
  { ssr: false }
);

function Page() {
  const params     = useSearchParams();
  const employerId = params.get('employerId') || '';
  return <TalentPipelinePage employerId={employerId} />;
}

export default function EmployerPipelinePage() {
  return (
    <Suspense fallback={null}>
      <Page />
    </Suspense>
  );
}
