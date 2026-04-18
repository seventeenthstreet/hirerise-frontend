'use client';

/**
 * SkillGraphExplorer.tsx
 *
 * Visual explorer for the Skill Graph — skill nodes + relationship edges.
 * Click a skill node to view prerequisites, advanced skills, and roles that use it.
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { adminService } from '@/services/adminService';
import { cn } from '@/utils/cn';
import type { GraphSkillNode, GraphSkillRelationship, SkillDetailData } from '@/types/admin';

// ─── Category colours ─────────────────────────────────────────────────────────

const CAT_COLORS: Record<string, { fill: string; text: string; badge: string }> = {
  technical:     { fill: '#3b82f6', text: 'text-blue-700',    badge: 'bg-blue-50 border-blue-200 text-blue-700'    },
  soft:          { fill: '#10b981', text: 'text-emerald-700', badge: 'bg-emerald-50 border-emerald-200 text-emerald-700' },
  domain:        { fill: '#8b5cf6', text: 'text-violet-700',  badge: 'bg-violet-50 border-violet-200 text-violet-700'  },
  tool:          { fill: '#f59e0b', text: 'text-amber-700',   badge: 'bg-amber-50 border-amber-200 text-amber-700'   },
};

const EDGE_COLORS: Record<string, string> = {
  prerequisite:  '#ef4444',
  advanced:      '#8b5cf6',
  related:       '#94a3b8',
  complementary: '#10b981',
};

function getCatColor(cat?: string): string {
  return CAT_COLORS[cat ?? '']?.fill ?? '#6b7280';
}

function getDifficultyRadius(diff?: number): number {
  if (!diff) return 14;
  return 12 + diff * 2;
}

// ─── Simple spring layout ─────────────────────────────────────────────────────

interface LayoutSkillNode extends GraphSkillNode {
  x: number;
  y: number;
  vx: number;
  vy: number;
}

function buildSkillLayout(
  skills: GraphSkillNode[],
  rels: GraphSkillRelationship[],
  w: number,
  h: number
): LayoutSkillNode[] {
  // Distribute by category in quadrants
  const catGroups: Record<string, GraphSkillNode[]> = {};
  skills.forEach(s => {
    const k = s.skill_category ?? 'other';
    if (!catGroups[k]) catGroups[k] = [];
    catGroups[k].push(s);
  });

  const cats = Object.keys(catGroups);
  const nodes: LayoutSkillNode[] = [];

  cats.forEach((cat, ci) => {
    const angle = (ci / cats.length) * 2 * Math.PI;
    const cx = w / 2 + Math.cos(angle) * w * 0.28;
    const cy = h / 2 + Math.sin(angle) * h * 0.28;
    catGroups[cat].forEach((skill, si) => {
      const r = Math.min(70, catGroups[cat].length * 8);
      const a = (si / catGroups[cat].length) * 2 * Math.PI;
      nodes.push({
        ...skill,
        x: cx + Math.cos(a) * r + (Math.random() - 0.5) * 15,
        y: cy + Math.sin(a) * r + (Math.random() - 0.5) * 15,
        vx: 0, vy: 0,
      });
    });
  });

  const idx: Record<string, number> = {};
  nodes.forEach((n, i) => {
    idx[n.id] = i;
    if (n.skill_id) idx[n.skill_id] = i;
  });

  for (let iter = 0; iter < 100; iter++) {
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const dx = nodes[i].x - nodes[j].x;
        const dy = nodes[i].y - nodes[j].y;
        const d  = Math.sqrt(dx * dx + dy * dy) || 1;
        const f  = 1400 / (d * d);
        nodes[i].vx += (dx / d) * f;
        nodes[i].vy += (dy / d) * f;
        nodes[j].vx -= (dx / d) * f;
        nodes[j].vy -= (dy / d) * f;
      }
    }
    rels.forEach(r => {
      const ai = idx[r.skill_id];
      const bi = idx[r.related_skill_id];
      if (ai == null || bi == null) return;
      const dx = nodes[bi].x - nodes[ai].x;
      const dy = nodes[bi].y - nodes[ai].y;
      const d  = Math.sqrt(dx * dx + dy * dy) || 1;
      const f  = (d - 80) * 0.025;
      nodes[ai].vx += (dx / d) * f;
      nodes[ai].vy += (dy / d) * f;
      nodes[bi].vx -= (dx / d) * f;
      nodes[bi].vy -= (dy / d) * f;
    });
    nodes.forEach(n => {
      n.vx += (w / 2 - n.x) * 0.005;
      n.vy += (h / 2 - n.y) * 0.005;
      n.x  += n.vx;
      n.y  += n.vy;
      n.vx *= 0.82;
      n.vy *= 0.82;
      n.x = Math.max(25, Math.min(w - 25, n.x));
      n.y = Math.max(25, Math.min(h - 25, n.y));
    });
  }

  return nodes;
}

// ─── Skill Detail Panel ───────────────────────────────────────────────────────

function SkillDetailPanel({
  skillId,
  onClose,
}: {
  skillId: string;
  onClose: () => void;
}) {
  const { data, isLoading } = useQuery({
    queryKey:  ['skillDetail', skillId],
    queryFn:   () => adminService.getSkillDetail(skillId),
    staleTime: 60_000,
  });

  const catStyle = CAT_COLORS[data?.skill.skill_category ?? ''] ?? CAT_COLORS.technical;

  return (
    <div className="h-full flex flex-col bg-white">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-surface-100 bg-surface-50">
        <span className="text-sm font-semibold text-surface-800">Skill Details</span>
        <button onClick={onClose} className="text-surface-400 hover:text-surface-700">
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {isLoading && (
        <div className="flex-1 flex items-center justify-center">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-hr-500 border-t-transparent" />
        </div>
      )}

      {data && (
        <div className="flex-1 overflow-y-auto">
          {/* Skill header */}
          <div className="p-4 border-b border-surface-50">
            <div className="flex items-start gap-2.5">
              <div
                className="mt-0.5 h-3 w-3 rounded-full flex-shrink-0"
                style={{ background: getCatColor(data.skill.skill_category) }}
              />
              <div>
                <h3 className="font-semibold text-surface-900 text-sm">{data.skill.skill_name}</h3>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  {data.skill.skill_category && (
                    <span className={cn('text-[10px] border rounded-full px-2 py-0.5 font-medium capitalize', catStyle?.badge ?? '')}>
                      {data.skill.skill_category}
                    </span>
                  )}
                  {data.skill.difficulty_level != null && (
                    <span className="text-[10px] bg-surface-100 text-surface-600 rounded-full px-2 py-0.5 font-medium">
                      Level {data.skill.difficulty_level}
                    </span>
                  )}
                  {data.skill.demand_score != null && (
                    <span className="text-[10px] bg-amber-50 text-amber-700 border border-amber-200 rounded-full px-2 py-0.5 font-medium">
                      Demand: {data.skill.demand_score}/10
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Prerequisites */}
          <SkillSection title="Prerequisites" count={data.prerequisites.length} color="red">
            {data.prerequisites.length === 0 ? (
              <p className="text-xs text-surface-400 italic">No prerequisites</p>
            ) : (
              data.prerequisites.map((p, i) => (
                <div key={i} className="flex items-center justify-between text-xs py-0.5">
                  <span className="text-surface-700">{p.related_skill_id_name}</span>
                  {p.strength_score != null && (
                    <span className="text-surface-400 tabular-nums">{p.strength_score.toFixed(1)}</span>
                  )}
                </div>
              ))
            )}
          </SkillSection>

          {/* Advanced skills */}
          <SkillSection title="Unlocks Advanced Skills" count={data.advanced_skills.length} color="violet">
            {data.advanced_skills.length === 0 ? (
              <p className="text-xs text-surface-400 italic">No advanced skills</p>
            ) : (
              data.advanced_skills.map((a, i) => (
                <div key={i} className="flex items-center justify-between text-xs py-0.5">
                  <span className="text-surface-700">{a.skill_id_name}</span>
                  {a.strength_score != null && (
                    <span className="text-surface-400 tabular-nums">{a.strength_score.toFixed(1)}</span>
                  )}
                </div>
              ))
            )}
          </SkillSection>

          {/* Roles */}
          <SkillSection title="Used In Roles" count={data.roles.length} color="blue">
            {data.roles.length === 0 ? (
              <p className="text-xs text-surface-400 italic">Not mapped to any roles</p>
            ) : (
              data.roles.map((r, i) => (
                <div key={i} className="flex items-center justify-between text-xs py-0.5">
                  <span className="text-surface-700 truncate">{r.role_name}</span>
                  {r.importance_weight != null && (
                    <span className="text-surface-400 tabular-nums text-[10px] ml-2 flex-shrink-0">
                      {r.importance_weight.toFixed(1)}
                    </span>
                  )}
                </div>
              ))
            )}
          </SkillSection>
        </div>
      )}
    </div>
  );
}

function SkillSection({
  title, count, color, children,
}: {
  title: string; count: number; color: string; children: React.ReactNode;
}) {
  const [open, setOpen] = useState(true);
  const colors: Record<string, string> = {
    red: 'bg-red-50 text-red-700', violet: 'bg-violet-50 text-violet-700',
    blue: 'bg-blue-50 text-blue-700', emerald: 'bg-emerald-50 text-emerald-700',
  };
  return (
    <div className="border-b border-surface-50">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-surface-50 transition-colors"
      >
        <span className="text-xs font-semibold text-surface-700">{title}</span>
        <div className="flex items-center gap-2">
          <span className={cn('text-[10px] font-bold rounded-full px-1.5 py-0.5', colors[color] ?? colors.blue)}>{count}</span>
          <svg className={cn('h-3 w-3 text-surface-400 transition-transform', open ? 'rotate-180' : '')} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>
      {open && <div className="px-4 pb-3 space-y-0.5">{children}</div>}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function SkillGraphExplorer() {
  const svgRef = useRef<SVGSVGElement>(null);
  const [svgSize, setSvgSize] = useState({ w: 800, h: 600 });
  const [nodes, setNodes] = useState<LayoutSkillNode[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch]   = useState('');
  const [filterCat, setFilterCat] = useState<string>('');
  const [transform, setTransform] = useState({ x: 0, y: 0, k: 1 });
  const dragging   = useRef<{ id: string } | null>(null);
  const panStart   = useRef<{ x: number; y: number; tx: number; ty: number } | null>(null);

  const { data, isLoading } = useQuery({
    queryKey:  ['skillGraph'],
    queryFn:   () => adminService.getSkillGraph(),
    staleTime: 120_000,
  });

  useEffect(() => {
    if (!svgRef.current) return;
    const obs = new ResizeObserver(entries => {
      const { width, height } = entries[0].contentRect;
      setSvgSize({ w: width, h: height });
    });
    obs.observe(svgRef.current.parentElement!);
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    if (!data?.skills) return;
    const validSkills = data.skills.filter(s => s.skill_name);
    setNodes(buildSkillLayout(validSkills, data.relationships, svgSize.w, svgSize.h));
  }, [data, svgSize.w, svgSize.h]);

  const onNodeMouseDown = useCallback((e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    dragging.current = { id };
  }, []);

  const onSvgMouseDown = useCallback((e: React.MouseEvent) => {
    panStart.current = { x: e.clientX, y: e.clientY, tx: transform.x, ty: transform.y };
  }, [transform]);

  const onMouseMove = useCallback((e: React.MouseEvent) => {
    if (dragging.current) {
      const svg = svgRef.current!;
      const pt  = svg.createSVGPoint();
      pt.x = e.clientX; pt.y = e.clientY;
      const sp = pt.matrixTransform(svg.getScreenCTM()!.inverse());
      setNodes(prev => prev.map(n => n.id === dragging.current!.id ? { ...n, x: sp.x, y: sp.y } : n));
    } else if (panStart.current) {
      const dx = e.clientX - panStart.current.x;
      const dy = e.clientY - panStart.current.y;
      setTransform(t => ({ ...t, x: panStart.current!.tx + dx, y: panStart.current!.ty + dy }));
    }
  }, []);

  const onMouseUp = useCallback(() => { dragging.current = null; panStart.current = null; }, []);

  const onWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    setTransform(t => ({ ...t, k: Math.max(0.2, Math.min(3, t.k * (e.deltaY > 0 ? 0.9 : 1.1))) }));
  }, []);

  const nodeIndex = new Map(nodes.map(n => [n.id, n]));

  const filteredIds = (search || filterCat)
    ? new Set(nodes.filter(n =>
        (!search || (n.skill_name ?? '').toLowerCase().includes(search.toLowerCase())) &&
        (!filterCat || n.skill_category === filterCat)
      ).map(n => n.id))
    : null;

  const visibleRels = data?.relationships?.filter(r => {
    const a = nodeIndex.get(r.skill_id);
    const b = nodeIndex.get(r.related_skill_id);
    if (!a || !b) return false;
    if (filteredIds) return filteredIds.has(r.skill_id) || filteredIds.has(r.related_skill_id);
    return true;
  }) ?? [];

  const cats = [...new Set((data?.skills ?? []).map(s => s.skill_category).filter(Boolean))];

  return (
    <div className="flex h-full gap-0 relative">
      <div className="flex-1 flex flex-col min-w-0">
        {/* Toolbar */}
        <div className="flex items-center gap-3 px-4 py-2.5 border-b border-surface-100 bg-white shrink-0 flex-wrap">
          <div className="relative">
            <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-surface-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder="Filter skills..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-8 pr-3 py-1.5 text-xs border border-surface-200 rounded-lg bg-surface-50 focus:outline-none focus:ring-1 focus:ring-hr-400 w-44"
            />
          </div>
          <select
            value={filterCat}
            onChange={e => setFilterCat(e.target.value)}
            className="text-xs border border-surface-200 rounded-lg bg-surface-50 px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-hr-400"
          >
            <option value="">All categories</option>
            {cats.map(c => <option key={c} value={c!}>{c}</option>)}
          </select>

          <div className="flex items-center gap-3 ml-auto text-xs text-surface-400">
            <span>{data?.node_count ?? '—'} Skills</span>
            <span>{data?.edge_count ?? '—'} Relationships</span>
            <button
              onClick={() => setTransform({ x: 0, y: 0, k: 1 })}
              className="px-2 py-1 rounded border border-surface-200 hover:bg-surface-50 text-surface-500 text-[11px]"
            >
              Reset
            </button>
          </div>
        </div>

        <div className="flex-1 relative bg-surface-50 overflow-hidden">
          {isLoading && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center">
                <div className="h-8 w-8 mx-auto animate-spin rounded-full border-2 border-hr-500 border-t-transparent mb-3" />
                <p className="text-sm text-surface-500">Loading skill graph…</p>
              </div>
            </div>
          )}
          {!isLoading && nodes.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center">
              <p className="text-sm text-surface-400">No skills in the graph yet. Import skills first.</p>
            </div>
          )}

          <svg
            ref={svgRef}
            className="w-full h-full cursor-grab active:cursor-grabbing select-none"
            onMouseDown={onSvgMouseDown}
            onMouseMove={onMouseMove}
            onMouseUp={onMouseUp}
            onMouseLeave={onMouseUp}
            onWheel={onWheel}
          >
            <defs>
              {Object.entries(EDGE_COLORS).map(([type, color]) => (
                <marker key={type} id={`arrow-${type}`} markerWidth="6" markerHeight="4" refX="5" refY="2" orient="auto">
                  <polygon points="0 0, 6 2, 0 4" fill={color} fillOpacity={0.7} />
                </marker>
              ))}
            </defs>

            <g transform={`translate(${transform.x},${transform.y}) scale(${transform.k})`}>
              {visibleRels.map(rel => {
                const an = nodeIndex.get(rel.skill_id);
                const bn = nodeIndex.get(rel.related_skill_id);
                if (!an || !bn) return null;
                const color = EDGE_COLORS[rel.relationship_type] ?? '#94a3b8';
                const isDim = filteredIds && !filteredIds.has(rel.skill_id) && !filteredIds.has(rel.related_skill_id);
                const isHighlight = selectedId === rel.skill_id || selectedId === rel.related_skill_id;
                return (
                  <line
                    key={rel.id}
                    x1={an.x} y1={an.y} x2={bn.x} y2={bn.y}
                    stroke={color}
                    strokeWidth={isHighlight ? 2 : 1}
                    strokeOpacity={isDim ? 0.1 : isHighlight ? 0.9 : 0.45}
                    markerEnd={`url(#arrow-${rel.relationship_type})`}
                    strokeDasharray={rel.relationship_type === 'related' ? '4 2' : undefined}
                  />
                );
              })}

              {nodes.map(node => {
                const fill   = getCatColor(node.skill_category);
                const r      = getDifficultyRadius(node.difficulty_level);
                const isSel  = selectedId === node.id;
                const isDim  = filteredIds && !filteredIds.has(node.id);
                return (
                  <g
                    key={node.id}
                    transform={`translate(${node.x},${node.y})`}
                    className="cursor-pointer"
                    onMouseDown={e => onNodeMouseDown(e, node.id)}
                    onClick={() => setSelectedId(node.id === selectedId ? null : node.id)}
                    opacity={isDim ? 0.2 : 1}
                  >
                    <circle
                      r={r + (isSel ? 3 : 0)}
                      fill={fill}
                      fillOpacity={isSel ? 1 : 0.82}
                      stroke={isSel ? '#1e1b4b' : 'white'}
                      strokeWidth={isSel ? 2.5 : 1.5}
                    />
                    <text
                      textAnchor="middle"
                      dy={r + 10}
                      fontSize={8.5}
                      fill="#475569"
                      fontWeight={isSel ? 700 : 400}
                      style={{ pointerEvents: 'none', userSelect: 'none' }}
                    >
                      {(node.skill_name ?? '').length > 14 ? (node.skill_name ?? '').slice(0, 12) + '…' : (node.skill_name ?? node.id)}
                    </text>
                  </g>
                );
              })}
            </g>
          </svg>

          {/* Legend */}
          <div className="absolute bottom-3 left-3 bg-white/90 backdrop-blur-sm rounded-lg border border-surface-100 p-2 text-[10px] shadow-sm space-y-1">
            <p className="text-surface-500 font-semibold uppercase tracking-wider mb-1">Relationships</p>
            {Object.entries(EDGE_COLORS).map(([type, color]) => (
              <div key={type} className="flex items-center gap-1.5">
                <span className="h-0.5 w-4 rounded-full" style={{ background: color }} />
                <span className="text-surface-600 capitalize">{type}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {selectedId && (
        <div className="w-80 shrink-0 border-l border-surface-100">
          <SkillDetailPanel skillId={selectedId} onClose={() => setSelectedId(null)} />
        </div>
      )}
    </div>
  );
}