'use client';

/**
 * app/(dashboard)/skills/page.tsx — v5
 *
 * Targeted improvements over v4:
 *  - Match score uses real matchScoreImpact sum (not flat ×3 estimate)
 *  - Impact label: "+N pts match score" (meaningful)
 *  - "More Skills" subtitle shows priority tier (High/Moderate/Good)
 *  - AI header subtitle is personalised to targetRole
 *  - Search highlights matching text in dropdown results
 *  - No duplicate/contradicting messages anywhere
 *  - "Add All N" always reflects visible top skill count
 *  - Score bar: current% → potential% with accurate gain
 */

import {
  useState, useEffect, useRef, useMemo, useCallback,
} from 'react';
import { useSearchParams }         from 'next/navigation';
import { useSkillRecommendations } from '@/hooks/useSkillRecommendations';
import { useSkillSearch }          from '@/hooks/useSkillSearch';
import { useQueryClient }          from '@tanstack/react-query';
import { PROFILE_KEY, useProfile } from '@/hooks/useProfile';
import type { RecommendedSkill }   from '@/hooks/useSkillRecommendations';
import { apiFetch }                from '@/services/apiClient';

// ─── Constants ────────────────────────────────────────────────────────────────

const TOP_COUNT   = 4;
const EXPAND_STEP = 5;

const STYLES = `
  @keyframes spin        { to { transform: rotate(360deg) } }
  @keyframes fadeSlideIn { from { opacity:0; transform:translateY(8px) } to { opacity:1; transform:translateY(0) } }
  @keyframes fadeOut     { from { opacity:1; transform:scale(1) }        to { opacity:0; transform:scale(0.88) } }
  @keyframes pulse       { 0%,100%{opacity:1} 50%{opacity:.45} }
  @keyframes shimmer     { from{background-position:-200% 0} to{background-position:200% 0} }
`;

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Highlight occurrences of `query` inside `text` */
function HighlightMatch({ text, query }: { text: string; query: string }) {
  if (!query || query.length < 2) return <>{text}</>;
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return <>{text}</>;
  return (
    <>
      {text.slice(0, idx)}
      <mark style={{ background: 'rgba(59,113,248,0.35)', color: '#fff', borderRadius: 2, padding: '0 1px' }}>
        {text.slice(idx, idx + query.length)}
      </mark>
      {text.slice(idx + query.length)}
    </>
  );
}

/** Priority label for a skill based on demandScore */
function priorityLabel(score: number): string {
  if (score >= 80) return 'high impact';
  if (score >= 60) return 'moderate impact';
  return 'moderate impact';
}

function priorityColor(score: number): string {
  if (score >= 80) return '#18d98b';
  if (score >= 60) return '#3b71f8';
  return '#f5a623';
}

// ─── Atoms ────────────────────────────────────────────────────────────────────

function Spinner({ size = 14, color = 'rgba(255,255,255,0.7)' }: { size?: number; color?: string }) {
  return (
    <span style={{
      display: 'inline-block', width: size, height: size, borderRadius: '50%',
      border: '2px solid rgba(255,255,255,0.1)', borderTopColor: color,
      animation: 'spin .6s linear infinite', flexShrink: 0,
    }} />
  );
}

function AddBtn({ onClick, disabled, loading, added }: {
  onClick: () => void; disabled?: boolean; loading?: boolean; added?: boolean;
}) {
  if (added) return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: '6px 14px', borderRadius: 8, fontSize: 12, fontWeight: 700,
      background: 'rgba(24,217,139,0.12)', color: '#18d98b',
      border: '1px solid rgba(24,217,139,0.25)', flexShrink: 0,
    }}>
      <svg width={11} height={11} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
      </svg>
      Added
    </span>
  );
  return (
    <button
      onClick={onClick}
      disabled={disabled || loading}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 5,
        padding: '6px 14px', borderRadius: 8, fontSize: 12, fontWeight: 700,
        background: disabled ? 'rgba(255,255,255,0.04)' : '#3b71f8',
        color: disabled ? 'rgba(255,255,255,0.2)' : '#fff',
        border: 'none', cursor: disabled ? 'not-allowed' : 'pointer',
        transition: 'background .15s, transform .1s', flexShrink: 0,
      }}
      onMouseEnter={e => { if (!disabled) (e.currentTarget as HTMLButtonElement).style.background = '#2546eb'; }}
      onMouseLeave={e => { if (!disabled) (e.currentTarget as HTMLButtonElement).style.background = '#3b71f8'; }}
      onMouseDown={e  => { if (!disabled) (e.currentTarget as HTMLButtonElement).style.transform = 'scale(0.95)'; }}
      onMouseUp={e    => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)'; }}
    >
      {loading
        ? <Spinner size={11} />
        : <svg width={11} height={11} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
          </svg>
      }
      {loading ? 'Adding…' : '+ Add'}
    </button>
  );
}

// ─── Match Score Bar ──────────────────────────────────────────────────────────
// Uses the real cumulative matchScoreImpact from added skills this session.

function MatchScoreBar({
  baseScore,
  sessionGain,
  potentialGain,
  targetRole,
}: {
  baseScore:     number;   // score from server before this session
  sessionGain:   number;   // pts gained by skills added this session
  potentialGain: number;   // total pts available if all suggestions added
  targetRole:    string | null;
}) {
  const currentDisplay  = Math.min(100, baseScore + sessionGain);
  const potentialDisplay = Math.min(100, baseScore + potentialGain);
  const gained = currentDisplay - baseScore;

  return (
    <div style={{
      padding: '14px 20px 16px',
      borderTop: '1px solid rgba(255,255,255,0.05)',
      background: 'rgba(59,113,248,0.03)',
    }}>
      {/* Labels row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <span style={{
          fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
          letterSpacing: '.1em', color: 'rgba(255,255,255,0.28)',
        }}>
          Role Match Score{targetRole ? ` — ${targetRole}` : ''}
        </span>

        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          {/* Base */}
          <span style={{ fontSize: 12, fontWeight: 700, color: gained > 0 ? 'rgba(255,255,255,0.4)' : 'rgba(255,255,255,0.75)' }}>
            {baseScore}%
          </span>

          {/* Arrow + current (only when gained this session) */}
          {gained > 0 && (
            <>
              <svg width={12} height={12} fill="none" stroke="rgba(24,217,139,0.7)" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
              </svg>
              <span style={{ fontSize: 14, fontWeight: 800, color: '#18d98b' }}>{currentDisplay}%</span>
              <span style={{
                fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 20,
                background: 'rgba(24,217,139,0.12)', color: '#18d98b',
                border: '1px solid rgba(24,217,139,0.2)',
              }}>
                +{gained}%
              </span>
            </>
          )}

          {/* Potential (only when there are still skills to add) */}
          {potentialGain > 0 && potentialDisplay > currentDisplay && (
            <span style={{
              fontSize: 10, fontWeight: 600, color: 'rgba(255,255,255,0.25)',
              marginLeft: 4,
            }}>
              → {potentialDisplay}% match potential
            </span>
          )}
        </div>
      </div>

      {/* Bar track */}
      <div style={{ position: 'relative', height: 7, borderRadius: 9999, background: 'rgba(255,255,255,0.07)', overflow: 'hidden' }}>
        {/* Potential ghost bar */}
        {potentialDisplay > currentDisplay && (
          <div style={{
            position: 'absolute', left: 0, top: 0,
            width: `${potentialDisplay}%`, height: '100%',
            background: 'rgba(59,113,248,0.15)',
            borderRadius: 9999,
          }} />
        )}
        {/* Active bar */}
        <div style={{
          position: 'absolute', left: 0, top: 0,
          width: `${currentDisplay}%`, height: '100%',
          background: 'linear-gradient(90deg, #3b71f8, #18d98b)',
          borderRadius: 9999,
          transition: 'width 1s cubic-bezier(.4,0,.2,1)',
        }} />
      </div>

      {/* Footer text */}
      <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.2)', marginTop: 7, lineHeight: 1.5 }}>
        {gained > 0
          ? `You've improved your match by ${gained}% this session.${potentialDisplay > currentDisplay ? ` Add all suggestions to reach ${potentialDisplay}%.` : ''}`
          : potentialGain > 0
            ? `Add the suggested skills above to reach ${potentialDisplay}% match potential.`
            : 'Your match score is up to date.'
        }
      </p>
    </div>
  );
}

// ─── Skill Row ────────────────────────────────────────────────────────────────

function SkillRow({ skill, onAdd, isBeingAdded, alreadyAdded }: {
  skill: RecommendedSkill; onAdd: (name: string) => void;
  isBeingAdded: boolean; alreadyAdded: boolean;
}) {
  if (alreadyAdded) return null;

  const pColor = priorityColor(skill.demandScore);

  return (
    <div
      style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '12px 20px', borderBottom: '1px solid rgba(255,255,255,0.04)',
        transition: 'background .12s', animation: 'fadeSlideIn .2s ease-out',
      }}
      onMouseEnter={e => (e.currentTarget.style.background = 'rgba(59,113,248,0.04)')}
      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
    >
      {/* Avatar */}
      <div style={{
        width: 38, height: 38, borderRadius: 10, flexShrink: 0,
        background: `${pColor}14`, border: `1px solid ${pColor}28`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 11, fontWeight: 800, color: pColor,
      }}>
        {skill.name.slice(0, 2).toUpperCase()}
      </div>

      {/* Name + meta */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{
          fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.88)',
          margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {skill.name}
        </p>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginTop: 4, flexWrap: 'wrap' }}>
          {/* Demand bar */}
          <div style={{ width: 48, height: 3, borderRadius: 9999, background: 'rgba(255,255,255,0.08)', overflow: 'hidden', flexShrink: 0 }}>
            <div style={{ width: `${skill.demandScore}%`, height: '100%', borderRadius: 9999, background: pColor, transition: 'width .6s ease' }} />
          </div>
          <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', fontWeight: 600 }}>
            {skill.demandScore}% demand
          </span>
          {/* Impact label — meaningful */}
          <span style={{
            fontSize: 10, fontWeight: 700, padding: '1px 7px', borderRadius: 20,
            background: `${pColor}12`, color: pColor, border: `1px solid ${pColor}25`,
          }}>
            +{skill.matchScoreImpact} pts match score
          </span>
        </div>
      </div>

      <AddBtn
        onClick={() => onAdd(skill.name)}
        disabled={alreadyAdded}
        loading={isBeingAdded}
        added={alreadyAdded}
      />
    </div>
  );
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function SkeletonRow() {
  const s: React.CSSProperties = { animation: 'pulse 1.6s ease-in-out infinite' };
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 20px' }}>
      <div style={{ width: 38, height: 38, borderRadius: 10, background: 'rgba(255,255,255,0.05)', flexShrink: 0, ...s }} />
      <div style={{ flex: 1 }}>
        <div style={{ height: 12, width: '42%', borderRadius: 6, background: 'rgba(255,255,255,0.06)', marginBottom: 7, ...s }} />
        <div style={{ height: 3, width: '30%', borderRadius: 9999, background: 'rgba(255,255,255,0.04)', ...s }} />
      </div>
      <div style={{ width: 65, height: 30, borderRadius: 8, background: 'rgba(255,255,255,0.05)', ...s }} />
    </div>
  );
}

// ─── Search Dropdown ──────────────────────────────────────────────────────────

function SearchDropdown({ results, isSearching, noResults, query, addedNames, onSelect }: {
  results: Array<{ id: string; name: string; category: string }>;
  isSearching: boolean; noResults: boolean; query: string;
  addedNames: Set<string>; onSelect: (name: string) => void;
}) {
  if (!query || query.length < 2) return null;
  return (
    <div style={{
      position: 'absolute', top: 'calc(100% + 6px)', left: 0, right: 0,
      borderRadius: 12, zIndex: 200, overflow: 'hidden',
      background: '#0d1322',
      border: '1px solid rgba(59,113,248,0.22)',
      boxShadow: '0 20px 60px rgba(0,0,0,0.65)',
      animation: 'fadeSlideIn .15s ease-out',
    }}>
      {isSearching && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '14px 16px' }}>
          <Spinner size={13} />
          <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)' }}>Searching…</span>
        </div>
      )}
      {!isSearching && noResults && (
        <div style={{ padding: '14px 16px', textAlign: 'center' }}>
          <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)', margin: 0 }}>
            No skills found for &ldquo;{query}&rdquo;
          </p>
        </div>
      )}
      {!isSearching && results.slice(0, 10).map(skill => {
        const already = addedNames.has(skill.name.toLowerCase());
        return (
          <button
            key={skill.id ?? skill.name}
            onClick={() => !already && onSelect(skill.name)}
            disabled={already}
            style={{
              width: '100%', display: 'flex', alignItems: 'center',
              justifyContent: 'space-between', gap: 10,
              padding: '10px 16px', border: 'none',
              background: 'transparent',
              cursor: already ? 'default' : 'pointer',
              borderBottom: '1px solid rgba(255,255,255,0.04)',
              transition: 'background .1s',
            }}
            onMouseEnter={e => { if (!already) (e.currentTarget as HTMLButtonElement).style.background = 'rgba(59,113,248,0.1)'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; }}
          >
            <div style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: already ? 'rgba(255,255,255,0.28)' : 'rgba(255,255,255,0.88)' }}>
                <HighlightMatch text={skill.name} query={query} />
              </span>
              {skill.category && (
                <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.22)', marginLeft: 8 }}>
                  {skill.category}
                </span>
              )}
            </div>
            {already
              ? <span style={{ fontSize: 10, color: '#18d98b', fontWeight: 700, flexShrink: 0 }}>✓ In profile</span>
              : <span style={{ fontSize: 10, color: '#3b71f8', fontWeight: 700, flexShrink: 0 }}>+ Add</span>
            }
          </button>
        );
      })}
    </div>
  );
}

// ─── Search Section ───────────────────────────────────────────────────────────

function SearchSection({ addedNames, onAdd }: { addedNames: Set<string>; onAdd: (name: string) => void }) {
  const { query, setQuery, results, isSearching, noResults, isEnabled, clear } = useSkillSearch();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  return (
    <div>
      <div style={{ marginBottom: 14 }}>
        <h3 style={{ fontSize: 13, fontWeight: 800, color: 'rgba(255,255,255,0.87)', margin: 0 }}>
          🔍 Search &amp; Add Skills
        </h3>
        <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginTop: 3 }}>
          Browse 1000+ skills — type at least 2 characters to search
        </p>
      </div>

      <div ref={wrapRef} style={{ position: 'relative' }}>
        <div style={{ position: 'relative' }}>
          <span style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)', color: 'rgba(255,255,255,0.22)', pointerEvents: 'none' }}>
            <svg width={15} height={15} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </span>
          <input
            type="text"
            value={query}
            onChange={e => { setQuery(e.target.value); setOpen(true); }}
            onFocus={() => setOpen(true)}
            placeholder='e.g. "Excel", "Python", "GST Compliance"'
            autoComplete="off"
            style={{
              width: '100%', height: 44, borderRadius: 12,
              paddingLeft: 40, paddingRight: query ? 40 : 14,
              fontSize: 13, color: 'rgba(255,255,255,0.87)',
              background: 'rgba(255,255,255,0.05)',
              border: open ? '1px solid rgba(59,113,248,0.55)' : '1px solid rgba(255,255,255,0.08)',
              boxShadow: open ? '0 0 0 3px rgba(59,113,248,0.1)' : 'none',
              outline: 'none', transition: 'border .15s, box-shadow .15s',
              boxSizing: 'border-box',
            }}
          />
          {query && (
            <span style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)' }}>
              {isSearching
                ? <Spinner size={13} />
                : (
                  <button
                    onClick={() => { clear(); setOpen(false); }}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 3, color: 'rgba(255,255,255,0.3)', display: 'flex' }}
                  >
                    <svg width={13} height={13} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )
              }
            </span>
          )}
        </div>

        {open && isEnabled && (
          <SearchDropdown
            results={results}
            isSearching={isSearching}
            noResults={noResults}
            query={query}
            addedNames={addedNames}
            onSelect={name => { onAdd(name); clear(); setOpen(false); }}
          />
        )}
      </div>
    </div>
  );
}

// ─── Added Skills Panel ───────────────────────────────────────────────────────

function AddedSkillsPanel({ skills, isLoading, localAdded, localRemoved, onRemove }: {
  skills:       Array<{ name: string; proficiency?: string }>;
  isLoading:    boolean;
  localAdded:   Set<string>;
  localRemoved: Set<string>;
  onRemove:     (name: string) => Promise<void>;
}) {
  const [showAll, setShowAll]   = useState(false);
  const [removing, setRemoving] = useState<Set<string>>(new Set());
  const COLORS = ['#3b71f8', '#18d98b', '#9b7cf7', '#f5a623', '#06bfbf', '#e96caa'];
  const SHOW   = 15;

  const allNames = useMemo(() => {
    const set = new Set<string>();
    skills.forEach(s => { if (!localRemoved.has(s.name.toLowerCase())) set.add(s.name); });
    localAdded.forEach(n => {
      if (localRemoved.has(n)) return;
      const found = skills.find(s => s.name.toLowerCase() === n);
      if (!found) set.add(n.split(' ').map((w: string) => w.charAt(0).toUpperCase() + w.slice(1)).join(' '));
    });
    return [...set].filter(Boolean).sort((a, b) => a.localeCompare(b));
  }, [skills, localAdded, localRemoved]);

  const visible  = showAll ? allNames : allNames.slice(0, SHOW);
  const overflow = allNames.length - SHOW;

  if (!isLoading && allNames.length === 0) return null;

  return (
    <div style={{
      borderRadius: 16,
      background: 'rgba(9,14,26,0.85)',
      border: '1px solid rgba(24,217,139,0.14)',
      boxShadow: '0 2px 16px rgba(0,0,0,0.22)',
      overflow: 'hidden',
    }}>
      {/* ── Header ── */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '14px 20px',
        borderBottom: '1px solid rgba(255,255,255,0.05)',
        background: 'rgba(24,217,139,0.04)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 28, height: 28, borderRadius: 8, flexShrink: 0,
            background: 'rgba(24,217,139,0.12)', border: '1px solid rgba(24,217,139,0.22)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <svg width={14} height={14} fill="none" stroke="#18d98b" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <div>
            <h3 style={{ fontSize: 13, fontWeight: 800, color: 'rgba(255,255,255,0.87)', margin: 0 }}>
              Skills You've Added
            </h3>
            <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.32)', marginTop: 2 }}>
              {isLoading ? 'Loading…' : 'These skills are already part of your profile'}
            </p>
          </div>
        </div>
        {allNames.length > 0 && (
          <span style={{
            fontSize: 12, fontWeight: 800, padding: '3px 11px', borderRadius: 20,
            background: 'rgba(24,217,139,0.1)', color: '#18d98b',
            border: '1px solid rgba(24,217,139,0.2)',
          }}>
            {allNames.length}
          </span>
        )}
      </div>

      {/* ── Progress nudge message (dynamic, no contradictions) ── */}
      {!isLoading && allNames.length > 0 && (
        <div style={{
          padding: '9px 20px',
          borderBottom: '1px solid rgba(255,255,255,0.04)',
          background: 'rgba(59,113,248,0.04)',
        }}>
          <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.38)', margin: 0, lineHeight: 1.55 }}>
            💡 You've added{' '}
            <strong style={{ color: 'rgba(255,255,255,0.68)' }}>
              {allNames.length} skill{allNames.length !== 1 ? 's' : ''}
            </strong>
            {' '}— great start! Add the AI-suggested skills above to increase your job match score.
          </p>
        </div>
      )}

      {/* ── Pills ── */}
      <div style={{ padding: '14px 20px' }}>
        {isLoading ? (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {[1,2,3,4,5,6,7].map(i => (
              <div key={i} style={{
                height: 30, width: `${52 + (i * 29) % 68}px`, borderRadius: 20,
                background: 'rgba(255,255,255,0.05)', animation: 'pulse 1.6s ease-in-out infinite',
              }} />
            ))}
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
              {visible.map((name, i) => {
                const isNew      = localAdded.has(name.toLowerCase());
                const isRemoving = removing.has(name);
                const col        = COLORS[i % COLORS.length];
                return (
                  <span
                    key={name}
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: 5,
                      padding: '5px 8px 5px 11px', borderRadius: 20,
                      fontSize: 12, fontWeight: 600,
                      background: isRemoving ? 'rgba(239,68,68,0.1)' : isNew ? `${col}18` : 'rgba(255,255,255,0.06)',
                      border:     isRemoving ? '1px solid rgba(239,68,68,0.3)' : isNew ? `1px solid ${col}30` : '1px solid rgba(255,255,255,0.08)',
                      color:      isRemoving ? '#ef4444' : isNew ? col : 'rgba(255,255,255,0.65)',
                      transition: 'all .2s',
                      animation:  isNew ? 'fadeSlideIn .3s ease-out' : 'none',
                    }}
                  >
                    {isNew && !isRemoving && (
                      <svg width={9} height={9} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                    {name}
                    {/* ✕ Remove button */}
                    <button
                      onClick={() => {
                        setRemoving(prev => new Set(prev).add(name));
                        onRemove(name).finally(() =>
                          setRemoving(prev => { const n = new Set(prev); n.delete(name); return n; })
                        );
                      }}
                      disabled={isRemoving}
                      title={`Remove ${name}`}
                      style={{
                        background: 'none', border: 'none', padding: '2px 3px', marginLeft: 1,
                        cursor: isRemoving ? 'not-allowed' : 'pointer',
                        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                        color: isRemoving ? '#ef4444' : 'rgba(255,255,255,0.2)',
                        borderRadius: '50%', transition: 'color .15s', lineHeight: 1,
                      }}
                      onMouseEnter={e => { if (!isRemoving) (e.currentTarget as HTMLButtonElement).style.color = '#ef4444'; }}
                      onMouseLeave={e => { if (!isRemoving) (e.currentTarget as HTMLButtonElement).style.color = 'rgba(255,255,255,0.2)'; }}
                    >
                      {isRemoving
                        ? <Spinner size={9} color="#ef4444" />
                        : <svg width={9} height={9} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                      }
                    </button>
                  </span>
                );
              })}
            </div>

            {overflow > 0 && (
              <button
                onClick={() => setShowAll(v => !v)}
                style={{
                  marginTop: 12, background: 'none', border: 'none',
                  fontSize: 11, fontWeight: 700, color: 'rgba(59,113,248,0.75)',
                  cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', gap: 4,
                }}
              >
                {showAll ? '↑ Show less' : `+ ${overflow} more`}
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function SkillsPage() {
  const searchParams = useSearchParams();
  const fromMissing  = searchParams.get('source') === 'missing-skills';
  const topRef       = useRef<HTMLDivElement>(null);
  const qc           = useQueryClient();

  useEffect(() => {
    if (fromMissing && topRef.current) {
      const t = setTimeout(() => topRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 250);
      return () => clearTimeout(t);
    }
  }, [fromMissing]);

  // ── Server data ─────────────────────────────────────────────────────────────
  const { data, isLoading, addSkill, addAllSkills, isAdding, isAddingAll, addingSkill } = useSkillRecommendations();
  const { data: profileData, isLoading: userSkillsLoading } = useProfile();

  const userSkills = useMemo(() => {
    const raw: any[] = (profileData?.user as any)?.skills ?? [];
    return raw
      .map((s: any) => typeof s === 'string' ? { name: s } : { name: s?.name ?? '', proficiency: s?.proficiency })
      .filter((s: any) => s.name?.trim()) as Array<{ name: string; proficiency?: string }>;
  }, [profileData]);

  // ── Session-local optimistic state ──────────────────────────────────────────
  const [localAdded,   setLocalAdded]   = useState<Set<string>>(new Set());
  const [localRemoved, setLocalRemoved] = useState<Set<string>>(new Set());

  // Track the cumulative matchScoreImpact for skills added this session
  // so the score bar reflects real server values, not a flat multiplier.
  const [sessionScoreGain, setSessionScoreGain] = useState(0);

  // ── addedNames: union of server skills + locally added, minus removed ────────
  const addedNames = useMemo(() => {
    const s = new Set<string>();
    localAdded.forEach(n => s.add(n));
    userSkills.forEach(u => { if (!localRemoved.has(u.name.toLowerCase())) s.add(u.name.toLowerCase()); });
    return s;
  }, [localAdded, localRemoved, userSkills]);

  // ── Visible recommendation lists ────────────────────────────────────────────
  const allRecs     = data?.recommendedSkills ?? [];
  const visibleRecs = allRecs.filter(s => !addedNames.has(s.name.toLowerCase()));
  const topSkills   = visibleRecs.slice(0, TOP_COUNT);
  const moreSkills  = visibleRecs.slice(TOP_COUNT);

  // Potential gain = sum of matchScoreImpact for ALL remaining visible suggestions
  const potentialGain = useMemo(
    () => visibleRecs.reduce((sum, s) => sum + (s.matchScoreImpact ?? 0), 0),
    [visibleRecs]
  );

  // ── Handlers ────────────────────────────────────────────────────────────────
  const handleAdd = useCallback((name: string) => {
    const key    = name.toLowerCase();
    const impact = allRecs.find(s => s.name.toLowerCase() === key)?.matchScoreImpact ?? 0;
    setLocalAdded(prev   => new Set(prev).add(key));
    setLocalRemoved(prev => { const n = new Set(prev); n.delete(key); return n; });
    setSessionScoreGain(prev => prev + impact);
    addSkill(name);
    setTimeout(() => qc.invalidateQueries({ queryKey: PROFILE_KEY }), 900);
  }, [addSkill, allRecs, qc]);

  const handleAddAll = useCallback(() => {
    if (!data?.missingSkills) return;
    const gain = topSkills.reduce((sum, s) => sum + (s.matchScoreImpact ?? 0), 0);
    data.missingSkills.forEach(s => {
      const key = s.toLowerCase();
      setLocalAdded(prev   => new Set(prev).add(key));
      setLocalRemoved(prev => { const n = new Set(prev); n.delete(key); return n; });
    });
    setSessionScoreGain(prev => prev + gain);
    addAllSkills(data.missingSkills);
    setTimeout(() => qc.invalidateQueries({ queryKey: PROFILE_KEY }), 900);
  }, [addAllSkills, data?.missingSkills, topSkills, qc]);

  const handleRemove = useCallback((name: string): Promise<void> => {
    const key    = name.toLowerCase();
    const impact = allRecs.find(s => s.name.toLowerCase() === key)?.matchScoreImpact ?? 0;
    // Optimistic: hide immediately + roll back score
    setLocalRemoved(prev => new Set(prev).add(key));
    setLocalAdded(prev   => { const n = new Set(prev); n.delete(key); return n; });
    setSessionScoreGain(prev => Math.max(0, prev - impact));

    return apiFetch<void>('/skills/remove', {
      method: 'POST',
      body: JSON.stringify({ skills: [name] }),
    }).then(() => {
      qc.invalidateQueries({ queryKey: PROFILE_KEY });
      qc.invalidateQueries({ queryKey: ['skill-recommendations'] });
    }).catch(() => {
      // Roll back on error
      setLocalRemoved(prev => { const n = new Set(prev); n.delete(key); return n; });
      setSessionScoreGain(prev => prev + impact);
    });
  }, [allRecs, qc]);

  // ── Expand state for "More Skills" ──────────────────────────────────────────
  const [expanded,     setExpanded]     = useState(false);
  const [visibleCount, setVisibleCount] = useState(TOP_COUNT);
  const shownMore   = moreSkills.slice(0, visibleCount - TOP_COUNT);
  const hiddenCount = moreSkills.length - shownMore.length;

  // ── Dominant priority label for "More Skills" subtitle ──────────────────────
  const moreAvgDemand = moreSkills.length
    ? moreSkills.reduce((s, r) => s + r.demandScore, 0) / moreSkills.length
    : 0;

  // ── Card styles ──────────────────────────────────────────────────────────────
  const aiCard: React.CSSProperties = {
    borderRadius: 16, background: 'rgba(14,20,36,0.98)', overflow: 'hidden',
    border: fromMissing ? '1px solid rgba(245,166,35,0.42)' : '1px solid rgba(59,113,248,0.28)',
    boxShadow: fromMissing
      ? '0 0 0 3px rgba(245,166,35,0.07), 0 6px 36px rgba(0,0,0,0.4)'
      : '0 0 0 1px rgba(59,113,248,0.07), 0 6px 36px rgba(0,0,0,0.35)',
  };
  const flatCard: React.CSSProperties = {
    borderRadius: 16, background: 'rgba(14,20,36,0.95)', overflow: 'hidden',
    border: '1px solid rgba(255,255,255,0.06)',
    boxShadow: '0 4px 20px rgba(0,0,0,0.25)',
  };

  return (
    <>
      <style>{STYLES}</style>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 20, animation: 'fadeSlideIn .3s ease-out' }}>

        {/* ── Page header ──────────────────────────────────────────────────── */}
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 800, color: 'rgba(255,255,255,0.92)', letterSpacing: '-.02em', margin: 0 }}>
            Skills
          </h2>
          <p style={{ marginTop: 4, fontSize: 12, color: 'rgba(255,255,255,0.35)' }}>
            {isLoading
              ? 'Analysing your profile…'
              : data?.targetRole
                ? `Personalised recommendations for ${data.targetRole}`
                : 'Add skills to improve your job match score'
            }
          </p>
        </div>

        {/* ── AI Suggested Skills ───────────────────────────────────────────── */}
        <div ref={topRef} style={aiCard}>

          {/* Header */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '16px 20px',
            borderBottom: '1px solid rgba(255,255,255,0.05)',
            background: 'rgba(59,113,248,0.05)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{
                width: 32, height: 32, borderRadius: 9, flexShrink: 0,
                background: 'rgba(59,113,248,0.16)', border: '1px solid rgba(59,113,248,0.28)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16,
              }}>🎯</div>
              <div>
                <h3 style={{ fontSize: 13, fontWeight: 800, color: 'rgba(255,255,255,0.92)', margin: 0 }}>
                  AI Suggested Skills
                </h3>
                <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.38)', marginTop: 2, maxWidth: 420 }}>
                  {isLoading
                    ? 'Analysing your profile…'
                    : topSkills.length > 0 && data?.targetRole
                      ? 'These are the highest-impact skills missing from your profile for your target role.'
                      : topSkills.length > 0
                        ? 'These are the highest-impact skills currently missing from your profile.'
                        : 'Set your target role to unlock AI-powered skill recommendations.'
                  }
                </p>
                {!isLoading && topSkills.length > 0 && (
                  <p style={{ fontSize: 10, color: 'rgba(245,166,35,0.6)', marginTop: 4, fontWeight: 600, letterSpacing: '.01em' }}>
                    🔥 Commonly required by top employers for this role
                  </p>
                )}
              </div>
            </div>

            {/* Add All — always reflects current visible top skill count */}
            {!isLoading && topSkills.length > 0 && (
              <button
                onClick={handleAddAll}
                disabled={isAddingAll || isAdding}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '8px 16px', borderRadius: 9, border: 'none',
                  fontSize: 11, fontWeight: 700, flexShrink: 0,
                  cursor: isAddingAll || isAdding ? 'not-allowed' : 'pointer',
                  background: isAddingAll ? 'rgba(255,255,255,0.05)' : '#f5a623',
                  color:      isAddingAll ? 'rgba(255,255,255,0.28)' : '#07090f',
                  transition: 'background .15s',
                }}
              >
                {isAddingAll
                  ? <><Spinner size={11} color="#aaa" /> Adding…</>
                  : <>
                      <svg width={11} height={11} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
                      </svg>
                      Add All {topSkills.length}
                    </>
                }
              </button>
            )}
          </div>

          {/* Skill rows */}
          {isLoading
            ? <>{[1,2,3,4].map(i => <SkeletonRow key={i} />)}</>
            : topSkills.length === 0
              ? (
                <div style={{ padding: '28px 20px', textAlign: 'center' }}>
                  {!data?.hasTargetRole
                    ? (
                      <>
                        <p style={{ fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.42)', marginBottom: 12 }}>
                          Set your target role to get AI-powered skill recommendations.
                        </p>
                        <a href="/profile" style={{
                          display: 'inline-flex', alignItems: 'center', gap: 5,
                          padding: '8px 18px', borderRadius: 9, background: '#3b71f8',
                          color: '#fff', fontSize: 12, fontWeight: 700, textDecoration: 'none',
                        }}>
                          Update Profile →
                        </a>
                      </>
                    )
                    : (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 14, justifyContent: 'center' }}>
                        <span style={{ fontSize: 28 }}>🏆</span>
                        <div style={{ textAlign: 'left' }}>
                          <p style={{ fontSize: 13, fontWeight: 700, color: 'rgba(255,255,255,0.75)', margin: 0 }}>
                            You have all key skills for {data?.targetRole}!
                          </p>
                          <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginTop: 4 }}>
                            Use the search below to explore more skills.
                          </p>
                        </div>
                      </div>
                    )
                  }
                </div>
              )
              : topSkills.map(skill => (
                <SkillRow
                  key={skill.name}
                  skill={skill}
                  onAdd={handleAdd}
                  isBeingAdded={isAddingAll || (isAdding && addingSkill === skill.name)}
                  alreadyAdded={addedNames.has(skill.name.toLowerCase())}
                />
              ))
          }

          {/* Live match score bar */}
          {!isLoading && data && (
            <MatchScoreBar
              baseScore={data.matchScore}
              sessionGain={sessionScoreGain}
              potentialGain={potentialGain}
              targetRole={data.targetRole}
            />
          )}
        </div>

        {/* ── More Suggested Skills ─────────────────────────────────────────── */}
        {!isLoading && moreSkills.length > 0 && (
          <div style={flatCard}>
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '14px 20px', borderBottom: '1px solid rgba(255,255,255,0.05)',
            }}>
              <div>
                <h3 style={{ fontSize: 13, fontWeight: 800, color: 'rgba(255,255,255,0.87)', margin: 0 }}>
                  More Suggested Skills
                </h3>
                <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginTop: 2 }}>
                  {moreSkills.length} more skill{moreSkills.length > 1 ? 's' : ''} ({priorityLabel(moreAvgDemand)})
                </p>
              </div>
              <span style={{
                fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20,
                background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.35)',
              }}>
                {moreSkills.length}
              </span>
            </div>

            {expanded && shownMore.map(skill => (
              <SkillRow
                key={skill.name}
                skill={skill}
                onAdd={handleAdd}
                isBeingAdded={isAddingAll || (isAdding && addingSkill === skill.name)}
                alreadyAdded={addedNames.has(skill.name.toLowerCase())}
              />
            ))}

            <div style={{ display: 'flex', borderTop: expanded ? '1px solid rgba(255,255,255,0.04)' : 'none' }}>
              {hiddenCount > 0 && (
                <button
                  onClick={() => { setExpanded(true); setVisibleCount(v => v + EXPAND_STEP); }}
                  style={{ flex: 1, padding: '13px', border: 'none', borderRight: expanded ? '1px solid rgba(255,255,255,0.04)' : 'none', background: 'transparent', cursor: 'pointer', fontSize: 12, fontWeight: 700, color: 'rgba(59,113,248,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'rgba(59,113,248,0.05)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                >
                  <svg width={13} height={13} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                  {!expanded ? `Show ${Math.min(EXPAND_STEP, moreSkills.length)} more` : `${hiddenCount} remaining`}
                </button>
              )}
              {expanded && (
                <button
                  onClick={() => { setExpanded(false); setVisibleCount(TOP_COUNT); }}
                  style={{ flex: hiddenCount > 0 ? '0 0 auto' : 1, minWidth: hiddenCount > 0 ? 110 : undefined, padding: '13px', border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,0.28)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, transition: 'color .15s' }}
                  onMouseEnter={e => { (e.currentTarget.style.background = 'rgba(255,255,255,0.02)'); (e.currentTarget.style.color = 'rgba(255,255,255,0.55)'); }}
                  onMouseLeave={e => { (e.currentTarget.style.background = 'transparent'); (e.currentTarget.style.color = 'rgba(255,255,255,0.28)'); }}
                >
                  <svg width={13} height={13} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" /></svg>
                  Show less
                </button>
              )}
              {!expanded && hiddenCount === 0 && (
                <button
                  onClick={() => { setExpanded(true); setVisibleCount(v => v + EXPAND_STEP); }}
                  style={{ flex: 1, padding: '13px', border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 12, fontWeight: 700, color: 'rgba(59,113,248,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'rgba(59,113,248,0.05)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                >
                  <svg width={13} height={13} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                  Show {Math.min(EXPAND_STEP, moreSkills.length)} more
                </button>
              )}
            </div>
          </div>
        )}

        {/* ── Search & Add ─────────────────────────────────────────────────── */}
        <div style={{ ...flatCard, overflow: 'visible' }}>
          <div style={{ padding: 20, position: 'relative' }}>
            <SearchSection addedNames={addedNames} onAdd={handleAdd} />
          </div>
        </div>

        {/* ── Skills You've Added ───────────────────────────────────────────── */}
        <AddedSkillsPanel
          skills={userSkills}
          isLoading={userSkillsLoading}
          localAdded={localAdded}
          localRemoved={localRemoved}
          onRemove={handleRemove}
        />

        {/* ── AI Explanation (only when suggestions remain) ─────────────────── */}
        {!isLoading && data?.hasTargetRole && visibleRecs.length > 0 && (
          <div style={{ padding: '13px 16px', borderRadius: 12, background: 'rgba(59,113,248,0.05)', border: '1px solid rgba(59,113,248,0.12)' }}>
            <div style={{ display: 'flex', gap: 9 }}>
              <span style={{ fontSize: 14, flexShrink: 0, marginTop: 1 }}>💡</span>
              <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.42)', lineHeight: 1.65, margin: 0 }}>
                You're on the right track. Add the recommended skills above to further increase your match score.
              </p>
            </div>
          </div>
        )}

      </div>
    </>
  );
}