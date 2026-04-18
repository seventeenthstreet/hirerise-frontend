'use client';
import { getAuthToken } from '@/lib/getToken';
/**
 * app/(dashboard)/resume-builder/page.tsx
 * Premium AI Resume Intelligence Builder — v3
 * Features: 5 templates, photo upload, customization panel,
 * 4-dimension ATS, multi-step pipeline, PDF/DOCX export, validation
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { useProfile }      from '@/hooks/useProfile';
import { useCareerHealth } from '@/hooks/useCareerHealth';
import { useHasResume }    from '@/hooks/useHasResume';
import { useResumes }      from '@/hooks/useResumes';
import type {
  ResumeContent, AtsBreakdown, AtsSuggestion,
  TemplateId, ResumeCustomization,
} from '@/lib/supabase';
import { DEFAULT_CUSTOMIZATION } from '@/lib/supabase';
import type { ImproveTarget } from '@/lib/services/resumePipeline';
import { getTemplateBody }    from '@/lib/templates';

// ─── Auth fetch ───────────────────────────────────────────────────────────────
async function authFetch<T>(path: string, body: unknown): Promise<T> {
  const token = await getAuthToken();
  const res   = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  if (!res.ok || !json.success) throw new Error(json?.error ?? `Request failed (${res.status})`);
  return json.data as T;
}

async function authFetchBlob(path: string, body: unknown): Promise<{ blob: Blob; filename: string }> {
  const token = await getAuthToken();
  const res   = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const json = await res.json().catch(() => ({}));
    throw new Error(json?.error ?? `Export failed (${res.status})`);
  }
  const cd       = res.headers.get('content-disposition') ?? '';
  const fnMatch  = cd.match(/filename="([^"]+)"/);
  const filename = fnMatch?.[1] ?? 'resume.pdf';
  return { blob: await res.blob(), filename };
}

// ─── Design tokens ────────────────────────────────────────────────────────────
const C = {
  bg:'#060810', s0:'#0b0f1a', s1:'#10151f', s2:'#161c2c', s3:'#1c2438',
  border:'rgba(255,255,255,0.07)', borderB:'rgba(255,255,255,0.12)',
  text:'#dde4ef', muted:'#5a6882', dim:'#252e42',
  green:'#18d98b', blue:'#3b71f8', amber:'#f5a623',
  red:'#f04d3c', purple:'#9b7cf7', cyan:'#06bfbf', pink:'#e96caa',
} as const;

const KF = `
@keyframes spin{to{transform:rotate(360deg)}}
@keyframes rise{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
@keyframes slide{from{opacity:0;transform:translateX(8px)}to{opacity:1;transform:none}}
@keyframes pop{0%{transform:scale(0.94);opacity:0}100%{transform:scale(1);opacity:1}}
`;

// ─── Template metadata ────────────────────────────────────────────────────────
const TEMPLATES: { id: TemplateId; name: string; desc: string; color: string; photo: boolean }[] = [
  { id:'modern',       name:'Modern Pro',    desc:'Sidebar layout',    color:C.blue,   photo:false },
  { id:'modern-photo', name:'Modern + Photo',desc:'With profile photo', color:C.cyan,   photo:true  },
  { id:'minimal',      name:'Minimal Clean', desc:'Clean typography',  color:C.muted,  photo:false },
  { id:'ats',          name:'ATS Optimized', desc:'Plain, parseable',  color:C.green,  photo:false },
  { id:'creative',     name:'Creative',      desc:'Design-forward',    color:C.purple, photo:true  },
  { id:'executive',    name:'Executive',     desc:'Premium style',     color:C.amber,  photo:false },
];

type Flow = 'idle' | 'generating' | 'editing';
type RightTab = 'preview' | 'ats' | 'customize';

// ─── Atoms ────────────────────────────────────────────────────────────────────
function Spinner({ size=20, color='#fff' }: { size?:number; color?:string }) {
  return <div style={{ width:size, height:size, borderRadius:'50%', border:`2px solid ${color}30`, borderTopColor:color, animation:'spin .65s linear infinite', flexShrink:0 }}/>;
}

function Btn({ children, onClick, disabled=false, loading=false, color=C.blue, size='md', variant='solid', full=false }: {
  children:React.ReactNode; onClick?:()=>void; disabled?:boolean; loading?:boolean;
  color?:string; size?:'sm'|'md'|'lg'; variant?:'solid'|'ghost'|'outline'; full?:boolean;
}) {
  const [hov,setHov]=useState(false);
  const pad=size==='sm'?'6px 13px':size==='lg'?'14px 28px':'9px 19px';
  const fs=size==='sm'?11:size==='lg'?14:12;
  const bg=variant==='solid'?(hov&&!disabled?color+'dd':color):(hov?color+'28':color+'15');
  return (
    <button onClick={onClick} disabled={disabled||loading}
      onMouseEnter={()=>setHov(true)} onMouseLeave={()=>setHov(false)}
      style={{ padding:pad, background:bg, color:variant==='solid'?'#fff':color,
        border:variant==='outline'?`1px solid ${color}50`:'none', borderRadius:9,
        fontWeight:700, fontSize:fs, cursor:disabled||loading?'not-allowed':'pointer',
        opacity:disabled||loading?.55:1, display:'inline-flex', alignItems:'center',
        gap:7, transition:'all .15s', fontFamily:'inherit',
        width:full?'100%':undefined, justifyContent:full?'center':undefined }}>
      {loading && <Spinner size={12} color={variant==='solid'?'#fff':color}/>}
      {children}
    </button>
  );
}

function Input({ value, onChange, placeholder, multiline=false, rows=3, style }: {
  value:string; onChange:(v:string)=>void; placeholder?:string;
  multiline?:boolean; rows?:number; style?:React.CSSProperties;
}) {
  const [foc,setFoc]=useState(false);
  const base:React.CSSProperties={
    width:'100%', background:C.s1, border:`1px solid ${foc?C.blue:C.borderB}`,
    boxShadow:foc?`0 0 0 3px ${C.blue}18`:'none', borderRadius:8,
    padding:'8px 12px', fontSize:13, color:C.text, outline:'none',
    resize:'vertical', fontFamily:'inherit', lineHeight:1.55,
    transition:'border-color .15s,box-shadow .15s', ...style,
  };
  return multiline
    ? <textarea rows={rows} value={value} onChange={e=>onChange(e.target.value)}
        placeholder={placeholder} style={base}
        onFocus={()=>setFoc(true)} onBlur={()=>setFoc(false)}/>
    : <input value={value} onChange={e=>onChange(e.target.value)}
        placeholder={placeholder} style={base}
        onFocus={()=>setFoc(true)} onBlur={()=>setFoc(false)}/>;
}

function FieldLabel({ children, required=false }: { children:React.ReactNode; required?:boolean }) {
  return (
    <div style={{ fontSize:10, fontWeight:700, color:C.muted, textTransform:'uppercase', letterSpacing:'.1em', marginBottom:5, display:'flex', alignItems:'center', gap:4 }}>
      {children}
      {required && <span style={{ color:'#f04d3c', fontSize:12, lineHeight:1, fontWeight:900 }}>*</span>}
    </div>
  );
}

function Card({ children, style }: { children:React.ReactNode; style?:React.CSSProperties }) {
  return <div style={{ background:C.s0, border:`1px solid ${C.border}`, borderRadius:14, ...style }}>{children}</div>;
}

function Sect({ title, icon, children, open:def=true }: { title:string; icon:string; children:React.ReactNode; open?:boolean }) {
  const [open,setOpen]=useState(def);
  return (
    <div style={{ background:C.s0, border:`1px solid ${C.border}`, borderRadius:12, overflow:'hidden', marginBottom:10 }}>
      <button onClick={()=>setOpen(o=>!o)} style={{ width:'100%', display:'flex', alignItems:'center',
        justifyContent:'space-between', padding:'14px 18px', background:'none', border:'none',
        cursor:'pointer', fontFamily:'inherit' }}>
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          <span style={{ fontSize:15 }}>{icon}</span>
          <span style={{ fontSize:13, fontWeight:700, color:C.text }}>{title}</span>
        </div>
        <span style={{ fontSize:10, color:C.dim, transform:open?'rotate(180deg)':'none', transition:'transform .2s' }}>▼</span>
      </button>
      {open && <div style={{ padding:'0 18px 18px', borderTop:`1px solid ${C.border}`, animation:'rise .2s ease-out' }}>
        <div style={{ height:14 }}/>{children}
      </div>}
    </div>
  );
}

// ─── ATS Ring ─────────────────────────────────────────────────────────────────
function AtsRing({ score }: { score:number }) {
  const r=38, circ=2*Math.PI*r, dash=(score/100)*circ;
  const col=score>=85?C.green:score>=65?C.blue:score>=45?C.amber:C.red;
  return (
    <div style={{ position:'relative', width:92, height:92, flexShrink:0 }}>
      <svg width={92} height={92} style={{ transform:'rotate(-90deg)' }}>
        <circle cx={46} cy={46} r={r} fill="none" stroke={C.s2} strokeWidth={8}/>
        <circle cx={46} cy={46} r={r} fill="none" stroke={col} strokeWidth={8}
          strokeLinecap="round" strokeDasharray={`${dash} ${circ}`}
          style={{ transition:'stroke-dasharray .9s cubic-bezier(.4,0,.2,1),stroke .4s' }}/>
      </svg>
      <div style={{ position:'absolute', inset:0, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center' }}>
        <span style={{ fontSize:22, fontWeight:900, color:col, lineHeight:1 }}>{score}</span>
        <span style={{ fontSize:8, color:C.muted, fontWeight:700 }}>/100</span>
      </div>
    </div>
  );
}

// ─── Auto-Fix Types ──────────────────────────────────────────────────────────
interface BulletDiff { expId:string; jobTitle:string; before:string[]; after:string[]; changed:boolean[] }
interface AutoFixDiff { bullets:BulletDiff[]; summaryChanged:boolean; keywordsAdded:string[] }
interface AutoFixResult {
  fixed:               ResumeContent;
  atsAfter:            AtsBreakdown;
  atsBefore:           AtsBreakdown;
  diff:                AutoFixDiff;
  improvementsSummary: string[];
  scoreIncrease:       number;
  cached:              boolean;
}

// ─── Auto-Fix CTA Banner ──────────────────────────────────────────────────────
// Shown inside the ATS panel when score is improvable. One-click trigger.
function AutoFixCta({ ats, busy, onFix }: { ats:AtsBreakdown|null; busy:boolean; onFix:()=>void }) {
  if (!ats || ats.overall >= 82) return null;
  const gain = Math.min(30, Math.max(5, Math.round((80 - ats.overall) * 0.6)));
  return (
    <div style={{ margin:'14px 0 0', background:`linear-gradient(135deg,${C.pink}14 0%,${C.purple}10 100%)`,
      border:`1px solid ${C.pink}30`, borderRadius:12, padding:'14px 16px' }}>
      <div style={{ display:'flex', alignItems:'flex-start', gap:12, marginBottom:12 }}>
        <div style={{ fontSize:26, lineHeight:1, flexShrink:0 }}>🤖</div>
        <div>
          <div style={{ fontSize:13, fontWeight:800, color:C.text, marginBottom:3 }}>Auto-Fix Resume with Ava</div>
          <div style={{ fontSize:11, color:C.muted, lineHeight:1.5 }}>
            Ava will rewrite your bullets, add missing keywords, and improve clarity — in one click.
            Estimated score boost: <span style={{ color:C.green, fontWeight:700 }}>+{gain} pts</span>
          </div>
        </div>
      </div>
      <Btn onClick={onFix} loading={busy} color={C.pink} full>
        {busy ? 'Ava is fixing your resume…' : '⚡ Auto-Fix Resume with Ava'}
      </Btn>
    </div>
  );
}

// ─── Score Delta Badge ────────────────────────────────────────────────────────
function ScoreDelta({ before, after }: { before:number; after:number }) {
  const delta = after - before;
  const col   = delta > 0 ? C.green : delta < 0 ? C.red : C.muted;
  return (
    <div style={{ display:'flex', alignItems:'center', gap:6 }}>
      <span style={{ fontSize:32, fontWeight:900, color:C.muted, lineHeight:1 }}>{before}</span>
      <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:2 }}>
        <span style={{ fontSize:10, color:C.muted }}>→</span>
        {delta !== 0 && (
          <span style={{ fontSize:10, fontWeight:800, color:col, background:`${col}15`,
            borderRadius:20, padding:'1px 6px' }}>
            {delta > 0 ? `+${delta}` : delta}
          </span>
        )}
      </div>
      <span style={{ fontSize:32, fontWeight:900, color:after>=75?C.green:after>=55?C.blue:C.amber, lineHeight:1 }}>{after}</span>
    </div>
  );
}

// ─── Before/After Bullet Diff ─────────────────────────────────────────────────
function BulletDiffView({ diff }: { diff:AutoFixDiff }) {
  const changed = diff.bullets.filter(b => b.changed.some(Boolean));
  if (changed.length === 0 && !diff.summaryChanged && diff.keywordsAdded.length === 0) {
    return <p style={{ fontSize:11, color:C.muted, margin:0 }}>No bullet changes detected.</p>;
  }
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
      {diff.summaryChanged && (
        <div style={{ background:`${C.purple}0a`, border:`1px solid ${C.purple}20`, borderRadius:10, padding:'10px 12px' }}>
          <div style={{ fontSize:9, fontWeight:800, textTransform:'uppercase', letterSpacing:'.1em',
            color:C.purple, marginBottom:6 }}>✨ Summary improved</div>
          <div style={{ fontSize:10, color:C.muted }}>Professional summary was rewritten.</div>
        </div>
      )}
      {diff.keywordsAdded.length > 0 && (
        <div>
          <div style={{ fontSize:9, fontWeight:800, textTransform:'uppercase', letterSpacing:'.1em',
            color:C.green, marginBottom:6 }}>🔑 Keywords added</div>
          <div style={{ display:'flex', flexWrap:'wrap', gap:4 }}>
            {diff.keywordsAdded.map(kw => (
              <span key={kw} style={{ fontSize:10, padding:'2px 8px', borderRadius:20,
                background:C.green+'18', border:`1px solid ${C.green}30`, color:C.green }}>
                + {kw}
              </span>
            ))}
          </div>
        </div>
      )}
      {changed.map(exp => (
        <div key={exp.expId}>
          <div style={{ fontSize:10, fontWeight:700, color:C.text, marginBottom:8 }}>
            💼 {exp.jobTitle}
          </div>
          {exp.after.map((bullet, i) => (
            exp.changed[i] ? (
              <div key={i} style={{ marginBottom:8 }}>
                <div style={{ fontSize:10, color:C.red+'99', textDecoration:'line-through',
                  marginBottom:3, lineHeight:1.5, padding:'4px 8px',
                  background:`${C.red}08`, borderRadius:6, borderLeft:`2px solid ${C.red}40` }}>
                  {exp.before[i]}
                </div>
                <div style={{ fontSize:10, color:C.text, lineHeight:1.5, padding:'4px 8px',
                  background:`${C.green}08`, borderRadius:6, borderLeft:`2px solid ${C.green}50` }}>
                  {bullet}
                </div>
              </div>
            ) : null
          ))}
        </div>
      ))}
    </div>
  );
}

// ─── Auto-Fix Result Panel ────────────────────────────────────────────────────
function AutoFixResultPanel({
  result, onAccept, onDismiss, busy,
}: {
  result: AutoFixResult;
  onAccept: () => void;
  onDismiss: () => void;
  busy: boolean;
}) {
  const [tab, setTab] = React.useState<'score'|'changes'|'improvements'>('score');
  return (
    <div style={{ padding:'16px 18px', animation:'pop .2s ease-out' }}>

      {/* Header */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:14 }}>
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          <span style={{ fontSize:18 }}>🤖</span>
          <div>
            <div style={{ fontSize:13, fontWeight:800, color:C.text }}>Ava's Auto-Fix</div>
            <div style={{ fontSize:10, color:C.muted }}>
              {result.cached ? '⚡ Cached result' : 'Fresh optimisation'}
            </div>
          </div>
        </div>
        <button onClick={onDismiss} style={{ background:'none', border:'none', color:C.muted,
          cursor:'pointer', fontSize:16, fontFamily:'inherit', padding:'4px 8px' }}>✕</button>
      </div>

      {/* Score delta */}
      <div style={{ background:C.s1, border:`1px solid ${C.border}`, borderRadius:12,
        padding:'14px 16px', marginBottom:12 }}>
        <div style={{ fontSize:9, fontWeight:800, textTransform:'uppercase', letterSpacing:'.12em',
          color:C.muted, marginBottom:8 }}>ATS Score</div>
        <ScoreDelta before={result.atsBefore.overall} after={result.atsAfter.overall}/>
        {result.scoreIncrease > 0 && (
          <div style={{ marginTop:6, fontSize:11, color:C.green, fontWeight:700 }}>
            🎯 +{result.scoreIncrease} point{result.scoreIncrease !== 1 ? 's' : ''} improvement
          </div>
        )}
      </div>

      {/* Tab bar */}
      <div style={{ display:'flex', gap:3, background:C.s2, borderRadius:10, padding:'3px', marginBottom:12 }}>
        {([
          {id:'score'      as const, l:'📊 Dims'},
          {id:'changes'    as const, l:'🔄 Changes'},
          {id:'improvements' as const, l:'✅ Summary'},
        ]).map(t => (
          <button key={t.id} onClick={()=>setTab(t.id)} style={{ flex:1, padding:'6px 4px',
            border:'none', borderRadius:7, cursor:'pointer', fontFamily:'inherit',
            fontWeight:700, fontSize:10, transition:'all .15s',
            background:tab===t.id?C.s0:'transparent',
            color:tab===t.id?C.text:C.muted,
            boxShadow:tab===t.id?'0 1px 4px rgba(0,0,0,.3)':'none' }}>
            {t.l}
          </button>
        ))}
      </div>

      {/* Tab: dimension comparison */}
      {tab==='score' && (
        <div style={{ display:'flex', flexDirection:'column', gap:8, marginBottom:14 }}>
          {([
            {l:'Keyword Match',    b:result.atsBefore.keywordMatch,    a:result.atsAfter.keywordMatch,    c:C.blue  },
            {l:'Content Strength', b:result.atsBefore.contentStrength, a:result.atsAfter.contentStrength, c:C.green },
            {l:'Skills Relevance', b:result.atsBefore.skillsRelevance, a:result.atsAfter.skillsRelevance, c:C.purple},
            {l:'Formatting',       b:result.atsBefore.formatting,      a:result.atsAfter.formatting,      c:C.amber },
          ]).map(dim => {
            const delta = dim.a - dim.b;
            return (
              <div key={dim.l}>
                <div style={{ display:'flex', justifyContent:'space-between', fontSize:9, marginBottom:3 }}>
                  <span style={{ color:C.muted }}>{dim.l}</span>
                  <span style={{ color:C.muted }}>
                    <span style={{ fontWeight:700, color:dim.c }}>{dim.b}%</span>
                    {' → '}
                    <span style={{ fontWeight:900, color:delta>0?C.green:delta<0?C.red:dim.c }}>{dim.a}%</span>
                    {delta !== 0 && (
                      <span style={{ marginLeft:4, fontSize:8, fontWeight:800,
                        color:delta>0?C.green:C.red }}>
                        {delta>0?`+${delta}`:delta}
                      </span>
                    )}
                  </span>
                </div>
                {/* After bar (green overlay) */}
                <div style={{ position:'relative', height:4, borderRadius:4, background:C.s2 }}>
                  <div style={{ position:'absolute', height:4, borderRadius:4, background:C.s3,
                    width:`${dim.b}%`, transition:'width .6s' }}/>
                  <div style={{ position:'absolute', height:4, borderRadius:4,
                    background:delta>0?C.green:dim.c,
                    width:`${dim.a}%`, transition:'width .9s cubic-bezier(.4,0,.2,1)' }}/>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Tab: bullet diffs */}
      {tab==='changes' && (
        <div style={{ maxHeight:260, overflowY:'auto', marginBottom:14 }}>
          <BulletDiffView diff={result.diff}/>
        </div>
      )}

      {/* Tab: improvement summary */}
      {tab==='improvements' && (
        <div style={{ marginBottom:14 }}>
          {result.improvementsSummary.length > 0 ? (
            <ul style={{ margin:0, padding:'0 0 0 14px', display:'flex', flexDirection:'column', gap:7 }}>
              {result.improvementsSummary.map((s,i) => (
                <li key={i} style={{ fontSize:11, color:C.text, lineHeight:1.5 }}>{s}</li>
              ))}
            </ul>
          ) : (
            <p style={{ fontSize:11, color:C.muted, margin:0 }}>No summary available.</p>
          )}
        </div>
      )}

      {/* Accept / dismiss CTAs */}
      <div style={{ display:'flex', gap:7, marginTop:4 }}>
        <Btn onClick={onAccept} loading={busy} color={C.green} full>
          ✅ Apply Changes
        </Btn>
        <Btn onClick={onDismiss} variant="ghost" color={C.muted} size="sm">
          Dismiss
        </Btn>
      </div>
    </div>
  );
}

// ─── ATS Panel ────────────────────────────────────────────────────────────────
function AtsPanel({ ats, onFix, busy }: { ats:AtsBreakdown|null; onFix:(s:AtsSuggestion)=>void; busy:boolean }) {
  const score=ats?.overall??0;
  const grade=score>=85?{l:'Excellent',c:C.green,e:'🏆'}:score>=65?{l:'Strong',c:C.blue,e:'💪'}:score>=45?{l:'Moderate',c:C.amber,e:'⚡'}:{l:'Weak',c:C.red,e:'⚠️'};
  return (
    <div style={{ padding:'18px 20px' }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:16 }}>
        <div>
          <div style={{ fontSize:9, fontWeight:800, textTransform:'uppercase', letterSpacing:'.14em', color:C.muted, marginBottom:5 }}>ATS Score</div>
          <div style={{ fontSize:42, fontWeight:900, color:grade.c, lineHeight:1 }}>{score}</div>
          <div style={{ display:'flex', alignItems:'center', gap:5, marginTop:4 }}>
            <span style={{ fontSize:14 }}>{grade.e}</span>
            <span style={{ fontSize:13, fontWeight:700, color:grade.c }}>{grade.l}</span>
          </div>
        </div>
        <AtsRing score={score}/>
      </div>

      {ats && <>
        <div style={{ height:6, borderRadius:6, background:C.s2, marginBottom:4, overflow:'hidden' }}>
          <div style={{ height:'100%', borderRadius:6, background:`linear-gradient(90deg,${C.red} 0%,${C.amber} 45%,${C.blue} 70%,${C.green} 100%)`, width:`${score}%`, transition:'width .9s cubic-bezier(.4,0,.2,1)' }}/>
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, margin:'14px 0' }}>
          {[
            { l:'Keyword Match',    v:ats.keywordMatch,    c:C.blue   },
            { l:'Content Strength', v:ats.contentStrength, c:C.green  },
            { l:'Skills Relevance', v:ats.skillsRelevance, c:C.purple },
            { l:'Formatting',       v:ats.formatting,      c:C.amber  },
          ].map(b => (
            <div key={b.l}>
              <div style={{ display:'flex', justifyContent:'space-between', fontSize:9, marginBottom:3 }}>
                <span style={{ color:C.muted }}>{b.l}</span>
                <span style={{ fontWeight:700, color:b.c }}>{b.v}%</span>
              </div>
              <div style={{ height:4, borderRadius:4, background:C.s2 }}>
                <div style={{ height:4, borderRadius:4, background:b.c, width:`${b.v}%`, transition:'width .9s cubic-bezier(.4,0,.2,1)' }}/>
              </div>
            </div>
          ))}
        </div>

        {ats.missingKeywords.length > 0 && (
          <div style={{ marginBottom:14 }}>
            <div style={{ fontSize:9, fontWeight:700, color:C.muted, textTransform:'uppercase', letterSpacing:'.1em', marginBottom:6 }}>Missing Keywords</div>
            <div style={{ display:'flex', flexWrap:'wrap', gap:4 }}>
              {ats.missingKeywords.map(kw => (
                <span key={kw} style={{ fontSize:10, padding:'2px 8px', borderRadius:20, background:C.amber+'14', border:`1px solid ${C.amber}28`, color:C.amber }}>{kw}</span>
              ))}
            </div>
          </div>
        )}

        {ats.suggestions.length > 0 && (
          <div>
            <div style={{ fontSize:9, fontWeight:700, color:C.muted, textTransform:'uppercase', letterSpacing:'.1em', marginBottom:8 }}>AI Suggestions</div>
            <div style={{ display:'flex', flexDirection:'column', gap:7 }}>
              {ats.suggestions.slice(0,4).map(s => {
                const c:Record<string,string>={keyword:C.amber,verb:C.purple,metric:C.green,format:C.blue,skills:C.cyan};
                const ic:Record<string,string>={keyword:'🔑',verb:'⚡',metric:'📊',format:'📝',skills:'🧠'};
                const col=c[s.type]??C.blue;
                return (
                  <div key={s.id} style={{ background:C.s1, border:`1px solid ${col}22`, borderRadius:10, padding:'10px 12px' }}>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:8, marginBottom:3 }}>
                      <span style={{ fontSize:12, fontWeight:700, color:C.text }}>{ic[s.type]} {s.title}</span>
                      <span style={{ fontSize:9, fontWeight:800, padding:'2px 6px', borderRadius:20, background:C.green+'18', color:C.green, flexShrink:0 }}>{s.impact}</span>
                    </div>
                    <div style={{ fontSize:10, color:C.muted, lineHeight:1.45, marginBottom:8 }}>{s.detail}</div>
                    <Btn onClick={()=>onFix(s)} disabled={busy} loading={busy} size="sm" color={col} variant="ghost">✨ Fix with AI</Btn>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </>}
    </div>
  );
}

// ─── Template Preview ─────────────────────────────────────────────────────────
function TemplatePreview({ resume, templateId, custom }: {
  resume: ResumeContent; templateId: TemplateId; custom: ResumeCustomization;
}) {
  const html = React.useMemo(() => {
    try { return getTemplateBody(templateId, resume, custom); }
    catch { return '<div style="padding:20px;color:#666;">Preview unavailable</div>'; }
  }, [resume, templateId, custom]);

  return (
    <div style={{ padding:'16px 18px' }}>
      <div style={{ fontSize:9, fontWeight:800, textTransform:'uppercase', letterSpacing:'.12em', color:C.muted, marginBottom:10 }}>
        {TEMPLATES.find(t=>t.id===templateId)?.name} · Live Preview
      </div>
      <div style={{ position:'relative', overflow:'hidden', borderRadius:8, boxShadow:'0 4px 20px rgba(0,0,0,.4)', background:'#fff' }}>
        {/* Scale wrapper: preview is 364px wide, A4 body is ~794px → scale ≈ 0.458 */}
        <div style={{ width:'100%', height:300, overflow:'hidden', position:'relative' }}>
          <div style={{
            position:'absolute', top:0, left:0,
            width:794, transformOrigin:'top left',
            transform:'scale(0.458)',
            pointerEvents:'none',
          }} dangerouslySetInnerHTML={{ __html: html }}/>
        </div>
      </div>
      <div style={{ fontSize:9, color:C.muted, marginTop:8, textAlign:'center' }}>
        Scaled preview · Download PDF for full resolution
      </div>
    </div>
  );
}

// ─── Template Picker ──────────────────────────────────────────────────────────
function TemplatePicker({ selected, onChange }: { selected:TemplateId; onChange:(id:TemplateId)=>void }) {
  return (
    <div style={{ display:'flex', gap:8, overflowX:'auto', paddingBottom:4 }}>
      {TEMPLATES.map(t => {
        const active=selected===t.id;
        return (
          <button key={t.id} onClick={()=>onChange(t.id)} style={{
            flexShrink:0, width:100, background:active?t.color+'18':C.s1,
            border:`1.5px solid ${active?t.color:C.border}`, borderRadius:11,
            padding:'10px 8px', cursor:'pointer', fontFamily:'inherit',
            transform:active?'translateY(-2px)':'none', transition:'all .18s',
            boxShadow:active?`0 4px 16px ${t.color}28`:'none' }}>
            <div style={{ fontSize:11, fontWeight:700, color:active?t.color:C.text, marginBottom:2 }}>{t.name}</div>
            <div style={{ fontSize:9, color:C.muted }}>{t.desc}</div>
            {t.photo && <div style={{ fontSize:8, color:t.color+'99', marginTop:3 }}>📷 Photo</div>}
          </button>
        );
      })}
    </div>
  );
}

// ─── Photo Uploader ───────────────────────────────────────────────────────────
function PhotoUploader({ photo_url, onUpload, onRemove, templateId }: {
  photo_url:string; onUpload:(url:string)=>void; onRemove:()=>void; templateId:TemplateId;
}) {
  const [uploading,setUploading]=useState(false);
  const [err,setErr]=useState('');
  const inputRef=useRef<HTMLInputElement>(null);
  const allowed=TEMPLATES.find(t=>t.id===templateId)?.photo??false;
  // modern-photo template always supports photos
  const isPhotoTemplate=templateId==='modern-photo'||templateId==='creative';

  if (!allowed && !isPhotoTemplate) return (
    <div style={{ padding:'12px 14px', background:`${C.amber}10`, border:`1px solid ${C.amber}25`, borderRadius:10, fontSize:11, color:C.amber }}>
      📷 Photo is disabled for the {templateId.toUpperCase()} template (ATS parsers reject photos)
    </div>
  );

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file=e.target.files?.[0]; if(!file) return;
    if(!file.type.startsWith('image/')) { setErr('Must be an image file'); return; }
    if(file.size>2*1024*1024) { setErr('Max 2MB'); return; }
    setErr(''); setUploading(true);
    try {
      const token = await getAuthToken();
      const fd=new FormData(); fd.append('photo',file);
      const res=await fetch('/api/resume/photo',{method:'POST',headers:token?{Authorization:`Bearer ${token}`}:{},body:fd});
      const json=await res.json();
      if(!res.ok||!json.success) throw new Error(json?.error??'Upload failed');
      onUpload(json.data.photo_url);
    } catch(e:any){setErr(e.message);}
    finally{setUploading(false);}
  };

  return (
    <div>
      <input ref={inputRef} type="file" accept="image/*" style={{ display:'none' }} onChange={handleFile}/>
      {photo_url ? (
        <div style={{ display:'flex', alignItems:'center', gap:12 }}>
          <img src={photo_url} alt="Profile" style={{ width:64, height:64, borderRadius:'50%', objectFit:'cover', border:`2px solid ${C.blue}40` }}/>
          <div>
            <div style={{ fontSize:12, fontWeight:700, color:C.text, marginBottom:4 }}>Profile photo uploaded</div>
            <div style={{ display:'flex', gap:7 }}>
              <Btn onClick={()=>inputRef.current?.click()} size="sm" color={C.blue} variant="ghost">Replace</Btn>
              <Btn onClick={onRemove} size="sm" color={C.red} variant="ghost">Remove</Btn>
            </div>
          </div>
        </div>
      ) : (
        <div onClick={()=>inputRef.current?.click()} style={{
          border:`2px dashed ${C.borderB}`, borderRadius:10, padding:'16px 20px',
          textAlign:'center', cursor:'pointer', background:C.s1, transition:'all .15s' }}>
          {uploading ? <Spinner size={24} color={C.blue}/> : <>
            <div style={{ fontSize:24, marginBottom:6 }}>📷</div>
            <div style={{ fontSize:12, fontWeight:700, color:C.text, marginBottom:2 }}>Upload Profile Photo</div>
            <div style={{ fontSize:10, color:C.muted }}>JPG, PNG — max 2MB</div>
          </>}
        </div>
      )}
      {err && <div style={{ fontSize:11, color:C.red, marginTop:6 }}>⚠ {err}</div>}
    </div>
  );
}

// ─── Customization Panel ──────────────────────────────────────────────────────
function CustomizePanel({ custom, onChange }: { custom:ResumeCustomization; onChange:(c:ResumeCustomization)=>void }) {
  const upd=(k:keyof ResumeCustomization, v:any) => onChange({...custom,[k]:v});
  const toggleSection=(s:string) => {
    const hidden=custom.hiddenSections.includes(s)
      ?custom.hiddenSections.filter(x=>x!==s)
      :[...custom.hiddenSections,s];
    upd('hiddenSections',hidden);
  };
  return (
    <div style={{ padding:'16px 20px', display:'flex', flexDirection:'column', gap:16 }}>
      <div>
        <FieldLabel>Font Size</FieldLabel>
        <div style={{ display:'flex', gap:6 }}>
          {(['small','medium','large'] as const).map(s => (
            <button key={s} onClick={()=>upd('fontSize',s)} style={{
              flex:1, padding:'6px', borderRadius:8, cursor:'pointer', fontFamily:'inherit',
              fontSize:11, fontWeight:700, textTransform:'capitalize',
              background:custom.fontSize===s?C.blue+'18':C.s1,
              border:`1px solid ${custom.fontSize===s?C.blue:C.border}`,
              color:custom.fontSize===s?C.blue:C.muted }}>{s}</button>
          ))}
        </div>
      </div>

      <div>
        <FieldLabel>Color Theme</FieldLabel>
        <div style={{ display:'flex', gap:6 }}>
          {(['light','dark','accent'] as const).map(t => (
            <button key={t} onClick={()=>upd('colorTheme',t)} style={{
              flex:1, padding:'6px', borderRadius:8, cursor:'pointer', fontFamily:'inherit',
              fontSize:11, fontWeight:700, textTransform:'capitalize',
              background:custom.colorTheme===t?C.purple+'18':C.s1,
              border:`1px solid ${custom.colorTheme===t?C.purple:C.border}`,
              color:custom.colorTheme===t?C.purple:C.muted }}>{t}</button>
          ))}
        </div>
      </div>

      <div>
        <FieldLabel>Accent Color</FieldLabel>
        <div style={{ display:'flex', gap:8, alignItems:'center' }}>
          {['#2563eb','#7c3aed','#059669','#92400e','#be185d','#0f766e'].map(col => (
            <button key={col} onClick={()=>upd('accentColor',col)} style={{
              width:28, height:28, borderRadius:'50%', background:col, border:custom.accentColor===col?`3px solid #fff`:`2px solid transparent`, cursor:'pointer' }}/>
          ))}
          <input type="color" value={custom.accentColor||'#2563eb'} onChange={e=>upd('accentColor',e.target.value)}
            style={{ width:32, height:28, borderRadius:6, border:`1px solid ${C.border}`, cursor:'pointer', background:'none' }}/>
        </div>
      </div>

      <div>
        <FieldLabel>Show / Hide Sections</FieldLabel>
        <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
          {['summary','experience','skills','education'].map(s => {
            const hidden=custom.hiddenSections.includes(s);
            return (
              <div key={s} onClick={()=>toggleSection(s)} style={{
                display:'flex', alignItems:'center', justifyContent:'space-between',
                padding:'8px 12px', borderRadius:9, cursor:'pointer',
                background:hidden?C.s1:C.blue+'12', border:`1px solid ${hidden?C.border:C.blue+'30'}` }}>
                <span style={{ fontSize:12, fontWeight:600, color:hidden?C.muted:C.text, textTransform:'capitalize' }}>{s}</span>
                <span style={{ fontSize:11, color:hidden?C.muted:C.blue }}>{hidden?'Hidden':'Visible'}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── Experience Editor ────────────────────────────────────────────────────────
function ExpEditor({ items, onChange, onAiStrengthen, busy }: {
  items:ResumeContent['experience']; onChange:(i:ResumeContent['experience'])=>void;
  onAiStrengthen:(idx:number)=>void; busy:boolean;
}) {
  const upd=(id:string,p:Partial<ResumeContent['experience'][0]>)=>onChange(items.map(it=>it.id===id?{...it,...p}:it));
  const updBullet=(id:string,bi:number,val:string)=>{
    const it=items.find(x=>x.id===id)!;
    upd(id,{bullets:it.bullets.map((b,i)=>i===bi?val:b)});
  };
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
      {items.map((item,idx) => (
        <div key={item.id} style={{ background:C.s1, border:`1px solid ${C.border}`, borderRadius:10, padding:14 }}>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:10 }}>
            <Input value={item.jobTitle} onChange={v=>upd(item.id,{jobTitle:v})} placeholder="Job Title"/>
            <Input value={item.company}  onChange={v=>upd(item.id,{company:v})}  placeholder="Company"/>
            <Input value={item.period}   onChange={v=>upd(item.id,{period:v})}   placeholder="Jan 2022 – Present"/>
          </div>
          {item.bullets.map((b,bi) => (
            <div key={bi} style={{ display:'flex', gap:6, marginBottom:6, alignItems:'flex-start' }}>
              <span style={{ color:C.blue, fontSize:13, marginTop:9, flexShrink:0 }}>•</span>
              <Input value={b} onChange={v=>updBullet(item.id,bi,v)} multiline rows={2}
                placeholder="Achieved X by doing Y, resulting in Z%" style={{ flex:1 }}/>
              <button onClick={()=>upd(item.id,{bullets:item.bullets.filter((_,i)=>i!==bi)})}
                style={{ marginTop:8, width:22, height:22, borderRadius:6, background:C.red+'18', border:`1px solid ${C.red}25`, color:C.red, fontSize:13, cursor:'pointer', fontFamily:'inherit' }}>×</button>
            </div>
          ))}
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginTop:6 }}>
            <div style={{ display:'flex', gap:8 }}>
              <button onClick={()=>upd(item.id,{bullets:[...item.bullets,'']})} style={{ fontSize:11, color:C.blue, background:'none', border:'none', cursor:'pointer', fontFamily:'inherit', fontWeight:600 }}>+ Bullet</button>
              <Btn onClick={()=>onAiStrengthen(idx)} loading={busy} disabled={busy} size="sm" color={C.purple} variant="ghost">⚡ AI Strengthen</Btn>
            </div>
            <button onClick={()=>onChange(items.filter(it=>it.id!==item.id))} style={{ fontSize:11, color:C.red, background:'none', border:'none', cursor:'pointer', fontFamily:'inherit' }}>Remove</button>
          </div>
        </div>
      ))}
      <button onClick={()=>onChange([...items,{id:`exp_${Date.now()}`,jobTitle:'',company:'',period:'',bullets:['']}])}
        style={{ padding:'9px', borderRadius:9, border:`1px dashed ${C.borderB}`, background:'transparent', color:C.muted, fontSize:12, cursor:'pointer', fontFamily:'inherit' }}>+ Add Experience</button>
    </div>
  );
}

// ─── Skills Editor ────────────────────────────────────────────────────────────
function SkillsEditor({ skills, onChange }: { skills:string[]; onChange:(s:string[])=>void }) {
  const [inp,setInp]=useState('');
  const add=()=>{ const v=inp.trim(); if(!v||skills.includes(v))return; onChange([...skills,v]); setInp(''); };
  return (
    <div>
      <div style={{ display:'flex', flexWrap:'wrap', gap:6, marginBottom:10 }}>
        {skills.map(sk => (
          <span key={sk} style={{ display:'flex', alignItems:'center', gap:4, fontSize:12, fontWeight:600, padding:'4px 10px', borderRadius:20, background:C.blue+'14', border:`1px solid ${C.blue}28`, color:C.text }}>
            {sk}
            <button onClick={()=>onChange(skills.filter(x=>x!==sk))} style={{ background:'none', border:'none', color:C.muted, cursor:'pointer', padding:0, fontSize:14, lineHeight:1, fontFamily:'inherit' }}>×</button>
          </span>
        ))}
      </div>
      <div style={{ display:'flex', gap:7 }}>
        <Input value={inp} onChange={setInp} placeholder="Add skill…" style={{ flex:1 }}/>
        <button onClick={add} style={{ padding:'8px 16px', background:C.blue, border:'none', borderRadius:9, color:'#fff', fontWeight:700, fontSize:12, cursor:'pointer', fontFamily:'inherit' }}>Add</button>
      </div>
    </div>
  );
}

// ─── Idle Landing ─────────────────────────────────────────────────────────────
function IdleLanding({ hasResume, resumeName, onGenerate, generating }: {
  hasResume:boolean; resumeName:string; onGenerate:()=>void; generating:boolean;
}) {
  return (
    <div style={{ display:'flex', flexDirection:'column', alignItems:'center', padding:'60px 24px', textAlign:'center', animation:'rise .35s ease-out' }}>
      <div style={{ width:80, height:80, borderRadius:22, fontSize:34, marginBottom:20,
        background:C.blue+'18', border:`1px solid ${C.blue}30`,
        display:'flex', alignItems:'center', justifyContent:'center' }}>{hasResume?'🔧':'✨'}</div>
      <div style={{ fontSize:9, fontWeight:800, textTransform:'uppercase', letterSpacing:'.16em', color:C.muted, marginBottom:6 }}>AI Resume Intelligence</div>
      <h1 style={{ fontSize:28, fontWeight:900, color:C.text, margin:'0 0 10px', letterSpacing:'-.02em' }}>
        {hasResume?'Rebuild & Optimise':'Generate Your Resume'}
      </h1>
      <p style={{ fontSize:13, color:C.muted, maxWidth:420, lineHeight:1.65, marginBottom:28 }}>
        {hasResume
          ?`AI will rebuild "${resumeName}" using a 3-step intelligence pipeline: base generation → enhancement → role optimisation.`
          :'Generate a complete, ATS-optimised resume from your profile in under 60 seconds using a 3-step AI pipeline.'}
      </p>
      <div style={{ display:'flex', gap:8, flexWrap:'wrap', justifyContent:'center', marginBottom:28 }}>
        {[{s:'1',l:'Generate',i:'⚙️',d:'Base resume from profile'},{s:'2',l:'Enhance',i:'💪',d:'Stronger language + metrics'},{s:'3',l:'Optimise',i:'🎯',d:'Role-specific keywords'}].map((st,i) => (
          <React.Fragment key={st.s}>
            <div style={{ textAlign:'center', padding:'14px 18px', background:C.s0, border:`1px solid ${C.border}`, borderRadius:12, minWidth:120 }}>
              <div style={{ fontSize:22, marginBottom:6 }}>{st.i}</div>
              <div style={{ fontSize:12, fontWeight:800, color:C.text, marginBottom:2 }}>Step {st.s}: {st.l}</div>
              <div style={{ fontSize:10, color:C.muted }}>{st.d}</div>
            </div>
            {i<2&&<div style={{ display:'flex', alignItems:'center', fontSize:16, color:C.dim }}>→</div>}
          </React.Fragment>
        ))}
      </div>
      <Btn onClick={onGenerate} loading={generating} color={C.blue} size="lg">
        {generating?'Running AI Pipeline…':hasResume?'🤖 Rebuild with AI Pipeline':'✨ Generate Resume with AI'}
      </Btn>
    </div>
  );
}

// ─── Generating Progress ──────────────────────────────────────────────────────
function GeneratingView({ stepIdx }: { stepIdx:number }) {
  const steps=['Normalising profile data…','Generating base resume…','Enhancing language & metrics…','Optimising for your role…','Calculating ATS score…','Validating resume…'];
  const cur=steps[Math.min(stepIdx,steps.length-1)];
  const pct=Math.round((stepIdx/steps.length)*100);
  return (
    <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:18, padding:'80px 24px', animation:'rise .3s ease-out' }}>
      <Spinner size={44} color={C.blue}/>
      <div style={{ fontSize:15, fontWeight:700, color:C.text }}>{cur}</div>
      <div style={{ width:'100%', maxWidth:380 }}>
        <div style={{ height:6, borderRadius:6, background:C.s2, overflow:'hidden' }}>
          <div style={{ height:'100%', borderRadius:6, background:C.blue, width:`${pct}%`, transition:'width .6s ease-out' }}/>
        </div>
        <div style={{ display:'flex', justifyContent:'space-between', fontSize:10, color:C.muted, marginTop:6 }}>
          <span>Multi-step AI pipeline</span><span>{pct}%</span>
        </div>
      </div>
    </div>
  );
}

// ─── Version History ──────────────────────────────────────────────────────────
interface VersionSnap { id:string; label:string; ats:number; at:string; data:ResumeContent }

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function ResumeBuilderPage() {
  const { data: profileData }              = useProfile();
  const { data: chi }                      = useCareerHealth();
  const { hasResume, isLoading: hrLoad }   = useHasResume();
  const { data: resumesData }              = useResumes();

  const profileUser  = (profileData?.user as any) ?? null;
  const latestResume = (resumesData as any)?.items?.[0] ?? null;
  const isProUser    = profileUser?.tier==='pro'||profileUser?.tier==='enterprise';

  // ── Core state ──────────────────────────────────────────────────────────────
  const [flow,        setFlow]        = useState<Flow>('idle');
  const [stepIdx,     setStepIdx]     = useState(0);
  const [resumeData,  setResumeData]  = useState<ResumeContent|null>(null);
  const [resumeId,    setResumeId]    = useState<string|null>(null);
  const [targetRole,  setTargetRole]  = useState('');
  const [template,    setTemplate]    = useState<TemplateId>('modern');
  const [custom,      setCustom]      = useState<ResumeCustomization>({...DEFAULT_CUSTOMIZATION});
  const [ats,         setAts]         = useState<AtsBreakdown|null>(null);
  const [rightTab,    setRightTab]    = useState<RightTab>('ats');
  const [versions,    setVersions]    = useState<VersionSnap[]>([]);
  const [improving,   setImproving]   = useState(false);
  const [saving,      setSaving]      = useState(false);
  const [exporting,   setExporting]   = useState<'pdf'|'docx'|null>(null);
  const [error,       setError]       = useState<string|null>(null);
  const [fieldAlert,  setFieldAlert]  = useState<string|null>(null);
  // ── Auto-fix state ──────────────────────────────────────────────────────────
  const [autoFixing,  setAutoFixing]  = useState(false);
  const [autoFixResult, setAutoFixResult] = useState<AutoFixResult|null>(null);
  const [showAutoFix, setShowAutoFix] = useState(false);
  const personalSectRef = React.useRef<HTMLDivElement>(null);

  // Seed target role — priority: URL ?role= param > CHI detected profession
  const searchParams = useSearchParams();
  useEffect(()=>{
    const roleFromUrl = searchParams?.get('role');
    if (roleFromUrl) { setTargetRole(decodeURIComponent(roleFromUrl)); return; }
    if(!targetRole&&chi?.detectedProfession) setTargetRole(chi.detectedProfession);
  },[chi?.detectedProfession, searchParams]);

  // Auto-save snapshot every 30s
  useEffect(()=>{
    if(flow!=='editing'||!resumeData)return;
    const t=setInterval(()=>snapshot('Auto-save'),30_000);
    return()=>clearInterval(t);
  },[flow,resumeData,ats]);

  // Recalculate ATS on edit (debounced)
  const debounceRef=useRef<ReturnType<typeof setTimeout>|null>(null);
  useEffect(()=>{
    if(!resumeData)return;
    if(debounceRef.current)clearTimeout(debounceRef.current);
    debounceRef.current=setTimeout(async()=>{
      try{
        const result=await authFetch<AtsBreakdown>('/api/resume/ats-score',{resumeData,targetRole:targetRole||resumeData.targetRole});
        setAts(result);
      }catch{}
    },1200);
  },[resumeData,targetRole]);

  function snapshot(label:string){
    if(!resumeData||!ats)return;
    setVersions(prev=>[{id:`v_${Date.now()}`,label,ats:ats.overall,at:new Date().toLocaleString(),data:JSON.parse(JSON.stringify(resumeData))},...prev].slice(0,12));
  }

  // ── Generate ─────────────────────────────────────────────────────────────────
  const handleGenerate=useCallback(async()=>{
    setFlow('generating'); setStepIdx(0); setError(null);
    const tick=setInterval(()=>setStepIdx(i=>Math.min(i+1,5)),5000);
    try{
      const result=await authFetch<{resumeId:string|null;resume:ResumeContent;atsScore:number;breakdown:AtsBreakdown;steps:string[]}>(
        '/api/resume/generate',{
          profileData:{
            displayName:profileUser?.displayName, email:profileUser?.email,
            phone:(profileUser as any)?.phone, targetRole:profileUser?.targetRole??chi?.detectedProfession,
            experienceYears:profileUser?.experienceYears, educationLevel:profileUser?.educationLevel,
            location:profileUser?.location, industry:(profileUser as any)?.industry,
            skills:chi?.topSkills??[], currentJobTitle:chi?.currentJobTitle,
            detectedProfession:chi?.detectedProfession, bio:profileUser?.bio,
          },
          templateId:template,
        }
      );
      setResumeData(result.resume);
      if(result.resumeId)setResumeId(result.resumeId);
      if(result.resume.targetRole)setTargetRole(result.resume.targetRole);
      setAts(result.breakdown);
      setFlow('editing'); setRightTab('ats');
    }catch(err:any){
      setError(err?.message??'Generation failed');
      setFlow('idle');
    }finally{clearInterval(tick);}
  },[profileUser,chi,template]);

  // ── Improve ───────────────────────────────────────────────────────────────────
  const handleImprove=useCallback(async(target:ImproveTarget,label:string)=>{
    if(!resumeData)return;
    setImproving(true); setError(null);
    try{
      const result=await authFetch<{resume:ResumeContent;atsScore:number;breakdown:AtsBreakdown;changeSummary:string}>(
        '/api/resume/improve',{resumeData,targetRole:targetRole||resumeData.targetRole,target,resumeId,templateId:template}
      );
      setResumeData(result.resume); setAts(result.breakdown);
      snapshot(result.changeSummary||label);
    }catch(err:any){setError(err?.message??'Improvement failed');}
    finally{setImproving(false);}
  },[resumeData,targetRole,resumeId,template]);

  const handleFixSuggestion=useCallback((s:AtsSuggestion)=>{
    const m:Record<string,ImproveTarget['type']>={keyword:'keywords',verb:'bullets',metric:'bullets',format:'summary',skills:'keywords'};
    handleImprove({type:m[s.type]??'full',missingKeywords:ats?.missingKeywords},`Fixed: ${s.title}`);
  },[handleImprove,ats]);

  // ── Ava full-resume ATS optimization ─────────────────────────────────────────
  const handleAvaOptimize=useCallback(async()=>{
    if(!resumeData||!ats)return;
    setImproving(true); setError(null);
    try{
      const result=await authFetch<{
        improvedResume: typeof resumeData;
        ats: AtsBreakdown;
        improvementsSummary: string[];
        estimatedScoreIncrease: number;
        actualScoreIncrease: number;
      }>(
        '/api/resume/ava-optimize',
        {resumeData, targetRole:targetRole||resumeData.targetRole, atsBreakdown:ats, resumeId, templateId:template}
      );
      setResumeData(result.improvedResume);
      setAts(result.ats);
      const gained=result.actualScoreIncrease>0?` (+${result.actualScoreIncrease} pts)`:'';
      snapshot(`Ava optimised resume${gained} — ${result.improvementsSummary[0]??'improvements applied'}`);
      setRightTab('ats'); // show the updated ATS panel
    }catch(err:any){setError(err?.message??'Ava optimisation failed');}
    finally{setImproving(false);}
  },[resumeData,ats,targetRole,resumeId,template]);

  // ── Auto-Fix ─────────────────────────────────────────────────────────────────
  const handleAutoFix=useCallback(async()=>{
    if(!resumeData)return;
    setAutoFixing(true); setError(null); setAutoFixResult(null);
    try{
      const result=await authFetch<AutoFixResult>(
        '/api/resume/auto-fix',
        { resumeData, targetRole:targetRole||resumeData.targetRole, atsData:ats, resumeId, templateId:template }
      );
      setAutoFixResult(result);
      setShowAutoFix(true);
      setRightTab('ats'); // switch to ATS tab to show the result
    }catch(err:any){ setError(err?.message??'Auto-fix failed'); }
    finally{ setAutoFixing(false); }
  },[resumeData,targetRole,ats,resumeId,template]);

  function applyAutoFix(){
    if(!autoFixResult)return;
    const before=resumeData;
    setResumeData(autoFixResult.fixed);
    setAts(autoFixResult.atsAfter);
    const gain=autoFixResult.scoreIncrease>0?` (+${autoFixResult.scoreIncrease} pts)`:'';
    snapshot(`Auto-Fix applied${gain}`);
    setShowAutoFix(false);
    setAutoFixResult(null);
  }

  // ── Save ──────────────────────────────────────────────────────────────────────
  const handleSave=useCallback(async()=>{
    if(!resumeData)return; setSaving(true); setError(null);
    try{
      const result=await authFetch<{resumeId:string;atsScore:number;savedAt:string}>(
        '/api/resume/save',{resumeData,targetRole,resumeId,templateId:template,customization:custom}
      );
      if(result.resumeId)setResumeId(result.resumeId);
      snapshot('Saved to database');
    }catch(err:any){setError(err?.message??'Save failed');}
    finally{setSaving(false);}
  },[resumeData,targetRole,resumeId,template,custom]);

  // ── Export ────────────────────────────────────────────────────────────────────
  const handleExport=useCallback(async(fmt:'pdf'|'docx')=>{
    if(!resumeData)return;
    // Client-side validation first
    const missing: string[] = [];
    if(!resumeData.personalInfo?.name?.trim())  missing.push('Full Name');
    if(!resumeData.personalInfo?.email?.trim()) missing.push('Email');
    if(missing.length > 0){
      setFieldAlert(missing.join(' and ') + (missing.length === 1 ? ' is' : ' are') + ' required to export your resume.');
      personalSectRef.current?.scrollIntoView({ behavior:'smooth', block:'center' });
      return;
    }
    setFieldAlert(null);
    setExporting(fmt); setError(null);
    try{
      const {blob,filename}=await authFetchBlob(`/api/resume/export/${fmt}`,{
        resumeData,templateId:template,customization:custom,
      });
      const url=URL.createObjectURL(blob);
      const a=document.createElement('a'); a.href=url; a.download=filename;
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }catch(err:any){setError(err?.message??`${fmt.toUpperCase()} export failed`);}
    finally{setExporting(null);}
  },[resumeData,template,custom]);

  // ── Photo ─────────────────────────────────────────────────────────────────────
  const updatePhoto=(url:string)=>{
    setResumeData(d=>d?{...d,personalInfo:{...d.personalInfo,photo_url:url}}:d);
    // Auto-switch to photo template if user is on a non-photo template
    setTemplate(prev => {
      const noPhotoTemplates:TemplateId[]=['modern','minimal','ats','executive'];
      if(noPhotoTemplates.includes(prev)) return 'modern-photo';
      return prev;
    });
    setCustom(c=>({...c,showPhoto:true}));
  };
  const removePhoto=()=>{
    setResumeData(d=>d?{...d,personalInfo:{...d.personalInfo,photo_url:''}}:d);
    // Revert from photo template when photo removed
    setTemplate(prev => prev==='modern-photo' ? 'modern' : prev);
    setCustom(c=>({...c,showPhoto:false}));
  };

  // ─────────────────────────────────────────────────────────────────────────────
  if(hrLoad)return <div style={{display:'flex',height:'60vh',alignItems:'center',justifyContent:'center'}}><Spinner size={32} color={C.blue}/></div>;

  const isFlowGenerating=(flow as string)==='generating';

  return (
    <>
      <style>{KF}</style>
      <div style={{ minHeight:'100vh', padding:'24px 0 80px', animation:'rise .3s ease-out' }}>

        {/* ── Header ──────────────────────────────────────────────────────────── */}
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', flexWrap:'wrap', gap:12, marginBottom:22 }}>
          <div>
            <div style={{ fontSize:9, fontWeight:800, textTransform:'uppercase', letterSpacing:'.16em', color:C.muted, marginBottom:4 }}>Resume Intelligence Engine</div>
            <h1 style={{ fontSize:26, fontWeight:900, color:C.text, margin:0, letterSpacing:'-.02em' }}>
              {hasResume?'🔧 Rebuild & Optimise':'✨ AI Resume Builder'}
            </h1>
          </div>
          {flow==='editing'&&(
            <div style={{ display:'flex', gap:7, flexWrap:'wrap', alignItems:'center' }}>
              <Btn onClick={()=>setFlow('idle')} variant="ghost" color={C.muted} size="sm">← New</Btn>
              <Btn onClick={handleSave} loading={saving} variant="ghost" color={C.green} size="sm">💾 Save</Btn>
              <Btn onClick={()=>handleImprove({type:'summary'},'Rewrote summary')} loading={improving} variant="ghost" color={C.purple} size="sm">✨ AI Summary</Btn>
              <Btn onClick={handleAutoFix} loading={autoFixing} disabled={!resumeData} color={C.pink} size="sm">⚡ Auto-Fix</Btn>
              <Btn onClick={handleAvaOptimize} loading={improving} disabled={!ats} color={'#e96caa'} size="sm">🤖 Ava Optimize</Btn>
              <Btn onClick={()=>handleImprove({type:'full'},`Optimised for ${targetRole}`)} loading={improving} color={C.green} size="sm">⚡ Full Optimise</Btn>
              <Btn onClick={()=>handleExport('pdf')} loading={exporting==='pdf'} disabled={!!exporting} color={C.blue} size="sm">⬇ PDF</Btn>
              <Btn onClick={()=>handleExport('docx')} loading={exporting==='docx'} disabled={!!exporting} variant="outline" color={C.muted} size="sm">⬇ DOCX</Btn>
            </div>
          )}
        </div>

        {/* ── Error Banner ─────────────────────────────────────────────────────── */}
        {error&&(
          <div style={{ background:`${C.red}0a`, border:`1px solid ${C.red}30`, borderRadius:12, padding:'12px 18px', marginBottom:16, display:'flex', alignItems:'flex-start', gap:10 }}>
            <span style={{ fontSize:16, flexShrink:0 }}>❌</span>
            <div style={{ flex:1 }}>
              <div style={{ fontSize:12, fontWeight:700, color:C.red, marginBottom:2 }}>Error</div>
              <div style={{ fontSize:12, color:C.muted }}>{error}</div>
            </div>
            <button onClick={()=>setError(null)} style={{ background:'none', border:'none', color:C.muted, cursor:'pointer', fontSize:16, fontFamily:'inherit' }}>×</button>
          </div>
        )}

        {/* ── Idle ─────────────────────────────────────────────────────────────── */}
        {flow==='idle'&&<IdleLanding hasResume={hasResume} resumeName={latestResume?.fileName??'Uploaded CV'} onGenerate={handleGenerate} generating={isFlowGenerating}/>}

        {/* ── Generating ────────────────────────────────────────────────────────── */}
        {flow==='generating'&&<GeneratingView stepIdx={stepIdx}/>}

        {/* ── Editor ───────────────────────────────────────────────────────────── */}
        {flow==='editing'&&resumeData&&(
          <div style={{ display:'grid', gridTemplateColumns:'1fr 400px', gap:16, alignItems:'start' }}>

            {/* LEFT ─────────────────────────────────────────────────────────── */}
            <div>
              {/* Target role + template */}
              <Card style={{ marginBottom:12 }}>
                <div style={{ padding:'16px 20px', display:'flex', gap:14, alignItems:'flex-end', flexWrap:'wrap' }}>
                  <div style={{ flex:1, minWidth:180 }}>
                    <FieldLabel>🎯 Target Job Role</FieldLabel>
                    <Input value={targetRole} onChange={setTargetRole} placeholder="e.g. Senior Finance Manager"/>
                  </div>
                </div>
                <div style={{ padding:'0 20px 16px' }}>
                  <FieldLabel>Template</FieldLabel>
                  <TemplatePicker selected={template} onChange={(id)=>{
                    setTemplate(id);
                    // Auto-toggle photo off for ATS/minimal
                    if(id==='ats'||id==='minimal') setCustom(c=>({...c,showPhoto:false}));
                  }}/>
                </div>
              </Card>

              {/* Personal Info */}
              <div ref={personalSectRef}><Sect title="Personal Information" icon="👤">
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:14 }}>
                  {([['name','Full Name','Your Name',true],['email','Email','you@example.com',true],['phone','Phone','+1 234 567 8900',false],['location','Location','City, Country',false],['linkedin','LinkedIn','linkedin.com/in/you',false],['website','Website','yoursite.com',false]] as [keyof typeof resumeData.personalInfo,string,string,boolean][]).map(([k,label,ph,req]) => (
                    <div key={k}>
                      <FieldLabel required={req}>{label}</FieldLabel>
                      <Input value={(resumeData.personalInfo as any)[k]||''} onChange={v=>setResumeData(d=>d?{...d,personalInfo:{...d.personalInfo,[k]:v}}:d)} placeholder={ph}/>
                    </div>
                  ))}
                </div>
                {/* Photo upload */}
                <FieldLabel>Profile Photo</FieldLabel>
                <PhotoUploader photo_url={resumeData.personalInfo.photo_url||''} onUpload={updatePhoto} onRemove={removePhoto} templateId={template}/>
                <div style={{ marginTop:10, display:'flex', alignItems:'center', gap:8 }}>
                  <input type="checkbox" id="showPhoto" checked={custom.showPhoto}
                    onChange={e=>{
                      if(!TEMPLATES.find(t=>t.id===template)?.photo&&e.target.checked){ setError('This template does not support photos'); return; }
                      setCustom(c=>({...c,showPhoto:e.target.checked}));
                    }} style={{ cursor:'pointer' }}/>
                  <label htmlFor="showPhoto" style={{ fontSize:12, color:C.muted, cursor:'pointer' }}>Show photo in resume</label>
                </div>
              </Sect></div>

              {/* Summary */}
              {!custom.hiddenSections.includes('summary')&&(
                <Sect title="Professional Summary" icon="📋">
                  <Input value={resumeData.summary} onChange={s=>setResumeData(d=>d?{...d,summary:s}:d)} multiline rows={5} placeholder="Results-driven professional with 7+ years…"/>
                  <div style={{ marginTop:10, display:'flex', gap:8 }}>
                    <Btn onClick={()=>handleImprove({type:'summary'},'Rewrote summary')} loading={improving} variant="ghost" color={C.purple} size="sm">✨ AI Rewrite</Btn>
                    <Btn onClick={()=>handleImprove({type:'keywords',missingKeywords:ats?.missingKeywords},'Injected keywords')} loading={improving} variant="ghost" color={C.blue} size="sm">🔑 Inject Keywords</Btn>
                  </div>
                </Sect>
              )}

              {/* Experience */}
              {!custom.hiddenSections.includes('experience')&&(
                <Sect title="Work Experience" icon="💼">
                  <ExpEditor items={resumeData.experience} onChange={exp=>setResumeData(d=>d?{...d,experience:exp}:d)}
                    onAiStrengthen={idx=>handleImprove({type:'bullets',experienceIndex:idx},`Strengthened bullets`)} busy={improving}/>
                </Sect>
              )}

              {/* Skills */}
              {!custom.hiddenSections.includes('skills')&&(
                <Sect title="Skills" icon="🧠">
                  <SkillsEditor skills={resumeData.skills} onChange={s=>setResumeData(d=>d?{...d,skills:s}:d)}/>
                </Sect>
              )}

              {/* Education */}
              {!custom.hiddenSections.includes('education')&&(
                <Sect title="Education" icon="🎓" open={false}>
                  <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                    {resumeData.education.map(item=>(
                      <div key={item.id} style={{ background:C.s1, border:`1px solid ${C.border}`, borderRadius:10, padding:14, display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
                        <Input value={item.degree} onChange={v=>setResumeData(d=>d?{...d,education:d.education.map(e=>e.id===item.id?{...e,degree:v}:e)}:d)} placeholder="Bachelor of Commerce"/>
                        <Input value={item.school} onChange={v=>setResumeData(d=>d?{...d,education:d.education.map(e=>e.id===item.id?{...e,school:v}:e)}:d)} placeholder="University"/>
                        <Input value={item.year}   onChange={v=>setResumeData(d=>d?{...d,education:d.education.map(e=>e.id===item.id?{...e,year:v}:e)}:d)} placeholder="2019–2022"/>
                        <Input value={item.grade??''} onChange={v=>setResumeData(d=>d?{...d,education:d.education.map(e=>e.id===item.id?{...e,grade:v}:e)}:d)} placeholder="GPA (optional)"/>
                        <button onClick={()=>setResumeData(d=>d?{...d,education:d.education.filter(e=>e.id!==item.id)}:d)} style={{ fontSize:11, color:C.red, background:'none', border:'none', cursor:'pointer', fontFamily:'inherit', gridColumn:'1/-1', textAlign:'left' }}>Remove</button>
                      </div>
                    ))}
                    <button onClick={()=>setResumeData(d=>d?{...d,education:[...d.education,{id:`edu_${Date.now()}`,degree:'',school:'',year:''}]}:d)} style={{ padding:'9px', borderRadius:9, border:`1px dashed ${C.borderB}`, background:'transparent', color:C.muted, fontSize:12, cursor:'pointer', fontFamily:'inherit' }}>+ Add Education</button>
                  </div>
                </Sect>
              )}
            </div>

            {/* RIGHT ────────────────────────────────────────────────────────── */}
            <div style={{ position:'sticky', top:20 }}>
              {/* Tab bar */}
              <div style={{ display:'flex', gap:3, background:C.s2, borderRadius:12, padding:'4px', marginBottom:12 }}>
                {([{id:'ats',l:'📊 ATS'},{id:'preview',l:'👁 Preview'},{id:'customize',l:'🎨 Style'}] as {id:RightTab;l:string}[]).map(tab=>(
                  <button key={tab.id} onClick={()=>setRightTab(tab.id)} style={{ flex:1, padding:'8px 5px', border:'none', borderRadius:9, cursor:'pointer', fontFamily:'inherit', fontWeight:700, fontSize:11, background:rightTab===tab.id?C.s0:'transparent', color:rightTab===tab.id?C.text:C.muted, transition:'all .15s', boxShadow:rightTab===tab.id?'0 1px 4px rgba(0,0,0,.3)':'none' }}>{tab.l}</button>
                ))}
              </div>

              <Card style={{ overflow:'hidden' }}>
                <div key={rightTab} style={{ animation:'slide .2s ease-out' }}>
                  {rightTab==='ats'&&(
                    showAutoFix && autoFixResult ? (
                      <AutoFixResultPanel
                        result={autoFixResult}
                        onAccept={applyAutoFix}
                        onDismiss={()=>{ setShowAutoFix(false); setAutoFixResult(null); }}
                        busy={autoFixing}
                      />
                    ) : (
                      <div>
                        <AtsPanel ats={ats} onFix={handleFixSuggestion} busy={improving||autoFixing}/>
                        <div style={{ padding:'0 18px 18px' }}>
                          <AutoFixCta ats={ats} busy={autoFixing} onFix={handleAutoFix}/>
                        </div>
                      </div>
                    )
                  )}

                  {rightTab==='preview'&&(
                    <TemplatePreview resume={resumeData} templateId={template} custom={custom}/>
                  )}

                  {rightTab==='customize'&&<CustomizePanel custom={custom} onChange={setCustom}/>}
                </div>

                {/* Export footer */}
                <div style={{ borderTop:`1px solid ${C.border}`, padding:'12px 18px' }}>
                  {/* Validation warning */}
                  {fieldAlert&&(
                    <div style={{ fontSize:11, color:'#f04d3c', background:'#f04d3c0a', border:'1px solid #f04d3c30', borderRadius:8, padding:'8px 10px', marginBottom:10, display:'flex', alignItems:'flex-start', gap:8 }}>
                      <span style={{ flexShrink:0 }}>⚠</span>
                      <span>{fieldAlert}</span>
                    </div>
                  )}
                  {(!resumeData.personalInfo?.name?.trim())&&(
                    <div style={{ fontSize:11, color:C.amber, background:`${C.amber}10`, border:`1px solid ${C.amber}25`, borderRadius:8, padding:'8px 10px', marginBottom:10 }}>
                      ⚠ Add your name to enable export
                    </div>
                  )}
                  <div style={{ display:'flex', gap:7, marginBottom:8 }}>
                    <Btn onClick={()=>handleExport('pdf')} loading={exporting==='pdf'} disabled={!!exporting} color={C.blue} size="sm" full>
                      {exporting==='pdf'?'Generating PDF…':'⬇ Download PDF'}
                    </Btn>
                    <Btn onClick={()=>handleExport('docx')} loading={exporting==='docx'} disabled={!!exporting} variant="outline" color={C.muted} size="sm" full>
                      {exporting==='docx'?'Generating…':'⬇ DOCX'}
                    </Btn>
                  </div>
                  <Btn onClick={handleSave} loading={saving} color={C.green} size="sm" full>💾 Save Resume</Btn>
                </div>
              </Card>

              {/* Version history */}
              {versions.length>0&&(
                <div style={{ marginTop:12 }}>
                  <div style={{ fontSize:9, fontWeight:800, textTransform:'uppercase', letterSpacing:'.12em', color:C.muted, marginBottom:8 }}>Version History</div>
                  <div style={{ display:'flex', flexDirection:'column', gap:5 }}>
                    {versions.slice(0,4).map(v=>(
                      <div key={v.id} onClick={()=>{ setResumeData(v.data); setError(null); }} style={{ background:C.s0, border:`1px solid ${C.border}`, borderRadius:10, padding:'10px 13px', cursor:'pointer', display:'flex', alignItems:'center', gap:10, transition:'background .15s' }}>
                        <div style={{ width:32, height:32, borderRadius:8, background:C.blue+'14', display:'flex', alignItems:'center', justifyContent:'center', fontSize:11, fontWeight:900, color:C.blue, flexShrink:0 }}>{v.ats}</div>
                        <div style={{ flex:1, minWidth:0 }}>
                          <div style={{ fontSize:11, fontWeight:700, color:C.text, marginBottom:1, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{v.label}</div>
                          <div style={{ fontSize:10, color:C.muted }}>{v.at}</div>
                        </div>
                        <span style={{ fontSize:10, color:C.muted }}>↩</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </>
  );
}