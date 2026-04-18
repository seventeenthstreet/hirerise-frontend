import React, { useEffect, useState } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CareerTrend {
  career_name:      string;
  demand_score:     number;
  trend_score:      number;
  automation_risk:  number;
  salary_growth:    number;
  top_skills?:      string[];
}

export interface SkillDemand {
  skill_name:     string;
  demand_score:   number;
  growth_rate:    number;
  industry_usage: string[];
}

interface Props {
  careerTrends?: CareerTrend[];
  skillDemand?:  SkillDemand[];
}

// ─── Config ───────────────────────────────────────────────────────────────────

const DEMAND_COLOR = (score: number): string => {
  if (score >= 90) return '#22c55e';
  if (score >= 75) return '#06b6d4';
  if (score >= 55) return '#f59e0b';
  return '#ef4444';
};

const GROWTH_COLOR = (rate: number): string => {
  if (rate >= 0.20) return '#22c55e';
  if (rate >= 0.13) return '#06b6d4';
  if (rate >= 0.08) return '#f59e0b';
  return '#9ca3af';
};

const RISK_COLOR = (risk: number): string => {
  if (risk <= 15)  return '#22c55e';
  if (risk <= 30)  return '#f59e0b';
  return '#ef4444';
};

const SKILL_COLORS = [
  '#06b6d4', '#6366f1', '#22c55e', '#f59e0b', '#a78bfa',
  '#f43f5e', '#10b981', '#8b5cf6', '#ec4899', '#14b8a6',
];

// ─── Career Demand Bar ────────────────────────────────────────────────────────

function CareerDemandBar({
  trend,
  rank,
  animated,
}: {
  trend:    CareerTrend;
  rank:     number;
  animated: boolean;
}) {
  const demandCol  = DEMAND_COLOR(trend.demand_score);
  const growthCol  = GROWTH_COLOR(trend.salary_growth);
  const riskCol    = RISK_COLOR(trend.automation_risk);
  const isTop      = rank === 0;

  return (
    <div style={MI.barRow}>
      <div style={MI.barHeader}>
        <div style={MI.barLeft}>
          <span style={{ ...MI.rankNum, color: isTop ? demandCol : '#4b5563' }}>
            #{rank + 1}
          </span>
          <span style={{ ...MI.careerLabel, color: isTop ? '#f9fafb' : '#d1d5db' }}>
            {trend.career_name}
          </span>
          {isTop && <span style={MI.hotPill}>🔥 HOT</span>}
        </div>
        <div style={MI.barRight}>
          <span style={{ ...MI.scoreChip, color: demandCol, background: `${demandCol}15` }}>
            {trend.demand_score}
          </span>
        </div>
      </div>

      {/* Demand bar */}
      <div style={MI.trackRow}>
        <span style={MI.trackLabel}>Demand</span>
        <div style={MI.track}>
          <div style={{
            ...MI.fill,
            width:      animated ? `${trend.demand_score}%` : '0%',
            background: `linear-gradient(90deg, ${demandCol}, ${demandCol}88)`,
            boxShadow:  isTop ? `0 0 10px ${demandCol}40` : 'none',
          }} />
        </div>
      </div>

      {/* Trend score bar */}
      <div style={MI.trackRow}>
        <span style={MI.trackLabel}>Trend</span>
        <div style={MI.track}>
          <div style={{
            ...MI.fill,
            width:      animated ? `${trend.trend_score}%` : '0%',
            background: `linear-gradient(90deg, #6366f1, #6366f188)`,
          }} />
        </div>
      </div>

      {/* Meta pills */}
      <div style={MI.metaRow}>
        <span style={{ ...MI.metaPill, color: growthCol, background: `${growthCol}12` }}>
          📈 +{(trend.salary_growth * 100).toFixed(0)}%/yr
        </span>
        <span style={{ ...MI.metaPill, color: riskCol, background: `${riskCol}12` }}>
          🤖 {trend.automation_risk}% risk
        </span>
        {trend.top_skills?.slice(0, 3).map(s => (
          <span key={s} style={MI.skillTag}>{s}</span>
        ))}
      </div>
    </div>
  );
}

// ─── Skill Demand Bar ─────────────────────────────────────────────────────────

function SkillBar({
  skill,
  rank,
  animated,
}: {
  skill:    SkillDemand;
  rank:     number;
  animated: boolean;
}) {
  const color = SKILL_COLORS[rank % SKILL_COLORS.length];

  return (
    <div style={MI.skillBarRow}>
      <div style={MI.skillMeta}>
        <span style={{ ...MI.skillName, color: rank < 3 ? '#f9fafb' : '#9ca3af' }}>
          {skill.skill_name}
        </span>
        <div style={MI.skillRight}>
          <span style={{ ...MI.growthTag, color: GROWTH_COLOR(skill.growth_rate) }}>
            +{(skill.growth_rate * 100).toFixed(0)}%
          </span>
          <span style={{ fontSize: 11, fontWeight: 700, color, minWidth: 24, textAlign: 'right' }}>
            {skill.demand_score}
          </span>
        </div>
      </div>
      <div style={MI.skillTrack}>
        <div style={{
          ...MI.skillFill,
          width:      animated ? `${skill.demand_score}%` : '0%',
          background: rank < 3
            ? `linear-gradient(90deg, ${color}, ${color}88)`
            : `${color}60`,
        }} />
      </div>
      {skill.industry_usage?.length > 0 && (
        <div style={MI.industryRow}>
          {skill.industry_usage.slice(0, 3).map(ind => (
            <span key={ind} style={MI.industryTag}>{ind}</span>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Tab selector ─────────────────────────────────────────────────────────────

function Tab({
  label, active, onClick,
}: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      style={{
        ...MI.tab,
        color:       active ? '#f9fafb'  : '#4b5563',
        background:  active ? '#1f2937'  : 'transparent',
        borderColor: active ? '#374151'  : 'transparent',
      }}
      onClick={onClick}
    >
      {label}
    </button>
  );
}

// ─── Summary stats strip ──────────────────────────────────────────────────────

function StatsStrip({ trends }: { trends: CareerTrend[] }) {
  const avgDemand  = Math.round(trends.reduce((s, t) => s + t.demand_score,    0) / trends.length);
  const avgGrowth  = (trends.reduce((s, t) => s + t.salary_growth, 0) / trends.length * 100).toFixed(0);
  const topCareer  = trends[0]?.career_name ?? '—';
  const lowRisk    = trends.filter(t => t.automation_risk <= 20).length;

  return (
    <div style={MI.statsStrip}>
      {[
        { label: 'Avg Market Demand', value: `${avgDemand}/100`,    color: DEMAND_COLOR(avgDemand) },
        { label: 'Avg Salary Growth', value: `+${avgGrowth}%/yr`,   color: '#22c55e' },
        { label: 'Top Career',        value: topCareer,              color: '#06b6d4', small: true },
        { label: 'Low Automation Risk', value: `${lowRisk} careers`, color: '#a78bfa' },
      ].map(({ label, value, color, small }) => (
        <div key={label} style={MI.statBox}>
          <span style={MI.statLabel}>{label}</span>
          <span style={{ ...MI.statValue, color, fontSize: small ? 12 : 16 }}>{value}</span>
        </div>
      ))}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function MarketInsightsCard({ careerTrends = [], skillDemand = [] }: Props) {
  const [activeTab, setActiveTab] = useState<'careers' | 'skills'>('careers');
  const [animated,  setAnimated]  = useState(false);
  const [showAll,   setShowAll]   = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setAnimated(true), 200);
    return () => clearTimeout(t);
  }, []);

  const hasData = careerTrends.length > 0 || skillDemand.length > 0;

  if (!hasData) {
    return (
      <div style={MI.card}>
        <p style={MI.heading}>Market Demand Insights</p>
        <p style={{ ...MI.sub, marginBottom: 0 }}>
          Market data is being collected. Check back after the next data refresh.
        </p>
      </div>
    );
  }

  const displayedCareers = showAll ? careerTrends : careerTrends.slice(0, 6);
  const displayedSkills  = showAll ? skillDemand  : skillDemand.slice(0, 10);

  return (
    <div style={MI.card}>
      {/* Header */}
      <div style={MI.headerRow}>
        <span style={MI.headerIcon}>📡</span>
        <div>
          <p style={MI.heading}>Market Demand Insights</p>
          <p style={MI.sub}>Live labor market signals — career demand, skill trends, and automation outlook</p>
        </div>
      </div>

      {/* Summary stats */}
      {careerTrends.length > 0 && <StatsStrip trends={careerTrends} />}

      {/* Tab bar */}
      <div style={MI.tabBar}>
        <Tab label={`🏢 Career Demand (${careerTrends.length})`}  active={activeTab === 'careers'} onClick={() => setActiveTab('careers')} />
        <Tab label={`⚡ Skill Trends (${skillDemand.length})`}    active={activeTab === 'skills'}  onClick={() => setActiveTab('skills')} />
      </div>

      {/* Career Demand tab */}
      {activeTab === 'careers' && (
        <div style={MI.contentArea}>
          <div style={MI.colHeaders}>
            <span style={MI.colHeader}>Career</span>
            <span style={MI.colHeader}>Demand Score</span>
          </div>
          <div style={MI.barList}>
            {displayedCareers.map((trend, i) => (
              <CareerDemandBar key={trend.career_name} trend={trend} rank={i} animated={animated} />
            ))}
          </div>
          {careerTrends.length > 6 && (
            <button style={MI.showMoreBtn} onClick={() => setShowAll(v => !v)}>
              {showAll ? '▲ Show fewer' : `▼ Show all ${careerTrends.length} careers`}
            </button>
          )}
        </div>
      )}

      {/* Skill Demand tab */}
      {activeTab === 'skills' && (
        <div style={MI.contentArea}>
          <div style={MI.colHeaders}>
            <span style={MI.colHeader}>Skill</span>
            <span style={MI.colHeader}>Demand / Growth</span>
          </div>
          <div style={MI.skillList}>
            {displayedSkills.map((skill, i) => (
              <SkillBar key={skill.skill_name} skill={skill} rank={i} animated={animated} />
            ))}
          </div>
          {skillDemand.length > 10 && (
            <button style={MI.showMoreBtn} onClick={() => setShowAll(v => !v)}>
              {showAll ? '▲ Show fewer' : `▼ Show all ${skillDemand.length} skills`}
            </button>
          )}
        </div>
      )}

      {/* Legend */}
      <div style={MI.legend}>
        {[
          { dot: '#22c55e', label: 'Very High (90+)' },
          { dot: '#06b6d4', label: 'High (75–89)' },
          { dot: '#f59e0b', label: 'Moderate (55–74)' },
          { dot: '#ef4444', label: 'Low (<55)' },
        ].map(({ dot, label }) => (
          <span key={label} style={MI.legendItem}>
            <span style={{ ...MI.legendDot, background: dot }} />
            {label}
          </span>
        ))}
      </div>

      <p style={MI.disclaimer}>
        Market signals are derived from job posting analysis and updated periodically.
        Scores reflect demand relative to other careers in the dataset.
      </p>
    </div>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const MI: Record<string, React.CSSProperties> = {
  card:        { background: '#111827', border: '1.5px solid #1f2937', borderRadius: 20, padding: '28px 28px 20px', marginTop: 20 },

  headerRow:   { display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 20 },
  headerIcon:  { fontSize: 28, lineHeight: '1' },
  heading:     { fontFamily: 'Syne, sans-serif', fontSize: 17, fontWeight: 700, color: '#f9fafb', margin: '0 0 4px' },
  sub:         { fontSize: 13, color: '#6b7280', margin: 0 },

  statsStrip:  { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 20 },
  statBox:     { background: '#0d1117', border: '1px solid #1f2937', borderRadius: 12, padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 4 },
  statLabel:   { fontSize: 10, color: '#4b5563', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' },
  statValue:   { fontSize: 16, fontWeight: 800, color: '#f9fafb' },

  tabBar:      { display: 'flex', gap: 6, marginBottom: 16, borderBottom: '1px solid #1f2937', paddingBottom: 8 },
  tab:         { padding: '6px 14px', borderRadius: 8, border: '1px solid transparent', fontSize: 12, fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s' },

  contentArea: { },
  colHeaders:  { display: 'flex', justifyContent: 'space-between', marginBottom: 10, paddingBottom: 6, borderBottom: '1px solid #1a2030' },
  colHeader:   { fontSize: 10, fontWeight: 700, color: '#374151', textTransform: 'uppercase', letterSpacing: '0.08em' },

  barList:     { display: 'flex', flexDirection: 'column', gap: 18 },
  barRow:      { display: 'flex', flexDirection: 'column', gap: 6 },
  barHeader:   { display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
  barLeft:     { display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 },
  barRight:    { flexShrink: 0 },
  rankNum:     { fontSize: 10, fontWeight: 800, minWidth: 20, textAlign: 'right' },
  careerLabel: { fontSize: 13, fontWeight: 600, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  hotPill:     { fontSize: 9, fontWeight: 800, color: '#f97316', background: 'rgba(249,115,22,0.1)', border: '1px solid rgba(249,115,22,0.25)', borderRadius: 8, padding: '1px 6px', flexShrink: 0 },
  scoreChip:   { fontSize: 13, fontWeight: 800, padding: '2px 8px', borderRadius: 8 },

  trackRow:    { display: 'flex', alignItems: 'center', gap: 8 },
  trackLabel:  { fontSize: 9, fontWeight: 600, color: '#374151', minWidth: 40, textTransform: 'uppercase' },
  track:       { flex: 1, height: 8, background: '#1f2937', borderRadius: 4, overflow: 'hidden' },
  fill:        { height: '100%', borderRadius: 4, transition: 'width 0.9s cubic-bezier(0.34,1.1,0.64,1)' },

  metaRow:     { display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 2 },
  metaPill:    { fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 8 },
  skillTag:    { fontSize: 10, color: '#4b5563', background: '#0d1117', border: '1px solid #1f2937', borderRadius: 6, padding: '1px 6px' },

  skillList:   { display: 'flex', flexDirection: 'column', gap: 14 },
  skillBarRow: { display: 'flex', flexDirection: 'column', gap: 5 },
  skillMeta:   { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  skillName:   { fontSize: 12, fontWeight: 600 },
  skillRight:  { display: 'flex', alignItems: 'center', gap: 8 },
  growthTag:   { fontSize: 10, fontWeight: 700 },
  skillTrack:  { height: 7, background: '#1f2937', borderRadius: 4, overflow: 'hidden' },
  skillFill:   { height: '100%', borderRadius: 4, transition: 'width 0.9s cubic-bezier(0.34,1.1,0.64,1)' },
  industryRow: { display: 'flex', gap: 4, flexWrap: 'wrap' },
  industryTag: { fontSize: 9, color: '#374151', background: '#0d1117', border: '1px solid #1a2030', borderRadius: 4, padding: '1px 5px' },

  showMoreBtn: { marginTop: 12, width: '100%', background: 'transparent', border: '1px solid #1f2937', borderRadius: 10, padding: '8px', color: '#4b5563', fontSize: 11, fontWeight: 600, cursor: 'pointer' },

  legend:      { display: 'flex', gap: 16, marginTop: 16, paddingTop: 12, borderTop: '1px solid #1f2937', flexWrap: 'wrap' },
  legendItem:  { display: 'flex', alignItems: 'center', gap: 5, fontSize: 10, color: '#4b5563' },
  legendDot:   { width: 8, height: 8, borderRadius: '50%', flexShrink: 0 },
  disclaimer:  { fontSize: 11, color: '#374151', marginTop: 10, lineHeight: 1.6, textAlign: 'center' },
};
