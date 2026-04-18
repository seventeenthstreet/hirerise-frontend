'use client';

/**
 * app/career-dashboard/_sections/InsightsSection.tsx — FIXED
 *
 * useEngagement (or useInsightsFeed) returns:
 *   { insights: ModuleState<InsightsFeedResult>, progress, alerts, actions }
 * where ModuleState<T> = { data: T | null, loading: boolean, error: string | null }
 *
 * InsightsFeedResult = { insights: CareerInsight[], unread_count, generated_at }
 */

import { useInsightsFeed } from '@/hooks/useEngagement';
import { useRouter } from 'next/navigation';

const T = {
  card: '#0d1117', border: 'rgba(255,255,255,0.07)',
  text: '#dde4ef', muted: '#5f6d87', dim: '#1a2236',
  blue: '#3c72f8', green: '#1fd8a0', amber: '#f4a928', purple: '#9b7cf7',
} as const;

const TYPE_STYLES: Record<string, { color: string; icon: string }> = {
  improvement:  { color: T.green,  icon: '↑' },
  suggestion:   { color: T.blue,   icon: '💡' },
  warning:      { color: T.amber,  icon: '⚠' },
  celebration:  { color: T.purple, icon: '🎉' },
};

export default function InsightsSection() {
  const router = useRouter();

  // useInsightsFeed returns { insights: ModuleState<InsightsFeedResult>, actions }
  const { insights: insightsState, actions } = useInsightsFeed();
  const { data, loading, error } = insightsState;

  // data is InsightsFeedResult | null
  const insights = data?.insights ?? [];

  return (
    <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, padding: '20px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <h2 style={{ fontSize: 15, fontWeight: 600, color: T.text, margin: 0 }}>
          AI Insights
          {data?.unread_count ? (
            <span style={{ marginLeft: 8, background: T.blue, color: '#fff', borderRadius: 10, padding: '1px 7px', fontSize: 10, fontWeight: 700 }}>
              {data.unread_count}
            </span>
          ) : null}
        </h2>
        <button
          onClick={() => router.push('/daily-insights')}
          style={{ fontSize: 12, color: T.blue, background: 'transparent', border: 'none', cursor: 'pointer', fontWeight: 600 }}
        >
          View All →
        </button>
      </div>

      {loading ? (
        <div style={{ color: T.muted, fontSize: 13 }}>Generating your insights…</div>
      ) : error ? (
        <div style={{ fontSize: 13, color: T.muted }}>Could not load insights right now.</div>
      ) : insights.length === 0 ? (
        <div style={{ fontSize: 13, color: T.muted, textAlign: 'center', padding: '16px 0' }}>
          Insights will appear once your profile is scored.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {insights.slice(0, 4).map((ins: any) => {
            const style = TYPE_STYLES[ins.type ?? ins.insight_type] ?? { color: T.blue, icon: '•' };
            return (
              <div
                key={ins.id}
                style={{ background: `${style.color}0e`, border: `1px solid ${style.color}25`, borderRadius: 8, padding: '12px 14px' }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                  <span style={{ fontSize: 14, lineHeight: 1, flexShrink: 0 }}>{style.icon}</span>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: T.text, marginBottom: 2 }}>
                      {ins.title}
                    </div>
                    <div style={{ fontSize: 12, color: T.muted, lineHeight: 1.5 }}>
                      {ins.body ?? ins.message ?? ins.content}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}