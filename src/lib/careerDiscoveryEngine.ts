/**
 * lib/careerDiscoveryEngine.ts
 * Extended with: 3 new strengths, CHI scoring, career clusters,
 * match reasons (Section 10 & 12), subjectClassification (Section 7).
 */

import type { AcademicMarks, YearMarks } from '@/services/studentOnboardingService';
import type { StrengthRatings, InterestArea, LearningStyle } from '@/services/studentOnboardingService';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface StudentProfile {
  interests:          InterestArea[];
  strengths:          StrengthRatings;
  learning_styles:    LearningStyle[];
  career_curiosities: string[];
  academic_marks?:    AcademicMarks | null;
}

export interface CareerMatch {
  id:          string;
  title:       string;
  emoji:       string;
  score:       number;
  description: string;
  topSkills:   string[];
  reasons:     string[];
  cluster:     string;
}

export interface CareerHealthIndex {
  score:     number;
  label:     string;
  tagline:   string;
  breakdown: { interests: number; strengths: number; academics: number; learning: number; curiosity: number };
}

export interface CareerIntelligenceReport {
  primaryCluster:     string;
  compatibilityScore: number;
  chi:                CareerHealthIndex;
  topCareers:         { rank: number; title: string; emoji: string }[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function avgSubject(marks: AcademicMarks | null | undefined, subj: keyof YearMarks): number {
  if (!marks) return 50;
  const vals = [marks.year_1[subj], marks.year_2[subj], marks.year_3[subj]]
    .filter((v): v is number => v !== null && v !== undefined);
  if (!vals.length) return 50;
  return vals.reduce((a, b) => a + b, 0) / vals.length;
}

function strengthPct(rating: number | undefined): number {
  if (!rating) return 50;
  return ((rating - 1) / 4) * 100;
}

function hasInterest(interests: InterestArea[], area: InterestArea): number {
  return interests.includes(area) ? 100 : 0;
}

function clamp(v: number): number { return Math.min(100, Math.max(0, v)); }

// ── Career definitions ────────────────────────────────────────────────────────

interface CareerDef {
  id: string; title: string; emoji: string; cluster: string;
  description: string; topSkills: string[];
  score:   (p: StudentProfile) => number;
  reasons: (p: StudentProfile) => string[];
}

const DEFS: CareerDef[] = [
  {
    id: 'software_engineer', title: 'Software Engineer', emoji: '💻',
    cluster: 'Technology & Data',
    description: 'Build software products — web apps, mobile apps, backend systems, and AI tools.',
    topSkills: ['Programming', 'Problem Solving', 'Algorithms', 'System Design'],
    score: (p) => clamp(avgSubject(p.academic_marks,'mathematics')*0.35 + avgSubject(p.academic_marks,'computer')*0.25 + hasInterest(p.interests,'technology')*0.20 + strengthPct(p.strengths.problem_solving)*0.15 + strengthPct(p.strengths.mathematics)*0.05),
    reasons: (p) => {
      const r: string[] = [];
      if ((p.strengths.problem_solving??0)>=4) r.push('Strong problem solving skills');
      if (avgSubject(p.academic_marks,'mathematics')>=70) r.push('High mathematics score');
      if (p.interests.includes('technology')) r.push('Interest in technology');
      if (avgSubject(p.academic_marks,'computer')>=70) r.push('Strong computer/IT marks');
      return r.slice(0,3);
    },
  },
  {
    id: 'data_scientist', title: 'Data Scientist', emoji: '📊',
    cluster: 'Technology & Data',
    description: 'Extract insights from large datasets using statistics, ML models, and visualisation.',
    topSkills: ['Statistics', 'Python/R', 'Machine Learning', 'Data Visualisation'],
    score: (p) => clamp(avgSubject(p.academic_marks,'mathematics')*0.35 + avgSubject(p.academic_marks,'science')*0.20 + avgSubject(p.academic_marks,'computer')*0.20 + hasInterest(p.interests,'technology')*0.15 + strengthPct(p.strengths.problem_solving)*0.10),
    reasons: (p) => {
      const r: string[] = [];
      if (avgSubject(p.academic_marks,'mathematics')>=70) r.push('Strong mathematics foundation');
      if ((p.strengths.analytical_thinking??0)>=4) r.push('Analytical thinking strength');
      if (p.interests.includes('technology')) r.push('Interest in technology');
      if ((p.strengths.attention_to_detail??0)>=4) r.push('High attention to detail');
      return r.slice(0,3);
    },
  },
  {
    id: 'ai_engineer', title: 'AI Engineer', emoji: '🤖',
    cluster: 'Technology & Data',
    description: 'Design and build AI models, machine learning pipelines, and intelligent systems.',
    topSkills: ['Python', 'Machine Learning', 'Mathematics', 'System Design'],
    score: (p) => clamp(avgSubject(p.academic_marks,'mathematics')*0.40 + avgSubject(p.academic_marks,'computer')*0.25 + hasInterest(p.interests,'technology')*0.20 + strengthPct(p.strengths.problem_solving)*0.15),
    reasons: (p) => {
      const r: string[] = [];
      if (avgSubject(p.academic_marks,'mathematics')>=75) r.push('Excellent mathematics score');
      if (p.interests.includes('technology')) r.push('Strong interest in technology');
      if ((p.strengths.problem_solving??0)>=4) r.push('Problem solving strength');
      if (avgSubject(p.academic_marks,'computer')>=70) r.push('Computer/IT proficiency');
      return r.slice(0,3);
    },
  },
  {
    id: 'doctor', title: 'Medical Doctor', emoji: '🏥',
    cluster: 'Health & Life Sciences',
    description: 'Diagnose and treat patients — specialise in surgery, psychiatry, research, and more.',
    topSkills: ['Biology', 'Chemistry', 'Empathy', 'Critical Thinking'],
    score: (p) => clamp(avgSubject(p.academic_marks,'science')*0.40 + hasInterest(p.interests,'healthcare')*0.30 + strengthPct(p.strengths.communication)*0.15 + strengthPct(p.strengths.problem_solving)*0.15),
    reasons: (p) => {
      const r: string[] = [];
      if (p.interests.includes('healthcare')) r.push('Interest in healthcare');
      if (avgSubject(p.academic_marks,'science')>=70) r.push('Strong science marks');
      if ((p.strengths.communication??0)>=4) r.push('Strong communication skills');
      if ((p.strengths.attention_to_detail??0)>=4) r.push('High attention to detail');
      return r.slice(0,3);
    },
  },
  {
    id: 'entrepreneur', title: 'Entrepreneur', emoji: '🚀',
    cluster: 'Business & Management',
    description: 'Launch and scale your own business — build products, lead teams, and create markets.',
    topSkills: ['Leadership', 'Sales', 'Product Thinking', 'Resilience'],
    score: (p) => clamp(hasInterest(p.interests,'business')*0.30 + strengthPct(p.strengths.leadership)*0.25 + strengthPct(p.strengths.creativity)*0.25 + strengthPct(p.strengths.communication)*0.20),
    reasons: (p) => {
      const r: string[] = [];
      if (p.interests.includes('business')) r.push('Interest in business');
      if ((p.strengths.leadership??0)>=4) r.push('Strong leadership skills');
      if ((p.strengths.creativity??0)>=4) r.push('Creative thinker');
      if ((p.strengths.communication??0)>=4) r.push('Excellent communication');
      return r.slice(0,3);
    },
  },
  {
    id: 'ux_designer', title: 'UX / Product Designer', emoji: '🎨',
    cluster: 'Design & Creative',
    description: 'Design beautiful, intuitive digital products that delight users.',
    topSkills: ['Design Thinking', 'Figma', 'User Research', 'Prototyping'],
    score: (p) => clamp(hasInterest(p.interests,'design')*0.35 + strengthPct(p.strengths.creativity)*0.30 + hasInterest(p.interests,'technology')*0.20 + strengthPct(p.strengths.communication)*0.15),
    reasons: (p) => {
      const r: string[] = [];
      if (p.interests.includes('design')) r.push('Interest in design');
      if ((p.strengths.creativity??0)>=4) r.push('High creativity rating');
      if ((p.strengths.attention_to_detail??0)>=4) r.push('Attention to detail');
      if (p.interests.includes('technology')) r.push('Interest in technology');
      return r.slice(0,3);
    },
  },
  {
    id: 'lawyer', title: 'Lawyer', emoji: '⚖️',
    cluster: 'Law & Social Sciences',
    description: 'Advise and represent clients — specialise in corporate law, human rights, or criminal defence.',
    topSkills: ['Critical Thinking', 'Argumentation', 'Research', 'Writing'],
    score: (p) => clamp(hasInterest(p.interests,'law')*0.35 + avgSubject(p.academic_marks,'language')*0.25 + avgSubject(p.academic_marks,'social_studies')*0.20 + strengthPct(p.strengths.communication)*0.20),
    reasons: (p) => {
      const r: string[] = [];
      if (p.interests.includes('law')) r.push('Interest in law');
      if (avgSubject(p.academic_marks,'language')>=70) r.push('Strong language skills');
      if ((p.strengths.communication??0)>=4) r.push('Excellent communication');
      if ((p.strengths.analytical_thinking??0)>=4) r.push('Analytical mindset');
      return r.slice(0,3);
    },
  },
  {
    id: 'product_manager', title: 'Product Manager', emoji: '🧭',
    cluster: 'Business & Management',
    description: 'Define and ship great products — the connective tissue between engineering, design, and business.',
    topSkills: ['Strategy', 'Roadmapping', 'Communication', 'Analytics'],
    score: (p) => clamp(hasInterest(p.interests,'technology')*0.20 + hasInterest(p.interests,'business')*0.20 + strengthPct(p.strengths.leadership)*0.25 + strengthPct(p.strengths.communication)*0.25 + strengthPct(p.strengths.problem_solving)*0.10),
    reasons: (p) => {
      const r: string[] = [];
      if ((p.strengths.leadership??0)>=4) r.push('Strong leadership');
      if ((p.strengths.communication??0)>=4) r.push('Excellent communication');
      if (p.interests.includes('business')) r.push('Business interest');
      if (p.interests.includes('technology')) r.push('Technology interest');
      return r.slice(0,3);
    },
  },
  {
    id: 'research_scientist', title: 'Research Scientist', emoji: '🔭',
    cluster: 'Health & Life Sciences',
    description: 'Conduct original research in physics, chemistry, biology, or social sciences.',
    topSkills: ['Research Methods', 'Critical Analysis', 'Writing', 'Statistics'],
    score: (p) => clamp(avgSubject(p.academic_marks,'science')*0.35 + avgSubject(p.academic_marks,'mathematics')*0.25 + hasInterest(p.interests,'science')*0.25 + strengthPct(p.strengths.problem_solving)*0.15),
    reasons: (p) => {
      const r: string[] = [];
      if (p.interests.includes('science')) r.push('Interest in science');
      if (avgSubject(p.academic_marks,'science')>=70) r.push('High science marks');
      if ((p.strengths.analytical_thinking??0)>=4) r.push('Analytical thinking');
      if ((p.strengths.attention_to_detail??0)>=4) r.push('Attention to detail');
      return r.slice(0,3);
    },
  },
  {
    id: 'marketing_strategist', title: 'Marketing Strategist', emoji: '📣',
    cluster: 'Business & Management',
    description: 'Build brands, run campaigns, and grow audiences through data and creative storytelling.',
    topSkills: ['Copywriting', 'Analytics', 'Brand Strategy', 'Social Media'],
    score: (p) => clamp(hasInterest(p.interests,'business')*0.30 + strengthPct(p.strengths.creativity)*0.30 + strengthPct(p.strengths.communication)*0.25 + avgSubject(p.academic_marks,'language')*0.15),
    reasons: (p) => {
      const r: string[] = [];
      if (p.interests.includes('business')) r.push('Business interest');
      if ((p.strengths.creativity??0)>=4) r.push('Creative thinker');
      if ((p.strengths.communication??0)>=4) r.push('Strong communicator');
      if (avgSubject(p.academic_marks,'language')>=70) r.push('Strong language skills');
      return r.slice(0,3);
    },
  },
  {
    id: 'educator', title: 'Educator / Academic', emoji: '🎓',
    cluster: 'Education & Social Sciences',
    description: 'Teach, mentor, and shape the next generation — in schools, universities, or online platforms.',
    topSkills: ['Communication', 'Curriculum Design', 'Subject Mastery', 'Patience'],
    score: (p) => clamp(strengthPct(p.strengths.communication)*0.35 + avgSubject(p.academic_marks,'language')*0.25 + avgSubject(p.academic_marks,'social_studies')*0.20 + strengthPct(p.strengths.leadership)*0.20),
    reasons: (p) => {
      const r: string[] = [];
      if ((p.strengths.communication??0)>=4) r.push('Strong communication skills');
      if ((p.strengths.collaboration??0)>=4) r.push('Collaborative nature');
      if (avgSubject(p.academic_marks,'language')>=70) r.push('Strong language scores');
      if ((p.strengths.leadership??0)>=4) r.push('Natural leadership');
      return r.slice(0,3);
    },
  },
];

// ── Public scoring API ────────────────────────────────────────────────────────

export function scoreCareerMatches(profile: StudentProfile): CareerMatch[] {
  const boosted = DEFS.map(def => ({
    ...def,
    rawScore:     def.score(profile),
    matchReasons: def.reasons(profile),
  })).map(c => ({
    ...c,
    boostedScore: c.rawScore + (profile.career_curiosities.includes(c.id) ? 8 : 0),
  }));

  const maxScore = Math.max(...boosted.map(c => c.boostedScore), 1);

  return boosted
    .map(c => ({
      id:          c.id,
      title:       c.title,
      emoji:       c.emoji,
      description: c.description,
      topSkills:   c.topSkills,
      cluster:     c.cluster,
      reasons:     c.matchReasons,
      score:       Math.round((c.boostedScore / maxScore) * 95),
    }))
    .sort((a, b) => b.score - a.score);
}

export function topCareerMatches(profile: StudentProfile, n = 5): CareerMatch[] {
  return scoreCareerMatches(profile).slice(0, n);
}

// ── Career Health Index (Section 9) ──────────────────────────────────────────

export function computeCHI(profile: StudentProfile): CareerHealthIndex {
  const interestScore  = Math.min(100, (profile.interests.length / 3) * 100);
  const allStr         = Object.values(profile.strengths).filter(Boolean) as number[];
  const strengthScore  = allStr.length ? (allStr.reduce((a,b)=>a+b,0)/allStr.length/5)*100 : 50;
  const avgs           = academicAverages(profile.academic_marks ?? null);
  const academicScore  = Object.values(avgs).reduce((a,b)=>a+b,0)/Object.values(avgs).length;
  const learningScore  = profile.learning_styles.length>=2 ? 90 : profile.learning_styles.length===1 ? 70 : 40;
  const curiosityScore = Math.min(100,(profile.career_curiosities.length/3)*100);

  const breakdown = {
    interests: Math.round(interestScore),
    strengths: Math.round(strengthScore),
    academics: Math.round(academicScore),
    learning:  Math.round(learningScore),
    curiosity: Math.round(curiosityScore),
  };

  const score = Math.round(
    breakdown.interests*0.20 + breakdown.strengths*0.30 +
    breakdown.academics*0.25 + breakdown.learning*0.10 + breakdown.curiosity*0.15
  );

  const topMatch  = scoreCareerMatches(profile)[0];
  const topCluster = topMatch?.cluster ?? 'your chosen field';
  const label = score>=80?'Excellent':score>=65?'Strong':score>=50?'Good':'Developing';

  return { score, label, tagline: `${label} alignment with ${topCluster} careers.`, breakdown };
}

// ── Career Intelligence Report (Section 12) ───────────────────────────────────

export function buildCareerReport(profile: StudentProfile): CareerIntelligenceReport {
  const matches = scoreCareerMatches(profile);
  const chi     = computeCHI(profile);

  const clusterScores: Record<string, number> = {};
  matches.slice(0,5).forEach(m => {
    clusterScores[m.cluster] = (clusterScores[m.cluster]??0) + m.score;
  });

  const primaryCluster     = Object.entries(clusterScores).sort(([,a],[,b])=>b-a)[0]?.[0] ?? matches[0]?.cluster ?? 'General';
  const topClusterCareers  = matches.filter(m=>m.cluster===primaryCluster);
  const compatibilityScore = topClusterCareers.length
    ? Math.round(topClusterCareers.reduce((a,m)=>a+m.score,0)/topClusterCareers.length)
    : chi.score;

  return {
    primaryCluster, compatibilityScore, chi,
    topCareers: matches.slice(0,3).map((m,i)=>({ rank:i+1, title:m.title, emoji:m.emoji })),
  };
}

// ── Academic utilities ────────────────────────────────────────────────────────

export function markLabel(avg: number): 'Excellent'|'Strong'|'Average'|'Needs Work' {
  if (avg>=80) return 'Excellent';
  if (avg>=65) return 'Strong';
  if (avg>=50) return 'Average';
  return 'Needs Work';
}

/** Section 7 — classify subject */
export function subjectClassification(avg: number): 'Strong'|'Moderate'|'Needs Improvement' {
  if (avg>75)  return 'Strong';
  if (avg>=50) return 'Moderate';
  return 'Needs Improvement';
}

export function academicAverages(marks: AcademicMarks | null | undefined): Record<keyof YearMarks, number> {
  return {
    mathematics:    avgSubject(marks,'mathematics'),
    science:        avgSubject(marks,'science'),
    language:       avgSubject(marks,'language'),
    social_studies: avgSubject(marks,'social_studies'),
    computer:       avgSubject(marks,'computer'),
  };
}