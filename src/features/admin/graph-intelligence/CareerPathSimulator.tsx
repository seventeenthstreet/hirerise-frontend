'use client';

import { useState, useRef, memo } from 'react';
import { useMutation } from '@tanstack/react-query';
import { adminService } from '@/services/adminService';
import { cn } from '@/utils/cn';
import type { PathSimulatorResult, PathSimulatorStep, RoleSearchResult } from '@/types/admin';

// ─── Role Autocomplete ────────────────────────────────────────────────────────

const RoleAutocomplete = memo(function RoleAutocomplete({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: RoleSearchResult | null;
  onChange: (role: RoleSearchResult | null) => void;
  placeholder?: string;
}) {
  const [inputValue, setInputValue] = useState('');
  const [results, setResults]       = useState<RoleSearchResult[]>([]);
  const [open, setOpen]             = useState(false);
  const debounceRef                 = useRef<ReturnType<typeof setTimeout>>();

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const q = e.target.value;
    setInputValue(q);
    if (value) onChange(null);
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
    onChange(role);
  };

  return (
    <div className="relative">
      <label className="block text-xs font-semibold text-surface-700 mb-1">{label}</label>
      <input
        type="text"
        value={inputValue}
        onChange={handleChange}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder={placeholder}
        autoComplete="off"
        spellCheck={false}
        className={cn(
          'w-full px-3 py-2.5 text-sm border rounded-lg bg-white text-surface-900 focus:outline-none focus:ring-2 transition-all',
          value ? 'border-hr-400 focus:ring-hr-200' : 'border-surface-200 focus:ring-hr-200 focus:border-hr-400'
        )}
      />
      {open && results.length > 0 && (
        <div className="absolute z-50 w-full mt-1 bg-white rounded-lg border border-surface-200 shadow-lg overflow-hidden">
          {results.map(r => (
            <button
              key={r.id}
              type="button"
              onMouseDown={e => { e.preventDefault(); select(r); }}
              className="w-full flex items-start gap-2.5 px-3 py-2.5 hover:bg-hr-50 transition-colors text-left"
            >
              <div className="mt-1 h-2 w-2 rounded-full bg-hr-400 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-surface-800">{r.role_name}</p>
                {(r.role_family || r.seniority) && (
                  <p className="text-xs text-surface-400 mt-0.5">
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

// ─── Path Step Card ───────────────────────────────────────────────────────────

function PathStepCard({ step, isLast }: { step: PathSimulatorStep; isLast: boolean }) {
  const [showSkills, setShowSkills] = useState(false);

  const transitionTypeColor: Record<string, string> = {
    primary:   'bg-hr-100 text-hr-700',
    vertical:  'bg-blue-100 text-blue-700',
    lateral:   'bg-amber-100 text-amber-700',
    diagonal:  'bg-violet-100 text-violet-700',
  };

  return (
    <div className="flex gap-3">
      <div className="flex flex-col items-center">
        <div className={cn(
          'h-8 w-8 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0',
          isLast ? 'bg-emerald-500 text-white' : step.step === 1 ? 'bg-hr-600 text-white' : 'bg-surface-200 text-surface-700'
        )}>
          {isLast ? (
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
            </svg>
          ) : step.step}
        </div>
        {!isLast && <div className="w-0.5 flex-1 bg-surface-200 mt-1.5" />}
      </div>

      <div className={cn(
        'flex-1 rounded-xl border p-4 mb-4 transition-all',
        isLast ? 'border-emerald-200 bg-emerald-50' : step.step === 1 ? 'border-hr-200 bg-hr-50' : 'border-surface-200 bg-white'
      )}>
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="font-semibold text-surface-900 text-sm">{step.role_name}</p>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              {step.role_family && <span className="text-[10px] text-surface-500">{step.role_family}</span>}
              {step.seniority && (
                <span className="text-[10px] bg-surface-100 text-surface-600 rounded-full px-1.5 py-0.5 capitalize font-medium">
                  {step.seniority}
                </span>
              )}
            </div>
          </div>
          {step.skills.length > 0 && (
            <button onClick={() => setShowSkills(v => !v)} className="text-xs text-hr-600 hover:text-hr-700 flex-shrink-0 font-medium">
              {showSkills ? 'Hide' : `${step.skills.length} skills`}
            </button>
          )}
        </div>

        {showSkills && step.skills.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1">
            {step.skills.map(s => (
              <span key={s.skill_id} className="text-[11px] bg-white border border-surface-200 text-surface-700 rounded-full px-2 py-0.5">
                {s.skill_name}
              </span>
            ))}
          </div>
        )}

        {!isLast && step.transition_to_next && (
          <div className="mt-3 pt-3 border-t border-surface-100 flex items-center gap-2">
            <svg className="h-3.5 w-3.5 text-surface-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
            </svg>
            <div className="flex items-center gap-2 text-xs text-surface-500">
              {step.transition_to_next.transition_type && (
                <span className={cn('rounded-full px-1.5 py-0.5 text-[10px] font-semibold',
                  transitionTypeColor[step.transition_to_next.transition_type] ?? 'bg-surface-100 text-surface-600')}>
                  {step.transition_to_next.transition_type}
                </span>
              )}
              {step.transition_to_next.probability != null && (
                <span>{Math.round(step.transition_to_next.probability * 100)}% probability</span>
              )}
              {step.transition_to_next.years_required != null && (
                <span>· {step.transition_to_next.years_required}yr required</span>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function CareerPathSimulator() {
  const [currentRole, setCurrentRole] = useState<RoleSearchResult | null>(null);
  const [targetRole,  setTargetRole]  = useState<RoleSearchResult | null>(null);
  const [maxHops, setMaxHops]         = useState(6);
  const [result, setResult]           = useState<PathSimulatorResult | null>(null);

  const mutation = useMutation({
    mutationFn: () => adminService.simulateCareerPath({
      current_role_id: currentRole!.role_id,
      target_role_id:  targetRole!.role_id,
      max_hops:        maxHops,
    }),
    onSuccess: data => setResult(data),
  });

  const canSimulate = currentRole && targetRole && currentRole.id !== targetRole.id;

  return (
    <div className="flex h-full gap-0">
      <div className="w-80 shrink-0 flex flex-col border-r border-surface-100 bg-white">
        <div className="px-5 py-4 border-b border-surface-100">
          <h3 className="font-semibold text-surface-900 text-sm">Path Simulator</h3>
          <p className="text-xs text-surface-500 mt-0.5">Test career paths via role_transitions graph.</p>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          <RoleAutocomplete label="Current Role" value={currentRole} onChange={setCurrentRole} placeholder="e.g. Accountant" />

          <div className="flex items-center justify-center gap-3">
            <div className="flex-1 h-px bg-surface-200" />
            <div className="h-8 w-8 rounded-full bg-surface-100 flex items-center justify-center">
              <svg className="h-4 w-4 text-surface-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
              </svg>
            </div>
            <div className="flex-1 h-px bg-surface-200" />
          </div>

          <RoleAutocomplete label="Target Role" value={targetRole} onChange={setTargetRole} placeholder="e.g. Finance Director" />

          <div>
            <label className="block text-xs font-semibold text-surface-700 mb-1">
              Max Hops: <span className="text-hr-600">{maxHops}</span>
            </label>
            <input
              type="range" min={1} max={8} value={maxHops}
              onChange={e => setMaxHops(parseInt(e.target.value))}
              className="w-full accent-hr-600"
            />
            <div className="flex justify-between text-[10px] text-surface-400 mt-0.5">
              <span>1</span><span>8</span>
            </div>
          </div>

          <button
            onClick={() => mutation.mutate()}
            disabled={!canSimulate || mutation.isPending}
            className={cn(
              'w-full py-2.5 rounded-lg text-sm font-semibold transition-all',
              canSimulate && !mutation.isPending
                ? 'bg-hr-600 text-white hover:bg-hr-700 shadow-sm'
                : 'bg-surface-100 text-surface-400 cursor-not-allowed'
            )}
          >
            {mutation.isPending ? (
              <span className="flex items-center justify-center gap-2">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                Simulating…
              </span>
            ) : 'Simulate Path'}
          </button>

          {mutation.isError && (
            <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700">
              Failed to simulate path. Check if roles exist in the graph.
            </div>
          )}
        </div>

        <div className="px-5 py-3 border-t border-surface-50 bg-surface-50">
          <p className="text-[10px] font-semibold text-surface-400 uppercase tracking-wider mb-1">How it works</p>
          <p className="text-xs text-surface-500 leading-relaxed">
            Uses BFS over <code className="bg-white border border-surface-200 rounded px-1 font-mono text-[10px]">role_transitions</code> to find the shortest path.
          </p>
        </div>
      </div>

      <div className="flex-1 flex flex-col overflow-hidden">
        {!result && !mutation.isPending && (
          <div className="flex-1 flex items-center justify-center bg-surface-50">
            <div className="text-center text-surface-400">
              <svg className="h-16 w-16 mx-auto mb-3 opacity-20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M13 9l3 3m0 0l-3 3m3-3H8m13 0a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-sm font-medium">Select roles and run simulation</p>
              <p className="text-xs mt-1">The career path will appear here</p>
            </div>
          </div>
        )}

        {mutation.isPending && (
          <div className="flex-1 flex items-center justify-center bg-surface-50">
            <div className="text-center">
              <div className="h-10 w-10 mx-auto animate-spin rounded-full border-2 border-hr-500 border-t-transparent mb-3" />
              <p className="text-sm text-surface-600 font-medium">Finding optimal path…</p>
            </div>
          </div>
        )}

        {result && !mutation.isPending && (
          <div className="flex-1 overflow-y-auto p-6">
            <div className={cn('rounded-xl border p-4 mb-6', result.found ? 'bg-emerald-50 border-emerald-200' : 'bg-amber-50 border-amber-200')}>
              {result.found ? (
                <div className="flex items-start gap-3">
                  <div className="h-8 w-8 rounded-full bg-emerald-500 flex items-center justify-center flex-shrink-0">
                    <svg className="h-4 w-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <div>
                    <p className="font-semibold text-emerald-900 text-sm">Path Found!</p>
                    <p className="text-xs text-emerald-700 mt-0.5">{result.current_role} → {result.target_role}</p>
                    <div className="flex items-center gap-3 mt-2">
                      <span className="text-xs bg-emerald-100 text-emerald-700 rounded-full px-2 py-0.5 font-medium">{result.hops} hop{result.hops !== 1 ? 's' : ''}</span>
                      <span className="text-xs bg-emerald-100 text-emerald-700 rounded-full px-2 py-0.5 font-medium">{result.steps.length} roles</span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex items-start gap-3">
                  <div className="h-8 w-8 rounded-full bg-amber-400 flex items-center justify-center flex-shrink-0">
                    <svg className="h-4 w-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div>
                    <p className="font-semibold text-amber-900 text-sm">No Path Found</p>
                    <p className="text-xs text-amber-700 mt-0.5">{result.message}</p>
                  </div>
                </div>
              )}
            </div>
            {result.found && result.steps.length > 0 && (
              <div>
                {result.steps.map((step, i) => (
                  <PathStepCard key={step.role_id + i} step={step} isLast={i === result.steps.length - 1} />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}