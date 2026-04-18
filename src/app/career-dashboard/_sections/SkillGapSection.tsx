'use client';

/**
 * app/career-dashboard/_sections/SkillGapSection.tsx
 */

import { useCareerHealth } from '@/hooks/useCareerHealth';
import { useRouter } from 'next/navigation';

const T = {
  card: '#0d1117', border: 'rgba(255,255,255,0.07)',
  text: '#dde4ef', muted: '#5f6d87', dim: '#1a2236',
  blue: '#3c72f8', green: '#1fd8a0', amber: '#f4a928', red: '#ef5b48',
} as const;

export default function SkillGapSection() {
  const { data: chi, isLoading } = useCareerHealth();
  const router = useRouter();

  const gaps = chi?.skillGaps ?? [];

  return (
    <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, padding: '20px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <h2 style={{ fontSize: 15, fontWeight: 600, color: T.text, margin: 0 }}>Skill Gaps</h2>
        <button
          onClick={() => router.push('/skills')}
          style={{ fontSize: 12, color: T.blue, background: 'transparent', border: 'none', cursor: 'pointer', fontWeight: 600 }}
        >
          Fix Skill Gaps →
        </button>
      </div>

      {isLoading ? (
        <div style={{ color: T.muted, fontSize: 13 }}>Analysing your skills…</div>
      ) : gaps.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '20px 0' }}>
          <div style={{ fontSize: 13, color: T.muted, marginBottom: 12 }}>
            No skill gap data yet. Upload your resume to see what to learn next.
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
          {gaps.slice(0, 5).map((gap: any, i: number) => {
            const yourLevel   = gap.yourLevel   ?? 0;
            const marketLevel = gap.marketLevel ?? 70;
            const diff        = marketLevel - yourLevel;
            const color       = diff > 40 ? T.red : diff > 20 ? T.amber : T.green;

            return (
              <div key={i}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontSize: 13, color: T.text }}>{gap.skill}</span>
                  <span style={{ fontSize: 11, color, fontWeight: 600 }}>
                    {yourLevel}% → {marketLevel}%
                  </span>
                </div>
                <div style={{ height: 6, background: T.dim, borderRadius: 3, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${yourLevel}%`, background: color, borderRadius: 3, transition: 'width 0.4s' }} />
                </div>
              </div>
            );
          })}

          <button
            onClick={() => router.push('/skills')}
            style={{ marginTop: 8, padding: '11px 0', background: 'transparent', color: T.blue, border: `1px solid ${T.blue}40`, borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
          >
            Increase Salary Potential →
          </button>
        </div>
      )}
    </div>
  );
}