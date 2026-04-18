'use client';
/**
 * app/(dashboard)/interview-prep/page.tsx
 * Route: /interview-prep
 */
import { useResumes } from '@/hooks/useResumes';
import { InterviewPrepFull } from '@/components/InterviewPrep';

export default function InterviewPrepPage() {
  const { data: resumesData } = useResumes();
  const resumeContent = (resumesData as any)?.items?.[0]?.content ?? null;

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '28px 16px 80px' }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ margin: 0, fontSize: 26, fontWeight: 900, letterSpacing: '-.02em' }}>
          🎤 Interview Prep
        </h1>
        <p style={{ margin: '6px 0 0', fontSize: 13, opacity: 0.55 }}>
          Role-specific questions, personalised answers, and Ava coaching — all from your resume.
        </p>
      </div>
      <InterviewPrepFull resumeData={resumeContent} />
    </div>
  );
}