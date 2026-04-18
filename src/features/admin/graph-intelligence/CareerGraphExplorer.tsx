'use client';

/**
 * CareerGraphExplorer.tsx
 *
 * Visual explorer for the Career Graph — role nodes + transition edges.
 * Renders an SVG force-layout graph with click-to-inspect panels.
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { adminService } from '@/services/adminService';
import { cn } from '@/utils/cn';
import type { GraphRoleNode, GraphTransitionEdge, RoleDetailData } from '@/types/admin';

// ─── Colour helpers ───────────────────────────────────────────────────────────

const FAMILY_COLORS: Record<string, string> = {
  'Software Engineering': '#3b82f6',
  'Finance':              '#8b5cf6',
  'Marketing':            '#ec4899',
  'Operations':           '#f59e0b',
  'Data':                 '#10b981',
  'Product':              '#06b6d4',
  'HR':                   '#ef4444',
  'Sales':                '#f97316',
};

function getFamilyColor(family?: string): string {
  if (!family) return '#6b7280';
  return FAMILY_COLORS[family] ?? '#6b7280';
}

function getSeniorityRadius(seniority?: string): number {
  const map: Record<string, number> = {
    junior: 14, mid: 16, senior: 18, lead: 20, principal: 22, director: 24, vp: 26,
  };
  return map[seniority?.toLowerCase() ?? ''] ?? 16;
}

// ─── Force Layout ─────────────────────────────────────────────────────────────

interface LayoutNode extends GraphRoleNode {
  x: number;
  y: number;
  vx: number;
  vy: number;
}

function buildLayout(
  roles: GraphRoleNode[],
  transitions: GraphTransitionEdge[],
  width: number,
  height: number
): LayoutNode[] {
  // Group by family for initial placement
  const familyGroups: Record<string, GraphRoleNode[]> = {};
  roles.forEach(r => {
    const key = r.role_family ?? 'Other';
    if (!familyGroups[key]) familyGroups[key] = [];
    familyGroups[key].push(r);
  });

  const families = Object.keys(familyGroups);
  const nodes: LayoutNode[] = [];

  families.forEach((family, fi) => {
    const angle = (fi / families.length) * 2 * Math.PI;
    const cx = width / 2 + Math.cos(angle) * (width * 0.3);
    const cy = height / 2 + Math.sin(angle) * (height * 0.3);
    const members = familyGroups[family];

    members.forEach((role, ri) => {
      const spread = Math.min(80, members.length * 10);
      const memberAngle = (ri / members.length) * 2 * Math.PI;
      nodes.push({
        ...role,
        x: cx + Math.cos(memberAngle) * spread + (Math.random() - 0.5) * 20,
        y: cy + Math.sin(memberAngle) * spread + (Math.random() - 0.5) * 20,
        vx: 0,
        vy: 0,
      });
    });
  });

  // Simple force simulation
  const edgeMap: Record<string, string[]> = {};
  transitions.forEach(t => {
    if (!edgeMap[t.from_role_id]) edgeMap[t.from_role_id] = [];
    edgeMap[t.from_role_id].push(t.to_role_id);
  });

  for (let iter = 0; iter < 120; iter++) {
    // Repulsion
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const dx = nodes[i].x - nodes[j].x;
        const dy = nodes[i].y - nodes[j].y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const force = 1600 / (dist * dist);
        nodes[i].vx += (dx / dist) * force;
        nodes[i].vy += (dy / dist) * force;
        nodes[j].vx -= (dx / dist) * force;
        nodes[j].vy -= (dy / dist) * force;
      }
    }
    // Attraction along edges
    const nodeIndex: Record<string, number> = {};
    nodes.forEach((n, i) => { nodeIndex[n.id] = i; nodeIndex[n.role_id ?? n.id] = i; });
    transitions.forEach(t => {
      const ai = nodeIndex[t.from_role_id];
      const bi = nodeIndex[t.to_role_id];
      if (ai == null || bi == null) return;
      const dx = nodes[bi].x - nodes[ai].x;
      const dy = nodes[bi].y - nodes[ai].y;
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;
      const target = 90;
      const force = (dist - target) * 0.03;
      nodes[ai].vx += (dx / dist) * force;
      nodes[ai].vy += (dy / dist) * force;
      nodes[bi].vx -= (dx / dist) * force;
      nodes[bi].vy -= (dy / dist) * force;
    });
    // Centre gravity
    nodes.forEach(n => {
      n.vx += (width / 2 - n.x) * 0.005;
      n.vy += (height / 2 - n.y) * 0.005;
    });
    // Apply + damp
    const damp = 0.85;
    nodes.forEach(n => {
      n.x += n.vx;
      n.y += n.vy;
      n.vx *= damp;
      n.vy *= damp;
      n.x = Math.max(30, Math.min(width - 30, n.x));
      n.y = Math.max(30, Math.min(height - 30, n.y));
    });
  }

  return nodes;
}

// ─── Role Detail Panel ────────────────────────────────────────────────────────

function RoleDetailPanel({
  roleId,
  onClose,
}: {
  roleId: string;
  onClose: () => void;
}) {
  const { data, isLoading, isError } = useQuery({
    queryKey:  ['roleDetail', roleId],
    queryFn:   () => adminService.getRoleDetail(roleId),
    staleTime: 60_000,
  });

  return (
    <div className="absolute right-0 top-0 h-full w-80 bg-white border-l border-surface-100 shadow-lg flex flex-col z-10 animate-slide-up">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-surface-100 bg-surface-50">
        <span className="text-sm font-semibold text-surface-800 truncate">Role Details</span>
        <button onClick={onClose} className="text-surface-400 hover:text-surface-700 transition-colors">
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

      {isError && (
        <div className="p-4 text-sm text-red-600">Failed to load role details.</div>
      )}

      {data && (
        <div className="flex-1 overflow-y-auto">
          {/* Role header */}
          <div className="p-4 border-b border-surface-50">
            <div className="flex items-start gap-2">
              <div
                className="mt-0.5 h-3 w-3 rounded-full flex-shrink-0"
                style={{ background: getFamilyColor(data.role.role_family) }}
              />
              <div>
                <h3 className="font-semibold text-surface-900 text-sm leading-tight">{data.role.role_name}</h3>
                {data.role.role_family && (
                  <p className="text-xs text-surface-400 mt-0.5">{data.role.role_family}</p>
                )}
                {data.role.seniority_level && (
                  <span className="inline-block mt-1 text-[10px] bg-surface-100 text-surface-600 rounded-full px-2 py-0.5 font-medium capitalize">
                    {data.role.seniority_level}
                  </span>
                )}
              </div>
            </div>
            {data.role.description && (
              <p className="mt-2 text-xs text-surface-500 leading-relaxed">{data.role.description}</p>
            )}
          </div>

          {/* Transitions */}
          <Section title="Outgoing Transitions" count={data.outgoing_transitions.length} color="blue">
            {data.outgoing_transitions.length === 0 ? (
              <p className="text-xs text-surface-400 italic">No outgoing transitions</p>
            ) : (
              data.outgoing_transitions.map(t => (
                <TransitionRow key={t.id} label={t.to_role_id_name ?? t.to_role_id} transition={t} direction="out" />
              ))
            )}
          </Section>

          <Section title="Incoming Transitions" count={data.incoming_transitions.length} color="emerald">
            {data.incoming_transitions.length === 0 ? (
              <p className="text-xs text-surface-400 italic">No incoming transitions</p>
            ) : (
              data.incoming_transitions.map(t => (
                <TransitionRow key={t.id} label={t.from_role_id_name ?? t.from_role_id} transition={t} direction="in" />
              ))
            )}
          </Section>

          {/* Skills */}
          <Section title="Required Skills" count={data.skills.length} color="violet">
            {data.skills.length === 0 ? (
              <p className="text-xs text-surface-400 italic">No skills mapped</p>
            ) : (
              <div className="flex flex-wrap gap-1">
                {data.skills.map(s => (
                  <span key={s.skill_id} className="text-[11px] bg-violet-50 text-violet-700 border border-violet-200 rounded-full px-2 py-0.5">
                    {s.skill_name}
                  </span>
                ))}
              </div>
            )}
          </Section>

          {/* Salary */}
          {data.salary.length > 0 && (
            <Section title="Salary Benchmarks" count={data.salary.length} color="amber">
              {data.salary.slice(0, 5).map((s, i) => (
                <div key={i} className="flex items-center justify-between text-xs py-0.5">
                  <span className="text-surface-600 font-medium">{s.country}</span>
                  <span className="text-surface-800 font-mono tabular-nums">
                    {s.median_salary
                      ? `${(s.currency ?? '')} ${s.median_salary.toLocaleString()}`
                      : '—'}
                  </span>
                </div>
              ))}
            </Section>
          )}

          {/* Education */}
          {data.education.length > 0 && (
            <Section title="Education Match" count={data.education.length} color="sky">
              {data.education.map((e, i) => (
                <div key={i} className="flex items-center justify-between text-xs py-0.5">
                  <span className="text-surface-600 capitalize">{e.education_level?.replace(/_/g, ' ')}</span>
                  {e.match_score != null && (
                    <span className="text-surface-800 font-mono tabular-nums">{e.match_score}%</span>
                  )}
                </div>
              ))}
            </Section>
          )}
        </div>
      )}
    </div>
  );
}

function Section({
  title, count, color, children,
}: {
  title: string; count: number; color: string; children: React.ReactNode;
}) {
  const [open, setOpen] = useState(true);
  const colors: Record<string, string> = {
    blue: 'bg-blue-50 text-blue-700', emerald: 'bg-emerald-50 text-emerald-700',
    violet: 'bg-violet-50 text-violet-700', amber: 'bg-amber-50 text-amber-700',
    sky: 'bg-sky-50 text-sky-700',
  };
  return (
    <div className="border-b border-surface-50">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-surface-50 transition-colors"
      >
        <span className="text-xs font-semibold text-surface-700">{title}</span>
        <div className="flex items-center gap-2">
          <span className={cn('text-[10px] font-bold rounded-full px-1.5 py-0.5', colors[color] ?? colors.blue)}>
            {count}
          </span>
          <svg className={cn('h-3 w-3 text-surface-400 transition-transform', open ? 'rotate-180' : '')} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>
      {open && <div className="px-4 pb-3 space-y-1">{children}</div>}
    </div>
  );
}

function TransitionRow({
  label, transition, direction,
}: {
  label: string;
  transition: GraphTransitionEdge;
  direction: 'in' | 'out';
}) {
  return (
    <div className="flex items-center gap-2 text-xs py-0.5">
      <span className={cn(
        'text-[10px] font-bold rounded-full px-1.5 py-0.5',
        direction === 'out' ? 'bg-blue-50 text-blue-600' : 'bg-emerald-50 text-emerald-600'
      )}>
        {direction === 'out' ? '→' : '←'}
      </span>
      <span className="text-surface-700 flex-1 truncate">{label}</span>
      {transition.probability != null && (
        <span className="text-surface-400 font-mono tabular-nums flex-shrink-0">
          {Math.round(transition.probability * 100)}%
        </span>
      )}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function CareerGraphExplorer() {
  const svgRef    = useRef<SVGSVGElement>(null);
  const [svgSize, setSvgSize] = useState({ w: 800, h: 600 });
  const [nodes,   setNodes]   = useState<LayoutNode[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch]   = useState('');
  const [transform, setTransform] = useState({ x: 0, y: 0, k: 1 });
  const dragging   = useRef<{ id: string; ox: number; oy: number } | null>(null);
  const panStart   = useRef<{ x: number; y: number; tx: number; ty: number } | null>(null);

  const { data, isLoading, isError } = useQuery({
    queryKey:  ['careerGraph'],
    queryFn:   () => adminService.getCareerGraph(),
    staleTime: 120_000,
  });

  // Measure container
  useEffect(() => {
    if (!svgRef.current) return;
    const obs = new ResizeObserver(entries => {
      const { width, height } = entries[0].contentRect;
      setSvgSize({ w: width, h: height });
    });
    obs.observe(svgRef.current.parentElement!);
    return () => obs.disconnect();
  }, []);

  // Build layout when data arrives
  useEffect(() => {
    if (!data?.roles) return;
    // Guard: filter out any Firestore docs that are missing role_name
    const validRoles = data.roles.filter(r => r.role_name);
    const laid = buildLayout(validRoles, data.transitions, svgSize.w, svgSize.h);
    setNodes(laid);
  }, [data, svgSize.w, svgSize.h]);

  // Mouse drag handlers
  const onNodeMouseDown = useCallback((e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    const svg = svgRef.current!;
    const pt  = svg.createSVGPoint();
    pt.x = e.clientX; pt.y = e.clientY;
    const sp = pt.matrixTransform(svg.getScreenCTM()!.inverse());
    dragging.current = { id, ox: sp.x, oy: sp.y };
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
      setNodes(prev => prev.map(n =>
        n.id === dragging.current!.id
          ? { ...n, x: sp.x, y: sp.y }
          : n
      ));
    } else if (panStart.current) {
      const dx = e.clientX - panStart.current.x;
      const dy = e.clientY - panStart.current.y;
      setTransform(t => ({ ...t, x: panStart.current!.tx + dx, y: panStart.current!.ty + dy }));
    }
  }, []);

  const onMouseUp = useCallback(() => {
    dragging.current = null;
    panStart.current = null;
  }, []);

  const onWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const scale = e.deltaY > 0 ? 0.9 : 1.1;
    setTransform(t => ({ ...t, k: Math.max(0.2, Math.min(3, t.k * scale)) }));
  }, []);

  // Filter nodes by search
  const nodeIndex = new Map(nodes.map(n => [n.id, n]));
  const filteredIds = search
    ? new Set(nodes.filter(n => (n.role_name ?? '').toLowerCase().includes(search.toLowerCase())).map(n => n.id))
    : null;

  const visibleTransitions = data?.transitions?.filter(t => {
    const fn = nodeIndex.get(t.from_role_id);
    const tn = nodeIndex.get(t.to_role_id);
    if (!fn || !tn) return false;
    if (filteredIds) return filteredIds.has(t.from_role_id) || filteredIds.has(t.to_role_id);
    return true;
  }) ?? [];

  return (
    <div className="flex h-full gap-0 relative">
      {/* Graph canvas */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Toolbar */}
        <div className="flex items-center gap-3 px-4 py-2.5 border-b border-surface-100 bg-white shrink-0">
          <div className="relative">
            <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-surface-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder="Filter roles..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-8 pr-3 py-1.5 text-xs border border-surface-200 rounded-lg bg-surface-50 focus:outline-none focus:ring-1 focus:ring-hr-400 w-48"
            />
          </div>
          <div className="flex items-center gap-3 ml-auto text-xs text-surface-400">
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-blue-400" />
              {data?.node_count ?? '—'} Roles
            </span>
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 bg-surface-300" style={{ clipPath: 'polygon(0 50%, 100% 0, 100% 100%)' }} />
              {data?.edge_count ?? '—'} Transitions
            </span>
            <button
              onClick={() => setTransform({ x: 0, y: 0, k: 1 })}
              className="px-2 py-1 rounded border border-surface-200 hover:bg-surface-50 text-surface-500 text-[11px]"
            >
              Reset View
            </button>
          </div>
        </div>

        {/* SVG graph */}
        <div className="flex-1 relative bg-surface-50 overflow-hidden">
          {isLoading && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center">
                <div className="h-8 w-8 mx-auto animate-spin rounded-full border-2 border-hr-500 border-t-transparent mb-3" />
                <p className="text-sm text-surface-500">Loading career graph…</p>
              </div>
            </div>
          )}
          {isError && (
            <div className="absolute inset-0 flex items-center justify-center">
              <p className="text-sm text-red-500">Failed to load graph data.</p>
            </div>
          )}
          {!isLoading && !isError && nodes.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center text-surface-400">
                <svg className="h-12 w-12 mx-auto mb-2 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                <p className="text-sm">No roles in the graph yet. Import roles first.</p>
              </div>
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
              <marker id="arrowhead" markerWidth="6" markerHeight="4" refX="5" refY="2" orient="auto">
                <polygon points="0 0, 6 2, 0 4" fill="#cbd5e1" />
              </marker>
              <marker id="arrowhead-highlight" markerWidth="6" markerHeight="4" refX="5" refY="2" orient="auto">
                <polygon points="0 0, 6 2, 0 4" fill="#3b82f6" />
              </marker>
            </defs>

            <g transform={`translate(${transform.x},${transform.y}) scale(${transform.k})`}>
              {/* Edges */}
              {visibleTransitions.map(t => {
                const fn = nodeIndex.get(t.from_role_id);
                const tn = nodeIndex.get(t.to_role_id);
                if (!fn || !tn) return null;
                const isHighlight = selectedId === t.from_role_id || selectedId === t.to_role_id;
                const isDim = filteredIds && !filteredIds.has(t.from_role_id) && !filteredIds.has(t.to_role_id);
                return (
                  <line
                    key={t.id}
                    x1={fn.x} y1={fn.y} x2={tn.x} y2={tn.y}
                    stroke={isHighlight ? '#3b82f6' : '#e2e8f0'}
                    strokeWidth={isHighlight ? 2 : 1}
                    strokeOpacity={isDim ? 0.2 : isHighlight ? 1 : 0.7}
                    markerEnd={isHighlight ? 'url(#arrowhead-highlight)' : 'url(#arrowhead)'}
                  />
                );
              })}

              {/* Nodes */}
              {nodes.map(node => {
                const color  = getFamilyColor(node.role_family);
                const radius = getSeniorityRadius(node.seniority_level);
                const isSelected = selectedId === node.id;
                const isDim = filteredIds && !filteredIds.has(node.id);
                return (
                  <g
                    key={node.id}
                    transform={`translate(${node.x},${node.y})`}
                    className="cursor-pointer"
                    onMouseDown={e => onNodeMouseDown(e, node.id)}
                    onClick={() => setSelectedId(node.id === selectedId ? null : node.id)}
                    opacity={isDim ? 0.25 : 1}
                  >
                    <circle
                      r={radius + (isSelected ? 3 : 0)}
                      fill={color}
                      fillOpacity={isSelected ? 1 : 0.85}
                      stroke={isSelected ? '#1e3a5f' : 'white'}
                      strokeWidth={isSelected ? 2.5 : 1.5}
                    />
                    <text
                      textAnchor="middle"
                      dy={radius + 11}
                      fontSize={9}
                      fill="#475569"
                      fontWeight={isSelected ? 700 : 400}
                      style={{ pointerEvents: 'none', userSelect: 'none' }}
                    >
                      {(node.role_name ?? '').length > 16
                        ? (node.role_name ?? '').slice(0, 14) + '…'
                        : (node.role_name ?? node.id)}
                    </text>
                  </g>
                );
              })}
            </g>
          </svg>

          {/* Legend */}
          <div className="absolute bottom-3 left-3 bg-white/90 backdrop-blur-sm rounded-lg border border-surface-100 p-2 text-[10px] shadow-sm">
            {Object.entries(FAMILY_COLORS).slice(0, 5).map(([family, color]) => (
              <div key={family} className="flex items-center gap-1.5 py-0.5">
                <span className="h-2 w-2 rounded-full flex-shrink-0" style={{ background: color }} />
                <span className="text-surface-600">{family}</span>
              </div>
            ))}
            <div className="flex items-center gap-1.5 py-0.5">
              <span className="h-2 w-2 rounded-full flex-shrink-0 bg-gray-400" />
              <span className="text-surface-600">Other</span>
            </div>
          </div>
        </div>
      </div>

      {/* Detail panel */}
      {selectedId && (
        <div className="w-80 shrink-0 relative border-l border-surface-100">
          <RoleDetailPanel roleId={selectedId} onClose={() => setSelectedId(null)} />
        </div>
      )}
    </div>
  );
}