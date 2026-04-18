'use client';

import { useState, useRef, memo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { adminService } from '@/services/adminService';
import { cn } from '@/utils/cn';
import type { RoleImpact, RoleSearchResult } from '@/types/admin';

// ─── Stat Card ────────────────────────────────────────────────────────────────

function StatCard({
  label, value, sublabel, color, icon,
}: {
  label: string;
  value: number;
  sublabel?: string;
  color: 'blue' | 'emerald' | 'violet' | 'amber' | 'red';
  icon: React.ReactNode;
}) {
  const colors = {
    blue:    { bg: 'bg-blue-50',    border: 'border-blue-200',   text: 'text-blue-700',    icon: 'text-blue-500'    },
    emerald: { bg: 'bg-emerald-50', border: 'border-emerald-200',text: 'text-emerald-700', icon: 'text-emerald-500' },
    violet:  { bg: 'bg-violet-50',  border: 'border-violet-200', text: 'text-violet-700',  icon: 'text-violet-500'  },
    amber:   { bg: 'bg-amber-50',   border: 'border-amber-200',  text: 'text-amber-700',   icon: 'text-amber-500'   },
    red:     { bg: 'bg-red-50',     border: 'border-red-200',    text: 'text-red-700',     icon: 'text-red-500'     },
  };
  const c = colors[color];
  return (
    <div className={cn('rounded-xl border p-4', c.bg, c.border)}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-surface-400">{label}</p>
          <p className={cn('mt-1 text-3xl font-bold tabular-nums', c.text)}>{value}</p>
          {sublabel && <p className="text-xs text-surface-400 mt-0.5">{sublabel}</p>}
        </div>
        <span className={cn('mt-0.5', c.icon)}>{icon}</span>
      </div>
    </div>
  );
}

// ─── Role Search Bar ──────────────────────────────────────────────────────────

const RoleSearchBar = memo(function RoleSearchBar({
  onSelect,
}: {
  onSelect: (role: RoleSearchResult) => void;
}) {
  const [inputValue, setInputValue] = useState('');
  const [results, setResults]       = useState<RoleSearchResult[]>([]);
  const [open, setOpen]             = useState(false);
  const debounceRef                 = useRef<ReturnType<typeof setTimeout>>();

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const q = e.target.value;
    setInputValue(q);
    clearTimeout(debounceRef.current);
    if (q.length < 2) { setResults([]); setOpen(false); return; }
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await adminService.searchGraphRoles(q, 10);
        setResults(res.roles ?? []);
        setOpen(true);
      } catch {
        setResults([]);
        setOpen(false);
      }
    }, 350);
  };

  const select = (role: RoleSearchResult) => {
    setInputValue(role.role_name);
    setResults([]);
    setOpen(false);
    onSelect(role);
  };

  return (
    <div className="relative w-full max-w-md">
      <div className="relative">
        <svg className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-surface-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          type="text"
          value={inputValue}
          onChange={handleChange}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          placeholder="Search for a role to analyze…"
          autoComplete="off"
          spellCheck={false}
          className="w-full pl-10 pr-4 py-2.5 text-sm border border-surface-200 rounded-xl bg-white text-surface-900 focus:outline-none focus:ring-2 focus:ring-hr-300 focus:border-hr-400 shadow-sm"
        />
      </div>
      {open && results.length > 0 && (
        <div className="absolute z-50 w-full mt-1.5 bg-white rounded-xl border border-surface-200 shadow-xl overflow-hidden">
          {results.map(r => (
            <button
              key={r.id}
              type="button"
              onMouseDown={e => { e.preventDefault(); select(r); }}
              className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-hr-50 transition-colors text-left"
            >
              <div className="h-2 w-2 rounded-full bg-hr-400 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-surface-800">{r.role_name}</p>
                {(r.role_family || r.seniority) && (
                  <p className="text-xs text-surface-400">
                    {[r.role_family, r.seniority].filter(Boolean).join(' · ')}
                  </p>
                )}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
});

// ─── Impact Detail ────────────────────────────────────────────────────────────

function ImpactDetail({ data }: { data: RoleImpact }) {
  const { role, impact, salary_stats, education_summary, outgoing_transitions, incoming_transitions, skill_mappings } = data;
  const [activeTab, setActiveTab] = useState<'transitions' | 'skills' | 'salary' | 'education'>('transitions');

  const TABS = [
    { id: 'transitions' as const, label: 'Transitions', count: impact.total_transitions },
    { id: 'skills'      as const, label: 'Skills',      count: impact.skill_mappings     },
    { id: 'salary'      as const, label: 'Salary',      count: impact.salary_benchmarks  },
    { id: 'education'   as const, label: 'Education',   count: impact.education_mappings },
  ];

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-surface-200 bg-white p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-lg font-bold text-surface-900">{role.role_name}</h3>
            <div className="flex items-center gap-2 mt-1">
              {role.role_family && <span className="text-sm text-surface-500">{role.role_family}</span>}
              {role.seniority_level && (
                <span className="text-xs bg-surface-100 text-surface-600 rounded-full px-2 py-0.5 capitalize font-medium">
                  {role.seniority_level}
                </span>
              )}
            </div>
            {role.description && (
              <p className="mt-2 text-sm text-surface-500 leading-relaxed max-w-xl">{role.description}</p>
            )}
          </div>
          <div className="text-xs text-surface-400 bg-surface-50 rounded-lg px-3 py-2 text-center flex-shrink-0">
            <p className="font-mono">{role.id}</p>
            <p className="text-[10px] text-surface-300 mt-0.5">role_id</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
        <StatCard label="Total Transitions" value={impact.total_transitions} sublabel={`${impact.outgoing_transitions} out · ${impact.incoming_transitions} in`} color="blue"
          icon={<svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" /></svg>} />
        <StatCard label="Outgoing" value={impact.outgoing_transitions} color="blue"
          icon={<svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>} />
        <StatCard label="Incoming" value={impact.incoming_transitions} color="emerald"
          icon={<svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M7 16l-4-4m0 0l4-4m-4 4h18" /></svg>} />
        <StatCard label="Skill Mappings" value={impact.skill_mappings} color="violet"
          icon={<svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" /></svg>} />
        <StatCard label="Salary Records" value={impact.salary_benchmarks} sublabel={salary_stats?.countries.join(', ') ?? undefined} color="amber"
          icon={<svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>} />
        <StatCard label="Education Maps" value={impact.education_mappings} color="violet"
          icon={<svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M12 14l9-5-9-5-9 5 9 5z" /></svg>} />
      </div>

      <div className="rounded-xl border border-surface-200 bg-white overflow-hidden">
        <div className="flex border-b border-surface-100">
          {TABS.map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={cn('flex-1 flex items-center justify-center gap-2 px-3 py-3 text-sm font-medium transition-colors',
                activeTab === tab.id ? 'bg-white text-hr-700 border-b-2 border-hr-600' : 'text-surface-500 hover:text-surface-700 hover:bg-surface-50')}>
              {tab.label}
              <span className={cn('text-[10px] rounded-full px-1.5 py-0.5 font-bold',
                activeTab === tab.id ? 'bg-hr-100 text-hr-700' : 'bg-surface-100 text-surface-500')}>
                {tab.count}
              </span>
            </button>
          ))}
        </div>

        <div className="p-4 max-h-80 overflow-y-auto">
          {activeTab === 'transitions' && (
            <div className="space-y-4">
              {outgoing_transitions.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-surface-500 uppercase tracking-wider mb-2">Outgoing ({outgoing_transitions.length})</p>
                  <div className="space-y-1.5">
                    {outgoing_transitions.map(t => <TransitionRow key={t.id} t={t} direction="out" />)}
                  </div>
                </div>
              )}
              {incoming_transitions.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-surface-500 uppercase tracking-wider mb-2">Incoming ({incoming_transitions.length})</p>
                  <div className="space-y-1.5">
                    {incoming_transitions.map(t => <TransitionRow key={t.id} t={t} direction="in" />)}
                  </div>
                </div>
              )}
              {impact.total_transitions === 0 && <p className="text-sm text-surface-400 text-center py-4">No transitions mapped.</p>}
            </div>
          )}
          {activeTab === 'skills' && (
            <div>
              {skill_mappings.length === 0
                ? <p className="text-sm text-surface-400 text-center py-4">No skills mapped.</p>
                : <div className="flex flex-wrap gap-1.5">
                    {skill_mappings.map((s, i) => (
                      <span key={i} className="text-xs bg-violet-50 border border-violet-200 text-violet-700 rounded-full px-2.5 py-1 font-medium">
                        {s.skill_id}
                        {s.importance_weight != null && <span className="ml-1 text-violet-400">({s.importance_weight.toFixed(1)})</span>}
                      </span>
                    ))}
                  </div>
              }
            </div>
          )}
          {activeTab === 'salary' && (
            <div>
              {!salary_stats
                ? <p className="text-sm text-surface-400 text-center py-4">No salary data.</p>
                : <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm">
                      <span className="text-surface-600">Countries:</span>
                      <div className="flex flex-wrap gap-1">
                        {salary_stats.countries.map(c => (
                          <span key={c} className="text-xs bg-amber-50 border border-amber-200 text-amber-700 rounded-full px-2 py-0.5">{c}</span>
                        ))}
                      </div>
                    </div>
                    {salary_stats.median_range.max > 0 && (
                      <p className="text-sm text-surface-600">
                        Median range: <span className="font-semibold text-surface-800 font-mono">
                          {salary_stats.median_range.min.toLocaleString()} – {salary_stats.median_range.max.toLocaleString()}
                        </span>
                      </p>
                    )}
                  </div>
              }
            </div>
          )}
          {activeTab === 'education' && (
            <div>
              {education_summary.length === 0
                ? <p className="text-sm text-surface-400 text-center py-4">No education mappings.</p>
                : <div className="space-y-2">
                    {education_summary.map((e, i) => (
                      <div key={i} className="flex items-center justify-between py-1.5 border-b border-surface-50 last:border-0">
                        <span className="text-sm text-surface-700 capitalize">{e.education_level?.replace(/_/g, ' ')}</span>
                        {e.match_score != null && (
                          <div className="flex items-center gap-2">
                            <div className="w-24 h-1.5 rounded-full bg-surface-100 overflow-hidden">
                              <div className="h-full rounded-full bg-violet-400" style={{ width: `${Math.min(e.match_score, 100)}%` }} />
                            </div>
                            <span className="text-xs text-surface-500 tabular-nums w-8 text-right">{e.match_score}%</span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
              }
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function TransitionRow({ t, direction }: {
  t: { id: string; from_role_id: string; to_role_id: string; probability?: number; transition_type?: string; from_role_id_name?: string; to_role_id_name?: string };
  direction: 'in' | 'out';
}) {
  const label = direction === 'out' ? (t.to_role_id_name ?? t.to_role_id) : (t.from_role_id_name ?? t.from_role_id);
  return (
    <div className="flex items-center gap-2.5 px-3 py-2 rounded-lg bg-surface-50 border border-surface-100">
      <span className={cn('text-[10px] font-bold', direction === 'out' ? 'text-blue-600' : 'text-emerald-600')}>
        {direction === 'out' ? '→' : '←'}
      </span>
      <span className="text-sm text-surface-700 flex-1 truncate">{label}</span>
      <div className="flex items-center gap-1.5 flex-shrink-0">
        {t.transition_type && <span className="text-[10px] bg-surface-100 text-surface-600 rounded-full px-1.5 py-0.5">{t.transition_type}</span>}
        {t.probability != null && <span className="text-xs text-surface-400 font-mono tabular-nums">{Math.round(t.probability * 100)}%</span>}
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function RoleImpactAnalyzer() {
  const [selectedRoleId, setSelectedRoleId]     = useState<string | null>(null);
  const [selectedRoleName, setSelectedRoleName] = useState<string>('');

  const { data, isLoading, isError } = useQuery({
    queryKey:  ['roleImpact', selectedRoleId],
    queryFn:   () => adminService.getRoleImpact(selectedRoleId!),
    enabled:   !!selectedRoleId,
    staleTime: 60_000,
  });

  const handleSelect = (role: RoleSearchResult) => {
    setSelectedRoleId(role.role_id);
    setSelectedRoleName(role.role_name);
  };

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="rounded-xl border border-surface-200 bg-white p-5">
          <h3 className="text-sm font-semibold text-surface-800 mb-3">Analyze Role Dependencies</h3>
          <RoleSearchBar onSelect={handleSelect} />
          {selectedRoleName && (
            <p className="text-xs text-surface-400 mt-2">
              Showing impact for: <span className="font-semibold text-surface-600">{selectedRoleName}</span>
            </p>
          )}
        </div>

        {isLoading && (
          <div className="rounded-xl border border-surface-200 bg-white p-12 flex items-center justify-center">
            <div className="text-center">
              <div className="h-8 w-8 mx-auto animate-spin rounded-full border-2 border-hr-500 border-t-transparent mb-3" />
              <p className="text-sm text-surface-500">Analyzing dependencies…</p>
            </div>
          </div>
        )}

        {isError && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center text-red-600 text-sm">
            Failed to load role impact. The role may not exist in the graph.
          </div>
        )}

        {!selectedRoleId && (
          <div className="rounded-xl border border-dashed border-surface-200 bg-surface-50 p-12 flex items-center justify-center">
            <div className="text-center text-surface-400">
              <svg className="h-14 w-14 mx-auto mb-3 opacity-20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              <p className="text-sm font-medium">Search for a role above</p>
              <p className="text-xs mt-1">See transitions, skills, salary and education dependencies</p>
            </div>
          </div>
        )}

        {data && !isLoading && <ImpactDetail data={data} />}
      </div>
    </div>
  );
}