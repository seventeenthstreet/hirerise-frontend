'use client';

/**
 * app/career-dashboard/_sections/JobMatchSection.tsx — FIXED
 *
 * JobMatchData shape:
 *   { recommended_jobs: JobMatch[], total_roles_evaluated, user_skills_count,
 *     target_role, industry, message? }
 *
 * JobMatch shape:
 *   { id, title, sector, match_score, skill_score, missing_skills, salary }
 */

import { useJobMatches } from '@/hooks/useJobMatches';
import { useRouter }     from 'next/navigation';

const T = {
  card: '#0d1117', border: 'rgba(255,255,255,0.07)',
  text: '#dde4ef', muted: '#5f6d87', dim: '#1a2236',
  blue: '#3c72f8', green: '#1fd8a0', amber: '#f4a928',
} as const;

export default function JobMatchSection() {
  const { data, isLoading } = useJobMatches();
  const router = useRouter();

  // Correct field: recommended_jobs (not matches or items)
  const jobs = data?.recommended_jobs ?? [];

  return (
    <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, padding: '20px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <h2 style={{ fontSize: 15, fontWeight: 600, color: T.text, margin: 0 }}>Job Matches</h2>
        <button
          onClick={() => router.push('/job-fit')}
          style={{ fontSize: 12, color: T.blue, background: 'transparent', border: 'none', cursor: 'pointer', fontWeight: 600 }}
        >
          Apply to Matching Jobs →
        </button>
      </div>

      {isLoading ? (
        <div style={{ color: T.muted, fontSize: 13 }}>Finding your best matches…</div>
      ) : jobs.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '20px 0' }}>
          <div style={{ fontSize: 13, color: T.muted, marginBottom: 12 }}>
            No matches yet. Upload your resume to find jobs that fit you.
          </div>
          <button
            onClick={() => router.push('/resume')}
            style={{ padding: '10px 20px', background: T.blue, color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
          >
            Upload Resume →
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {jobs.slice(0, 4).map((job) => {
            const score = job.match_score ?? 0;
            const color = score >= 70 ? T.green : score >= 50 ? T.amber : T.muted;
            return (
              <div
                key={job.id}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: T.dim, borderRadius: 8, padding: '12px 14px' }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: T.text, marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {job.title}
                  </div>
                  <div style={{ fontSize: 11, color: T.muted }}>
                    {job.sector ?? ''}
                    {job.missing_skills?.length ? ` · ${job.missing_skills.length} skills to gain` : ''}
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
                  <div style={{ height: 4, width: 60, background: T.card, borderRadius: 2, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${score}%`, background: color, borderRadius: 2 }} />
                  </div>
                  <span style={{ fontSize: 12, fontWeight: 700, color, minWidth: 34, textAlign: 'right' }}>
                    {Math.round(score)}%
                  </span>
                </div>
              </div>
            );
          })}

          <button
            onClick={() => router.push('/job-fit')}
            style={{ marginTop: 4, padding: '11px 0', background: T.blue, color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
          >
            Apply to Matching Jobs →
          </button>
        </div>
      )}
    </div>
  );
}