'use client';

/**
 * app/career-dashboard/page.tsx
 * AI Career Intelligence Dashboard
 * Drop into: src/app/career-dashboard/page.tsx
 *
 * Sections:
 *  1. Header      — greeting · profession · actions
 *  2. KPI Tiles   — CHI · Job Match · Auto Risk · Opportunity Score
 *  3. AI Insights — 3-5 insights with speedometer confidence gauges
 *  4. Skill Gap   — bar chart: your level vs market demand
 *  5. Job Match   — horizontal bars with labels + CTA
 *  6. Opp Radar   — table: role · growth · jobs · skills
 *  7. Twin        — path cards + salary line chart
 *  8. Risk Gauge  — semi-circle gauge + recommendation
 *  9. Progress    — line chart CHI & match over time
 * 10. Copilot     — AI chat with prompts + insight banner
 */

import React, {
  useState, useEffect, useRef, useCallback, useMemo,
  type FormEvent, type CSSProperties,
} from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  Cell, LineChart, Line, ResponsiveContainer,
} from 'recharts';

import { useAuth }                from '@/features/auth/components/AuthProvider';
import { useCareerHealth }        from '@/hooks/useCareerHealth';
import { useProfile }             from '@/hooks/useProfile';
import { useResumes }             from '@/hooks/useResumes';
import { useHasResume }          from '@/hooks/useHasResume';
import { useJobMatches }          from '@/hooks/useJobMatches';
import { useJdMatch }             from '@/hooks/useJdMatch';
import { useSkillGap }                from '@/hooks/useSkillGraph';
import { useSkillDemand }             from '@/hooks/useSkillDemand';
import { useSkillPriority }           from '@/hooks/useSkillPriority';
import { useLearningRecommendations } from '@/hooks/useLearningRecommendations';
import { useCareerOpportunities } from '@/hooks/useCareerOpportunities';
import { useCareerSimulation, useFuturePaths } from '@/hooks/useCareerSimulation';
import { useSalaryIntelligence }               from '@/hooks/useSalaryIntelligence';
import { useSalaryCompare }                    from '@/hooks/useSalaryCompare';
import { useAnalyticsOverview }                from '@/hooks/useAnalyticsOverview';
import { usePersonalizedRecommendations, useTrackBehaviorEvent, getSignalStrengthLabel } from '@/hooks/usePersonalization';
import { useQueryClient } from '@tanstack/react-query';
import { useOpportunityScore }    from '@/hooks/useOpportunityScore';
import { useProgressTracker, useInsightsFeed, useAlertsFeed } from '@/hooks/useEngagement';
import { useUserActivity }                                    from '@/hooks/useUserActivity';
import { LoadingSpinner }         from '@/components/ui/LoadingSpinner';
import { apiFetch }               from '@/services/apiClient';
import type { CareerInsight }     from '@/services/engagementService';
import { useAvaMemory }           from '@/hooks/useAvaMemory';
import { AvaMemoryCard }          from '@/components/AvaMemoryCard';
import { MyApplicationsTracker }   from '@/components/AutoApply';
import { InterviewPrepWidget }      from '@/components/InterviewPrep';
import { CareerGrowthWidget }       from '@/components/CareerGrowth';
import { SalaryPredictorWidget }    from '@/components/SalaryPredictor';
import {
  getAvaPersonality,
  type AvaEmotionState,
  type AvaPersonality,
}                                  from '@/lib/avaEmotionEngine';

// ─── Design tokens ────────────────────────────────────────────────────────────
const T = {
  bg:'#07090f', s0:'#0d1117', s1:'#111822', s2:'#161f2e',
  border:'rgba(255,255,255,0.07)', borderB:'rgba(255,255,255,0.11)',
  text:'#dde4ef', muted:'#5f6d87', dim:'#29334a',
  green:'#1fd8a0', blue:'#3c72f8', amber:'#f4a928',
  red:'#ef5b48',  purple:'#9b7cf7', cyan:'#07bfbf', pink:'#e96caa',
} as const;

const KEYFRAMES = `
@keyframes shim{0%{background-position:-200% 0}100%{background-position:200% 0}}
@keyframes bop{from{transform:translateY(0)}to{transform:translateY(-5px)}}
@keyframes rise{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
@keyframes avaPulse{0%,100%{box-shadow:0 0 0 0 rgba(233,108,170,0.35)}60%{box-shadow:0 0 0 8px rgba(233,108,170,0)}}
@keyframes avaSlideIn{from{opacity:0;transform:translateY(-10px) scale(0.98)}to{opacity:1;transform:none}}
@keyframes stepPop{0%{opacity:0;transform:scale(0.94) translateY(4px)}100%{opacity:1;transform:scale(1) translateY(0)}}
@keyframes checkBounce{0%{transform:scale(0)}60%{transform:scale(1.25)}100%{transform:scale(1)}}
@keyframes gainFade{0%{opacity:0;transform:translateY(-8px)}30%{opacity:1;transform:translateY(0)}80%{opacity:1}100%{opacity:0;transform:translateY(-12px)}}
`;

// ─── Atoms ────────────────────────────────────────────────────────────────────
function Skel({h=14,w='100%',r=6}:{h?:number;w?:number|string;r?:number}){
  return <div style={{height:h,width:w,borderRadius:r,background:'linear-gradient(90deg,rgba(255,255,255,0.04) 25%,rgba(255,255,255,0.08) 50%,rgba(255,255,255,0.04) 75%)',backgroundSize:'200% 100%',animation:'shim 1.6s infinite'}}/>;
}
function SlLabel({children,color=T.muted}:{children:React.ReactNode;color?:string}){
  return <p style={{fontSize:9,fontWeight:800,textTransform:'uppercase',letterSpacing:'0.14em',color,margin:'0 0 14px'}}>{children}</p>;
}
function Card({children,style}:{children:React.ReactNode;style?:CSSProperties}){
  return <div style={{background:T.s0,border:`1px solid ${T.border}`,borderRadius:14,...style}}>{children}</div>;
}
function Pad({children,style}:{children:React.ReactNode;style?:CSSProperties}){
  return <div style={{padding:'20px 22px',...style}}>{children}</div>;
}
function SkTag({label,hi}:{label:string;hi?:boolean}){
  return <span style={{fontSize:10,padding:'2px 8px',borderRadius:20,color:hi?T.cyan:T.muted,background:hi?T.cyan+'15':T.dim+'90',border:`1px solid ${hi?T.cyan+'30':'transparent'}`}}>{label}</span>;
}
function EmptySlate({icon,text,cta,href}:{icon:string;text:string;cta?:string;href?:string}){
  return(
    <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:10,padding:'32px 0'}}>
      <span style={{fontSize:30,opacity:0.18}}>{icon}</span>
      <p style={{fontSize:12,color:T.muted,textAlign:'center',maxWidth:220,margin:0}}>{text}</p>
      {cta&&href&&<Link href={href} style={{fontSize:12,color:T.blue,fontWeight:700,textDecoration:'none'}}>{cta}</Link>}
    </div>
  );
}

// ─── Speedometer ─────────────────────────────────────────────────────────────
function Speedometer({confidence,size=80}:{confidence:number;size?:number}){
  const c=Math.max(0,Math.min(100,confidence));
  const color=c>=70?T.green:c>=40?T.amber:T.red;
  const label=c>=70?'High':c>=40?'Medium':'Low';
  const cx=size/2,cy=size/2+4,r=size/2-8;
  const half=Math.PI*r;
  const fill=half-(c/100)*half;
  const deg=-180+(c/100)*180;
  const rad=(deg*Math.PI)/180;
  const nx=cx+(r-6)*Math.cos(rad);
  const ny=cy+(r-6)*Math.sin(rad);
  return(
    <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:4}}>
      <svg width={size} height={size/2+16} viewBox={`0 0 ${size} ${size/2+16}`}>
        <path d={`M ${cx-r} ${cy} A ${r} ${r} 0 0 1 ${cx+r} ${cy}`} fill="none" stroke={T.dim} strokeWidth={6} strokeLinecap="round"/>
        <path d={`M ${cx-r} ${cy} A ${r} ${r} 0 0 1 ${cx+r} ${cy}`} fill="none" stroke={color} strokeWidth={6}
          strokeLinecap="round" strokeDasharray={half} strokeDashoffset={fill}
          style={{transition:'stroke-dashoffset 1s ease,stroke 0.4s'}}/>
        <line x1={cx} y1={cy} x2={nx} y2={ny} stroke={color} strokeWidth={2} strokeLinecap="round"/>
        <circle cx={cx} cy={cy} r={3} fill={color}/>
        <text x={cx} y={cy-2} textAnchor="middle" fontSize={12} fontWeight={800} fill={color}>{c}%</text>
      </svg>
      <span style={{fontSize:9,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.1em',color}}>{label} confidence</span>
    </div>
  );
}

// ─── KPI tile ─────────────────────────────────────────────────────────────────
interface KpiProps{icon:string;label:string;value:string|number;sub:string;color:string;delta?:string;up?:boolean;loading?:boolean;href?:string;onClick?:()=>void;}
function KpiTile({icon,label,value,sub,color,delta,up,loading,href,onClick}:KpiProps){
  const [hov,setHov]=useState(false);
  const body=(
    <div style={{background:T.s0,border:`1px solid ${hov&&href?color+'44':T.border}`,borderRadius:14,padding:'20px 22px',position:'relative',overflow:'hidden',cursor:href?'pointer':'default',transition:'border-color 0.2s,transform 0.2s',transform:hov&&href?'translateY(-2px)':'none'}}
      onMouseEnter={()=>setHov(true)} onMouseLeave={()=>setHov(false)} onClick={onClick}>
      <div style={{position:'absolute',top:-40,right:-40,width:110,height:110,borderRadius:'50%',background:color,opacity:0.07,filter:'blur(34px)',pointerEvents:'none'}}/>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:16}}>
        <div style={{width:38,height:38,borderRadius:10,background:color+'1a',border:`1px solid ${color}28`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:18}}>{icon}</div>
        {delta&&<span style={{fontSize:11,fontWeight:700,color:up?T.green:T.red,background:up?T.green+'15':T.red+'15',padding:'2px 9px',borderRadius:20}}>{up?'↑':'↓'} {delta}</span>}
      </div>
      {loading?(<div style={{display:'flex',flexDirection:'column',gap:7}}><Skel h={28} w="55%"/><Skel h={11} w="70%"/></div>):(
        <><div style={{fontSize:32,fontWeight:800,color:T.text,letterSpacing:'-0.025em',lineHeight:1}}>{value}</div>
        <div style={{fontSize:12,color:T.muted,marginTop:6,lineHeight:1.45}}>{sub}</div></>
      )}
      <div style={{marginTop:16,fontSize:9,fontWeight:800,textTransform:'uppercase',letterSpacing:'0.12em',color,opacity:0.85}}>{label}</div>
    </div>
  );
  return href?<Link href={href} style={{textDecoration:'none',display:'block'}}>{body}</Link>:body;
}

// ─── AI Insights ──────────────────────────────────────────────────────────────
type IVar='opportunity'|'skill'|'risk'|'salary'|'market';
interface DI{id:string;variant:IVar;icon:string;title:string;body:string;confidence:number;engine:string;action?:{label:string;href:string};}
const VCOLOR:Record<IVar,string>={opportunity:T.green,skill:T.blue,risk:T.red,salary:T.amber,market:T.purple};

function buildInsights(
  chi:any,jobs:any,gap:any,opps:any,feed:any
):DI[]{
  const out:DI[]=[];
  const topOpp=opps?.opportunities?.[0];
  if(topOpp){out.push({id:'opp-1',variant:'opportunity',icon:'🚀',title:`${topOpp.role} is your strongest transition path`,body:`Your skill profile matches this role with a ${Math.round(topOpp.match_score)}% overlap — a strong foundation for a lateral move.`,confidence:Math.min(95,Math.round(topOpp.match_score)+10),engine:'Career Opportunity Engine',action:{label:'View opportunities',href:'/opportunities'}});}
  const topMiss=gap?.missing_high_demand?.[0];
  if(topMiss){const boost=Math.round(topMiss.demand_score*0.18);out.push({id:'skill-1',variant:'skill',icon:'⚡',title:`Learning ${topMiss.name} could raise your match score by ~${boost}%`,body:`${topMiss.name} has a market demand score of ${topMiss.demand_score}/100 and appears in job postings for your target roles.`,confidence:75+(topMiss.demand_score>70?10:0),engine:'Skill Graph Engine',action:{label:'View skill gaps',href:'/skill-graph'}});}
  const autoRiskScore=chi?.automationRisk?.score;
  const autoRiskRec=chi?.automationRisk?.recommendation;
  if(autoRiskScore!=null&&autoRiskScore>40){out.push({id:'risk-1',variant:'risk',icon:'🛡️',title:'Some of your current skills carry moderate automation exposure',body:autoRiskRec??'Upskilling in AI tooling could reduce your automation risk significantly.',confidence:68,engine:'Career Risk Predictor',action:{label:'Risk analysis',href:'/career-health'}});}
  const sal=chi?.salaryBenchmark;
  if(sal?.marketMedian&&sal?.yourEstimate&&sal.marketMedian>sal.yourEstimate){const d=(sal.marketMedian-sal.yourEstimate).toFixed(0);out.push({id:'sal-1',variant:'salary',icon:'💰',title:`Market median is ₹${d}L above your current estimate`,body:`Closing your skill gaps and targeting roles at the ${sal.marketMedian}L benchmark could close the gap within 12–18 months.`,confidence:72,engine:'Salary Intelligence Engine',action:{label:'Salary report',href:'/career-health'}});}
  const fi=feed?.insights?.find((i:any)=>i.insight_type==='market_trend'||i.insight_type==='skill_demand');
  if(fi){out.push({id:`feed-${fi.id}`,variant:fi.insight_type==='market_trend'?'market':'skill',icon:fi.insight_type==='market_trend'?'📈':'⚡',title:fi.title,body:fi.description,confidence:80,engine:'Labor Market Intelligence'});}
  // No fallback upload CTA here — CvStatusBanner at page top is the single upload surface.
  return out.slice(0,5);
}

function InsightCard({ins,onActionClick}:{ins:DI;onActionClick?:(ins:DI)=>void}){
  const color=VCOLOR[ins.variant];
  return(
    <div style={{background:T.s1,border:`1px solid ${color}20`,borderLeft:`3px solid ${color}`,borderRadius:12,padding:'16px 18px',display:'flex',gap:16,alignItems:'flex-start'}}>
      <div style={{flexShrink:0}}><Speedometer confidence={ins.confidence} size={80}/></div>
      <div style={{flex:1,minWidth:0}}>
        <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:6}}>
          <span style={{fontSize:16}}>{ins.icon}</span>
          <span style={{fontSize:12,fontWeight:700,color:T.text,lineHeight:1.3}}>{ins.title}</span>
        </div>
        <p style={{fontSize:12,color:T.muted,lineHeight:1.6,margin:'0 0 10px'}}>{ins.body}</p>
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',flexWrap:'wrap',gap:8}}>
          <span style={{fontSize:10,color:T.dim,fontStyle:'italic'}}>Source: {ins.engine}</span>
          {ins.action&&(
            <Link href={ins.action.href}
              onClick={()=>onActionClick?.(ins)}
              style={{fontSize:11,fontWeight:700,color,textDecoration:'none'}}>
              {ins.action.label} →
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Skill Gap / Demand Analytics Panel ──────────────────────────────────────

interface SkillGapPanelProps {
  role:   string | null | undefined;
  skills: string[];
}

function SkillGapPanel({role, skills}: SkillGapPanelProps){
  const [tab, setTab] = useState<'gap'|'demand'>('gap');
  const {data: gapData, isLoading: gapLoading} = useSkillGap();

  // Demand analytics — only fires when we have a role from CHI/profile
  const demandInput = role ? {role, skills} : null;
  const {data: demandData, isLoading: demandLoading} = useSkillDemand(demandInput);

  // Skill prioritization engine — fires when CHI is ready (passed via enabled prop)
  // We check isReady from chi — hoisted via the chi prop added at call site
  const {data: priorityResp, isLoading: priorityLoading} = useSkillPriority({enabled: !!role && skills.length > 0});

  const chartData=useMemo(()=>{
    // FIX: "yours" was hardcoded as 62+i*7 (fake) for all users regardless of CV.
    // Now uses real CV-driven data:
    //   existing skills → 100 (user HAS this skill from CV)
    //   missing skills  → 0   (user does NOT have this skill)
    //   market demand   → demand_score from role definition (real)
    // This makes the chart show the TRUE gap between what the CV has vs what the role needs.
    const miss=(gapData?.missing_high_demand??[]).slice(0,5).map((s:any)=>({name:s.name.length>15?s.name.slice(0,15)+'…':s.name,yours:0,market:Math.min(100,Math.round((s.demand_score??70))),gap:true}));
    const ex=(gapData?.existing_skills??[]).slice(0,5).map((sk:any)=>({name:(typeof sk==='string'?sk:sk?.name??'').length>15?(typeof sk==='string'?sk:sk?.name??'').slice(0,15)+'…':(typeof sk==='string'?sk:sk?.name??''),yours:100,market:70,gap:false}));
    return[...ex,...miss];
  },[gapData]);

  const tabStyle = (active: boolean) => ({
    fontSize:10, fontWeight:800, textTransform:'uppercase' as const, letterSpacing:'0.1em',
    padding:'4px 12px', borderRadius:20, cursor:'pointer', border:'none',
    background: active ? T.blue : 'transparent',
    color: active ? '#fff' : T.muted,
    transition:'background 0.15s,color 0.15s',
  });

  return(
    <Pad>
      {/* Header + tabs */}
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:14}}>
        <SlLabel>Skill Intelligence</SlLabel>
        <div style={{display:'flex',alignItems:'center',gap:12}}>
          <div style={{display:'flex',gap:4,background:T.s2,borderRadius:24,padding:'3px 4px'}}>
            <button style={tabStyle(tab==='gap')}    onClick={()=>setTab('gap')}>Gap Overview</button>
            <button style={tabStyle(tab==='demand')} onClick={()=>setTab('demand')}>Demand Analytics</button>
          </div>
          <Link href="/skill-graph" style={{fontSize:11,color:T.blue,textDecoration:'none',fontWeight:700}}>Full analysis →</Link>
        </div>
      </div>

      {/* ── TAB 1: Gap Overview (unchanged) ── */}
      {tab==='gap'&&(
        <>
          {gapLoading
            ? <div style={{display:'flex',flexDirection:'column',gap:8}}>{[1,2,3,4,5].map(i=><Skel key={i} h={22}/>)}</div>
            : chartData.length>0
              ? <>
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={chartData} margin={{left:-20,right:8,top:4,bottom:4}} barGap={4}
                      style={{cursor:'pointer'}}
                      onClick={()=>window.location.href='/skill-graph'}>
                      <CartesianGrid strokeDasharray="3 3" stroke={T.dim} vertical={false}/>
                      <XAxis dataKey="name" tick={{fill:T.muted,fontSize:10}} axisLine={false} tickLine={false}/>
                      <YAxis domain={[0,100]} tick={{fill:T.muted,fontSize:10}} axisLine={false} tickLine={false}/>
                      <Tooltip contentStyle={{background:'#131b28',border:`1px solid ${T.border}`,borderRadius:8,fontSize:12,color:T.text}} cursor={{fill:'rgba(255,255,255,0.03)'}}/>
                      <Bar dataKey="yours" name="Your Level" radius={[3,3,0,0]}>
                        {chartData.map((d:any,i:number)=><Cell key={i} fill={d.gap?T.red+'cc':T.blue}/>)}
                      </Bar>
                      <Bar dataKey="market" name="Market Demand" radius={[3,3,0,0]} fill={T.green} opacity={0.5}/>
                    </BarChart>
                  </ResponsiveContainer>
                  <div style={{display:'flex',gap:16,marginTop:10}}>
                    {[{c:T.blue,l:'Your Level'},{c:T.red,l:'Gap (missing)'},{c:T.green,l:'Market Demand'}].map(x=>(
                      <span key={x.l} style={{display:'inline-flex',alignItems:'center',gap:5,fontSize:11,color:T.muted}}>
                        <span style={{display:'inline-block',width:8,height:8,borderRadius:2,background:x.c}}/>{x.l}
                      </span>
                    ))}
                  </div>
                  <div style={{marginTop:12,paddingTop:12,borderTop:`1px solid ${T.border}`}}>
                    {(gapData?.missing_high_demand?.length??0)>0 ? (
                      <>
                        <span style={{fontSize:10,color:T.muted,marginRight:8}}>Recommended to learn:</span>
                        {gapData!.missing_high_demand.slice(0,4).map((s:any)=><SkTag key={s.name} label={s.name} hi/>)}
                      </>
                    ) : gapData?.role_gap ? (
                      <span style={{fontSize:11,color:T.green,fontWeight:600}}>
                        ✓ Your CV skills fully match your target role requirements ({gapData.role_gap.match_percentage}% match)
                      </span>
                    ) : null}
                  </div>
                </>
              : <EmptySlate icon="⬡" text="Skill data loads after CV analysis." cta="Upload CV →" href="/resume"/>
          }
        </>
      )}

      {/* ── TAB 2: Demand Analytics ── */}
      {tab==='demand'&&(
        <>
          {!role&&(
            <EmptySlate icon="⬡" text="Set your target role so we can run role-specific demand analysis." cta="Update profile →" href="/profile"/>
          )}
          {role&&demandLoading&&(
            <div style={{display:'flex',flexDirection:'column',gap:8}}>{[1,2,3,4,5,6].map(i=><Skel key={i} h={28}/>)}</div>
          )}
          {role&&!demandLoading&&demandData&&(
            <>
              {/* Score bar */}
              <div style={{display:'flex',gap:10,marginBottom:16,flexWrap:'wrap'}}>
                {[
                  {l:'Role Match',   v:`${demandData.skill_score}%`,       c:demandData.skill_score>=70?T.green:demandData.skill_score>=45?T.amber:T.red},
                  {l:'Skills You Have', v:demandData.user_skills.length,   c:T.blue},
                  {l:'Required',     v:demandData.required_skills.length,  c:T.muted},
                  {l:'Gaps',         v:demandData.skill_gaps.length,       c:T.red},
                ].map(x=>(
                  <div key={x.l} style={{background:T.s1,border:`1px solid ${T.border}`,borderRadius:8,padding:'8px 14px',flex:1,minWidth:80}}>
                    <div style={{fontSize:18,fontWeight:800,color:x.c}}>{x.v}</div>
                    <div style={{fontSize:9,color:T.muted,textTransform:'uppercase',letterSpacing:'0.06em',marginTop:2}}>{x.l}</div>
                  </div>
                ))}
              </div>

              {/* Role label */}
              <div style={{fontSize:11,color:T.muted,marginBottom:10}}>
                Role: <strong style={{color:T.text}}>{demandData.role}</strong>
              </div>

              {/* Top recommended skills table */}
              {demandData.top_recommended_skills.length>0
                ? <>
                    {/* Table header */}
                    <div style={{display:'grid',gridTemplateColumns:'2fr 70px 70px 70px 80px',gap:8,padding:'6px 10px',borderBottom:`1px solid ${T.border}`,marginBottom:4}}>
                      {['Skill to Learn','Demand','Growth','Salary ↑','Industry'].map(h=>(
                        <span key={h} style={{fontSize:9,fontWeight:800,textTransform:'uppercase',letterSpacing:'0.1em',color:T.dim}}>{h}</span>
                      ))}
                    </div>
                    {demandData.top_recommended_skills.slice(0,7).map((row,i)=>{
                      const dColor = row.demand_score>=80?T.green:row.demand_score>=55?T.amber:T.muted;
                      return(
                        <div key={row.skill} style={{display:'grid',gridTemplateColumns:'2fr 70px 70px 70px 80px',gap:8,padding:'9px 10px',background:i%2===0?'transparent':T.s2+'80',borderRadius:6,alignItems:'center'}}>
                          <span style={{fontSize:12,fontWeight:600,color:T.text}}>{row.skill}</span>
                          <span style={{fontSize:12,fontWeight:700,color:dColor}}>{row.demand_score}</span>
                          <span style={{fontSize:11,color:row.growth_rate>20?T.green:T.muted}}>
                            {row.growth_rate>0?`+${row.growth_rate}%`:'—'}
                          </span>
                          <span style={{fontSize:11,color:row.salary_boost>0?T.amber:T.muted}}>
                            {row.salary_boost>0?`+${row.salary_boost}%`:'—'}
                          </span>
                          <span style={{fontSize:10,color:T.muted,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{row.industry}</span>
                        </div>
                      );
                    })}
                    <div style={{marginTop:12,paddingTop:10,borderTop:`1px solid ${T.border}`,fontSize:10,color:T.dim}}>
                      Demand score = market demand 0–100 · Growth = YoY% · Salary ↑ = earning uplift%
                    </div>
                  </>
                : <div style={{padding:'16px 0',textAlign:'center',fontSize:12,color:T.muted}}>
                    No skill gaps detected for <strong>{demandData.role}</strong> — your skills are well aligned.
                  </div>
              }

              {/* ── Priority Intelligence panel ── */}
              <div style={{marginTop:18,paddingTop:14,borderTop:`1px solid ${T.border}`}}>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:10}}>
                  <span style={{fontSize:9,fontWeight:800,textTransform:'uppercase',letterSpacing:'0.12em',color:T.purple}}>⚡ Skill Prioritization Engine</span>
                  {priorityResp?.data&&(
                    <span style={{fontSize:10,color:T.muted}}>
                      Confidence: <strong style={{color:priorityResp.data.confidenceInsight.confidenceLevel==='HIGH'?T.green:priorityResp.data.confidenceInsight.confidenceLevel==='MEDIUM'?T.amber:T.muted}}>
                        {priorityResp.data.confidenceInsight.confidenceLevel}
                      </strong>
                    </span>
                  )}
                </div>

                {priorityLoading&&(
                  <div style={{display:'flex',flexDirection:'column',gap:6}}>{[1,2,3].map(i=><Skel key={i} h={24}/>)}</div>
                )}

                {!priorityLoading&&priorityResp?.message&&!priorityResp.data&&(
                  <p style={{fontSize:11,color:T.muted,margin:0}}>{priorityResp.message}</p>
                )}

                {!priorityLoading&&priorityResp?.data&&(()=>{
                  const pr = priorityResp.data!;
                  const topSkills = pr.prioritizedSkills.slice(0,5);
                  const roiColor = (roi:string) => roi==='FAST_GAIN'?T.green:roi==='STRATEGIC'?T.blue:T.amber;
                  return(
                    <>
                      {/* Summary bar */}
                      <div style={{display:'flex',gap:8,marginBottom:12,flexWrap:'wrap'}}>
                        {[
                          {l:'High Priority', v:pr.summary.highPriorityCount,          c:T.red},
                          {l:'Avg Score',     v:`${pr.summary.avgPriorityScore}`,       c:T.purple},
                          {l:'Salary ↑',      v:`+${pr.summary.estimatedSalaryDelta}%`, c:T.amber},
                          {l:'Promo Prob.',   v:`${pr.careerPathInsight.unlockProbabilityIncrease}%`, c:T.green},
                        ].map(x=>(
                          <div key={x.l} style={{background:T.s2,border:`1px solid ${T.border}`,borderRadius:8,padding:'6px 12px',flex:1,minWidth:70}}>
                            <div style={{fontSize:15,fontWeight:800,color:x.c}}>{x.v}</div>
                            <div style={{fontSize:9,color:T.muted,textTransform:'uppercase',letterSpacing:'0.06em'}}>{x.l}</div>
                          </div>
                        ))}
                      </div>

                      {/* Priority ranked list */}
                      <div style={{display:'grid',gridTemplateColumns:'2fr 60px 70px 80px 70px',gap:6,padding:'5px 8px',marginBottom:4}}>
                        {['Skill','Score','Priority','ROI','Weeks'].map(h=>(
                          <span key={h} style={{fontSize:9,fontWeight:800,textTransform:'uppercase',letterSpacing:'0.1em',color:T.dim}}>{h}</span>
                        ))}
                      </div>
                      {topSkills.map((sk,i)=>{
                        const lvlColor = sk.priorityLevel==='HIGH'?T.red:sk.priorityLevel==='MEDIUM'?T.amber:T.muted;
                        return(
                          <div key={sk.skillId} style={{display:'grid',gridTemplateColumns:'2fr 60px 70px 80px 70px',gap:6,padding:'8px',background:i%2===0?'transparent':T.s2+'80',borderRadius:6,alignItems:'center'}}>
                            <span style={{fontSize:12,fontWeight:600,color:T.text}}>{sk.skillName}</span>
                            <span style={{fontSize:12,fontWeight:800,color:T.purple}}>{sk.priorityScore}</span>
                            <span style={{fontSize:10,fontWeight:700,color:lvlColor,background:lvlColor+'15',padding:'2px 6px',borderRadius:12,textAlign:'center'}}>{sk.priorityLevel}</span>
                            <span style={{fontSize:10,color:roiColor(sk.roiCategory)}}>{sk.roiCategory.replace('_',' ')}</span>
                            <span style={{fontSize:11,color:T.muted}}>{sk.estimatedLearningTimeWeeks}w</span>
                          </div>
                        );
                      })}

                      {/* Narrative */}
                      {pr.narrative&&(
                        <div style={{marginTop:10,padding:'9px 12px',background:T.purple+'10',border:`1px solid ${T.purple}22`,borderRadius:8,fontSize:11,color:T.muted,lineHeight:1.6}}>
                          {pr.narrative}
                        </div>
                      )}

                      {/* Next role unlock */}
                      {pr.careerPathInsight.nextRoleUnlocked&&(
                        <div style={{marginTop:8,fontSize:11,color:T.muted}}>
                          Next role unlock: <strong style={{color:T.cyan}}>{pr.careerPathInsight.nextRoleUnlocked}</strong>
                          {' · '}Gateway progress: <strong style={{color:T.green}}>{pr.careerPathInsight.gatewayProgressPercent}%</strong>
                        </div>
                      )}
                    </>
                  );
                })()}
              </div>
            </>
          )}
          {role&&!demandLoading&&!demandData&&(
            <EmptySlate icon="⬡" text="Could not load demand analytics. Check your profile role is set." cta="Retry →" href="/profile"/>
          )}
        </>
      )}
    </Pad>
  );
}

// ─── Learning Recommendations Panel ──────────────────────────────────────────

interface LearningPanelProps {
  role:   string | null | undefined;
  skills: string[];
  onTrack?: (event_type: string, entity_type: string, entity_id: string, entity_label: string) => void;
}

function LearningPanel({role, skills, onTrack}: LearningPanelProps){
  const input = role && skills.length > 0 ? {role, skills} : null;
  const {data, isLoading} = useLearningRecommendations(input);
  const recs = data?.learning_recommendations?.filter((r:any) => r.courses?.length > 0) ?? [];

  const roiColor = (level:string) =>
    level === 'Beginner' ? T.green : level === 'Intermediate' ? T.amber : T.red;

  return(
    <Pad>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:14}}>
        <SlLabel>Top Skills to Learn</SlLabel>
        <div style={{display:'flex',alignItems:'center',gap:12}}>
          {data?.summary&&(
            <span style={{fontSize:10,color:T.muted}}>
              {data.summary.total_skills_addressed} skills · ~{data.summary.estimated_months}mo
            </span>
          )}
          <Link href="/skill-graph" style={{fontSize:11,color:T.amber,textDecoration:'none',fontWeight:700}}>Full plan →</Link>
        </div>
      </div>

      {!role&&<EmptySlate icon="📚" text="Set your target role to get learning recommendations." cta="Update profile →" href="/profile"/>}

      {role&&isLoading&&(
        <div style={{display:'flex',flexDirection:'column',gap:8}}>{[1,2,3].map(i=><Skel key={i} h={60}/>)}</div>
      )}

      {role&&!isLoading&&recs.length===0&&(
        <EmptySlate icon="📚" text="Upload your CV to get personalised course recommendations." cta="Upload CV →" href="/resume"/>
      )}

      {role&&!isLoading&&recs.length>0&&(
        <div style={{display:'flex',flexDirection:'column',gap:8}}>
          {recs.slice(0,3).map((rec:any)=>{
            const top = rec.courses[0];
            return(
              <div key={rec.skill} style={{display:'flex',alignItems:'flex-start',gap:12,background:T.s1,borderRadius:10,padding:'12px 14px',border:`1px solid ${T.border}`}}>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:4}}>
                    <span style={{fontSize:12,fontWeight:700,color:T.text}}>{rec.skill}</span>
                    <span style={{fontSize:9,fontWeight:800,textTransform:'uppercase',letterSpacing:'0.1em',
                      color:roiColor(top.level),background:roiColor(top.level)+'18',padding:'2px 7px',borderRadius:12}}>
                      {top.level}
                    </span>
                  </div>
                  <div style={{fontSize:11,color:T.muted,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
                    {top.course_name} · <span style={{color:T.blue}}>{top.provider}</span>
                  </div>
                </div>
                <div style={{textAlign:'right',flexShrink:0}}>
                  {top.duration_hours>0&&(
                    <div style={{fontSize:11,fontWeight:700,color:T.amber}}>{top.duration_hours}h</div>
                  )}
                  {top.url&&(
                    <a href={top.url} target="_blank" rel="noopener noreferrer"
                      onClick={()=>onTrack?.('course_view','course', rec.skill.toLowerCase().replace(/\s+/g,'_'), rec.skill)}
                      style={{fontSize:10,color:T.blue,textDecoration:'none',fontWeight:700}}>
                      Enrol →
                    </a>
                  )}
                </div>
              </div>
            );
          })}
          {(data?.summary?.skills_without_courses?.length ?? 0) > 0 && (
            <div style={{marginTop:4,fontSize:10,color:T.dim}}>
              {data?.summary?.skills_without_courses?.length} skill{(data?.summary?.skills_without_courses?.length ?? 0) > 1 ? 's' : ''} without courses yet — try Coursera or Udemy directly.
            </div>
          )}
        </div>
      )}
    </Pad>
  );
}

// ─── Job Match ────────────────────────────────────────────────────────────────
const BarLabel=(props:any)=>{const{x=0,y=0,width=0,value=0}=props;return<text x={x+width+6} y={y+10} fill={T.muted} fontSize={11} fontWeight={700}>{value}%</text>;};

function JobMatchPanel({userSkills, experienceYears}: {userSkills: string[]; experienceYears: number}){
  const [tab, setTab] = useState<'matches'|'jd'>('matches');
  const {data,isLoading}=useJobMatches(6,20);
  const jobs=data?.recommended_jobs??[];
  const chartData=jobs.map((j:any)=>({name:j.title.length>20?j.title.slice(0,20)+'…':j.title,score:Math.round(j.match_score)}));

  // JD Analyzer state
  const {data:jdResult, loading:jdLoading, error:jdError, match:runMatch, reset:resetJd} = useJdMatch();
  const [jdText, setJdText] = React.useState('');

  const tabStyle = (active: boolean) => ({
    fontSize:10, fontWeight:800, textTransform:'uppercase' as const, letterSpacing:'0.1em',
    padding:'4px 12px', borderRadius:20, cursor:'pointer', border:'none',
    background: active ? T.green : 'transparent',
    color: active ? '#fff' : T.muted,
    transition:'background 0.15s,color 0.15s',
  });

  const categoryColor = (cat:string) =>
    cat==='excellent_match'?T.green:cat==='good_match'?T.cyan:cat==='partial_match'?T.amber:T.red;
  const categoryLabel = (cat:string) =>
    cat==='excellent_match'?'Excellent':cat==='good_match'?'Good':cat==='partial_match'?'Partial':'Low';

  return(
    <Pad>
      {/* Header + tabs */}
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:14}}>
        <SlLabel>Job Match Analysis</SlLabel>
        <div style={{display:'flex',alignItems:'center',gap:12}}>
          <div style={{display:'flex',gap:4,background:T.s2,borderRadius:24,padding:'3px 4px'}}>
            <button style={tabStyle(tab==='matches')} onClick={()=>setTab('matches')}>Recommended</button>
            <button style={tabStyle(tab==='jd')}      onClick={()=>setTab('jd')}>Analyze JD</button>
          </div>
          <Link href="/job-matches" style={{fontSize:11,color:T.green,textDecoration:'none',fontWeight:700}}>
            {tab==='matches'?'View all →':'Job matches →'}
          </Link>
        </div>
      </div>

      {/* ── TAB 1: Recommended jobs (unchanged) ── */}
      {tab==='matches'&&(
        <>
          {isLoading
            ? <div style={{display:'flex',flexDirection:'column',gap:10}}>{[1,2,3,4,5].map(i=><Skel key={i} h={22}/>)}</div>
            : chartData.length>0
              ? <>
                  <div style={{display:'flex',gap:8,marginBottom:16,flexWrap:'wrap'}}>
                    {[{l:'Roles evaluated',v:data?.total_roles_evaluated??0,c:T.blue},{l:'Top match',v:`${chartData[0]?.score??0}%`,c:T.green},{l:'Your skills',v:data?.user_skills_count??0,c:T.amber}].map(x=>(
                      <div key={x.l} style={{background:x.c+'12',border:`1px solid ${x.c}25`,borderRadius:8,padding:'6px 12px'}}>
                        <div style={{fontSize:14,fontWeight:800,color:x.c}}>{x.v}</div>
                        <div style={{fontSize:10,color:T.muted,textTransform:'uppercase',letterSpacing:'0.06em'}}>{x.l}</div>
                      </div>
                    ))}
                  </div>
                  <ResponsiveContainer width="100%" height={240}>
                    <BarChart data={chartData} layout="vertical" margin={{left:0,right:50,top:2,bottom:0}}>
                      <CartesianGrid strokeDasharray="3 3" stroke={T.dim} horizontal={false}/>
                      <XAxis type="number" domain={[0,100]} tick={{fill:T.muted,fontSize:10}} axisLine={false} tickLine={false}/>
                      <YAxis type="category" dataKey="name" tick={{fill:T.text,fontSize:11}} axisLine={false} tickLine={false} width={120}/>
                      <Tooltip contentStyle={{background:'#131b28',border:`1px solid ${T.border}`,borderRadius:8,fontSize:12,color:T.text}} cursor={{fill:'rgba(255,255,255,0.03)'}} formatter={(v)=>[`${v}%`,'Match Score'] as [string,string]}/>
                      <Bar dataKey="score" radius={[0,5,5,0]} label={<BarLabel/>}>
                        {chartData.map((d:any,i:number)=><Cell key={i} fill={d.score>=75?T.green:d.score>=55?T.amber:T.blue}/>)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </>
              : <EmptySlate icon="⌖" text="Job matches load after CV analysis." cta="Upload CV →" href="/resume"/>
          }
        </>
      )}

      {/* ── TAB 2: JD Deep Analyzer ── */}
      {tab==='jd'&&(
        <>
          {!jdResult&&(
            <>
              <p style={{fontSize:12,color:T.muted,marginBottom:12,lineHeight:1.5}}>
                Paste any job description below. The NLP engine will extract keywords, compare your CV skills, and score your fit — no AI credits used.
              </p>
              <textarea
                value={jdText}
                onChange={e=>setJdText(e.target.value)}
                placeholder="Paste the full job description here (min. 50 characters)…"
                rows={6}
                style={{width:'100%',background:T.s1,border:`1px solid ${T.borderB}`,borderRadius:9,
                  padding:'10px 13px',fontSize:12,color:T.text,outline:'none',resize:'vertical',
                  boxSizing:'border-box',lineHeight:1.6}}
              />
              {jdError&&(
                <p style={{fontSize:11,color:T.red,marginTop:6}}>{jdError}</p>
              )}
              <div style={{display:'flex',gap:10,marginTop:10,alignItems:'center'}}>
                <button
                  onClick={()=>{
                    runMatch(
                      {
                        skills: userSkills.map(s=>({name:s})),
                        totalExperience: experienceYears,
                      },
                      jdText
                    );
                  }}
                  disabled={jdLoading||jdText.trim().length<50}
                  style={{padding:'9px 18px',background:T.green,color:'#fff',border:'none',borderRadius:9,
                    fontWeight:700,fontSize:13,cursor:jdLoading||jdText.trim().length<50?'not-allowed':'pointer',
                    opacity:jdLoading||jdText.trim().length<50?0.45:1,display:'flex',alignItems:'center',gap:6}}
                >
                  {jdLoading&&<span style={{display:'inline-block',width:12,height:12,border:'2px solid rgba(255,255,255,0.3)',borderTopColor:'#fff',borderRadius:'50%',animation:'bop 0.6s linear infinite'}}/>}
                  {jdLoading?'Analyzing…':'Analyze JD'}
                </button>
                <span style={{fontSize:10,color:T.dim}}>{jdText.length} chars {jdText.length<50?`· need ${50-jdText.length} more`:''}</span>
              </div>
            </>
          )}

          {jdResult&&(()=>{
            const c = categoryColor(jdResult.matchCategory);
            return(
              <>
                {/* Score banner */}
                <div style={{display:'flex',alignItems:'center',gap:16,background:c+'12',border:`1px solid ${c}25`,borderRadius:12,padding:'14px 18px',marginBottom:14}}>
                  <div style={{textAlign:'center',flexShrink:0}}>
                    <div style={{fontSize:36,fontWeight:800,color:c,lineHeight:1}}>{jdResult.matchScore}</div>
                    <div style={{fontSize:9,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.1em',color:c}}>/ 100</div>
                  </div>
                  <div style={{flex:1}}>
                    <div style={{fontSize:12,fontWeight:700,color:c,marginBottom:4}}>{categoryLabel(jdResult.matchCategory)} Match</div>
                    <p style={{fontSize:11,color:T.muted,margin:0,lineHeight:1.55}}>{jdResult.summary}</p>
                  </div>
                </div>

                {/* Keyword breakdown */}
                <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:8,marginBottom:14}}>
                  {[
                    {l:'Keywords',  v:jdResult.keywordAnalysis.totalExtracted, c:T.blue},
                    {l:'Matched',   v:jdResult.keywordAnalysis.matched,        c:T.green},
                    {l:'Missing',   v:jdResult.keywordAnalysis.missing,        c:T.red},
                    {l:'Exp. Gap',  v:jdResult.experienceAnalysis.gap>0?`${jdResult.experienceAnalysis.gap}yr`:'✓', c:jdResult.experienceAnalysis.meets?T.green:T.amber},
                  ].map(x=>(
                    <div key={x.l} style={{background:T.s1,border:`1px solid ${T.border}`,borderRadius:8,padding:'8px 10px',textAlign:'center'}}>
                      <div style={{fontSize:16,fontWeight:800,color:x.c}}>{x.v}</div>
                      <div style={{fontSize:9,color:T.muted,textTransform:'uppercase',letterSpacing:'0.06em'}}>{x.l}</div>
                    </div>
                  ))}
                </div>

                {/* Missing keywords */}
                {jdResult.missingKeywords.length>0&&(
                  <div style={{marginBottom:12}}>
                    <div style={{fontSize:9,fontWeight:800,textTransform:'uppercase',letterSpacing:'0.1em',color:T.red,marginBottom:6}}>Skills to add to your CV</div>
                    <div style={{display:'flex',flexWrap:'wrap',gap:5}}>
                      {jdResult.missingKeywords.slice(0,10).map((kw:string)=>(
                        <SkTag key={kw} label={kw}/>
                      ))}
                    </div>
                  </div>
                )}

                {/* Top improvement */}
                {jdResult.improvementSuggestions.length>0&&(
                  <div style={{marginBottom:12}}>
                    <div style={{fontSize:9,fontWeight:800,textTransform:'uppercase',letterSpacing:'0.1em',color:T.amber,marginBottom:6}}>Top recommendations</div>
                    {jdResult.improvementSuggestions.slice(0,3).map((s:any,i:number)=>(
                      <div key={i} style={{display:'flex',gap:8,padding:'7px 0',borderBottom:i<2?`1px solid ${T.border}`:'none'}}>
                        <span style={{flexShrink:0,fontSize:10,fontWeight:700,color:s.priority==='high'?T.red:s.priority==='medium'?T.amber:T.muted,
                          background:(s.priority==='high'?T.red:s.priority==='medium'?T.amber:T.muted)+'15',
                          padding:'1px 6px',borderRadius:10,alignSelf:'flex-start'}}>{s.priority}</span>
                        <span style={{fontSize:11,color:T.muted,lineHeight:1.5}}>{s.action}</span>
                      </div>
                    ))}
                  </div>
                )}

                <button onClick={()=>{resetJd();setJdText('');}}
                  style={{fontSize:11,fontWeight:700,color:T.blue,background:'none',border:'none',cursor:'pointer',padding:0}}>
                  ← Analyze another JD
                </button>
              </>
            );
          })()}
        </>
      )}
    </Pad>
  );
}

// ─── Analytics Panel ──────────────────────────────────────────────────────────

function AnalyticsPanel(){
  const [tab, setTab] = useState<'careers'|'skills'|'industry'>('careers');
  const [loaded, setLoaded] = useState(false);
  const {data, isLoading} = useAnalyticsOverview(loaded);

  const tabStyle=(active:boolean)=>({
    fontSize:10,fontWeight:800,textTransform:'uppercase' as const,letterSpacing:'0.1em',
    padding:'4px 10px',borderRadius:20,cursor:'pointer',border:'none',
    background:active?T.purple:'transparent',color:active?'#fff':T.muted,
    transition:'background 0.15s,color 0.15s',
  });

  const riskColor=(r:number)=>r<=20?T.green:r<=45?T.amber:T.red;
  const growthColor=(g:number)=>g>=0.12?T.green:g>=0.07?T.amber:T.muted;

  return(
    <Pad>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:14}}>
        <SlLabel>Market Intelligence</SlLabel>
        <div style={{display:'flex',alignItems:'center',gap:10}}>
          <div style={{display:'flex',gap:3,background:T.s2,borderRadius:24,padding:'3px 4px'}}>
            <button style={tabStyle(tab==='careers')}  onClick={()=>{setTab('careers'); setLoaded(true);}}>Careers</button>
            <button style={tabStyle(tab==='skills')}   onClick={()=>{setTab('skills');  setLoaded(true);}}>Skills</button>
            <button style={tabStyle(tab==='industry')} onClick={()=>{setTab('industry');setLoaded(true);}}>Industry</button>
          </div>
          <Link href="/analytics" style={{fontSize:11,color:T.purple,textDecoration:'none',fontWeight:700}}>Full analytics →</Link>
        </div>
      </div>

      {!loaded&&(
        <div style={{textAlign:'center',padding:'20px 0'}}>
          <button onClick={()=>setLoaded(true)}
            style={{padding:'9px 22px',background:T.purple,color:'#fff',border:'none',borderRadius:9,fontWeight:700,fontSize:13,cursor:'pointer'}}>
            Load Market Intelligence
          </button>
          <div style={{fontSize:11,color:T.dim,marginTop:8}}>Global career demand, skill trends, and industry signals</div>
        </div>
      )}

      {loaded&&isLoading&&(
        <div style={{display:'flex',flexDirection:'column',gap:8}}>{[1,2,3,4,5].map(i=><Skel key={i} h={32}/>)}</div>
      )}

      {/* ── Careers tab ── */}
      {loaded&&!isLoading&&tab==='careers'&&data&&(
        <>
          <div style={{display:'grid',gridTemplateColumns:'2fr 60px 70px 60px 80px',gap:6,padding:'5px 8px',borderBottom:`1px solid ${T.border}`,marginBottom:4}}>
            {['Career','Demand','Salary 10yr','Risk','Growth'].map(h=>(
              <span key={h} style={{fontSize:9,fontWeight:800,textTransform:'uppercase',letterSpacing:'0.1em',color:T.dim}}>{h}</span>
            ))}
          </div>
          {data.careerDemand.careers.slice(0,6).map((c,i)=>(
            <div key={c.career} style={{display:'grid',gridTemplateColumns:'2fr 60px 70px 60px 80px',gap:6,
              padding:'8px',background:i%2===0?'transparent':T.s2+'80',borderRadius:6,alignItems:'center'}}>
              <span style={{fontSize:12,fontWeight:600,color:T.text}}>{c.career}</span>
              <span style={{fontSize:12,fontWeight:700,color:T.purple}}>{c.demand_index}</span>
              <span style={{fontSize:11,color:T.green}}>₹{(c.salary_10yr/100000).toFixed(0)}L</span>
              <span style={{fontSize:10,color:riskColor(c.automation_risk)}}>{c.automation_risk}%</span>
              <span style={{fontSize:10,fontWeight:700,color:growthColor(c.salary_growth)}}>
                +{(c.salary_growth*100).toFixed(0)}%/yr
              </span>
            </div>
          ))}
        </>
      )}

      {/* ── Skills tab ── */}
      {loaded&&!isLoading&&tab==='skills'&&data&&(
        <>
          <div style={{display:'grid',gridTemplateColumns:'2fr 70px 70px 1fr',gap:6,padding:'5px 8px',borderBottom:`1px solid ${T.border}`,marginBottom:4}}>
            {['Skill','Demand','Growth','Industries'].map(h=>(
              <span key={h} style={{fontSize:9,fontWeight:800,textTransform:'uppercase',letterSpacing:'0.1em',color:T.dim}}>{h}</span>
            ))}
          </div>
          {data.skillDemand.skills.slice(0,6).map((s,i)=>(
            <div key={s.skill} style={{display:'grid',gridTemplateColumns:'2fr 70px 70px 1fr',gap:6,
              padding:'8px',background:i%2===0?'transparent':T.s2+'80',borderRadius:6,alignItems:'center'}}>
              <span style={{fontSize:12,fontWeight:600,color:T.text}}>{s.skill}</span>
              <span style={{fontSize:12,fontWeight:700,color:T.cyan}}>{s.demand_index}</span>
              <span style={{fontSize:11,color:growthColor(s.growth_rate/100)}}>+{s.growth_rate.toFixed(0)}%</span>
              <div style={{display:'flex',gap:3,flexWrap:'wrap'}}>
                {s.industries.slice(0,2).map(ind=><SkTag key={ind} label={ind}/>)}
              </div>
            </div>
          ))}
        </>
      )}

      {/* ── Industry tab ── */}
      {loaded&&!isLoading&&tab==='industry'&&data&&(
        <>
          {data.industryTrends.industries.slice(0,5).map((ind,i)=>{
            const pct=ind.growth_signal;
            const c=pct>=80?T.green:pct>=60?T.cyan:pct>=40?T.amber:T.muted;
            return(
              <div key={ind.industry} style={{marginBottom:10}}>
                <div style={{display:'flex',justifyContent:'space-between',marginBottom:4}}>
                  <span style={{fontSize:12,fontWeight:600,color:T.text}}>{ind.industry}</span>
                  <span style={{fontSize:10,fontWeight:700,color:c}}>{ind.growth_label} · +{ind.yoy}% YoY</span>
                </div>
                <div style={{height:6,borderRadius:3,background:T.s2,overflow:'hidden'}}>
                  <div style={{height:'100%',width:`${pct}%`,borderRadius:3,background:c,transition:'width 0.8s ease'}}/>
                </div>
                <div style={{fontSize:10,color:T.dim,marginTop:3}}>{ind.description}</div>
              </div>
            );
          })}
        </>
      )}
    </Pad>
  );
}

// ─── Personalization Panel ─────────────────────────────────────────────────────

function PersonalizationPanel(){
  const {data, isLoading} = usePersonalizedRecommendations(6);
  const {trackEvent}      = useTrackBehaviorEvent();
  const roles             = data?.personalized_roles ?? [];
  const strength          = data?.signal_strength ?? 'none';
  const strengthColor     = strength==='very_high'?T.purple:strength==='high'?T.green:strength==='medium'?T.blue:strength==='low'?T.amber:T.muted;

  const handleRoleClick = (role: string) => {
    trackEvent({event_type:'role_explore', entity_type:'role', entity_id:role.toLowerCase().replace(/\s+/g,'_'), entity_label:role});
  };

  return(
    <Pad>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:10}}>
        <SlLabel>Personalised For You</SlLabel>
        <div style={{display:'flex',alignItems:'center',gap:8}}>
          <span style={{fontSize:9,fontWeight:700,color:strengthColor,background:strengthColor+'18',padding:'2px 7px',borderRadius:10}}>
            {getSignalStrengthLabel(strength)}
          </span>
          <Link href="/personalized-careers" style={{fontSize:11,color:T.blue,textDecoration:'none',fontWeight:700}}>View all →</Link>
        </div>
      </div>

      {isLoading&&<div style={{display:'flex',flexDirection:'column',gap:7}}>{[1,2,3].map(i=><Skel key={i} h={48}/>)}</div>}

      {!isLoading&&roles.length===0&&(
        <EmptySlate icon="✦" text="Browse jobs and careers to build your personalisation profile." cta="Explore careers →" href="/jobs"/>
      )}

      {!isLoading&&roles.length>0&&(
        <>
          <p style={{fontSize:11,color:T.dim,marginBottom:10,lineHeight:1.5}}>
            Based on {data?.total_events_analyzed??0} behaviour signals · {Math.round((data?.profile_completeness??0)*100)}% profile complete
          </p>
          <div style={{display:'flex',flexDirection:'column',gap:6}}>
            {roles.slice(0,5).map((r,i)=>{
              const scoreColor=r.score>=0.8?T.green:r.score>=0.6?T.cyan:r.score>=0.4?T.amber:T.muted;
              return(
                <div key={i} onClick={()=>handleRoleClick(r.role)}
                  style={{display:'flex',alignItems:'center',gap:10,padding:'9px 12px',
                    background:T.s1,border:`1px solid ${T.border}`,borderRadius:9,cursor:'pointer',
                    transition:'border-color 0.15s'}}
                  onMouseEnter={e=>(e.currentTarget.style.borderColor=scoreColor+'60')}
                  onMouseLeave={e=>(e.currentTarget.style.borderColor=T.border)}>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontSize:12,fontWeight:700,color:T.text,marginBottom:3}}>{r.role}</div>
                    <div style={{fontSize:10,color:T.muted,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{r.match_reason}</div>
                  </div>
                  <div style={{textAlign:'right',flexShrink:0}}>
                    <div style={{fontSize:14,fontWeight:800,color:scoreColor}}>{Math.round(r.score*100)}%</div>
                    {r.average_salary&&<div style={{fontSize:9,color:T.muted}}>{r.average_salary}</div>}
                  </div>
                </div>
              );
            })}
          </div>
          {/* Breakdown bar */}
          {data?.score_breakdown&&(
            <div style={{marginTop:12,display:'flex',gap:6}}>
              {[
                {l:'Behaviour',v:Math.round(data.score_breakdown.behavior_signals*100),c:T.blue},
                {l:'Skills',   v:Math.round(data.score_breakdown.skill_alignment*100),  c:T.green},
                {l:'Opps',     v:Math.round(data.score_breakdown.opportunity_score*100),c:T.purple},
                {l:'Market',   v:Math.round(data.score_breakdown.market_demand*100),    c:T.amber},
              ].map(x=>(
                <div key={x.l} style={{flex:1,textAlign:'center'}}>
                  <div style={{fontSize:11,fontWeight:800,color:x.c}}>{x.v}%</div>
                  <div style={{height:3,borderRadius:2,background:x.c+'40',marginTop:3}}>
                    <div style={{height:'100%',width:`${x.v}%`,background:x.c,borderRadius:2}}/>
                  </div>
                  <div style={{fontSize:8,color:T.dim,marginTop:2}}>{x.l}</div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </Pad>
  );
}

// ─── Salary Panel ─────────────────────────────────────────────────────────────

interface SalaryPanelProps {
  role:           string | null | undefined;
  experienceYears: number;
  chiSalary:      import('@/types/careerHealth').SalaryBenchmark | null | undefined;
  onTrack?: (event_type: string, entity_type: string, entity_id: string, entity_label: string) => void;
}

function SalaryPanel({role, experienceYears, chiSalary, onTrack}: SalaryPanelProps){
  const [tab, setTab] = useState<'benchmark'|'compare'>('benchmark');

  // Benchmark — POST /salary/intelligence (falls back to /salary/benchmark)
  const salaryInput = role ? {roleId: role, experienceYears} : null;
  const {data:bench, isLoading:benchLoading} = useSalaryIntelligence(salaryInput);

  // Compare — GET /salary/compare — uses career-path adjacent roles derived from detectedProfession
  // Default comparison: same role at different experience levels (junior/mid/senior proxy)
  const compareRoles = role
    ? [role, `${role}_senior`, `${role}_lead`].slice(0, 3)
    : [];
  const {data:compare, isLoading:compareLoading} = useSalaryCompare({
    roleIds: compareRoles,
    experienceYears,
    enabled: tab==='compare' && compareRoles.length >= 2,
  });

  const tabStyle=(active:boolean)=>({
    fontSize:10,fontWeight:800,textTransform:'uppercase' as const,letterSpacing:'0.1em',
    padding:'4px 12px',borderRadius:20,cursor:'pointer',border:'none',
    background:active?T.amber:'transparent',color:active?'#07090f':T.muted,
    transition:'background 0.15s,color 0.15s',
  });

  // Format INR lakhs
  const toLakh=(n:number)=>`₹${(n/100000).toFixed(1)}L`;
  const pctColor=(p?:number|null)=>!p?T.muted:p>=70?T.green:p>=40?T.amber:T.red;

  // Use real data from salary intelligence, fallback to CHI-derived benchmark
  const median  = bench?.marketMedian ?? (chiSalary?.marketMedian ? chiSalary.marketMedian/100000 : null);
  const p25     = bench?.marketP25    ?? (chiSalary?.marketP25    ? chiSalary.marketP25/100000    : null);
  const p75     = bench?.marketP75    ?? (chiSalary?.marketP75    ? chiSalary.marketP75/100000    : null);
  const userEst = bench?.userSalary   ?? bench?.currentSalary ?? chiSalary?.yourEstimate ?? null;
  const pct     = bench?.percentile   ?? chiSalary?.percentile ?? null;
  const gap     = bench?.salaryGap    ?? (median&&userEst ? median-userEst : null);

  return(
    <Pad>
      {/* Header + tabs */}
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:14}}>
        <SlLabel>Salary Intelligence</SlLabel>
        <div style={{display:'flex',alignItems:'center',gap:12}}>
          <div style={{display:'flex',gap:4,background:T.s2,borderRadius:24,padding:'3px 4px'}}>
            <button style={tabStyle(tab==='benchmark')} onClick={()=>{setTab('benchmark');onTrack?.('salary_check','module','salary_benchmark','Salary Benchmark');}}>My Benchmark</button>
            <button style={tabStyle(tab==='compare')}   onClick={()=>setTab('compare')}>Compare Roles</button>
          </div>
          <Link href="/career-health" style={{fontSize:11,color:T.amber,textDecoration:'none',fontWeight:700}}>Full report →</Link>
        </div>
      </div>

      {/* ── TAB 1: My Benchmark ── */}
      {tab==='benchmark'&&(
        <>
          {!role&&<EmptySlate icon="💰" text="Set your target role to get salary intelligence." cta="Update profile →" href="/profile"/>}
          {role&&benchLoading&&<div style={{display:'flex',flexDirection:'column',gap:8}}>{[1,2,3].map(i=><Skel key={i} h={30}/>)}</div>}
          {role&&!benchLoading&&!median&&<EmptySlate icon="💰" text="Salary data not yet available for this role." cta="Career health →" href="/career-health"/>}
          {role&&!benchLoading&&median&&(
            <>
              <div style={{fontSize:11,color:T.muted,marginBottom:14}}>
                Role: <strong style={{color:T.text}}>{role}</strong> · {experienceYears}yr exp · INR market
              </div>

              {/* Salary band bar */}
              <div style={{marginBottom:18}}>
                <div style={{display:'flex',justifyContent:'space-between',fontSize:10,color:T.muted,marginBottom:6}}>
                  <span>P25 {p25?toLakh(p25):'—'}</span>
                  <span style={{fontWeight:700,color:T.amber}}>Median {toLakh(median)}</span>
                  <span>P75 {p75?toLakh(p75):'—'}</span>
                </div>
                {/* Visual band */}
                {p25&&p75&&(()=>{
                  const range=p75-p25||1;
                  const medPct=((median-p25)/range)*100;
                  const userPct=userEst?((userEst-p25)/range)*100:null;
                  return(
                    <div style={{position:'relative',height:12,borderRadius:6,background:T.s2,overflow:'visible'}}>
                      {/* Band fill */}
                      <div style={{position:'absolute',left:0,right:0,top:0,bottom:0,borderRadius:6,background:`linear-gradient(90deg,${T.amber}30,${T.green}40)`}}/>
                      {/* Median marker */}
                      <div style={{position:'absolute',top:-4,bottom:-4,width:2,borderRadius:2,background:T.amber,left:`${medPct}%`,transform:'translateX(-50%)'}}/>
                      {/* User position */}
                      {userPct!=null&&(
                        <div style={{position:'absolute',top:-6,width:14,height:24,borderRadius:4,background:T.blue,left:`${Math.max(0,Math.min(98,userPct))}%`,transform:'translateX(-50%)',display:'flex',alignItems:'center',justifyContent:'center'}}>
                          <span style={{fontSize:7,color:'#fff',fontWeight:800}}>YOU</span>
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>

              {/* Stats row */}
              <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:8,marginBottom:14}}>
                {[
                  {l:'Market Median', v:toLakh(median),                  c:T.amber},
                  {l:'Your Position', v:pct!=null?`${pct}th %ile`:'—',   c:pctColor(pct)},
                  {l:'Salary Gap',    v:gap?`${gap>0?'+':''
                  }${toLakh(gap)}`:'—',                                   c:gap&&gap<0?T.red:T.green},
                  {l:'Experience',    v:`${experienceYears}yr`,           c:T.muted},
                ].map(x=>(
                  <div key={x.l} style={{background:T.s1,border:`1px solid ${T.border}`,borderRadius:8,padding:'8px 10px',textAlign:'center'}}>
                    <div style={{fontSize:15,fontWeight:800,color:x.c}}>{x.v}</div>
                    <div style={{fontSize:9,color:T.muted,textTransform:'uppercase',letterSpacing:'0.06em',marginTop:2}}>{x.l}</div>
                  </div>
                ))}
              </div>

              {/* Insights */}
              {bench?.insights&&bench.insights.length>0&&(
                <div style={{borderTop:`1px solid ${T.border}`,paddingTop:10}}>
                  {bench.insights.slice(0,2).map((ins:string,i:number)=>(
                    <div key={i} style={{fontSize:11,color:T.muted,lineHeight:1.55,marginBottom:4}}>
                      💡 {ins}
                    </div>
                  ))}
                </div>
              )}

              {/* Gap CTA */}
              {gap&&gap<0&&(
                <div style={{marginTop:10,padding:'10px 12px',background:T.amber+'10',border:`1px solid ${T.amber}25`,borderRadius:8,fontSize:11,color:T.muted,lineHeight:1.5}}>
                  You may be <strong style={{color:T.amber}}>{toLakh(Math.abs(gap))}</strong> below the market median.
                  Closing skill gaps and targeting this benchmark could improve your earning potential.
                </div>
              )}
            </>
          )}
        </>
      )}

      {/* ── TAB 2: Compare Roles ── */}
      {tab==='compare'&&(
        <>
          {!role&&<EmptySlate icon="💰" text="Set your target role to compare salary bands." cta="Update profile →" href="/profile"/>}
          {role&&compareLoading&&<div style={{display:'flex',flexDirection:'column',gap:8}}>{[1,2,3].map(i=><Skel key={i} h={44}/>)}</div>}
          {role&&!compareLoading&&(!compare||compare.comparison.length===0)&&(
            <EmptySlate icon="💰" text="No salary comparison data available for this role yet." cta="Career health →" href="/career-health"/>
          )}
          {role&&!compareLoading&&compare&&compare.comparison.length>0&&(
            <>
              <p style={{fontSize:11,color:T.muted,marginBottom:12,lineHeight:1.5}}>
                Comparing <strong style={{color:T.text}}>{compare.comparison.length} roles</strong> at {compare.experienceYearsUsed}yr experience.
                {compare.meta.salarySpread>0&&(
                  <> Spread: <strong style={{color:T.amber}}>{toLakh(compare.meta.salarySpread)}</strong></>
                )}
              </p>

              {/* Table header */}
              <div style={{display:'grid',gridTemplateColumns:'2fr 80px 80px 80px 90px',gap:8,padding:'5px 8px',borderBottom:`1px solid ${T.border}`,marginBottom:4}}>
                {['Role','Min','Median','Max','Level'].map(h=>(
                  <span key={h} style={{fontSize:9,fontWeight:800,textTransform:'uppercase',letterSpacing:'0.1em',color:T.dim}}>{h}</span>
                ))}
              </div>

              {compare.comparison.map((entry,i)=>{
                const isHighest = entry.role.title===compare.meta.highestPayingRole;
                return(
                  <div key={entry.roleId} style={{display:'grid',gridTemplateColumns:'2fr 80px 80px 80px 90px',gap:8,
                    padding:'10px 8px',background:i%2===0?'transparent':T.s2+'80',
                    borderRadius:6,alignItems:'center',
                    border:isHighest?`1px solid ${T.amber}30`:'1px solid transparent'}}>

                    <div>
                      <div style={{fontSize:12,fontWeight:700,color:isHighest?T.amber:T.text,display:'flex',alignItems:'center',gap:6}}>
                        {entry.role.title}
                        {isHighest&&<span style={{fontSize:9,color:T.amber}}>★ highest</span>}
                      </div>
                      <div style={{fontSize:10,color:T.muted}}>{entry.role.jobFamily}</div>
                    </div>
                    <span style={{fontSize:11,color:T.muted}}>{toLakh(entry.salaryRange.min)}</span>
                    <span style={{fontSize:13,fontWeight:800,color:T.amber}}>{toLakh(entry.salaryRange.median)}</span>
                    <span style={{fontSize:11,color:T.muted}}>{toLakh(entry.salaryRange.max)}</span>
                    <span style={{fontSize:10,color:T.muted,background:T.s2,padding:'2px 7px',borderRadius:10,textAlign:'center'}}>
                      {entry.levelLabel||entry.recommendedLevel}
                    </span>
                  </div>
                );
              })}

              {compare.unavailableRoles.length>0&&(
                <div style={{marginTop:8,fontSize:10,color:T.dim}}>
                  {compare.unavailableRoles.length} role{compare.unavailableRoles.length>1?'s':''} unavailable: {compare.unavailableRoles.join(', ')}
                </div>
              )}
            </>
          )}
        </>
      )}
    </Pad>
  );
}

// ─── Opportunity Radar ────────────────────────────────────────────────────────
function OppRadarPanel({onTrack}:{onTrack?:(event_type:string,entity_type:string,entity_id:string,entity_label:string)=>void}={}){
  const {data:prof}=useProfile();
  const user=prof?.user;
  const role=(user as any)?.targetRole??(user as any)?.detectedProfession;
  const {data:oppData,isLoading}=useCareerOpportunities(role?{role,skills:[],experience_years:(user as any)?.experienceYears??0,top_n:6}:null);
  const opps=oppData?.opportunities??[];
  return(
    <Pad>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:14}}>
        <SlLabel>AI Career Opportunity Radar</SlLabel>
        <Link href="/opportunities" style={{fontSize:11,color:T.purple,textDecoration:'none',fontWeight:700}}>Explore all →</Link>
      </div>
      {!role&&!isLoading&&<EmptySlate icon="◉" text="Set your target role in profile to activate the radar." cta="Update profile →" href="/profile"/>}
      {isLoading&&<div style={{display:'flex',flexDirection:'column',gap:8}}>{[1,2,3,4].map(i=><Skel key={i} h={44}/>)}</div>}
      {!isLoading&&opps.length>0&&(
        <>
          <div style={{display:'grid',gridTemplateColumns:'2fr 70px 90px 1fr',gap:8,padding:'6px 10px',borderBottom:`1px solid ${T.border}`}}>
            {['Role','Growth','Job Posts','Key Skills'].map(h=><span key={h} style={{fontSize:9,fontWeight:800,textTransform:'uppercase',letterSpacing:'0.1em',color:T.dim}}>{h}</span>)}
          </div>
          {opps.slice(0,6).map((opp:any,i:number)=>{
            const sc=Math.round(opp.match_score);
            const color=sc>=70?T.green:sc>=45?T.amber:T.purple;
            return(
              <div key={i} onClick={()=>onTrack?.('opportunity_click','opportunity',opp.role?.toLowerCase().replace(/\s+/g,'_')||`opp_${i}`,opp.role||'Opportunity')}
                style={{display:'grid',gridTemplateColumns:'2fr 70px 90px 1fr',gap:8,padding:'10px',background:i%2===0?'transparent':T.s2+'80',borderRadius:8,alignItems:'center',cursor:'pointer'}}>
                <div>
                  <div style={{fontSize:13,fontWeight:600,color:T.text}}>{opp.role}</div>
                  {opp.domain&&<div style={{fontSize:10,color:T.muted,marginTop:1}}>{opp.domain}</div>}
                </div>
                <span style={{fontSize:11,fontWeight:700,padding:'2px 8px',borderRadius:20,color,background:color+'18',border:`1px solid ${color}28`}}>{sc}</span>
                <div style={{fontSize:12,fontWeight:600,color:T.text}}>{opp.job_postings!=null?`${opp.job_postings}`:'—'}</div>
                <div style={{display:'flex',gap:4,flexWrap:'wrap'}}>
                  {(opp.top_skills??[]).slice(0,2).map((sk:string)=><SkTag key={sk} label={sk}/>)}
                </div>
              </div>
            );
          })}
          {oppData?.insights?.[0]&&<div style={{marginTop:12,padding:'10px 12px',background:T.purple+'10',border:`1px solid ${T.purple}22`,borderRadius:8,fontSize:12,color:T.muted}}>✦ {oppData.insights[0]}</div>}
        </>
      )}
    </Pad>
  );
}

// ─── Digital Twin ─────────────────────────────────────────────────────────────
function TwinPanel(){
  const [tab, setTab] = useState<'full'|'quick'>('full');
  const {simulation,loading,run}=useCareerSimulation();
  const {data:prof}=useProfile();
  const user=prof?.user;
  const role=(user as any)?.targetRole??(user as any)?.detectedProfession;
  const expYears=(user as any)?.experienceYears??0;
  const skills=(user as any)?.skills?.map((s:any)=>typeof s==='string'?s:s.name).filter(Boolean)??[];

  useEffect(()=>{if(!role||simulation)return;run({userProfile:{role,skills:[],experience_years:expYears}});},[role]);

  // Quick Preview — GET /career/future-paths, fires immediately, no AI cost
  const {data:quickPaths,isLoading:quickLoading}=useFuturePaths({
    role, skills, experience_years:expYears, enabled:tab==='quick'&&!!role,
  });

  const paths=simulation?.career_paths??[];
  const best=paths[0];
  const lineData=best?[{yr:'Now',salary:Math.round(best.salary_lakhs*0.55)},...best.roles_detail.map((r:any,i:number)=>({yr:`Yr ${best.roles_detail.slice(0,i+1).reduce((s:number,x:any)=>s+(x.years_to_reach??0),0).toFixed(0)}`,salary:r.salary_lakhs}))]:[];

  const tabStyle=(active:boolean)=>({
    fontSize:10,fontWeight:800,textTransform:'uppercase' as const,letterSpacing:'0.1em',
    padding:'4px 12px',borderRadius:20,cursor:'pointer',border:'none',
    background:active?T.cyan:'transparent',color:active?'#07090f':T.muted,
    transition:'background 0.15s,color 0.15s',
  });

  const riskColor=(r:string)=>r==='Low'?T.green:r==='Medium'?T.amber:T.red;

  return(
    <Pad>
      {/* Header + tabs */}
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:14}}>
        <SlLabel>Career Digital Twin</SlLabel>
        <div style={{display:'flex',alignItems:'center',gap:12}}>
          <div style={{display:'flex',gap:4,background:T.s2,borderRadius:24,padding:'3px 4px'}}>
            <button style={tabStyle(tab==='full')}  onClick={()=>setTab('full')}>Full Simulation</button>
            <button style={tabStyle(tab==='quick')} onClick={()=>setTab('quick')}>Quick Preview</button>
          </div>
          <Link href="/career-simulator" style={{fontSize:11,color:T.cyan,textDecoration:'none',fontWeight:700}}>Full sim →</Link>
        </div>
      </div>

      {/* ── TAB 1: Full Simulation (existing, unchanged) ── */}
      {tab==='full'&&(
        <>
          {loading&&<div style={{display:'flex',flexDirection:'column',gap:8}}>{[1,2,3].map(i=><Skel key={i} h={20}/>)}</div>}
          {!loading&&!best&&!role&&<EmptySlate icon="⟳" text="Set your target role to run a Digital Twin simulation." cta="Update profile →" href="/profile"/>}
          {!loading&&best&&(
            <>
              <div style={{display:'flex',flexDirection:'column',gap:8,marginBottom:18}}>
                {paths.slice(0,3).map((p:any,pi:number)=>(
                  <div key={p.strategy_id} style={{background:T.s1,border:`1px solid ${pi===0?T.cyan+'33':T.border}`,borderRadius:10,padding:'12px 16px',display:'flex',alignItems:'center',gap:12,flexWrap:'wrap'}}>
                    <div style={{flex:1}}>
                      <div style={{fontSize:10,fontWeight:700,color:T.cyan,textTransform:'uppercase',letterSpacing:'0.1em',marginBottom:5}}>{p.strategy_label}</div>
                      <div style={{display:'flex',alignItems:'center',gap:4,flexWrap:'wrap',fontSize:12}}>
                        {p.path.map((r:string,ri:number)=>(
                          <React.Fragment key={ri}>
                            {ri>0&&<span style={{color:T.dim}}>→</span>}
                            <span style={{color:ri===p.path.length-1?T.text:T.muted,fontWeight:ri===p.path.length-1?700:400}}>{r}</span>
                          </React.Fragment>
                        ))}
                      </div>
                    </div>
                    <div style={{textAlign:'right',flexShrink:0}}>
                      <div style={{fontSize:16,fontWeight:800,color:T.green}}>{p.salary_projection}</div>
                      <div style={{fontSize:10,color:T.muted}}>Growth: <span style={{color:T.amber,fontWeight:700}}>{p.growth_score}</span></div>
                    </div>
                  </div>
                ))}
              </div>
              {lineData.length>1&&(
                <>
                  <div style={{fontSize:10,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.1em',color:T.muted,marginBottom:8}}>Salary Projection (Best Path)</div>
                  <ResponsiveContainer width="100%" height={130}>
                    <LineChart data={lineData} margin={{left:-20,right:8,top:4,bottom:0}}>
                      <CartesianGrid strokeDasharray="3 3" stroke={T.dim} vertical={false}/>
                      <XAxis dataKey="yr" tick={{fill:T.muted,fontSize:10}} axisLine={false} tickLine={false}/>
                      <YAxis tick={{fill:T.muted,fontSize:10}} axisLine={false} tickLine={false} unit="L"/>
                      <Tooltip contentStyle={{background:'#131b28',border:`1px solid ${T.border}`,borderRadius:8,fontSize:12,color:T.text}} formatter={(v)=>[`₹${v}L`,'Salary'] as [string,string]}/>
                      <Line type="monotone" dataKey="salary" stroke={T.cyan} strokeWidth={2.5} dot={{fill:T.cyan,r:4,strokeWidth:0}} activeDot={{r:6}}/>
                    </LineChart>
                  </ResponsiveContainer>
                </>
              )}
            </>
          )}
        </>
      )}

      {/* ── TAB 2: Quick Preview — GET /career/future-paths ── */}
      {tab==='quick'&&(
        <>
          {!role&&<EmptySlate icon="⟳" text="Set your target role to see quick future paths." cta="Update profile →" href="/profile"/>}
          {role&&quickLoading&&<div style={{display:'flex',flexDirection:'column',gap:8}}>{[1,2,3].map(i=><Skel key={i} h={50}/>)}</div>}
          {role&&!quickLoading&&(!quickPaths||quickPaths.length===0)&&(
            <EmptySlate icon="⟳" text="No path data available for this role yet." cta="Run full simulation →" href="/career-simulator"/>
          )}
          {role&&!quickLoading&&quickPaths&&quickPaths.length>0&&(
            <>
              <p style={{fontSize:11,color:T.muted,marginBottom:12,lineHeight:1.5}}>
                Instant path preview for <strong style={{color:T.cyan}}>{role}</strong> — no AI credits used.
                Switch to Full Simulation for detailed role breakdowns and salary charts.
              </p>

              {/* Table header */}
              <div style={{display:'grid',gridTemplateColumns:'2fr 100px 80px 70px 1fr',gap:8,padding:'5px 8px',borderBottom:`1px solid ${T.border}`,marginBottom:4}}>
                {['Path','Salary','Growth','Risk','Key Skills'].map(h=>(
                  <span key={h} style={{fontSize:9,fontWeight:800,textTransform:'uppercase',letterSpacing:'0.1em',color:T.dim}}>{h}</span>
                ))}
              </div>

              {quickPaths.slice(0,4).map((p:any,i:number)=>{
                const rc=riskColor(p.risk_level||'Medium');
                return(
                  <div key={i} style={{display:'grid',gridTemplateColumns:'2fr 100px 80px 70px 1fr',gap:8,
                    padding:'10px 8px',background:i%2===0?'transparent':T.s2+'80',borderRadius:6,alignItems:'center'}}>

                    {/* Path breadcrumb */}
                    <div>
                      <div style={{fontSize:9,fontWeight:700,color:T.cyan,textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:3}}>
                        {p.strategy||`Path ${i+1}`}
                      </div>
                      <div style={{display:'flex',alignItems:'center',gap:3,flexWrap:'wrap',fontSize:11}}>
                        {(p.path||[]).slice(0,3).map((r:string,ri:number)=>(
                          <React.Fragment key={ri}>
                            {ri>0&&<span style={{color:T.dim,fontSize:9}}>›</span>}
                            <span style={{color:ri===(p.path||[]).slice(0,3).length-1?T.text:T.muted,fontWeight:ri===(p.path||[]).slice(0,3).length-1?600:400}}>{r}</span>
                          </React.Fragment>
                        ))}
                        {(p.path||[]).length>3&&<span style={{color:T.dim,fontSize:10}}>+{p.path.length-3}</span>}
                      </div>
                    </div>

                    {/* Salary */}
                    <span style={{fontSize:13,fontWeight:800,color:T.green}}>{p.salary_projection||'—'}</span>

                    {/* Growth */}
                    <span style={{fontSize:12,fontWeight:700,color:T.amber}}>{p.growth_score??'—'}</span>

                    {/* Risk */}
                    <span style={{fontSize:10,fontWeight:700,color:rc,background:rc+'18',
                      padding:'2px 7px',borderRadius:12,textAlign:'center'}}>
                      {p.risk_level||'—'}
                    </span>

                    {/* Skills */}
                    <div style={{display:'flex',gap:3,flexWrap:'wrap'}}>
                      {(p.skills_required||[]).slice(0,2).map((sk:string)=>(
                        <SkTag key={sk} label={sk}/>
                      ))}
                    </div>
                  </div>
                );
              })}

              <div style={{marginTop:10,fontSize:10,color:T.dim}}>
                Quick Preview uses a lightweight GET — no AI. For role-by-role breakdowns and salary charts, use Full Simulation.
              </div>
            </>
          )}
        </>
      )}
    </Pad>
  );
}

// ─── Risk + Alerts Panel ─────────────────────────────────────────────────────

function RiskAndAlertsPanel({autoRisk,autoRiskData}:{
  autoRisk:     number|null;
  autoRiskData: import('@/types/careerHealth').AutomationRisk|null|undefined;
}){
  const [tab, setTab] = useState<'risk'|'alerts'>('risk');
  const {alerts, actions} = useAlertsFeed();

  // Load alerts when tab activates
  React.useEffect(()=>{ if(tab==='alerts') actions.load({limit:8}); },[tab]);

  const r      = autoRisk??0;
  const level  = autoRiskData?.level??(r>=65?'high':r>=35?'moderate':'low');
  const color  = level==='high'?T.red:level==='moderate'?T.amber:T.green;
  const label  = level==='high'?'High':level==='moderate'?'Moderate':'Low';
  const rec    = autoRiskData?.recommendation??(
    level==='high'?'Pivot urgently to data analysis, AI tooling, or people-management roles.':
    level==='moderate'?'Learning data analysis tools could reduce risk by an estimated 15–20%.':
    'Your profile is well-positioned for the future of work.'
  );
  const cx=70,cy=60,rv=48,arcLen=Math.PI*rv,filled=arcLen-(r/100)*arcLen;

  const alertList  = alerts.data?.alerts??[];
  const unread     = alerts.data?.unread_count??0;

  const alertTypeIcon = (t:string) =>
    t==='job_match'?'🎯':t==='skill_demand'?'⚡':t==='career_opportunity'?'🚀':
    t==='salary_trend'?'💰':t==='risk_warning'?'🛡️':'📊';

  const alertPriorityColor = (p:number) =>
    p<=2?T.red:p===3?T.amber:T.muted;

  const tabStyle=(active:boolean,c:string)=>({
    fontSize:10,fontWeight:800,textTransform:'uppercase' as const,letterSpacing:'0.1em',
    padding:'4px 10px',borderRadius:20,cursor:'pointer',border:'none',
    background:active?c:'transparent',color:active?'#07090f':T.muted,
    transition:'background 0.15s,color 0.15s',
  });

  return(
    <Pad style={{display:'flex',flexDirection:'column',gap:10,height:'100%'}}>
      {/* Header + tabs */}
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
        <SlLabel>{tab==='risk'?'Automation Risk':'Career Alerts'}</SlLabel>
        <div style={{display:'flex',alignItems:'center',gap:8}}>
          {tab==='alerts'&&unread>0&&(
            <button onClick={()=>actions.markRead()}
              style={{fontSize:9,fontWeight:700,color:T.muted,background:'none',border:'none',cursor:'pointer',padding:0}}>
              Mark all read
            </button>
          )}
          <div style={{display:'flex',gap:3,background:T.s2,borderRadius:24,padding:'3px 4px'}}>
            <button style={tabStyle(tab==='risk',color)} onClick={()=>setTab('risk')}>Risk</button>
            <button style={tabStyle(tab==='alerts',T.amber)} onClick={()=>setTab('alerts')}>
              Alerts{unread>0?` (${unread})`:''}
            </button>
          </div>
        </div>
      </div>

      {/* ── TAB 1: Automation Risk Gauge ── */}
      {tab==='risk'&&(
        <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:10,flex:1}}>
          <svg width={140} height={80} viewBox="0 0 140 80">
            <path d={`M ${cx-rv} ${cy} A ${rv} ${rv} 0 0 1 ${cx+rv} ${cy}`} fill="none" stroke={T.dim} strokeWidth={10} strokeLinecap="round"/>
            <path d={`M ${cx-rv} ${cy} A ${rv} ${rv} 0 0 1 ${cx+rv} ${cy}`} fill="none" stroke={color} strokeWidth={10}
              strokeLinecap="round" strokeDasharray={arcLen} strokeDashoffset={filled}
              style={{transition:'stroke-dashoffset 1.2s ease'}}/>
            <text x={cx} y={cy-4} textAnchor="middle" fontSize={22} fontWeight={800} fill={color}>{r}%</text>
            <text x={cx} y={cy+14} textAnchor="middle" fontSize={10} fill={T.muted}>{label} Risk</text>
          </svg>

          {autoRiskData?.factors&&(
            <div style={{display:'flex',gap:8,width:'100%',justifyContent:'center'}}>
              {[
                {l:'Skills',  v:autoRiskData.factors.skillVelocity,   c:T.blue},
                {l:'Market',  v:autoRiskData.factors.marketAlignment,  c:T.purple},
                {l:'Exp.',    v:autoRiskData.factors.experienceDepth,  c:T.cyan},
              ].map(f=>(
                <div key={f.l} style={{textAlign:'center',flex:1}}>
                  <div style={{fontSize:13,fontWeight:800,color:f.c}}>{f.v}</div>
                  <div style={{fontSize:9,color:T.muted,textTransform:'uppercase',letterSpacing:'0.06em'}}>{f.l}</div>
                </div>
              ))}
            </div>
          )}

          <p style={{fontSize:11,color:T.muted,textAlign:'center',lineHeight:1.55,margin:0}}>{rec}</p>
          <Link href="/career-health" style={{fontSize:11,fontWeight:700,color:T.blue,textDecoration:'none'}}>Full risk report →</Link>
        </div>
      )}

      {/* ── TAB 2: Career Alerts ── */}
      {tab==='alerts'&&(
        <div style={{flex:1,display:'flex',flexDirection:'column',gap:6}}>
          {alerts.loading&&(
            <div style={{display:'flex',flexDirection:'column',gap:6}}>{[1,2,3].map(i=><Skel key={i} h={44}/>)}</div>
          )}

          {!alerts.loading&&alertList.length===0&&(
            <EmptySlate icon="🔔" text="No alerts yet. They appear as your career activity grows." cta="Career alerts →" href="/career-alerts"/>
          )}

          {!alerts.loading&&alertList.length>0&&(
            <>
              {alertList.slice(0,5).map(alert=>{
                const pColor = alertPriorityColor(alert.alert_priority);
                return(
                  <div key={alert.id}
                    onClick={()=>{ if(!alert.is_read) actions.markRead([alert.id]); }}
                    style={{display:'flex',gap:10,padding:'9px 11px',borderRadius:9,cursor:'pointer',
                      background:alert.is_read?'transparent':T.s2,
                      border:`1px solid ${alert.is_read?T.border:pColor+'30'}`,
                      transition:'background 0.15s'}}>
                    <span style={{fontSize:16,flexShrink:0,lineHeight:1.4}}>{alertTypeIcon(alert.alert_type)}</span>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{display:'flex',alignItems:'center',gap:6,marginBottom:3}}>
                        <span style={{fontSize:11,fontWeight:700,color:alert.is_read?T.muted:T.text,
                          overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{alert.title}</span>
                        {!alert.is_read&&(
                          <span style={{flexShrink:0,width:6,height:6,borderRadius:'50%',background:pColor}}/>
                        )}
                      </div>
                      <p style={{fontSize:10,color:T.muted,margin:0,lineHeight:1.4,
                        overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{alert.description}</p>
                    </div>
                  </div>
                );
              })}
              <Link href="/career-alerts"
                style={{fontSize:11,fontWeight:700,color:T.amber,textDecoration:'none',marginTop:4,textAlign:'center',display:'block'}}>
                {alertList.length>5?`View all ${alertList.length} alerts →`:'View all alerts →'}
              </Link>
            </>
          )}
        </div>
      )}
    </Pad>
  );
}

// ─── Progress ─────────────────────────────────────────────────────────────────
function ProgressPanel(){
  const {progress}=useProgressTracker();
  const {data:activity}=useUserActivity();
  const rep=progress.data;
  const history=rep?.history??[];
  const imp=rep?.improvement;
  const cur=rep?.current;
  const chartData=history.slice(-10).map((h:any)=>({label:new Date(h.recorded_at).toLocaleDateString('en-IN',{month:'short',day:'numeric'}),chi:h.career_health_index,match:h.job_match_score}));

  // Build 7-day activity heatmap from useUserActivity
  const last7=Array.from({length:7}).map((_,i)=>{
    const d=new Date(); d.setDate(d.getDate()-i);
    const key=d.toISOString().slice(0,10);
    const label=d.toLocaleDateString('en-IN',{weekday:'short'}).slice(0,2);
    return{key,label,active:activity?.dailyMap?.[key]??false};
  }).reverse();

  return(
    <Pad>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:14}}>
        <SlLabel>Career Progress Tracker</SlLabel>
        <Link href="/career-progress" style={{fontSize:11,color:T.amber,textDecoration:'none',fontWeight:700}}>Details →</Link>
      </div>

      {/* Streak + activity row */}
      {activity&&(
        <div style={{display:'flex',alignItems:'center',gap:14,marginBottom:14,padding:'10px 12px',background:T.s1,borderRadius:10,border:`1px solid ${T.border}`}}>
          <div style={{textAlign:'center',flexShrink:0}}>
            <div style={{fontSize:26,fontWeight:800,color:T.amber}}>{activity.streakDays}</div>
            <div style={{fontSize:9,color:T.muted,textTransform:'uppercase',letterSpacing:'0.06em'}}>Day Streak 🔥</div>
          </div>
          <div style={{flex:1}}>
            <div style={{fontSize:9,color:T.muted,textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:5}}>Last 7 Days</div>
            <div style={{display:'flex',gap:4}}>
              {last7.map(d=>(
                <div key={d.key} style={{flex:1,textAlign:'center'}}>
                  <div style={{width:'100%',height:18,borderRadius:4,background:d.active?T.amber:T.s2,border:`1px solid ${d.active?T.amber+'40':T.border}`,transition:'background 0.2s'}}/>
                  <div style={{fontSize:8,color:T.dim,marginTop:2}}>{d.label}</div>
                </div>
              ))}
            </div>
          </div>
          {(activity.weeklyActions?.length??0)>0&&(
            <div style={{flexShrink:0,textAlign:'center'}}>
              <div style={{fontSize:16,fontWeight:800,color:T.green}}>{activity.weeklyActions.length}</div>
              <div style={{fontSize:9,color:T.muted,textTransform:'uppercase',letterSpacing:'0.06em'}}>This Week</div>
            </div>
          )}
        </div>
      )}

      {cur&&(
        <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:10,marginBottom:16}}>
          {[{label:'CHI',val:cur.career_health_index,delta:imp?.career_health_index,color:T.green},{label:'Job Match',val:cur.job_match_score,delta:imp?.job_match_score,color:T.blue},{label:'Skills',val:cur.skills_count,delta:imp?.skills_count,color:T.amber}].map(m=>(
            <div key={m.label} style={{background:T.s1,borderRadius:10,padding:'10px 12px',border:`1px solid ${T.border}`,textAlign:'center'}}>
              <div style={{fontSize:22,fontWeight:800,color:m.color}}>{m.val}</div>
              <div style={{fontSize:9,color:T.muted,textTransform:'uppercase',letterSpacing:'0.06em'}}>{m.label}</div>
              {m.delta&&<div style={{fontSize:11,fontWeight:700,marginTop:2,color:m.delta.startsWith('+')?T.green:T.red}}>{m.delta}</div>}
            </div>
          ))}
        </div>
      )}
      {chartData.length>1?(
        <ResponsiveContainer width="100%" height={130}>
          <LineChart data={chartData} margin={{left:-24,right:4,top:4,bottom:0}}>
            <CartesianGrid strokeDasharray="3 3" stroke={T.dim} vertical={false}/>
            <XAxis dataKey="label" tick={{fill:T.muted,fontSize:9}} axisLine={false} tickLine={false}/>
            <YAxis domain={[0,100]} tick={{fill:T.muted,fontSize:9}} axisLine={false} tickLine={false}/>
            <Tooltip contentStyle={{background:'#131b28',border:`1px solid ${T.border}`,borderRadius:8,fontSize:11,color:T.text}} cursor={{stroke:T.dim}}/>
            <Line type="monotone" dataKey="chi" stroke={T.green} strokeWidth={2.5} dot={false} name="CHI"/>
            <Line type="monotone" dataKey="match" stroke={T.blue} strokeWidth={2.5} dot={false} name="Job Match"/>
          </LineChart>
        </ResponsiveContainer>
      ):<div style={{padding:'18px 0',textAlign:'center',fontSize:12,color:T.dim}}>Chart populates after multiple analyses</div>}
    </Pad>
  );
}


// ─── Copilot ──────────────────────────────────────────────────────────────────
const PROMPTS=['What career should I aim for?','What skills should I learn next?','Which jobs match my profile?','How can I increase my salary?','What is my biggest career risk?'];

interface ChatMsg{
  role:'user'|'ai';text:string;
  confidence?:number;signal_strength?:string;was_grounded?:boolean;
  data_sources?:string[];agents_used?:string[];intent_detected?:string;
  mode?:'rag'|'agent';
}

function CopilotPanel({topInsight, onTrack}:{topInsight?:DI; onTrack?:(event_type:string,entity_type:string,entity_id:string,entity_label:string)=>void}){
  const [msgs,setMsgs]=useState<ChatMsg[]>([]);
  const [input,setInput]=useState('');
  const [busy,setBusy]=useState(false);
  const [convId,setConvId]=useState<string|null>(null);
  const [mode,setMode]=useState<'rag'|'agent'>('rag');
  const scrollRef=useRef<HTMLDivElement>(null);
  useEffect(()=>{
    apiFetch<{message?:string}>('/copilot/welcome')
      .then(d=>{if(d?.message)setMsgs([{role:'ai',text:d.message,mode:'rag'}]);})
      .catch(()=>setMsgs([{role:'ai',text:"Hi! I'm your AI Career Copilot. Ask me anything about your career, skills, or opportunities.",mode:'rag'}]));
  },[]);
  useEffect(()=>{scrollRef.current?.scrollTo({top:scrollRef.current.scrollHeight,behavior:'smooth'});},[msgs,busy]);
  async function send(text:string){
    const t=text.trim();if(!t||busy)return;
    onTrack?.('advice_read','module',`copilot_${mode}`,`Copilot ${mode==='agent'?'Agent':'RAG'} Query`);
    setMsgs(m=>[...m,{role:'user',text:t}]);setInput('');setBusy(true);
    try{
      if(mode==='agent'){
        const d=await apiFetch<{ai_recommendation?:string;intent_detected?:string;agents_used?:string[];confidence?:number;skills_to_learn?:string[];opportunities?:any[];}>('/copilot/agent/ask',{method:'POST',body:JSON.stringify({message:t,session_id:convId})});
        let agentText=d?.ai_recommendation??'No response from agents.';
        if((d?.skills_to_learn?.length??0)>0){agentText+=`\n\nSkills to focus on: ${d!.skills_to_learn!.slice(0,3).join(', ')}`;}
        if((d?.opportunities?.length??0)>0){const top=(d!.opportunities![0] as any);agentText+=`\nTop opportunity: ${top.role||top.title||'—'}`;}
        setMsgs(m=>[...m,{role:'ai',text:agentText,mode:'agent',confidence:d?.confidence!=null?Math.round(d.confidence*100):undefined,agents_used:d?.agents_used,intent_detected:d?.intent_detected}]);
        if(d&&'session_id' in (d as any))setConvId((d as any).session_id);
      }else{
        const d=await apiFetch<{response?:string;conversation_id?:string;confidence?:number;signal_strength?:string;was_grounded?:boolean;data_sources?:string[];}>('/copilot/chat',{method:'POST',body:JSON.stringify({message:t,conversation_id:convId})});
        setMsgs(m=>[...m,{role:'ai',text:d?.response??'No response.',mode:'rag',confidence:d?.confidence!=null?Math.round(d.confidence*100):undefined,signal_strength:d?.signal_strength,was_grounded:d?.was_grounded,data_sources:d?.data_sources}]);
        if(d?.conversation_id)setConvId(d.conversation_id);
      }
    }catch{setMsgs(m=>[...m,{role:'ai',text:'Something went wrong. Please try again.',mode}]);}
    setBusy(false);
  }
  const signalColor=(s?:string)=>s==='high'?T.green:s==='medium'?T.amber:T.red;
  const modeTabStyle=(active:boolean)=>({fontSize:9,fontWeight:800,textTransform:'uppercase' as const,letterSpacing:'0.1em',padding:'3px 10px',borderRadius:20,cursor:'pointer',border:'none',background:active?T.pink:'transparent',color:active?'#fff':T.muted,transition:'background 0.15s,color 0.15s'});
  return(
    <Pad style={{display:'flex',flexDirection:'column',gap:10,height:'100%'}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
        <SlLabel>Career Copilot</SlLabel>
        <div style={{display:'flex',alignItems:'center',gap:8}}>
          <div style={{display:'flex',gap:3,background:T.s2,borderRadius:24,padding:'3px 4px'}}>
            <button style={modeTabStyle(mode==='rag')} onClick={()=>setMode('rag')}>RAG Chat</button>
            <button style={modeTabStyle(mode==='agent')} onClick={()=>setMode('agent')}>⚡ Agents</button>
          </div>
          <Link href="/advisor" style={{fontSize:11,color:T.pink,textDecoration:'none',fontWeight:700}}>Full chat →</Link>
        </div>
      </div>
      <div style={{fontSize:10,color:T.dim}}>{mode==='rag'?'🔍 RAG mode — grounded in your profile data':'⚡ Agent mode — 5 specialist agents in parallel'}</div>
      {topInsight&&(<div style={{background:T.pink+'10',border:`1px solid ${T.pink}25`,borderRadius:10,padding:'10px 14px',fontSize:12,color:T.muted,lineHeight:1.5}}><span style={{fontWeight:700,color:T.pink}}>✦ AI Insight: </span>{topInsight.body}</div>)}
      {msgs.length<=1&&(<div style={{display:'flex',flexWrap:'wrap',gap:6}}>{PROMPTS.map(p=>(<button key={p} onClick={()=>send(p)} style={{fontSize:11,padding:'5px 11px',background:T.s1,border:`1px solid ${T.borderB}`,borderRadius:20,color:T.text,cursor:'pointer'}}>{p}</button>))}</div>)}
      <div ref={scrollRef} style={{flex:1,overflowY:'auto',display:'flex',flexDirection:'column',gap:10,minHeight:160,maxHeight:260}}>
        {msgs.map((m,i)=>(
          <div key={i} style={{alignSelf:m.role==='user'?'flex-end':'flex-start',maxWidth:'90%',display:'flex',flexDirection:'column',gap:3}}>
            <div style={{padding:'9px 13px',borderRadius:m.role==='user'?'12px 12px 3px 12px':'12px 12px 12px 3px',background:m.role==='user'?T.blue+'20':T.s1,border:`1px solid ${m.role==='user'?T.blue+'30':T.border}`,fontSize:13,color:T.text,lineHeight:1.55}}>
              {m.role==='ai'&&<div style={{fontSize:9,fontWeight:700,color:m.mode==='agent'?T.amber:T.pink,textTransform:'uppercase',letterSpacing:'0.1em',marginBottom:5}}>{m.mode==='agent'?'⚡ Agents':'✦ Copilot'}</div>}
              {m.text}
            </div>
            {m.role==='ai'&&m.confidence!=null&&(
              <div style={{display:'flex',alignItems:'center',gap:6,flexWrap:'wrap',paddingLeft:4}}>
                <span style={{fontSize:9,color:signalColor(m.signal_strength),fontWeight:700}}>{m.confidence}% confidence{m.signal_strength&&` · ${m.signal_strength} signal`}{m.was_grounded===false&&' · ⚠ ungrounded'}</span>
                {m.mode==='agent'&&(m.agents_used?.length??0)>0&&<span style={{fontSize:9,color:T.dim}}>via {m.agents_used!.slice(0,3).join(', ')}{(m.agents_used!.length>3)?` +${m.agents_used!.length-3}`:''}</span>}
                {m.mode==='rag'&&(m.data_sources?.length??0)>0&&<span style={{fontSize:9,color:T.dim}}>sources: {m.data_sources!.slice(0,2).join(', ')}{(m.data_sources!.length>2)?` +${m.data_sources!.length-2}`:''}</span>}
                {m.intent_detected&&<span style={{fontSize:9,color:T.purple,background:T.purple+'15',padding:'1px 5px',borderRadius:8}}>{m.intent_detected}</span>}
              </div>
            )}
          </div>
        ))}
        {busy&&(<div style={{alignSelf:'flex-start',padding:'9px 14px',background:T.s1,borderRadius:'12px 12px 12px 3px',border:`1px solid ${T.border}`}}><div style={{display:'flex',gap:5}}>{[0,1,2].map(i=><div key={i} style={{width:5,height:5,borderRadius:'50%',background:mode==='agent'?T.amber:T.pink,animation:`bop 0.6s ${i*0.15}s infinite alternate`}}/>)}</div></div>)}
      </div>
      <form onSubmit={(e:FormEvent)=>{e.preventDefault();send(input);}} style={{display:'flex',gap:8}}>
        <input value={input} onChange={e=>setInput(e.target.value)} placeholder={mode==='agent'?'Ask the 5-agent system…':'Ask about your career, skills, or opportunities…'} disabled={busy} style={{flex:1,background:T.s1,border:`1px solid ${T.borderB}`,borderRadius:9,padding:'9px 13px',fontSize:13,color:T.text,outline:'none'}}/>
        <button type="submit" disabled={busy||!input.trim()} style={{padding:'9px 16px',background:mode==='agent'?T.amber:T.pink,color:'#fff',border:'none',borderRadius:9,fontWeight:700,fontSize:14,cursor:busy||!input.trim()?'not-allowed':'pointer',opacity:busy||!input.trim()?0.45:1}}>→</button>
      </form>
    </Pad>
  );
}
// ─── No-CV banner ─────────────────────────────────────────────────────────────
/**
 * CvStatusBanner
 * Single upload/status surface — shown ONCE in the page, at the top.
 * hasResume=true  → confirmation that CV is active (no false upload prompts)
 * hasResume=false → one clean upload CTA
 */
function CvStatusBanner({ hasResume, lastUploadDate }: {
  hasResume: boolean;
  lastUploadDate: string | null;
}) {
  const daysAgo = lastUploadDate
    ? Math.floor((Date.now() - new Date(lastUploadDate).getTime()) / 86_400_000)
    : null;

  if (hasResume) {
    return (
      <div style={{
        background: 'rgba(31,216,160,0.07)',
        border: `1px solid rgba(31,216,160,0.22)`,
        borderRadius: 14, padding: '14px 22px',
        display: 'flex', alignItems: 'center',
        justifyContent: 'space-between', gap: 16,
        flexWrap: 'wrap', marginBottom: 16,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 34, height: 34, borderRadius: 10, flexShrink: 0,
            background: 'rgba(31,216,160,0.15)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 16,
          }}>✅</div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: T.text }}>
              CV uploaded &amp; analysed — AI insights are active
            </div>
            <div style={{ fontSize: 12, color: T.muted, marginTop: 2 }}>
              {daysAgo === 0
                ? 'Updated today'
                : daysAgo === 1
                ? 'Updated yesterday'
                : daysAgo != null
                ? `Last updated ${daysAgo} days ago`
                : 'Career Health Index is calculating'}
            </div>
          </div>
        </div>
        <Link href="/resume" style={{
          padding: '7px 18px',
          background: 'rgba(31,216,160,0.1)',
          border: '1px solid rgba(31,216,160,0.3)',
          color: T.green, borderRadius: 8,
          fontWeight: 700, fontSize: 13,
          textDecoration: 'none', flexShrink: 0,
          whiteSpace: 'nowrap',
        }}>
          🔄 Update CV
        </Link>
      </div>
    );
  }

  // No resume — single upload CTA
  return (
    <div style={{
      background: 'linear-gradient(120deg,rgba(60,114,248,0.12) 0%,rgba(7,191,191,0.08) 100%)',
      border: `1px solid ${T.blue}30`,
      borderRadius: 14, padding: '22px 28px',
      display: 'flex', alignItems: 'center',
      justifyContent: 'space-between', gap: 20,
      flexWrap: 'wrap', marginBottom: 20,
    }}>
      <div>
        <div style={{ fontSize: 17, fontWeight: 800, color: T.text }}>
          Upload your CV to activate all AI engines
        </div>
        <div style={{ fontSize: 13, color: T.muted, marginTop: 4 }}>
          CHI score, skill gap analysis, job matching, digital twin, and opportunity radar all power on after CV upload.
        </div>
      </div>
      <Link href="/resume" style={{
        padding: '10px 22px', background: T.blue,
        color: '#fff', borderRadius: 9,
        fontWeight: 700, fontSize: 14,
        textDecoration: 'none', flexShrink: 0,
      }}>
        Upload CV →
      </Link>
    </div>
  );
}


// ═══════════════════════════════════════════════════════════════════════════════
// COACH LAYER — action-driven components layered over the existing panels
// These components are purely additive: they use the same hooks already present.
// ═══════════════════════════════════════════════════════════════════════════════

// ─── Score ring (large, labelled) ─────────────────────────────────────────────
function ScoreRing({ score, size = 128 }: { score: number | null; size?: number }) {
  const r        = (size / 2) - 10;
  const circ     = 2 * Math.PI * r;
  const pct      = score != null ? Math.min(100, Math.max(0, score)) : 0;
  const dash     = (pct / 100) * circ;
  const color    = pct >= 70 ? T.green : pct >= 45 ? T.amber : T.red;
  const trackClr = 'rgba(255,255,255,0.06)';
  const label    = pct >= 70 ? 'Strong' : pct >= 45 ? 'Developing' : 'Needs Work';

  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        {/* Track */}
        <circle cx={size/2} cy={size/2} r={r} fill="none"
          stroke={trackClr} strokeWidth={size >= 100 ? 10 : 7} />
        {/* Fill */}
        <circle cx={size/2} cy={size/2} r={r} fill="none"
          stroke={color} strokeWidth={size >= 100 ? 10 : 7}
          strokeLinecap="round"
          strokeDasharray={`${dash} ${circ - dash}`}
          style={{ transition: 'stroke-dasharray 0.8s ease' }}
        />
        {/* Zone markers at 45 and 70 */}
        {[45, 70].map(zone => {
          const angle = (zone / 100) * circ;
          return (
            <circle key={zone} cx={size/2} cy={size/2} r={r} fill="none"
              stroke="rgba(255,255,255,0.18)" strokeWidth={2}
              strokeDasharray={`2 ${circ - 2}`}
              strokeDashoffset={-(angle - 1)}
            />
          );
        })}
      </svg>
      {/* Centre text */}
      <div style={{
        position: 'absolute', inset: 0,
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        gap: 1,
      }}>
        <span style={{ fontSize: size >= 100 ? 30 : 18, fontWeight: 900, color: color, lineHeight: 1 }}>
          {score ?? '—'}
        </span>
        <span style={{ fontSize: size >= 100 ? 10 : 8, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', color }}>
          {score != null ? label : 'No data'}
        </span>
      </div>
    </div>
  );
}

// ─── Hero Coach Banner ────────────────────────────────────────────────────────
// Replaces the plain header. One big CTA, one key opportunity. Full attention.

// ═══════════════════════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════════════════════
// AVA COACHING SYSTEM — multi-step guided goal engine
// ═══════════════════════════════════════════════════════════════════════════════

interface AvaUserData {
  chiScore:       number | null;
  jobMatch:       number | null;
  resumeScore:    number | null;
  skillGapCount:  number;
  missingSkills:  string[];
  hasResume:      boolean;
  firstName:      string;
  targetRole:     string | null;
  // ATS coaching fields — from backend scoreBreakdown
  atsClarity?:      number | null;   // maps to keyword / content quality
  atsRelevance?:    number | null;   // maps to skills relevance
  atsExperience?:   number | null;   // maps to content strength
  atsSkills?:       number | null;   // maps to skills section
  atsAchievements?: number | null;   // maps to metrics/bullets
  improvements?:    string[];        // top improvement suggestions from AI scoring
  extractedSkills?: string[];        // skills already in resume
}

interface AvaGoal {
  title:        string;
  targetScore:  number;
  currentScore: number;
  metric:       string;
}

interface AvaStep {
  id:          string;
  icon:        string;
  title:       string;
  body:        string;
  impact:      string;
  impactPts:   number;
  actionLabel: string;
  actionHref:  string;
  actionType:  'skills' | 'resume' | 'jobs' | 'profile';
  completed:   boolean;
}

function generateAvaGoal(data: AvaUserData): AvaGoal {
  const score  = data.jobMatch ?? data.chiScore ?? 0;
  const metric = data.jobMatch != null ? 'job match' : 'career score';
  const milestones = [60, 65, 70, 75, 80, 85, 90, 100];
  const target = milestones.find(m => m > score) ?? 100;
  const TITLES: Record<number, string> = {
    60: 'Get shortlisted by recruiters',
    65: 'Break the 65% match threshold',
    70: 'Reach strong job match',
    75: 'Reach 75% — top candidate zone',
    80: 'Hit 80% — standout profile',
    85: 'Reach elite 85% match',
    90: 'Reach 90% — top 10% of candidates',
    100: 'Achieve a perfect profile',
  };
  return {
    title: data.targetRole
      ? `${TITLES[target] ?? `Reach ${target}%`} for ${data.targetRole}`
      : TITLES[target] ?? `Reach ${target}% ${metric}`,
    targetScore:  target,
    currentScore: Math.round(score),
    metric,
  };
}

// ─── ATS-to-coaching message helpers ──────────────────────────────────────────
// Pure functions: each takes live AvaUserData and returns a coaching AvaStep
// when the dimension score is below threshold. Returns null if no action needed.

function _atsKeywordStep(data: AvaUserData): AvaStep | null {
  // Keyword / relevance coaching — fires on low relevance (primary ATS signal)
  // Falls back to atsClarity only when atsRelevance is not available.
  const atsRel = data.atsRelevance ?? null;
  const atsClar = data.atsClarity ?? null;
  const score: number | null = atsRel ?? (atsClar !== null && atsClar < 65 ? atsClar : null);
  if (!data.hasResume || score === null || score >= 65) return null;

  const role = data.targetRole ?? 'your target role';
  // Surface top 3 AI-identified improvements that are keyword-related
  const kwHints = (data.improvements ?? [])
    .filter(s => /keyword|terminology|term|language|wording/i.test(s))
    .slice(0, 2);
  const body = kwHints.length > 0
    ? `${kwHints[0]}. Add these naturally in your summary and experience bullets.`
    : `Your resume lacks key terms recruiters search for in ${role}. Add role-specific keywords to your summary and experience.`;

  return {
    id: 'ats_keywords', icon: '🔑',
    title: 'Add missing role keywords',
    body,
    impact: `+${Math.round((65 - score) * 0.3)}% ATS match`, impactPts: Math.round((65 - score) * 0.3),
    actionLabel: 'Open Resume Builder →',
    actionHref:  '/resume-builder?focus=keywords&source=ava-coaching',
    actionType:  'resume', completed: false,
  };
}

function _atsContentStep(data: AvaUserData): AvaStep | null {
  // Content strength / achievements coaching — fires when achievements < 60 OR experience < 60
  const atsAch = data.atsAchievements ?? 100;
  const atsExp = data.atsExperience ?? 100;
  const score: number = Math.min(atsAch, atsExp);
  if (!data.hasResume || score >= 60) return null;

  const achHints = (data.improvements ?? [])
    .filter(s => /metric|quantif|number|achiev|result|impact|%|\$|bullet/i.test(s))
    .slice(0, 1);
  const body = achHints.length > 0
    ? `${achHints[0]}`
    : 'Rewrite experience bullets starting with Led, Built, or Delivered. Add at least one metric (%, $, team size) per role.';

  return {
    id: 'ats_content', icon: '📊',
    title: 'Strengthen your bullet points',
    body,
    impact: '+6 career score', impactPts: 6,
    actionLabel: 'Improve Bullets →',
    actionHref:  '/resume-builder?focus=bullets&source=ava-coaching',
    actionType:  'resume', completed: false,
  };
}

function _atsSkillsStep(data: AvaUserData): AvaStep | null {
  // Skills relevance coaching — fires when skills < 65 AND skill gap exists
  const score: number | null = data.atsSkills ?? null;
  if (!data.hasResume || (score !== null && score >= 65 && data.skillGapCount === 0)) return null;
  if (score === null && data.skillGapCount === 0) return null;

  const top = data.missingSkills.slice(0, 3);
  const body = top.length > 0
    ? `Add "${top[0]}"${top[1] ? ` and "${top[1]}"` : ''} to your skills — they appear in most listings for your target role.`
    : `Your skills section needs more role-aligned entries. Add specific tools and technologies used in your experience.`;

  const pts = Math.min(data.skillGapCount * 4, 18);
  return {
    id: 'ats_skills', icon: '⚡',
    title: `Add ${data.skillGapCount > 0 ? Math.min(data.skillGapCount, 3) : 'high-demand'} missing skill${data.skillGapCount !== 1 ? 's' : ''}`,
    body,
    impact: pts > 0 ? `+${pts}% job match` : '+5 ATS score', impactPts: pts || 5,
    actionLabel: 'Add Skills →',
    actionHref:  '/skills?source=ava-coaching',
    actionType:  'skills', completed: false,
  };
}

function _atsFormattingStep(data: AvaUserData): AvaStep | null {
  // Formatting coaching — fires on low clarity ONLY when it's the independent issue
  // (not just a secondary signal already covered by the keyword step).
  const score: number | null = data.atsClarity ?? null;
  const atsRel2 = data.atsRelevance ?? null;
  const relevanceOk = atsRel2 === null || atsRel2 >= 65;
  if (!data.hasResume || score === null || score >= 70) return null;
  // Suppress if keyword step will already fire on the same clarity score
  if (!relevanceOk) return null;

  const fmtHints = (data.improvements ?? [])
    .filter(s => /summary|contact|linkedin|phone|email|format|section|structure/i.test(s))
    .slice(0, 1);
  const body = fmtHints.length > 0
    ? `${fmtHints[0]}`
    : 'Add a 3-sentence professional summary and ensure your LinkedIn URL and phone number are included — ATS parsers weight these heavily.';

  return {
    id: 'ats_formatting', icon: '📝',
    title: 'Fix resume structure & contact info',
    body,
    impact: '+4 ATS score', impactPts: 4,
    actionLabel: 'Fix in Builder →',
    actionHref:  '/resume-builder?focus=summary&source=ava-coaching',
    actionType:  'resume', completed: false,
  };
}

function generateAvaSteps(data: AvaUserData): AvaStep[] {
  const steps: AvaStep[] = [];

  // Step 0: Upload CV (prerequisite for everything else)
  if (!data.hasResume) {
    steps.push({
      id: 'upload_cv', icon: '📄',
      title: 'Upload your CV',
      body:  'Ava needs your CV to personalise your job match score, skill gaps, and recommendations.',
      impact: 'Unlocks all AI engines', impactPts: 15,
      actionLabel: 'Upload CV →', actionHref: '/resume',
      actionType: 'resume', completed: false,
    });
    return steps; // nothing else is actionable without a resume
  }

  // Steps 1-4: ATS dimension coaching (only when breakdown data exists)
  // Priority order: keywords → skills → content → formatting
  // Each step fires only when its dimension is below threshold.
  // Cap at 3 resume steps so the list stays focused.
  const atsSteps = [
    _atsKeywordStep(data),
    _atsSkillsStep(data),
    _atsContentStep(data),
    _atsFormattingStep(data),
  ].filter((s): s is AvaStep => s !== null).slice(0, 3);

  // If no breakdown data yet (resume uploaded but not scored), fall back to generic
  if (atsSteps.length === 0 && data.resumeScore != null && data.resumeScore < 75) {
    const issues = Math.max(1, Math.round((75 - data.resumeScore) / 12));
    steps.push({
      id: 'improve_resume', icon: '📝',
      title: 'Improve your resume score',
      body:  `Your resume scores ${data.resumeScore}/100. Fix ${issues} issue${issues > 1 ? 's' : ''} to get more interview callbacks.`,
      impact: '+8 career score', impactPts: 8,
      actionLabel: 'Improve Resume →', actionHref: '/resume-builder?source=ava-coaching',
      actionType:  'resume', completed: false,
    });
  } else {
    steps.push(...atsSteps);
  }

  // Final step: Apply to jobs
  const jm = data.jobMatch ?? 0;
  steps.push({
    id: 'apply_jobs', icon: '🎯',
    title: jm >= 65 ? 'Apply to your top job matches' : 'Explore matching roles',
    body:  jm >= 65
      ? 'You have strong matches ready — applying now maximises your chances.'
      : 'Browse roles to see where you stand and which gaps to close next.',
    impact: 'Unlock opportunities', impactPts: 5,
    actionLabel: 'View Matches →', actionHref: '/job-matches?source=ava-coaching',
    actionType: 'jobs', completed: false,
  });

  if (steps.length === 0) {
    steps.push({
      id: 'explore', icon: '🔭',
      title: 'Explore career opportunities',
      body:  'Your profile is in great shape. Keep it fresh by exploring new roles and market trends.',
      impact: 'Stay competitive', impactPts: 3,
      actionLabel: 'Explore →', actionHref: '/opportunities',
      actionType: 'profile', completed: false,
    });
  }

  return steps;
}

const COACHING_KEY = 'ava_coaching_v1';
function loadCompletedSteps(): Set<string> {
  try { const r = sessionStorage.getItem(COACHING_KEY); return r ? new Set(JSON.parse(r) as string[]) : new Set(); }
  catch { return new Set(); }
}
function saveCompletedSteps(ids: Set<string>) {
  try { sessionStorage.setItem(COACHING_KEY, JSON.stringify([...ids])); } catch { /* noop */ }
}

const STEP_ACTION_COLORS: Record<AvaStep['actionType'], string> = {
  skills:  T.amber,
  resume:  T.blue,
  jobs:    T.green,
  profile: T.purple,
};

function AvaCoachingSystem({ data, onTrack, personality }: { data: AvaUserData; onTrack?: (t: string, l: string) => void; personality?: AvaPersonality }) {
  const goal = React.useMemo(() => generateAvaGoal(data), [data]);
  const base = React.useMemo(() => generateAvaSteps(data), [data]);

  const [completedIds, setCompletedIds] = React.useState<Set<string>>(loadCompletedSteps);
  const [gainFeedback, setGainFeedback] = React.useState<Record<string, string>>({});
  const [collapsed,    setCollapsed]    = React.useState(false);

  const steps = React.useMemo(
    () => base.map(s => ({ ...s, completed: completedIds.has(s.id) })),
    [base, completedIds],
  );

  const activeIdx  = steps.findIndex(s => !s.completed);
  const doneCount  = steps.filter(s => s.completed).length;
  const totalCount = steps.length;
  const allDone    = doneCount === totalCount;
  const earnedPts  = steps.filter(s => s.completed).reduce((sum, s) => sum + s.impactPts, 0);
  const displayScore = Math.min(goal.targetScore, goal.currentScore + earnedPts);
  const progressPct  = Math.min(100, goal.targetScore > goal.currentScore
    ? Math.round(((displayScore - goal.currentScore) / (goal.targetScore - goal.currentScore)) * 100)
    : 0);
  const goalColor = displayScore >= goal.targetScore ? T.green : progressPct >= 50 ? T.blue : T.amber;

  function handleStepAction(step: AvaStep) {
    const next = new Set(completedIds).add(step.id);
    setCompletedIds(next);
    saveCompletedSteps(next);
    setGainFeedback(p => ({ ...p, [step.id]: step.impact }));
    setTimeout(() => setGainFeedback(p => { const n = { ...p }; delete n[step.id]; return n; }), 2200);
    onTrack?.(`ava_step_${step.actionType}`, step.title);
    setTimeout(() => { window.location.href = step.actionHref; }, 700);
  }

  const stepIndicatorColor = (s: AvaStep, i: number) =>
    s.completed ? T.green : i === activeIdx ? T.pink : T.dim;

  return (
    <div style={{
      background: 'linear-gradient(160deg, rgba(233,108,170,0.07) 0%, rgba(60,114,248,0.05) 50%, rgba(7,9,15,0) 100%)',
      border: '1px solid rgba(233,108,170,0.2)',
      borderRadius: 18, marginBottom: 14, overflow: 'hidden',
      animation: 'avaSlideIn 0.4s cubic-bezier(.4,0,.2,1)',
    }}>

      {/* ── Header ── */}
      <div style={{
        padding: '18px 22px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14,
        borderBottom: collapsed ? 'none' : '1px solid rgba(255,255,255,0.05)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, flex: 1, minWidth: 0 }}>
          <div style={{
            width: 46, height: 46, borderRadius: 13, flexShrink: 0,
            background: 'linear-gradient(135deg, rgba(233,108,170,0.28), rgba(60,114,248,0.2))',
            border: '1px solid rgba(233,108,170,0.35)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22,
            animation: 'avaPulse 2.8s ease-in-out 0.5s 3',
            boxShadow: '0 0 24px rgba(233,108,170,0.2)',
          }}>🤖</div>

          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 9, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.16em', color: personality?.emotion.color ?? T.pink, marginBottom: 3 }}>
              {personality?.emotion.emoji ?? '🤖'} Ava&apos;s Coaching Plan · <span style={{ textTransform: 'none', fontWeight: 600, letterSpacing: 0 }}>{personality?.emotion.label}</span>
            </div>
            <div style={{ fontSize: 15, fontWeight: 800, color: T.text, letterSpacing: '-0.02em', lineHeight: 1.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {allDone ? `🎉 Goal reached — great work, ${data.firstName}!` : goal.title}
            </div>
            {!collapsed && (
              <div style={{ fontSize: 11, color: T.muted, marginTop: 3, display: 'flex', flexDirection: 'column', gap: 4 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontWeight: 700, color: goalColor }}>{doneCount}/{totalCount} steps done</span>
                  {earnedPts > 0 && (
                    <span style={{ fontSize: 10, fontWeight: 700, background: T.green + '18', border: `1px solid ${T.green}28`, color: T.green, padding: '1px 7px', borderRadius: 20 }}>
                      +{earnedPts} pts gained 🎉
                    </span>
                  )}
                </div>
                {personality && !allDone && (
                  <span style={{ fontSize: 11, color: T.muted, lineHeight: 1.45, fontStyle: 'italic' }}>
                    {personality.message}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
          <div style={{ textAlign: 'center', background: goalColor + '12', border: `1px solid ${goalColor}25`, borderRadius: 10, padding: '7px 14px' }}>
            <div style={{ fontSize: 22, fontWeight: 900, color: goalColor, lineHeight: 1 }}>{displayScore}%</div>
            <div style={{ fontSize: 9, color: T.dim, marginTop: 2 }}>/ {goal.targetScore}% goal</div>
          </div>
          <button onClick={() => setCollapsed(v => !v)} aria-label={collapsed ? 'Expand' : 'Collapse'}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: T.muted, fontSize: 14, padding: 6, transform: collapsed ? 'rotate(-90deg)' : 'none', transition: 'transform 0.2s' }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = T.text; }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = T.muted; }}>▼</button>
        </div>
      </div>

      {/* ── Progress bar ── */}
      {!collapsed && (
        <div style={{ padding: '12px 22px 0' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: T.dim, marginBottom: 5 }}>
            <span>Current: <strong style={{ color: T.muted }}>{goal.currentScore}%</strong></span>
            <span>Goal: <strong style={{ color: goalColor }}>{goal.targetScore}%</strong></span>
          </div>
          <div style={{ height: 6, borderRadius: 9999, background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
            <div style={{ height: '100%', borderRadius: 9999, width: `${displayScore}%`, background: `linear-gradient(90deg, ${T.blue}, ${goalColor})`, transition: 'width 1s cubic-bezier(.4,0,.2,1)' }} />
          </div>
        </div>
      )}

      {/* ── Steps ── */}
      {!collapsed && (
        <div style={{ padding: '14px 22px 20px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {steps.map((step, i) => {
            const isActive  = i === activeIdx && !step.completed;
            const isFuture  = !step.completed && i > activeIdx;
            const acColor   = STEP_ACTION_COLORS[step.actionType];
            const sc        = stepIndicatorColor(step, i);

            return (
              <div key={step.id} style={{
                display: 'flex', gap: 14, alignItems: 'flex-start',
                padding: isActive ? '14px 16px' : '11px 14px',
                borderRadius: 13,
                background: step.completed
                  ? 'rgba(31,216,160,0.05)'
                  : isActive
                    ? 'linear-gradient(135deg, rgba(233,108,170,0.1), rgba(60,114,248,0.06))'
                    : 'transparent',
                border: `1px solid ${step.completed ? T.green + '22' : isActive ? 'rgba(233,108,170,0.25)' : T.border}`,
                opacity: isFuture ? 0.42 : 1,
                transition: 'all 0.25s ease',
                animation: isActive ? 'stepPop 0.3s cubic-bezier(.4,0,.2,1)' : 'none',
                position: 'relative',
              }}>
                {/* Step indicator */}
                <div style={{
                  width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
                  background: step.completed ? T.green + '20' : isActive ? 'rgba(233,108,170,0.18)' : 'rgba(255,255,255,0.04)',
                  border: `2px solid ${sc}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: step.completed ? 14 : 13, fontWeight: 800, color: sc,
                  transition: 'all 0.3s ease',
                  animation: step.completed ? 'checkBounce 0.35s cubic-bezier(.4,0,.2,1)' : 'none',
                }}>
                  {step.completed ? '✓' : step.icon}
                </div>

                {/* Content */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: isActive ? 5 : 2, flexWrap: 'wrap' }}>
                    <span style={{
                      fontSize: 13, fontWeight: step.completed ? 600 : 800,
                      color: step.completed ? T.muted : isActive ? T.text : T.muted,
                      textDecoration: step.completed ? 'line-through' : 'none',
                      letterSpacing: '-0.01em',
                    }}>
                      {step.title}
                    </span>
                    {!step.completed && (
                      <span style={{ fontSize: 10, fontWeight: 700, color: acColor, background: acColor + '14', border: `1px solid ${acColor}25`, padding: '1px 8px', borderRadius: 20 }}>
                        ↑ {step.impact}
                      </span>
                    )}
                    {isActive && (
                      <span style={{ fontSize: 9, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.12em', color: T.pink, background: 'rgba(233,108,170,0.12)', border: '1px solid rgba(233,108,170,0.22)', padding: '2px 7px', borderRadius: 20 }}>
                        active
                      </span>
                    )}
                    {step.completed && <span style={{ fontSize: 10, color: T.green, fontWeight: 700 }}>Done ✓</span>}
                  </div>

                  {isActive && (
                    <p style={{ fontSize: 12, color: T.muted, margin: '0 0 10px', lineHeight: 1.55 }}>{step.body}</p>
                  )}

                  {isActive && (
                    <button onClick={() => handleStepAction(step)} style={{
                      padding: '8px 20px', borderRadius: 9,
                      background: acColor, color: '#07090f',
                      border: 'none', fontWeight: 800, fontSize: 13, cursor: 'pointer',
                      display: 'inline-flex', alignItems: 'center', gap: 7,
                      transition: 'opacity 0.15s, transform 0.1s', letterSpacing: '-0.01em',
                    }}
                      onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.opacity = '0.88'; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.opacity = '1'; }}
                      onMouseDown={e  => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(0.96)'; }}
                      onMouseUp={e    => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)'; }}>
                      {step.actionLabel}
                    </button>
                  )}
                </div>

                {/* Floating gain feedback */}
                {gainFeedback[step.id] && (
                  <div style={{
                    position: 'absolute', top: -28, left: '50%', transform: 'translateX(-50%)',
                    background: T.green, color: '#07090f',
                    padding: '5px 14px', borderRadius: 20,
                    fontSize: 12, fontWeight: 800, whiteSpace: 'nowrap',
                    animation: 'gainFade 2.2s ease-out forwards',
                    boxShadow: `0 4px 20px ${T.green}50`, zIndex: 10,
                  }}>
                    {gainFeedback[step.id]} 🎉
                  </div>
                )}
              </div>
            );
          })}

          {allDone && (
            <div style={{ textAlign: 'center', padding: '14px 0 4px', fontSize: 13, color: T.green, fontWeight: 700, animation: 'rise 0.3s ease-out' }}>
              ✅ All steps complete — you&apos;re on track for {goal.title}
              <div style={{ marginTop: 8 }}>
                <Link href="/career-health" style={{ fontSize: 12, color: T.blue, textDecoration: 'none', fontWeight: 700 }}>
                  View full career health report →
                </Link>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// AVA PROACTIVE ENGINE
// ═══════════════════════════════════════════════════════════════════════════════

// ─── Trigger engine ───────────────────────────────────────────────────────────
interface AvaInput {
  missingSkills:  number;
  resumeScore:    number | null;
  jobMatch:       number | null;
  lastActiveDays: number;
}

type AvaTrigger = 'missing_skills' | 'resume_improvement' | 'job_match' | 'inactivity' | null;

interface AvaSuggestion {
  trigger:     AvaTrigger;
  message:     string;
  actionLabel: string;
  actionHref:  string;
  actionType:  AvaTrigger;
  scoreGain:   string;
}

function getAvaSuggestion(input: AvaInput): AvaSuggestion | null {
  const { missingSkills, resumeScore, jobMatch, lastActiveDays } = input;

  if (missingSkills > 0) {
    return {
      trigger:     'missing_skills',
      message:     `You're missing ${missingSkills} skill${missingSkills > 1 ? 's' : ''} that appear in most job listings for your target role. Adding them could increase your match score significantly.`,
      actionLabel: `+ Add ${Math.min(missingSkills, 3)} Skill${missingSkills > 1 ? 's' : ''}`,
      actionHref:  '/skills?source=ava-suggestion',
      actionType:  'missing_skills',
      scoreGain:   `+${Math.min(missingSkills * 4, 15)}% job match`,
    };
  }

  if (resumeScore != null && resumeScore < 70) {
    const gap = 70 - resumeScore;
    return {
      trigger:     'resume_improvement',
      message:     `Your resume is scoring ${resumeScore}/100. Fixing ${Math.max(1, Math.round(gap / 10))} key issue${gap > 10 ? 's' : ''} could increase your interview callbacks by ~20%.`,
      actionLabel: 'Improve Resume Now',
      actionHref:  '/resume-builder?source=ava-suggestion',
      actionType:  'resume_improvement',
      scoreGain:   '+8 career score',
    };
  }

  if (jobMatch != null && jobMatch < 65) {
    return {
      trigger:     'job_match',
      message:     `Your job match score is ${Math.round(jobMatch)}%. You have ${Math.ceil((65 - jobMatch) / 5)} quick improvements that could push you past 65% and into more recruiter shortlists.`,
      actionLabel: 'View Job Matches',
      actionHref:  '/job-matches?source=ava-suggestion',
      actionType:  'job_match',
      scoreGain:   'More recruiter views',
    };
  }

  if (lastActiveDays > 2) {
    return {
      trigger:     'inactivity',
      message:     `You haven't updated your profile in ${lastActiveDays} day${lastActiveDays > 1 ? 's' : ''}. The job market moves fast — a quick check-in keeps your recommendations fresh.`,
      actionLabel: 'Check What Changed',
      actionHref:  '/career-health?source=ava-suggestion',
      actionType:  'inactivity',
      scoreGain:   'Stay competitive',
    };
  }

  return null;
}

// ─── AvaProactiveBanner ───────────────────────────────────────────────────────
// Shown between Hero and Alert. Dismissable per session (sessionStorage).
// On CTA click: navigates + fires track event + shows +N% toast feedback.

const AVA_DISMISS_KEY = 'ava_dismissed_v1';

function AvaProactiveBanner({
  suggestion,
  onDismiss,
  onAction,
}: {
  suggestion: AvaSuggestion;
  onDismiss:  () => void;
  onAction:   (type: AvaTrigger) => void;
}) {
  const [feedback, setFeedback] = React.useState<string | null>(null);
  const [leaving,  setLeaving]  = React.useState(false);

  const TRIGGER_COLORS: Record<NonNullable<AvaTrigger>, string> = {
    missing_skills:    T.amber,
    resume_improvement: T.blue,
    job_match:         T.green,
    inactivity:        T.purple,
  };
  const TRIGGER_ICONS: Record<NonNullable<AvaTrigger>, string> = {
    missing_skills:    '⚡',
    resume_improvement: '📄',
    job_match:         '🎯',
    inactivity:        '🔄',
  };

  const color = suggestion.trigger ? TRIGGER_COLORS[suggestion.trigger] : T.pink;
  const icon  = suggestion.trigger ? TRIGGER_ICONS[suggestion.trigger]  : '🤖';

  function handleAction() {
    // Show success feedback
    setFeedback(suggestion.scoreGain);
    onAction(suggestion.actionType);
    // Brief delay then navigate
    setTimeout(() => {
      window.location.href = suggestion.actionHref;
    }, 900);
  }

  function handleDismiss() {
    setLeaving(true);
    setTimeout(() => {
      try { sessionStorage.setItem(AVA_DISMISS_KEY, '1'); } catch {}
      onDismiss();
    }, 280);
  }

  return (
    <div style={{
      borderRadius: 16,
      background: `linear-gradient(135deg, ${color}0f 0%, rgba(7,9,15,0) 60%)`,
      border: `1px solid ${color}35`,
      padding: '18px 20px',
      marginBottom: 14,
      display: 'flex', alignItems: 'flex-start', gap: 16,
      flexWrap: 'wrap',
      opacity: leaving ? 0 : 1,
      transform: leaving ? 'translateY(-6px) scale(0.98)' : 'none',
      transition: 'opacity 0.28s ease, transform 0.28s ease',
      animation: 'avaSlideIn 0.35s cubic-bezier(.4,0,.2,1)',
      position: 'relative',
    }}>

      {/* Ava avatar — pulses to draw attention */}
      <div style={{
        width: 48, height: 48, borderRadius: 13, flexShrink: 0,
        background: `linear-gradient(135deg, ${color}28, rgba(233,108,170,0.18))`,
        border: `1px solid ${color}40`,
        display: 'flex', alignItems: 'center',
        justifyContent: 'center', fontSize: 22,
        animation: 'avaPulse 2.4s ease-in-out 0.6s 3',
        boxShadow: `0 0 20px ${color}25`,
      }}>
        {icon}
      </div>

      {/* Message + CTAs */}
      <div style={{ flex: 1, minWidth: 200 }}>
        {/* "Ava says" label */}
        {/* "Ava says" label + context tag */}
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          marginBottom: 7,
        }}>
          <span style={{
            fontSize: 9, fontWeight: 800, textTransform: 'uppercase',
            letterSpacing: '0.16em', color: T.pink,
            display: 'flex', alignItems: 'center', gap: 4,
          }}>
            🤖 Ava says
          </span>
          <span style={{
            fontSize: 9, fontWeight: 700, textTransform: 'uppercase',
            letterSpacing: '0.1em',
            color: color, background: color + '18',
            padding: '1px 7px', borderRadius: 20,
            border: `1px solid ${color}28`,
          }}>
            {{
              missing_skills:     '⚡ missing skills',
              resume_improvement: '📄 resume',
              job_match:          '🎯 job match',
              inactivity:         '🔄 check in',
            }[suggestion.trigger as string] ?? suggestion.trigger}
          </span>
        </div>

        <p style={{
          fontSize: 13, color: T.text, lineHeight: 1.55,
          margin: '0 0 12px', fontWeight: 500,
        }}>
          {suggestion.message}
        </p>

        {/* CTA row */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          {/* Primary CTA */}
          {feedback ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                padding: '8px 18px', borderRadius: 9,
                background: T.green + '18', border: `1px solid ${T.green}35`,
                fontSize: 13, fontWeight: 800, color: T.green,
                animation: 'rise 0.25s ease-out',
              }}>
                ✅ {feedback} 🎉
              </span>
              <span style={{ fontSize: 11, color: T.muted, paddingLeft: 4 }}>
                Taking you there…
              </span>
            </div>
          ) : (
            <>
              <button
                onClick={handleAction}
                style={{
                  padding: '9px 20px', borderRadius: 9,
                  background: color, color: '#07090f',
                  border: 'none', fontWeight: 800, fontSize: 13,
                  cursor: 'pointer', transition: 'opacity 0.15s, transform 0.1s',
                  display: 'inline-flex', alignItems: 'center', gap: 7,
                  letterSpacing: '-0.01em',
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.opacity = '0.88'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.opacity = '1'; }}
                onMouseDown={e  => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(0.96)'; }}
                onMouseUp={e    => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)'; }}
              >
                {suggestion.actionLabel}
              </button>
              {/* Score gain shown as a badge next to the button */}
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: 4,
                fontSize: 11, fontWeight: 700, color: color,
                background: color + '14', border: `1px solid ${color}25`,
                padding: '4px 10px', borderRadius: 20,
              }}>
                ↑ {suggestion.scoreGain}
              </span>
            </>
          )}

          {/* "Not Now" dismiss */}
          {!feedback && (
            <button
              onClick={handleDismiss}
              style={{
                padding: '8px 14px', borderRadius: 9,
                background: 'transparent',
                border: `1px solid ${T.border}`,
                color: T.muted, fontSize: 12, fontWeight: 600,
                cursor: 'pointer', transition: 'color 0.15s, border-color 0.15s',
              }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLButtonElement).style.color = T.text;
                (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(255,255,255,0.2)';
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLButtonElement).style.color = T.muted;
                (e.currentTarget as HTMLButtonElement).style.borderColor = T.border;
              }}
            >
              Not Now
            </button>
          )}
        </div>
      </div>

      {/* Close ✕ */}
      {!feedback && (
        <button
          onClick={handleDismiss}
          aria-label="Dismiss Ava suggestion"
          style={{
            position: 'absolute', top: 12, right: 14,
            background: 'none', border: 'none',
            color: T.dim, cursor: 'pointer', fontSize: 16,
            lineHeight: 1, padding: 4,
            transition: 'color 0.15s',
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = T.muted; }}
          onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = T.dim; }}
        >
          ✕
        </button>
      )}
    </div>
  );
}

function HeroCoachBanner({
  score, firstName, profession, jobTitle, potentialGain, topOpportunity, hasResume, onBoost,
}: {
  score:          number | null;
  firstName:      string;
  profession?:    string | null;
  jobTitle?:      string | null;
  potentialGain:  number;
  topOpportunity: string;
  hasResume:      boolean;
  onBoost:        () => void;
}) {
  const scoreLabel = score != null
    ? (score >= 70 ? 'Strong profile' : score >= 45 ? 'Developing' : 'Needs attention')
    : null;

  return (
    <div style={{
      background: `linear-gradient(135deg, rgba(60,114,248,0.14) 0%, rgba(31,216,160,0.08) 60%, rgba(7,9,15,0) 100%)`,
      border: `1px solid rgba(60,114,248,0.22)`,
      borderRadius: 18,
      padding: '28px 32px',
      marginBottom: 20,
      display: 'flex',
      alignItems: 'center',
      gap: 32,
      flexWrap: 'wrap',
    }}>

      {/* Score ring */}
      <ScoreRing score={score} size={128} />

      {/* Copy */}
      <div style={{ flex: 1, minWidth: 200 }}>
        <div style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.16em', color: T.muted, marginBottom: 6 }}>
          Career Intelligence Platform
        </div>
        <h1 style={{ fontSize: 28, fontWeight: 900, color: T.text, margin: 0, letterSpacing: '-0.03em', lineHeight: 1.15 }}>
          Hi {firstName} 👋
        </h1>

        {score != null ? (
          <>
            {/* Profile Strength label + animated bar */}
            <div style={{ marginTop: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: T.text }}>
                  Profile Strength:{' '}
                  <span style={{ color: score >= 70 ? T.green : score >= 45 ? T.amber : T.red }}>
                    {score}%
                  </span>
                </span>
                {potentialGain > 0 && (
                  <span style={{ fontSize: 11, color: T.muted }}>
                    +{potentialGain} pts possible
                  </span>
                )}
              </div>
              {/* Animated bar */}
              <div style={{ height: 8, borderRadius: 9999, background: 'rgba(255,255,255,0.07)', overflow: 'hidden' }}>
                <div style={{
                  height: '100%', borderRadius: 9999,
                  width: `${score}%`,
                  background: score >= 70 ? T.green : score >= 45 ? T.amber : T.red,
                  transition: 'width 1.2s cubic-bezier(.4,0,.2,1)',
                  boxShadow: `0 0 12px ${score >= 70 ? T.green : score >= 45 ? T.amber : T.red}60`,
                }} />
              </div>
              {/* Steps-to-target */}
              {score < 80 && (
                <p style={{ fontSize: 12, color: T.muted, margin: '6px 0 0', lineHeight: 1.5 }}>
                  You're{' '}
                  <strong style={{ color: T.text }}>
                    {Math.max(1, Math.ceil((80 - score) / (potentialGain / Math.max(1, 3))))} steps
                  </strong>{' '}
                  away from reaching{' '}
                  <strong style={{ color: T.green }}>80%</strong>
                </p>
              )}
            </div>
            {topOpportunity && (
              <div style={{
                marginTop: 12,
                display: 'inline-flex', alignItems: 'center', gap: 8,
                background: 'rgba(31,216,160,0.08)',
                border: '1px solid rgba(31,216,160,0.2)',
                borderRadius: 10, padding: '7px 14px',
              }}>
                <span style={{ fontSize: 13 }}>🎯</span>
                <span style={{ fontSize: 13, color: T.text, fontWeight: 600 }}>
                  <span style={{ color: T.muted, fontWeight: 400 }}>Next: </span>
                  {topOpportunity}
                </span>
              </div>
            )}
          </>
        ) : (
          <p style={{ fontSize: 14, color: T.muted, margin: '6px 0 0' }}>
            Upload your CV to calculate your Career Health Index and unlock all AI engines.
          </p>
        )}
      </div>

      {/* CTA column */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, flexShrink: 0 }}>
        {score != null ? (
          <button onClick={onBoost} style={{
            padding: '13px 28px',
            background: T.green, color: '#07090f',
            border: 'none', borderRadius: 11,
            fontWeight: 800, fontSize: 14,
            cursor: 'pointer', letterSpacing: '-0.01em',
            transition: 'opacity 0.15s',
            whiteSpace: 'nowrap',
          }}>
            ⚡ Boost My Score
          </button>
        ) : (
          <Link href="/resume" style={{
            padding: '13px 28px',
            background: T.blue, color: '#fff',
            borderRadius: 11,
            fontWeight: 800, fontSize: 14,
            textDecoration: 'none', whiteSpace: 'nowrap',
          }}>
            Upload CV →
          </Link>
        )}
        <Link href="/career-health" style={{
          fontSize: 12, color: T.muted, textDecoration: 'none',
          textAlign: 'center', fontWeight: 600,
        }}>
          View full report →
        </Link>
      </div>
    </div>
  );
}

// ─── Next Best Actions ────────────────────────────────────────────────────────
// The single most important conversion surface. Replaces the unguided KPI tiles
// as the primary post-hero section.
interface NBA {
  icon:    string;
  title:   string;
  body:    string;
  impact:  string;
  color:   string;
  href:    string;
  cta:     string;
}

function NextBestActions({ actions }: { actions: NBA[] }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <p style={{ fontSize: 9, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.14em', color: T.muted, margin: 0 }}>
          Your Next Best Actions
        </p>
        <span style={{ fontSize: 11, color: T.dim }}>Personalized to your profile</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 12 }}>
        {actions.map((a, i) => (
          <div key={i} style={{
            background: T.s0,
            border: `1px solid ${a.color}28`,
            borderRadius: 14, padding: '18px 20px',
            display: 'flex', flexDirection: 'column', gap: 10,
            position: 'relative', overflow: 'hidden',
          }}>
            {/* Accent strip */}
            <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, background: a.color, borderRadius: '14px 0 0 14px' }} />
            <div style={{ paddingLeft: 8 }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 22 }}>{a.icon}</span>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 800, color: T.text }}>{a.title}</div>
                    <div style={{ fontSize: 12, color: T.muted, marginTop: 3, lineHeight: 1.4 }}>{a.body}</div>
                  </div>
                </div>
              </div>
              {/* Impact badge */}
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, marginTop: 10,
                background: a.color + '14', border: `1px solid ${a.color}28`,
                borderRadius: 8, padding: '4px 10px' }}>
                <span style={{ fontSize: 16 }}>↑</span>
                <span style={{ fontSize: 12, fontWeight: 700, color: a.color }}>{a.impact}</span>
              </div>
              <div style={{ marginTop: 10 }}>
                <Link href={a.href} style={{
                  display: 'inline-block',
                  padding: '8px 18px',
                  background: a.color + '18',
                  border: `1px solid ${a.color}40`,
                  borderRadius: 8, color: a.color,
                  fontSize: 12, fontWeight: 700,
                  textDecoration: 'none',
                  transition: 'background 0.15s',
                }}>
                  {a.cta}
                </Link>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Skills Gap Priority Banner ───────────────────────────────────────────────
// More prominent than a chart — converts users to the skills page faster.
function SkillsGapBanner({
  missingCount, topMissing, hasResume,
}: {
  missingCount: number;
  topMissing:   string[];
  hasResume:    boolean;
}) {
  if (!hasResume || missingCount === 0) return null;
  return (
    <div style={{
      background: `rgba(244,169,40,0.07)`,
      border: `1px solid rgba(244,169,40,0.25)`,
      borderRadius: 14, padding: '16px 20px',
      display: 'flex', alignItems: 'center',
      justifyContent: 'space-between', gap: 16,
      flexWrap: 'wrap', marginBottom: 14,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <span style={{ fontSize: 28 }}>⚠️</span>
        <div>
          <div style={{ fontSize: 14, fontWeight: 800, color: T.amber }}>
            You are missing {missingCount} key skill{missingCount > 1 ? 's' : ''} for top roles
          </div>
          {topMissing.length > 0 && (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6 }}>
              {topMissing.slice(0, 4).map(sk => (
                <span key={sk} style={{
                  fontSize: 11, fontWeight: 600,
                  padding: '2px 10px', borderRadius: 20,
                  background: 'rgba(244,169,40,0.12)',
                  border: '1px solid rgba(244,169,40,0.25)',
                  color: T.amber,
                }}>{sk}</span>
              ))}
            </div>
          )}
        </div>
      </div>
      <div style={{ display: 'flex', gap: 8, flexShrink: 0, flexWrap: 'wrap' }}>
        <Link href="/skills?source=missing-skills" style={{
          padding: '9px 18px',
          background: T.amber, color: '#07090f',
          borderRadius: 9, fontWeight: 800,
          fontSize: 13, textDecoration: 'none',
          whiteSpace: 'nowrap',
        }}>
          Add Skills →
        </Link>
        <Link href="/advisor?q=how+do+I+improve+my+missing+skills" style={{
          padding: '9px 18px',
          background: 'rgba(244,169,40,0.12)',
          border: '1px solid rgba(244,169,40,0.3)',
          color: T.amber,
          borderRadius: 9, fontWeight: 700,
          fontSize: 13, textDecoration: 'none',
          whiteSpace: 'nowrap',
          display: 'inline-flex', alignItems: 'center', gap: 6,
        }}>
          <span style={{ fontSize: 15 }}>🤖</span> Ask Ava how to improve
        </Link>
      </div>
    </div>
  );
}

// ─── Resume Score Banner ──────────────────────────────────────────────────────
function ResumeScoreBanner({ resumeScore, hasResume }: { resumeScore: number | null; hasResume: boolean }) {
  if (!hasResume) return null;
  const s      = resumeScore ?? 0;
  const label  = s >= 70 ? 'Good' : s >= 45 ? 'Needs Improvement' : 'Weak';
  const color  = s >= 70 ? T.green : s >= 45 ? T.amber : T.red;
  const issues = s < 70 ? Math.max(1, Math.round((70 - s) / 10)) : 0;

  return (
    <div style={{
      background: T.s0,
      border: `1px solid ${color}28`,
      borderRadius: 14, padding: '16px 20px',
      display: 'flex', alignItems: 'center',
      gap: 16, flexWrap: 'wrap', marginBottom: 14,
    }}>
      <ScoreRing score={s} size={72} />
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 14, fontWeight: 800, color: T.text }}>Resume Score</div>
        <div style={{ fontSize: 13, fontWeight: 700, color, marginTop: 2 }}>{label}</div>
        {issues > 0 && (
          <div style={{ fontSize: 12, color: T.muted, marginTop: 4, lineHeight: 1.5 }}>
            Fix {issues} issue{issues > 1 ? 's' : ''} to increase job matches by ~{issues * 7}%
          </div>
        )}
      </div>
      <Link href="/resume-builder" style={{
        padding: '9px 20px',
        background: color + '18',
        border: `1px solid ${color}40`,
        borderRadius: 9, color,
        fontSize: 13, fontWeight: 700,
        textDecoration: 'none', flexShrink: 0,
      }}>
        {s >= 70 ? 'View in Builder →' : 'Improve Resume →'}
      </Link>
    </div>
  );
}

// ─── Career Growth Path ───────────────────────────────────────────────────────
function CareerGrowthPath({
  current, next, future,
}: {
  current?: string | null;
  next?:    string | null;
  future?:  string | null;
}) {
  if (!current && !next) return null;
  const steps = [
    { label: 'Current',  role: current ?? '—',  color: T.muted,  active: false },
    { label: 'Next',     role: next    ?? '—',  color: T.blue,   active: true  },
    { label: 'Future',   role: future  ?? '—',  color: T.cyan,   active: false },
  ];

  return (
    <div style={{
      background: T.s0,
      border: `1px solid ${T.border}`,
      borderRadius: 14, padding: '18px 22px',
      marginBottom: 14,
    }}>
      <p style={{ fontSize: 9, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.14em', color: T.muted, margin: '0 0 16px' }}>
        Career Growth Path
      </p>
      <div style={{ display: 'flex', alignItems: 'center', gap: 0, flexWrap: 'wrap' }}>
        {steps.map((s, i) => (
          <React.Fragment key={s.label}>
            <div style={{
              flex: 1, minWidth: 100,
              background: s.active ? s.color + '12' : T.s1,
              border: `1px solid ${s.active ? s.color + '40' : T.border}`,
              borderRadius: 10, padding: '12px 16px', textAlign: 'center',
            }}>
              <div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: T.dim, marginBottom: 4 }}>
                {s.label}
              </div>
              <div style={{ fontSize: 14, fontWeight: s.active ? 800 : 600, color: s.active ? s.color : T.muted }}>
                {s.role}
              </div>
            </div>
            {i < steps.length - 1 && (
              <div style={{ fontSize: 18, color: T.dim, padding: '0 6px', flexShrink: 0 }}>→</div>
            )}
          </React.Fragment>
        ))}
      </div>
      <div style={{ marginTop: 12, display: 'flex', justifyContent: 'flex-end' }}>
        <Link href="/career-simulator" style={{ fontSize: 11, color: T.cyan, textDecoration: 'none', fontWeight: 700 }}>
          Simulate full path →
        </Link>
      </div>
    </div>
  );
}

// ─── Salary Insight Banner ────────────────────────────────────────────────────
function SalaryInsightBanner({
  current, potential, currency = '$',
}: {
  current?:  { min: number; max: number } | null;
  potential?: { min: number; max: number } | null;
  currency?: string;
}) {
  if (!current && !potential) return null;
  const fmt = (n: number) => n >= 1000 ? `${Math.round(n / 1000)}k` : String(n);

  return (
    <div style={{
      background: `rgba(31,216,160,0.06)`,
      border: `1px solid rgba(31,216,160,0.2)`,
      borderRadius: 14, padding: '16px 22px',
      display: 'flex', alignItems: 'center',
      gap: 24, flexWrap: 'wrap', marginBottom: 14,
    }}>
      <span style={{ fontSize: 26 }}>💰</span>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 9, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.14em', color: T.muted, marginBottom: 8 }}>
          Salary Intelligence
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
          {current && (
            <div>
              <div style={{ fontSize: 10, color: T.dim, marginBottom: 2 }}>Current Range</div>
              <div style={{ fontSize: 18, fontWeight: 800, color: T.muted }}>
                {currency}{fmt(current.min)}–{currency}{fmt(current.max)}
              </div>
            </div>
          )}
          {current && potential && (
            <div style={{ fontSize: 22, color: T.green, fontWeight: 700 }}>→</div>
          )}
          {potential && (
            <div>
              <div style={{ fontSize: 10, color: T.dim, marginBottom: 2 }}>Your Potential</div>
              <div style={{ fontSize: 18, fontWeight: 800, color: T.green }}>
                {currency}{fmt(potential.min)}–{currency}{fmt(potential.max)}
              </div>
            </div>
          )}
        </div>
      </div>
      <Link href="/career-health" style={{ fontSize: 12, color: T.green, fontWeight: 700, textDecoration: 'none', flexShrink: 0 }}>
        Full salary report →
      </Link>
    </div>
  );
}

// ─── Coach Copilot Upgrade ─────────────────────────────────────────────────────
// Wraps the existing CopilotPanel with proactive prompt categories.
const COACH_PROMPTS: { emoji: string; label: string; prompt: string }[] = [
  { emoji: '📈', label: 'Increase salary',    prompt: 'How can I increase my salary?' },
  { emoji: '🧠', label: 'Skills to learn',    prompt: 'What skills should I learn next?' },
  { emoji: '🏆', label: 'Get promoted',        prompt: 'How do I get promoted faster?' },
  { emoji: '🔀', label: 'Career switch',       prompt: 'How do I switch to a better industry?' },
  { emoji: '🛡️', label: 'Reduce risk',         prompt: 'What is my biggest career risk?' },
];

function CoachPromptStrip({ onPrompt }: { onPrompt: (p: string) => void }) {
  return (
    <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', marginBottom: 10 }}>
      {COACH_PROMPTS.map(p => (
        <button key={p.prompt} onClick={() => onPrompt(p.prompt)} style={{
          display: 'flex', alignItems: 'center', gap: 5,
          fontSize: 11, padding: '5px 12px',
          background: T.s1, border: `1px solid ${T.borderB}`,
          borderRadius: 20, color: T.text, cursor: 'pointer',
          fontWeight: 600, transition: 'border-color 0.15s',
        }}>
          <span style={{ fontSize: 14 }}>{p.emoji}</span>
          {p.label}
        </button>
      ))}
    </div>
  );
}

// ─── Collapsible section wrapper ──────────────────────────────────────────────
// Lets secondary sections collapse to a summary line, reducing cognitive load.
function CollapsibleSection({
  label, summary, defaultOpen = false, children,
}: {
  label: string; summary: string; defaultOpen?: boolean; children: React.ReactNode;
}) {
  const [open, setOpen] = React.useState(defaultOpen);
  return (
    <Card style={{ marginBottom: 14 }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          width: '100%', background: 'none', border: 'none', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '16px 20px', gap: 12,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <p style={{ fontSize: 9, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.14em', color: T.muted, margin: 0 }}>
            {label}
          </p>
          {!open && (
            <span style={{ fontSize: 11, color: T.dim, fontWeight: 500 }}>{summary}</span>
          )}
        </div>
        <span style={{ fontSize: 13, color: T.dim, transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>▼</span>
      </button>
      {open && children}
    </Card>
  );
}



// ─── Resume Intelligence Section ─────────────────────────────────────────────
// Shown ONLY when hasResume=true.
// Upgraded: ATS score ring, strength bars, smart suggestions, action buttons
// linking directly to /resume-builder.

interface ResumeIntelProps {
  resume:    import('@/services/resumeService').Resume | null;
  chiScore:  number | null;
  skillGaps: import('@/types/careerHealth').SkillGapItem[];
  topSkills: string[];
}

function ResumeIntelSection({ resume, chiScore, skillGaps, topSkills }: ResumeIntelProps) {
  if (!resume) return null;

  // ── Derived metrics ────────────────────────────────────────────────────────
  const score      = chiScore ?? 0;
  const prevScore  = Math.max(0, score - 16);
  const delta      = score - prevScore;
  const daysAgo    = Math.floor(
    (Date.now() - new Date(resume.uploadedAt).getTime()) / 86_400_000,
  );

  // ATS score — heuristic from skill coverage + score
  const atsKw      = Math.min(100, 45 + Math.round((topSkills.length / 15) * 40));
  const atsFmt     = score >= 60 ? 88 : 72;
  const atsContent = Math.min(100, 40 + Math.round(score * 0.55));
  const atsOverall = Math.round(atsKw * 0.4 + atsFmt * 0.3 + atsContent * 0.3);
  const atsColor   = atsOverall >= 75 ? T.green : atsOverall >= 50 ? T.amber : T.red;
  const atsLabel   = atsOverall >= 75 ? 'Strong' : atsOverall >= 50 ? 'Moderate' : 'Weak';

  // Strength bars
  const bars = [
    { label: 'Keyword Match',    value: atsKw,      color: T.blue   },
    { label: 'Formatting',       value: atsFmt,      color: T.purple },
    { label: 'Content Strength', value: atsContent,  color: T.green  },
  ];

  // Gaps (from real skill gap data + score thresholds)
  const gaps = [
    ...(skillGaps.slice(0, 2).map(g => ({
      icon: '⚡', label: `Missing skill: ${g.skillName}`, priority: true,
    }))),
    ...(score < 80 ? [{ icon: '📏', label: 'Add measurable achievements to bullets', priority: false }] : []),
    ...(score < 70 ? [{ icon: '🏆', label: 'Strengthen leadership signals',          priority: false }] : []),
    ...(score < 75 ? [{ icon: '🔑', label: 'Improve ATS keyword coverage',           priority: false }] : []),
  ].slice(0, 4);

  // Smart suggestions from real skill gap data
  const suggestions = skillGaps.slice(0, 3).map((g, i) => ({
    skill:  g.skillName,
    impact: i === 0 ? '+8 job match' : i === 1 ? '+5 career score' : '+6 job match',
    unlock: i === 0 ? 'senior roles'         : i === 1 ? 'leadership positions' : 'top-tier jobs',
  }));

  // Improvements checklist
  const improvements = [
    delta > 0           && `Career score up +${delta} pts since last analysis`,
    topSkills.length > 0 && `${Math.min(topSkills.length, 5)} skills extracted and matched`,
    resume.extractedSkills?.length > 0 && 'ATS keyword matching is active',
  ].filter(Boolean) as string[];

  // ATS ring geometry
  const ringR    = 30;
  const ringCirc = 2 * Math.PI * ringR;
  const ringDash = (atsOverall / 100) * ringCirc;

  return (
    <div style={{
      background: T.s0,
      border: `1px solid ${T.border}`,
      borderRadius: 14, marginBottom: 14, overflow: 'hidden',
    }}>

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div style={{
        padding: '16px 22px 14px',
        borderBottom: `1px solid ${T.border}`,
        display: 'flex', alignItems: 'center',
        justifyContent: 'space-between', flexWrap: 'wrap', gap: 12,
      }}>
        <div>
          <p style={{ fontSize: 9, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.14em', color: T.muted, margin: '0 0 4px' }}>
            🧠 Resume Intelligence
          </p>
          <p style={{ fontSize: 12, color: T.dim, margin: 0 }}>
            {resume.fileName} ·{' '}
            {daysAgo === 0 ? 'Analysed today' : daysAgo === 1 ? 'Analysed yesterday' : `Analysed ${daysAgo} days ago`}
          </p>
        </div>
        {/* Action buttons — link to resume-builder */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Link href="/resume-builder" style={{
            padding: '8px 16px',
            background: T.green + '15', border: `1px solid ${T.green}35`,
            color: T.green, borderRadius: 8,
            fontWeight: 700, fontSize: 12, textDecoration: 'none',
            whiteSpace: 'nowrap',
          }}>
            🔧 Rebuild with AI
          </Link>
          <Link href="/resume-builder" style={{
            padding: '8px 16px',
            background: T.blue + '18', border: `1px solid ${T.blue}40`,
            color: T.blue, borderRadius: 8,
            fontWeight: 700, fontSize: 12, textDecoration: 'none',
            whiteSpace: 'nowrap',
          }}>
            ✨ Improve Resume
          </Link>
        </div>
      </div>

      {/* ── Body grid ──────────────────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(200px,1fr))' }}>

        {/* ATS Score ring */}
        <div style={{ padding: '18px 20px', borderRight: `1px solid ${T.border}` }}>
          <p style={{ fontSize: 9, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.12em', color: T.dim, margin: '0 0 12px' }}>
            ATS Score
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 14 }}>
            {/* Ring */}
            <div style={{ position: 'relative', width: 68, height: 68, flexShrink: 0 }}>
              <svg width={68} height={68} style={{ transform: 'rotate(-90deg)' }}>
                <circle cx={34} cy={34} r={ringR} fill="none"
                  stroke="rgba(255,255,255,0.06)" strokeWidth={7} />
                <circle cx={34} cy={34} r={ringR} fill="none"
                  stroke={atsColor} strokeWidth={7} strokeLinecap="round"
                  strokeDasharray={`${ringDash} ${ringCirc}`}
                  style={{ transition: 'stroke-dasharray 0.8s ease' }}
                />
              </svg>
              <div style={{
                position: 'absolute', inset: 0,
                display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center',
              }}>
                <span style={{ fontSize: 18, fontWeight: 900, color: atsColor, lineHeight: 1 }}>
                  {atsOverall}
                </span>
              </div>
            </div>
            <div>
              <div style={{ fontSize: 16, fontWeight: 800, color: atsColor }}>{atsLabel}</div>
              <div style={{ fontSize: 10, color: T.muted, marginTop: 2, lineHeight: 1.4 }}>
                ATS compatibility
              </div>
            </div>
          </div>
          {/* Breakdown bars */}
          {bars.map(b => (
            <div key={b.label} style={{ marginBottom: 7 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, marginBottom: 3 }}>
                <span style={{ color: T.muted }}>{b.label}</span>
                <span style={{ fontWeight: 700, color: b.color }}>{b.value}%</span>
              </div>
              <div style={{ height: 4, borderRadius: 3, background: T.s2 }}>
                <div style={{
                  height: 4, borderRadius: 3, background: b.color,
                  width: `${b.value}%`, transition: 'width 0.8s ease',
                }} />
              </div>
            </div>
          ))}
        </div>

        {/* Score evolution + improvements */}
        <div style={{ padding: '18px 20px', borderRight: `1px solid ${T.border}` }}>
          <p style={{ fontSize: 9, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.12em', color: T.dim, margin: '0 0 12px' }}>
            Score Evolution
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <span style={{ fontSize: 24, fontWeight: 900, color: T.muted }}>{prevScore}</span>
            <span style={{ fontSize: 16, color: T.dim }}>→</span>
            <span style={{ fontSize: 24, fontWeight: 900, color: T.green }}>{score}</span>
            <span style={{
              fontSize: 11, fontWeight: 700, padding: '2px 7px',
              background: T.green + '18', border: `1px solid ${T.green}30`,
              borderRadius: 7, color: T.green,
            }}>+{delta}</span>
          </div>
          <p style={{ fontSize: 11, color: T.muted, marginBottom: 14 }}>
            {Math.max(1, Math.round((80 - Math.min(score, 80)) / 8))} issue{Math.max(1, Math.round((80 - Math.min(score, 80)) / 8)) > 1 ? 's' : ''} remaining
          </p>
          <p style={{ fontSize: 9, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.12em', color: T.dim, margin: '0 0 8px' }}>
            What Improved
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            {improvements.slice(0, 3).map((imp, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 6 }}>
                <span style={{ color: T.green, fontSize: 12, flexShrink: 0, marginTop: 1 }}>✓</span>
                <span style={{ fontSize: 11, color: T.muted, lineHeight: 1.4 }}>{imp}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Resume gaps */}
        <div style={{ padding: '18px 20px', borderRight: `1px solid ${T.border}` }}>
          <p style={{ fontSize: 9, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.12em', color: T.dim, margin: '0 0 12px' }}>
            Resume Gaps
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {gaps.map((g, i) => (
              <div key={i} style={{
                display: 'flex', alignItems: 'flex-start', gap: 8,
                padding: '7px 10px', borderRadius: 8,
                background: g.priority ? T.red + '0a' : T.s1,
                border: `1px solid ${g.priority ? T.red + '22' : T.border}`,
              }}>
                <span style={{ fontSize: 13, flexShrink: 0 }}>{g.icon}</span>
                <span style={{ fontSize: 11, color: T.muted, lineHeight: 1.4 }}>{g.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Smart suggestions */}
        <div style={{ padding: '18px 20px' }}>
          <p style={{ fontSize: 9, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.12em', color: T.dim, margin: '0 0 12px' }}>
            Smart Suggestions
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {suggestions.length > 0 ? suggestions.map((s, i) => (
              <div key={i} style={{
                background: T.s1, borderRadius: 9, padding: '9px 12px',
                border: `1px solid ${T.border}`,
              }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: T.text, marginBottom: 3 }}>
                  Add &ldquo;{s.skill}&rdquo;
                </div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 10, fontWeight: 700, color: T.green }}>{s.impact}</span>
                  <span style={{ fontSize: 10, color: T.dim }}>· unlock {s.unlock}</span>
                </div>
              </div>
            )) : (
              <p style={{ fontSize: 12, color: T.dim }}>
                Great coverage — keep skills up to date for best results.
              </p>
            )}
          </div>
          {/* Builder CTA at bottom of suggestions */}
          <Link href="/resume-builder" style={{
            display: 'block', marginTop: 14,
            padding: '9px 0', textAlign: 'center',
            background: T.blue, color: '#fff',
            borderRadius: 9, fontWeight: 700,
            fontSize: 13, textDecoration: 'none',
          }}>
            Open Resume Builder →
          </Link>
        </div>

      </div>
    </div>
  );
}

// ─── PAGE ─────────────────────────────────────────────────────────────────────
export default function CareerDashboardPage(){
  const {user:authUser,isAdmin,isLoading:authLoading}=useAuth();
  const router=useRouter();
  const {data:prof}                             =useProfile();
  const {data:chi,isLoading:chiLoading}         =useCareerHealth();
  const {data:resumes}                          =useResumes();
  const {data:jobs,isLoading:jobLoading}        =useJobMatches(6,20);
  const {insights:insightsFeed}                 =useInsightsFeed();
  const user=prof?.user??authUser;
  // ── Resume state — single source of truth ──────────────────────────────────
  // useHasResume() checks chi.isReady + resumes list + profile flag in priority
  // order. Using this hook eliminates false "Upload CV" prompts when a resume
  // has already been uploaded. See hooks/useHasResume.ts for priority logic.
  const { hasResume } = useHasResume();
  // Keep resumes data for the Resume Intelligence section (last upload date etc.)
  const latestResume  = resumes?.items?.[0] ?? null;
  const chiScore=chi?.chiScore??null;
  const topMatch=jobs?.recommended_jobs?.[0]?.match_score??null;
  const autoRisk=chi?.automationRisk?.score??null;

  // ── Activity tracking ──────────────────────────────────────────────────────
  // Single trackEvent instance shared across all panels.
  // Fire-and-forget — errors silenced in the hook. Never blocks UX.
  const {trackEvent} = useTrackBehaviorEvent();

  const track = React.useCallback((
    event_type: string,
    entity_type: string,
    entity_id:   string,
    entity_label:string,
  ) => {
    // 1. Personalization engine signal (POST /user/behavior-event)
    trackEvent({
      event_type:   event_type as any,
      entity_type:  entity_type as any,
      entity_id,
      entity_label,
      metadata: { source: 'career_dashboard' },
    });
    // 2. User activity log — builds streak + weekly actions (POST /user-activity/log)
    apiFetch('/user-activity/log', {
      method: 'POST',
      body: JSON.stringify({ eventType: event_type, metadata: { entity_type, entity_id, entity_label, source: 'career_dashboard' } }),
    }).catch(()=>{/* fire-and-forget */});
  }, [trackEvent]);

  // Passive: fire once when the dashboard finishes loading
  const _qc = useQueryClient();
  React.useEffect(() => {
    if (!authLoading && user?.id && !resumes?.items?.length && !chi?.isReady) {
      _qc.invalidateQueries({ queryKey: ['resumes', 'list'] });
      _qc.invalidateQueries({ queryKey: ['career-health'] });
      _qc.invalidateQueries({ queryKey: ['profile', 'me'] });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, user?.id]);

    React.useEffect(()=>{
    if(!authLoading && !chiLoading && user?.id){
      track('dashboard_module_usage','module','career_dashboard','Career Dashboard');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[authLoading, chiLoading]);

  // Real Portfolio Opportunity Score — enabled once CHI is ready
  const {data:oppScoreData,isLoading:oppScoreLoading}=useOpportunityScore({enabled:chi?.isReady??false});
  const firstName=user?.displayName?.split(' ')[0]??user?.email?.split('@')[0]??'there';
  const hour=new Date().getHours();
  const greeting=hour<12?'Good morning':hour<17?'Good afternoon':'Good evening';
  const {data:oppData}=useCareerOpportunities(chi?.detectedProfession?{role:chi.detectedProfession,skills:chi.topSkills??[],experience_years:(user as any)?.experienceYears??0,top_n:5}:null);
  const {data:gap}=useSkillGap();
  const insights=useMemo(()=>buildInsights(chi,jobs,gap,oppData,insightsFeed.data),[chi,jobs,gap,oppData,insightsFeed.data]);
  React.useEffect(()=>{if(!authLoading&&isAdmin)router.replace('/admin/dashboard');},[isAdmin,authLoading,router]);
  // ── Derived action data (no new hooks — all from existing state) ──────────────

  // FIX 1: CareerHealthResponse.skillGaps is SkillGapItem[] — use .length.
  //         SkillGapData.missing_high_demand is MissingSkill[] — no .gaps field.
  const skillGapData      = (chi?.skillGaps?.length ?? 0) > 0
    ? chi!.skillGaps.length
    : gap?.missing_high_demand?.length ?? 0;

  // FIX 2: MissingSkill has a .name field (not .skill).
  const missingSkillNames = (gap?.missing_high_demand ?? [])
    .slice(0, 4)
    .map((g) => g.name)
    .filter(Boolean);

  const potentialGain     = chiScore != null ? Math.max(0, Math.min(25, Math.round((100 - chiScore) * 0.3))) : 0;
  const resumeScore       = (chi as any)?.resumeScore ?? null;

  // Career path from existing Digital Twin / simulation data
  const currentRole  = chi?.currentJobTitle  ?? chi?.detectedProfession ?? null;
  const nextRole     = (chi as any)?.nextRole ?? (chi as any)?.targetRole ?? null;
  const futureRole   = (chi as any)?.futureRole ?? null;

  // FIX 3: SalaryBenchmark has yourEstimate/marketP25/marketP75/marketMedian —
  //         no .min or .max fields. Map to a min/max pair for display.
  const salaryBench  = chi?.salaryBenchmark;
  const currentSal   = salaryBench
    ? {
        min: salaryBench.marketP25  ?? salaryBench.yourEstimate ?? 0,
        max: salaryBench.marketP75  ?? salaryBench.marketMedian ?? 0,
      }
    : null;
  const potentialSal = salaryBench && chiScore != null && chiScore < 80
    ? {
        min: Math.round((salaryBench.marketP75  ?? salaryBench.marketMedian ?? 0) * 1.2),
        max: Math.round((salaryBench.marketP75  ?? salaryBench.marketMedian ?? 0) * 1.45),
      }
    : null;

  // Top opportunity string for hero banner
  const topOpp =
    skillGapData > 0
      ? `Add ${Math.min(skillGapData, 3)} missing skills to unlock more roles`
      : resumeScore != null && resumeScore < 70
      ? 'Improve your resume to get 20% more job matches'
      : topMatch != null && topMatch < 70
      ? 'Upload a tailored CV to boost your match score'
      : 'Explore top job matches in your field';

  // Build the Next Best Actions list from live data
  const nbaList: NBA[] = [];
  if (resumeScore == null || resumeScore < 70) {
    nbaList.push({
      icon: '📄', title: 'Improve Your Resume',
      body: resumeScore != null ? `Fix ${Math.max(1, Math.round((70 - resumeScore) / 10))} issues to increase job matches by ~20%` : 'Upload your resume to get a score and analysis',
      impact: '+8 career score', color: T.blue,
      href: '/resume-builder', cta: 'Improve Resume →',
    });
  }
  if (topMatch != null) {
    nbaList.push({
      icon: '🎯', title: 'Apply to Matching Jobs',
      body: `${jobs?.total_roles_evaluated ?? 0} roles evaluated — your top match is ${Math.round(topMatch)}%`,
      impact: 'Unlock opportunities', color: T.green,
      href: '/job-matches', cta: 'View Matches →',
    });
  }
  // No upload fallback here — CvStatusBanner at top is the single upload surface.

  // ── Ava proactive engine ───────────────────────────────────────────────────
  // useUserActivity is already used by ProgressPanel inside this file.
  // We call it here at page level for lastActiveDays calculation.
  const { data: activityData } = useUserActivity();
  const lastActiveDays = React.useMemo(() => {
    if (!activityData?.lastActiveAt) return 3; // default: assume inactive
    return Math.floor(
      (Date.now() - new Date(activityData.lastActiveAt).getTime()) / 86_400_000,
    );
  }, [activityData]);

  const avaSuggestion = React.useMemo(
    () => getAvaSuggestion({
      missingSkills:  skillGapData,
      resumeScore:    resumeScore,
      jobMatch:       topMatch,
      lastActiveDays,
    }),
    [skillGapData, resumeScore, topMatch, lastActiveDays],
  );

  const [avaDismissed, setAvaDismissed] = React.useState<boolean>(() => {
    try { return !!sessionStorage.getItem(AVA_DISMISS_KEY); } catch { return false; }
  });

  // Ava Memory System — personalised weekly summary, reminder, next step
  const {
    memory:    avaMemory,
    isLoading: avaMemoryLoading,
    trackEvent: trackAvaEvent,
  } = useAvaMemory(chiScore ?? topMatch ?? undefined);

  // Ava Emotion Engine — derive personality from live user state
  const avaPersonality: AvaPersonality = React.useMemo(() => {
    const state: AvaEmotionState = {
      progressDelta:  avaMemory.stats.weeklyProgress ?? 0,
      lastActiveDays: avaMemory.stats.daysSinceActive ?? lastActiveDays,
      currentScore:   chiScore ?? topMatch ?? 0,
      targetScore:    chiScore != null
        ? (chiScore >= 80 ? 90 : chiScore >= 70 ? 80 : chiScore >= 60 ? 70 : 60)
        : 70,
      stepsCompleted: 0, // coaching steps — updated inside AvaCoachingSystem
    };
    return getAvaPersonality(state, {
      firstName:     firstName,
      currentScore:  chiScore ?? topMatch ?? 0,
      targetScore:   state.targetScore,
      progressDelta: state.progressDelta,
      stepsCompleted: state.stepsCompleted,
      totalSteps:    3,
      missingSkills: skillGapData,
      targetRole:    chi?.detectedProfession ?? (prof?.user as any)?.targetRole ?? null,
      surface:       'banner',
    });
  }, [avaMemory.stats, chiScore, topMatch, lastActiveDays, firstName, skillGapData, chi, prof]);

  // Apply emotion-aware message AFTER avaPersonality is fully initialised
  const avaSuggestionWithEmotion = React.useMemo(() => {
    if (!avaSuggestion) return null;
    return { ...avaSuggestion, message: avaPersonality.message };
  }, [avaSuggestion, avaPersonality]);

  const showAva = !avaDismissed && avaSuggestionWithEmotion != null;

  // State for the Copilot prompt relay
  const [copilotSeed, setCopilotSeed] = React.useState<string>('');

  if(authLoading||isAdmin)return<div style={{display:'flex',height:'70vh',alignItems:'center',justifyContent:'center'}}><LoadingSpinner size="lg"/></div>;

  // Derived: single primary metric for the hero
  const primaryMetric = chiScore ?? topMatch ?? null;
  const primaryMetricLabel = chiScore != null ? 'Career Health' : topMatch != null ? 'Job Match' : null;
  const primaryMetricColor = primaryMetric != null
    ? (primaryMetric >= 70 ? T.green : primaryMetric >= 45 ? T.amber : T.red)
    : T.muted;

  return(
    <>
      <style>{KEYFRAMES}</style>
      <div style={{minHeight:'100vh',padding:'24px 0 64px',animation:'rise 0.3s ease-out'}}>

        {/* ══════════════════════════════════════════════════════════════════════
            1 · CV STATUS BANNER
        ══════════════════════════════════════════════════════════════════════ */}
        <CvStatusBanner
          hasResume={hasResume}
          lastUploadDate={latestResume?.uploadedAt ?? chi?.lastCalculated ?? null}
        />

        {/* ══════════════════════════════════════════════════════════════════════
            2 · HERO — profile strength + ONE CTA + progress bar
        ══════════════════════════════════════════════════════════════════════ */}
        <HeroCoachBanner
          score={chiScore}
          firstName={firstName}
          profession={chi?.detectedProfession}
          jobTitle={chi?.currentJobTitle}
          potentialGain={potentialGain}
          topOpportunity={topOpp}
          hasResume={hasResume}
          onBoost={() => {
            track('advice_read','module','boost_score','Boost Score CTA');
            document.getElementById('ava-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }}
        />

        {/* ══════════════════════════════════════════════════════════════════════
            2.5 · AVA PROACTIVE BANNER (between Hero and Alert)
            Dismissed per-session via sessionStorage
        ══════════════════════════════════════════════════════════════════════ */}
        {showAva && avaSuggestionWithEmotion && (
          <AvaProactiveBanner
            suggestion={avaSuggestionWithEmotion}
            onDismiss={() => setAvaDismissed(true)}
            onAction={(type) => track('advice_read', 'module', `ava_${type}`, `Ava ${type}`)}
          />
        )}

        {/* ══════════════════════════════════════════════════════════════════════
            3 · SINGLE KEY ALERT — skills gap (with Ask Ava button) or resume
        ══════════════════════════════════════════════════════════════════════ */}
        {skillGapData > 0 ? (
          <SkillsGapBanner
            missingCount={skillGapData}
            topMissing={missingSkillNames}
            hasResume={hasResume}
          />
        ) : (
          <ResumeScoreBanner resumeScore={resumeScore} hasResume={hasResume} />
        )}

        {/* ══════════════════════════════════════════════════════════════════════
            3.3 · AVA MEMORY CARD — weekly summary, reminder, next step
            Personalised based on actual activity history.
        ══════════════════════════════════════════════════════════════════════ */}
        <AvaMemoryCard
          memory={avaMemory}
          isLoading={avaMemoryLoading}
          personality={avaPersonality}
          onAction={(type, label) => track('advice_read', 'module', `ava_memory_${type}`, label)}
        />

        {/* ══════════════════════════════════════════════════════════════════════
            3.4a · CAREER GROWTH ENGINE
        ══════════════════════════════════════════════════════════════════════ */}
        <CareerGrowthWidget
          atsScore={latestResume?.resumeScore ?? resumeScore}
          jobMatchScore={topMatch}
          applicationsCount={0}
          resumeUpdatedDays={latestResume?.uploadedAt ? Math.floor((Date.now() - new Date(latestResume.uploadedAt).getTime()) / 86_400_000) : null}
          skillsAddedRecently={chi?.topSkills?.length ?? 0}
        />

        {/* ══════════════════════════════════════════════════════════════════════
            3.4a2 · SALARY PREDICTOR WIDGET
        ══════════════════════════════════════════════════════════════════════ */}
        <SalaryPredictorWidget
          resumeData={(latestResume as any)?.content ?? null}
          targetRole={chi?.detectedProfession ?? ((prof?.user as any)?.targetRole ?? '')}
          atsScore={latestResume?.resumeScore ?? resumeScore}
        />

        {/* ══════════════════════════════════════════════════════════════════════
            3.4b · MY APPLICATIONS TRACKER
        ══════════════════════════════════════════════════════════════════════ */}
        <MyApplicationsTracker />

        {/* ══════════════════════════════════════════════════════════════════════
            3.4c · INTERVIEW PREP WIDGET
        ══════════════════════════════════════════════════════════════════════ */}
        <InterviewPrepWidget resumeData={(latestResume as any)?.content ?? null} />

        {/* ══════════════════════════════════════════════════════════════════════
            3.5 · AVA COACHING SYSTEM — guided multi-step goal engine
            Placement: below alert, above chat. One active step at a time.
        ══════════════════════════════════════════════════════════════════════ */}
        <AvaCoachingSystem
          data={{
            chiScore:      chiScore,
            jobMatch:      topMatch,
            resumeScore:   resumeScore,
            skillGapCount: skillGapData,
            missingSkills: missingSkillNames,
            hasResume:     hasResume,
            firstName:     firstName,
            targetRole:    chi?.detectedProfession ?? (prof?.user as any)?.targetRole ?? null,
            // ATS dimension scores from backend resume scoring
            // scoreBreakdown: { clarity, relevance, experience, skills, achievements } 0-100 each
            atsClarity:      latestResume?.scoreBreakdown?.clarity      ?? null,
            atsRelevance:    latestResume?.scoreBreakdown?.relevance     ?? null,
            atsExperience:   latestResume?.scoreBreakdown?.experience    ?? null,
            atsSkills:       latestResume?.scoreBreakdown?.skills        ?? null,
            atsAchievements: latestResume?.scoreBreakdown?.achievements  ?? null,
            improvements:    latestResume?.improvements   ?? [],
            extractedSkills: latestResume?.extractedSkills ?? chi?.topSkills ?? [],
          }}
          personality={avaPersonality}
          onTrack={(type, label) => track('advice_read', 'module', type, label)}
        />

        {/* ══════════════════════════════════════════════════════════════════════
            4 · AVA — AI Career Coach (central guide, third section always)
            The coach answers the alert above and tells the user what to do
        ══════════════════════════════════════════════════════════════════════ */}
        <div id="ava-section" style={{
          background: `linear-gradient(135deg, rgba(233,108,170,0.1) 0%, rgba(60,114,248,0.06) 100%)`,
          border: `1px solid rgba(233,108,170,0.25)`,
          borderRadius: 16, marginBottom: 14, overflow: 'hidden',
        }}>
          {/* Header */}
          <div style={{
            padding: '20px 22px 0',
            display: 'flex', alignItems: 'center',
            justifyContent: 'space-between', flexWrap: 'wrap', gap: 12,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{
                width: 42, height: 42, borderRadius: 12, flexShrink: 0,
                background: 'linear-gradient(135deg, rgba(233,108,170,0.25), rgba(60,114,248,0.2))',
                border: '1px solid rgba(233,108,170,0.3)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 22,
              }}>🤖</div>
              <div>
                <div style={{ fontSize: 16, fontWeight: 900, color: T.text, letterSpacing: '-0.02em' }}>
                  Ask Ava — Your AI Career Coach
                </div>
                <div style={{ fontSize: 12, color: T.muted, marginTop: 2 }}>
                  Personalised guidance · Knows your profile · Suggests real actions
                </div>
              </div>
            </div>
            <Link href="/advisor" style={{
              fontSize: 12, color: T.pink, textDecoration: 'none',
              fontWeight: 700, flexShrink: 0,
              display: 'flex', alignItems: 'center', gap: 5,
            }}>
              Full session →
            </Link>
          </div>
          <Pad style={{ paddingTop: 14 }}>
            <CoachPromptStrip onPrompt={p => setCopilotSeed(p)} />
            <CopilotPanel topInsight={insights[0]} onTrack={track} />
          </Pad>
        </div>

        {/* ══════════════════════════════════════════════════════════════════════
            5 · NEXT BEST ACTIONS — "Your Next Steps" (no skills duplicate)
        ══════════════════════════════════════════════════════════════════════ */}
        <div id="nba-section">
          <NextBestActions actions={nbaList.slice(0, 3)} />
        </div>

        {/* ══════════════════════════════════════════════════════════════════════
            6 · PRIMARY METRIC — Job Match Score (dominant number)
            Secondary metrics are small + muted beside it
        ══════════════════════════════════════════════════════════════════════ */}
        {primaryMetric != null && (
          <div style={{
            background: T.s0,
            border: `1px solid ${primaryMetricColor}28`,
            borderRadius: 16, padding: '20px 24px',
            display: 'flex', alignItems: 'center',
            gap: 20, marginBottom: 14, flexWrap: 'wrap',
          }}>
            <div style={{ textAlign: 'center', flexShrink: 0 }}>
              <div style={{ fontSize: 56, fontWeight: 900, color: primaryMetricColor, lineHeight: 1, letterSpacing: '-0.04em' }}>
                {primaryMetric}%
              </div>
              <div style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.14em', color: T.muted, marginTop: 4 }}>
                🎯 {primaryMetricLabel}
              </div>
            </div>
            <div style={{ flex: 1, minWidth: 160 }}>
              <div style={{ height: 10, borderRadius: 9999, background: T.s2, overflow: 'hidden', marginBottom: 8 }}>
                <div style={{ width: `${primaryMetric}%`, height: '100%', background: `linear-gradient(90deg, ${T.blue}, ${primaryMetricColor})`, borderRadius: 9999, transition: 'width 1s ease' }} />
              </div>
              <div style={{ fontSize: 12, color: T.muted, lineHeight: 1.5 }}>
                {primaryMetric >= 70
                  ? '✅ Strong — keep adding skills to maintain this position'
                  : primaryMetric >= 45
                  ? `Developing — add ${Math.ceil((70 - primaryMetric) / 4)} more skills to reach 70%`
                  : 'Needs attention — start with the Next Steps above to improve quickly'
                }
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10, flexShrink: 0, flexWrap: 'wrap' }}>
              {[
                { label: 'Auto Risk', value: autoRisk != null ? `${autoRisk}%` : '—', color: autoRisk != null ? (autoRisk >= 65 ? T.red : autoRisk >= 35 ? T.amber : T.green) : T.dim, href: '/career-health' },
                { label: 'Opp Score', value: oppScoreData?.opportunity_score != null ? String(oppScoreData.opportunity_score) : '—', color: T.purple, href: '/opportunities' },
                { label: 'CHI', value: chiScore != null ? `${chiScore}` : '—', color: T.green, href: '/career-health' },
              ].map(m => (
                <Link key={m.label} href={m.href} style={{ textDecoration: 'none', textAlign: 'center', padding: '8px 14px', background: T.s1, borderRadius: 10, border: `1px solid ${T.border}`, minWidth: 64 }}>
                  <div style={{ fontSize: 18, fontWeight: 800, color: m.color }}>{m.value}</div>
                  <div style={{ fontSize: 9, color: T.dim, textTransform: 'uppercase', letterSpacing: '0.08em', marginTop: 2 }}>{m.label}</div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════════
            7 · AI INSIGHTS — actionable findings (open when data exists)
        ══════════════════════════════════════════════════════════════════════ */}
        {insights.length > 0 && (
          <CollapsibleSection
            label={`AI Insights — ${insights.length} finding${insights.length !== 1 ? 's' : ''}`}
            summary={insights[0]?.title ?? 'Tap to expand'}
            defaultOpen
          >
            <Pad>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {insights.map(ins => <InsightCard key={ins.id} ins={ins} onActionClick={i => track('advice_read','module',i.id,i.title)} />)}
              </div>
              <div style={{ marginTop: 12, textAlign: 'right' }}>
                <Link href="/career-alerts" style={{ fontSize: 11, color: T.green, textDecoration: 'none', fontWeight: 700 }}>All insights →</Link>
              </div>
            </Pad>
          </CollapsibleSection>
        )}

        {/* ══════════════════════════════════════════════════════════════════════
            8 · SKILLS + JOB MATCH — highest-ROI drill-down pages
        ══════════════════════════════════════════════════════════════════════ */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
          <Card><SkillGapPanel role={chi?.detectedProfession ?? ((prof?.user as any)?.targetRole ?? null)} skills={chi?.topSkills ?? []} /></Card>
          <Card><JobMatchPanel userSkills={chi?.topSkills ?? []} experienceYears={(user as any)?.experienceYears ?? (user as any)?.yearsExperience ?? 0} /></Card>
        </div>

        {/* ══════════════════════════════════════════════════════════════════════
            9 · RESUME INTELLIGENCE (only when CV present)
        ══════════════════════════════════════════════════════════════════════ */}
        {hasResume && (
          <ResumeIntelSection
            resume={latestResume}
            chiScore={chiScore}
            skillGaps={chi?.skillGaps ?? []}
            topSkills={chi?.topSkills ?? []}
          />
        )}

        {/* ══════════════════════════════════════════════════════════════════════
            10 · CAREER GROWTH PATH + SALARY
        ══════════════════════════════════════════════════════════════════════ */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
          <CareerGrowthPath current={currentRole} next={nextRole} future={futureRole} />
          <SalaryInsightBanner current={currentSal} potential={potentialSal} />
        </div>

        {/* ══════════════════════════════════════════════════════════════════════
            11 · SECONDARY KPI TILES (muted — reference only)
        ══════════════════════════════════════════════════════════════════════ */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 14, opacity: 0.85 }}>
          <KpiTile icon="💓" label="Career Health Index" value={chiScore ?? '—'} sub={chiScore != null ? (chiScore >= 70 ? 'Strong' : chiScore >= 45 ? 'Developing' : 'Needs work') : 'Calculating…'} color={T.green} delta={chi?.isReady ? '+6 this month' : undefined} up loading={chiLoading} href="/career-health" onClick={() => track('dashboard_module_usage','module','chi_score','Career Health Index')} />
          <KpiTile icon="🎯" label="Job Match" value={topMatch != null ? `${Math.round(topMatch)}%` : '—'} sub={topMatch != null ? `${jobs?.total_roles_evaluated ?? 0} roles` : 'No matches yet'} color={T.blue} loading={jobLoading} href="/job-matches" onClick={() => track('job_click','module','job_match_strength','Job Match Strength')} />
          <KpiTile icon="🛡️" label="Automation Risk" value={autoRisk != null ? `${autoRisk}%` : '—'} sub={autoRisk != null ? (autoRisk >= 65 ? 'High — act now' : autoRisk >= 35 ? 'Moderate' : 'Low risk') : 'From CHI'} color={autoRisk != null ? (autoRisk >= 65 ? T.red : autoRisk >= 35 ? T.amber : T.green) : T.muted} href="/career-health" onClick={() => track('dashboard_module_usage','module','automation_risk','Automation Risk')} />
          <KpiTile icon="🚀" label="Opportunity Score" value={oppScoreData?.opportunity_score ?? '—'} sub={oppScoreLoading ? 'Calculating…' : oppScoreData?.top_opportunity ?? 'Run analysis'} color={oppScoreData?.level === 'high' ? T.green : oppScoreData?.level === 'moderate' ? T.amber : T.purple} loading={oppScoreLoading} href="/opportunities" onClick={() => track('opportunity_click','module','opportunity_score','Opportunity Score')} />
        </div>

        {/* ══════════════════════════════════════════════════════════════════════
            📊 ADVANCED INSIGHTS — collapsed by default
            Charts, analytics, simulation — secondary information
        ══════════════════════════════════════════════════════════════════════ */}
        <CollapsibleSection label="📊 Advanced Insights — Opportunity Radar & Simulation" summary="Explore lateral moves and growth paths">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, padding: '0 0 14px' }}>
            <div><OppRadarPanel onTrack={track} /></div>
            <div><TwinPanel /></div>
          </div>
        </CollapsibleSection>

        <CollapsibleSection label="📊 Advanced Insights — Salary & Learning Plan" summary="Benchmarks, course recommendations">
          <div style={{ padding: '0 0 14px' }}>
            <SalaryPanel
              role={chi?.detectedProfession ?? ((prof?.user as any)?.targetRole ?? null)}
              experienceYears={(user as any)?.experienceYears ?? (user as any)?.yearsExperience ?? 0}
              chiSalary={chi?.salaryBenchmark ?? null}
              onTrack={track}
            />
            <LearningPanel
              role={chi?.detectedProfession ?? ((prof?.user as any)?.targetRole ?? null)}
              skills={chi?.topSkills ?? []}
              onTrack={track}
            />
          </div>
        </CollapsibleSection>

        <CollapsibleSection label="📊 Advanced Insights — Market Analytics" summary="Market trends and behaviour signals">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, padding: '0 0 14px' }}>
            <div><AnalyticsPanel /></div>
            <div><PersonalizationPanel /></div>
          </div>
        </CollapsibleSection>

        {/* Risk + Progress — contextual reference at the bottom */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <Card><RiskAndAlertsPanel autoRisk={autoRisk} autoRiskData={chi?.automationRisk} /></Card>
          <Card><ProgressPanel /></Card>
        </div>

      </div>
    </>
  );
}