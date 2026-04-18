'use client';

/**
 * app/career-dashboard/_sections/KPITiles.tsx — FIXED
 *
 * Correct property names from real hook types:
 *   useJobMatches  → data.recommended_jobs[0].match_score
 *   useCareerHealth → data.chiScore, data.automationRisk (object | null)
 *   userStore      → resume.score (via selectScore)
 */

import { useRouter } from 'next/navigation';
import { useCareerHealth } from '@/hooks/useCareerHealth';
import { useJobMatches }   from '@/hooks/useJobMatches';
import { useUserStore, selectScore } from '@/lib/store/userStore';

const T = {
  card:   '#0d1117',
  border: 'rgba(255,255,255,0.07)',
  text:   '#dde4ef',
  muted:  '#5f6d87',
  dim:    '#1a2236',
  blue:   '#3c72f8',
  green:  '#1fd8a0',
  amber:  '#f4a928',
  red:    '#ef5b48',
} as const;

interface Tile {
  label:    string;
  value:    string | null;
  subLabel: string;
  cta:      string;
  route:    string;
  color:    string;
  loading:  boolean;
}

function KPICard({ tile }: { tile: Tile }) {
  const router = useRouter();
  return (
    <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, padding: '18px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: T.muted, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
        {tile.label}
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
        <div style={{ fontSize: 28, fontWeight: 700, color: tile.loading ? T.muted : (tile.value ? tile.color : T.muted) }}>
          {tile.loading ? '—' : (tile.value ?? '—')}
        </div>
        <div style={{ fontSize: 12, color: T.muted }}>{tile.subLabel}</div>
      </div>
      <button
        onClick={() => router.push(tile.route)}
        style={{
          padding: '7px 0', background: `${tile.color}18`, color: tile.color,
          border: `1px solid ${tile.color}30`, borderRadius: 7,
          fontSize: 12, fontWeight: 600, cursor: 'pointer', marginTop: 'auto',
        }}
      >
        {tile.cta}
      </button>
    </div>
  );
}

function scoreColor(v: number | null, invert = false) {
  if (v == null) return T.muted;
  const good = v >= 70, mid = v >= 50;
  if (invert) return good ? T.red : mid ? T.amber : T.green;
  return good ? T.green : mid ? T.amber : T.red;
}

export default function KPITiles() {
  const { data: chi,     isLoading: chiLoading }   = useCareerHealth();
  const { data: matches, isLoading: matchLoading } = useJobMatches();
  const resumeScore = useUserStore(selectScore);

  const chiScore = chi?.chiScore ?? null;

  // automationRisk is typed as object { score, level, recommendation } | null
  const autoRiskRaw = (chi as any)?.automationRisk;
  const autoRisk: number | null =
    autoRiskRaw == null           ? null :
    typeof autoRiskRaw === 'number' ? autoRiskRaw :
    typeof autoRiskRaw?.score === 'number' ? autoRiskRaw.score :
    null;

  // JobMatchData.recommended_jobs[0].match_score is the top job score
  const topJob   = matches?.recommended_jobs?.[0];
  const jobScore = topJob != null ? topJob.match_score : null;

  const tiles: Tile[] = [
    {
      label:    'Career Health',
      value:    chiScore != null ? `${chiScore}` : null,
      subLabel: '/ 100',
      cta:      chiScore != null && chiScore < 60 ? 'Improve Score →' : 'View Details →',
      route:    '/career-health',
      color:    scoreColor(chiScore),
      loading:  chiLoading,
    },
    {
      label:    'Resume Score',
      value:    resumeScore != null ? `${resumeScore}` : null,
      subLabel: '/ 100',
      cta:      resumeScore != null && resumeScore < 60 ? 'Fix Resume Now →' : 'Optimise CV →',
      route:    '/resume-builder',
      color:    scoreColor(resumeScore),
      loading:  false,
    },
    {
      label:    'Job Match',
      value:    jobScore != null ? `${Math.round(jobScore)}%` : null,
      subLabel: 'top fit',
      cta:      'Apply to Matching Jobs →',
      route:    '/job-fit',
      color:    scoreColor(jobScore),
      loading:  matchLoading,
    },
    {
      label:    'Automation Risk',
      value:    autoRisk != null ? `${Math.round(autoRisk)}%` : null,
      subLabel: 'exposure',
      cta:      autoRisk != null && autoRisk > 60 ? 'Reduce My Risk →' : 'View Risk Profile →',
      route:    '/skills',
      color:    scoreColor(autoRisk, true),
      loading:  chiLoading,
    },
  ];

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 12 }}>
      {tiles.map(t => <KPICard key={t.label} tile={t} />)}
    </div>
  );
}