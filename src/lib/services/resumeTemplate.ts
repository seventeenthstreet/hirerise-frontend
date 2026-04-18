/**
 * lib/services/resumeTemplate.ts
 *
 * Builds A4-ready HTML for all 5 resume templates.
 * Templates: modern | minimal | ats | creative | executive
 * Supports: photo, color themes, font sizes, customization.
 */

import type { ResumeContent, TemplateId, ResumeCustomization } from '@/lib/supabase';

// ─── Theme configs ──────────────────────────────────────────────────────────────

interface ThemeConfig {
  accent:      string;
  bg:          string;
  sidebarBg?:  string;
  font:        string;
  headFont:    string;
  allowPhoto:  boolean;
  hasSidebar:  boolean;
}

const THEMES: Record<TemplateId, ThemeConfig> = {
  modern: {
    accent: '#2563eb', bg: '#ffffff', sidebarBg: '#eff6ff',
    font: 'Calibri, Arial, sans-serif', headFont: 'Georgia, serif',
    allowPhoto: true, hasSidebar: true,
  },
  minimal: {
    accent: '#374151', bg: '#ffffff',
    font: 'Helvetica, Arial, sans-serif', headFont: 'Helvetica, Arial, sans-serif',
    allowPhoto: false, hasSidebar: false,
  },
  ats: {
    accent: '#111827', bg: '#ffffff',
    font: 'Arial, sans-serif', headFont: 'Arial, sans-serif',
    allowPhoto: false, hasSidebar: false,
  },
  creative: {
    accent: '#7c3aed', bg: '#ffffff', sidebarBg: '#f5f3ff',
    font: 'Georgia, serif', headFont: 'Georgia, serif',
    allowPhoto: true, hasSidebar: true,
  },
  executive: {
    accent: '#92400e', bg: '#ffffff', sidebarBg: '#fdf8f0',
    font: 'Georgia, serif', headFont: 'Georgia, serif',
    allowPhoto: true, hasSidebar: true,
  },
  'modern-photo': { accent: '#2563eb', bg: '#ffffff', sidebarBg: '#1e3a5f', font: 'Georgia, serif', headFont: 'Arial, sans-serif', allowPhoto: true, hasSidebar: true },
};

// ─── Helpers ───────────────────────────────────────────────────────────────────

function esc(s: string | undefined): string {
  if (!s) return '';
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function fontSizePx(size: ResumeCustomization['fontSize']): number {
  return size === 'small' ? 9 : size === 'large' ? 11 : 10;
}

// ─── Template builders ─────────────────────────────────────────────────────────

function buildModern(resume: ResumeContent, theme: ThemeConfig, custom: ResumeCustomization, basePx: number): string {
  const p          = resume.personalInfo;
  const showPhoto  = custom.showPhoto && theme.allowPhoto && !!p.photo_url;
  const accent     = custom.accentColor || theme.accent;
  const sectionOrder = custom.sectionOrder.filter(s => !custom.hiddenSections.includes(s));

  const sectionContent: Record<string, string> = {
    summary:    buildSummarySection(resume, accent, basePx),
    experience: buildExperienceSection(resume, accent, basePx),
    skills:     buildSkillsSection(resume, accent, basePx, true),
    education:  buildEducationSection(resume, accent, basePx),
  };

  const mainSections = sectionOrder.map(s => sectionContent[s] || '').join('');

  return `
    <div style="display:grid;grid-template-columns:${theme.hasSidebar ? '180px 1fr' : '1fr'};min-height:270mm;">
      ${theme.hasSidebar ? `
      <div style="background:${theme.sidebarBg};border-right:1px solid ${accent}20;padding:20px 14px;">
        ${showPhoto ? `<img src="${esc(p.photo_url)}" style="width:90px;height:90px;border-radius:50%;object-fit:cover;display:block;margin:0 auto 14px;border:3px solid ${accent}40;" alt="Profile"/>` : ''}
        <div style="text-align:center;margin-bottom:14px;">
          <div style="font-size:${basePx + 2}px;font-weight:800;color:#111;">${esc(p.name)}</div>
          ${resume.targetRole ? `<div style="font-size:${basePx - 1}px;color:${accent};font-weight:600;margin-top:3px;">${esc(resume.targetRole)}</div>` : ''}
        </div>
        <div style="font-size:${basePx - 1}px;color:#555;margin-bottom:16px;">
          ${p.email ? `<div style="margin-bottom:4px;">✉ ${esc(p.email)}</div>` : ''}
          ${p.phone ? `<div style="margin-bottom:4px;">📞 ${esc(p.phone)}</div>` : ''}
          ${p.location ? `<div style="margin-bottom:4px;">📍 ${esc(p.location)}</div>` : ''}
          ${p.linkedin ? `<div style="margin-bottom:4px;">🔗 ${esc(p.linkedin)}</div>` : ''}
        </div>
        ${!custom.hiddenSections.includes('skills') ? `
        <div style="font-size:${basePx - 2}px;font-weight:800;text-transform:uppercase;letter-spacing:.1em;color:${accent};margin-bottom:8px;">Skills</div>
        ${(resume.skills || []).map(sk => `<div style="font-size:${basePx - 1}px;padding:3px 7px;margin-bottom:4px;border-radius:4px;background:${accent}18;color:#222;">${esc(sk)}</div>`).join('')}` : ''}
      </div>` : ''}
      <div style="padding:20px 24px;">
        ${!theme.hasSidebar ? buildContactHeader(p, accent, basePx, showPhoto, resume.targetRole) : ''}
        ${mainSections}
      </div>
    </div>`;
}

function buildContactHeader(p: ResumeContent['personalInfo'], accent: string, basePx: number, showPhoto: boolean, targetRole?: string): string {
  const contacts = [p.email, p.phone, p.location, p.linkedin].filter(Boolean);
  return `
    <div style="display:flex;align-items:center;gap:16px;margin-bottom:16px;">
      ${showPhoto && p.photo_url ? `<img src="${esc(p.photo_url)}" style="width:72px;height:72px;border-radius:50%;object-fit:cover;border:2px solid ${accent}40;" alt="Profile"/>` : ''}
      <div>
        <div style="font-size:${basePx + 8}px;font-weight:900;color:#111;margin-bottom:3px;">${esc(p.name)}</div>
        <div style="font-size:${basePx}px;color:${accent};font-weight:700;margin-bottom:6px;">${esc(targetRole || '')}</div>
        <div style="font-size:${basePx - 1}px;color:#666;display:flex;gap:14px;flex-wrap:wrap;">
          ${contacts.map(c => `<span>${esc(c)}</span>`).join('<span style="color:#ccc">|</span>')}
        </div>
      </div>
    </div>
    <div style="border-bottom:2px solid ${accent};margin-bottom:16px;"></div>`;
}

function buildSummarySection(resume: ResumeContent, accent: string, basePx: number): string {
  if (!resume.summary) return '';
  return `
    <div style="margin-bottom:14px;">
      <div style="font-size:${basePx - 1}px;font-weight:800;text-transform:uppercase;letter-spacing:.1em;color:${accent};padding-bottom:4px;border-bottom:2px solid ${accent};margin-bottom:8px;">Professional Summary</div>
      <p style="font-size:${basePx}px;color:#374151;line-height:1.6;margin:0;">${esc(resume.summary)}</p>
    </div>`;
}

function buildExperienceSection(resume: ResumeContent, accent: string, basePx: number): string {
  if (!resume.experience?.length) return '';
  return `
    <div style="margin-bottom:14px;">
      <div style="font-size:${basePx - 1}px;font-weight:800;text-transform:uppercase;letter-spacing:.1em;color:${accent};padding-bottom:4px;border-bottom:2px solid ${accent};margin-bottom:8px;">Work Experience</div>
      ${resume.experience.map(exp => `
        <div style="margin-bottom:12px;">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:2px;">
            <div>
              <span style="font-size:${basePx + 1}px;font-weight:700;color:#111;">${esc(exp.jobTitle)}</span>
              <span style="font-size:${basePx}px;color:${accent};font-weight:600;margin-left:6px;">${esc(exp.company)}</span>
            </div>
            <span style="font-size:${basePx - 1}px;color:#888;white-space:nowrap;margin-left:10px;">${esc(exp.period)}</span>
          </div>
          <ul style="margin:4px 0 0 16px;padding:0;">
            ${exp.bullets.filter(b => b.trim()).map(b => `<li style="font-size:${basePx}px;color:#374151;margin-bottom:3px;line-height:1.5;">${esc(b)}</li>`).join('')}
          </ul>
        </div>`).join('')}
    </div>`;
}

function buildSkillsSection(resume: ResumeContent, accent: string, basePx: number, inline = false): string {
  if (!resume.skills?.length) return '';
  if (inline) return `
    <div style="margin-bottom:14px;">
      <div style="font-size:${basePx - 1}px;font-weight:800;text-transform:uppercase;letter-spacing:.1em;color:${accent};padding-bottom:4px;border-bottom:2px solid ${accent};margin-bottom:8px;">Skills</div>
      <div style="display:flex;flex-wrap:wrap;gap:5px;">
        ${resume.skills.map(sk => `<span style="font-size:${basePx - 1}px;padding:3px 9px;border-radius:3px;background:${accent}15;border:1px solid ${accent}30;color:#222;">${esc(sk)}</span>`).join('')}
      </div>
    </div>`;
  return '';
}

function buildEducationSection(resume: ResumeContent, accent: string, basePx: number): string {
  if (!resume.education?.length) return '';
  return `
    <div style="margin-bottom:14px;">
      <div style="font-size:${basePx - 1}px;font-weight:800;text-transform:uppercase;letter-spacing:.1em;color:${accent};padding-bottom:4px;border-bottom:2px solid ${accent};margin-bottom:8px;">Education</div>
      ${resume.education.map(edu => `
        <div style="display:flex;justify-content:space-between;margin-bottom:8px;">
          <div>
            <div style="font-size:${basePx + 1}px;font-weight:700;color:#111;">${esc(edu.degree)}</div>
            <div style="font-size:${basePx}px;color:${accent};font-weight:600;">${esc(edu.school)}</div>
          </div>
          <div style="font-size:${basePx - 1}px;color:#888;white-space:nowrap;margin-left:10px;">${esc(edu.year)}${edu.grade ? ` · ${esc(edu.grade)}` : ''}</div>
        </div>`).join('')}
    </div>`;
}

// ─── ATS template (ultra-clean, no sidebar) ────────────────────────────────────

function buildATS(resume: ResumeContent, custom: ResumeCustomization, basePx: number): string {
  const p = resume.personalInfo;
  const contacts = [p.email, p.phone, p.location, p.linkedin, p.website].filter(Boolean);
  return `
    <div style="padding:24px 28px;font-family:Arial,sans-serif;">
      <div style="margin-bottom:12px;">
        <div style="font-size:${basePx + 8}px;font-weight:700;color:#000;margin-bottom:2px;">${esc(p.name)}</div>
        ${resume.targetRole ? `<div style="font-size:${basePx + 1}px;color:#333;margin-bottom:4px;">${esc(resume.targetRole)}</div>` : ''}
        <div style="font-size:${basePx}px;color:#333;">${contacts.join('  |  ')}</div>
      </div>
      <div style="border-bottom:1px solid #000;margin-bottom:12px;"></div>
      ${resume.summary ? `
        <div style="margin-bottom:12px;">
          <div style="font-size:${basePx}px;font-weight:700;text-transform:uppercase;margin-bottom:4px;border-bottom:1px solid #333;">PROFESSIONAL SUMMARY</div>
          <p style="font-size:${basePx}px;margin:4px 0;">${esc(resume.summary)}</p>
        </div>` : ''}
      ${resume.experience?.length ? `
        <div style="margin-bottom:12px;">
          <div style="font-size:${basePx}px;font-weight:700;text-transform:uppercase;margin-bottom:4px;border-bottom:1px solid #333;">WORK EXPERIENCE</div>
          ${resume.experience.map(exp => `
            <div style="margin-bottom:10px;">
              <div style="display:flex;justify-content:space-between;">
                <strong style="font-size:${basePx}px;">${esc(exp.jobTitle)}, ${esc(exp.company)}</strong>
                <span style="font-size:${basePx}px;">${esc(exp.period)}</span>
              </div>
              <ul style="margin:4px 0 0 18px;padding:0;">
                ${exp.bullets.filter(b => b.trim()).map(b => `<li style="font-size:${basePx}px;margin-bottom:2px;">${esc(b)}</li>`).join('')}
              </ul>
            </div>`).join('')}
        </div>` : ''}
      ${resume.skills?.length ? `
        <div style="margin-bottom:12px;">
          <div style="font-size:${basePx}px;font-weight:700;text-transform:uppercase;margin-bottom:4px;border-bottom:1px solid #333;">SKILLS</div>
          <div style="font-size:${basePx}px;">${resume.skills.join(', ')}</div>
        </div>` : ''}
      ${resume.education?.length ? `
        <div>
          <div style="font-size:${basePx}px;font-weight:700;text-transform:uppercase;margin-bottom:4px;border-bottom:1px solid #333;">EDUCATION</div>
          ${resume.education.map(edu => `
            <div style="display:flex;justify-content:space-between;margin-bottom:4px;">
              <div style="font-size:${basePx}px;"><strong>${esc(edu.degree)}</strong>, ${esc(edu.school)}</div>
              <div style="font-size:${basePx}px;">${esc(edu.year)}</div>
            </div>`).join('')}
        </div>` : ''}
    </div>`;
}

// ─── Main export ───────────────────────────────────────────────────────────────

export function buildResumeHTML(
  resume:     ResumeContent,
  templateId: TemplateId = 'modern',
  customization?: Partial<ResumeCustomization>,
): string {
  const custom: ResumeCustomization = {
    fontSize:       'medium',
    colorTheme:     'light',
    showPhoto:      true,
    accentColor:    '',
    sectionOrder:   ['summary', 'experience', 'skills', 'education'],
    hiddenSections: [],
    ...customization,
  };

  const theme  = THEMES[templateId] ?? THEMES.modern;
  const basePx = fontSizePx(custom.fontSize);
  const accent = custom.accentColor || theme.accent;

  let bodyContent: string;

  if (templateId === 'ats') {
    bodyContent = buildATS(resume, custom, basePx);
  } else {
    bodyContent = buildModern(resume, theme, { ...custom, accentColor: accent }, basePx);
  }

  const bgColor = custom.colorTheme === 'dark' ? '#1a1a2e' : '#ffffff';
  const textColor= custom.colorTheme === 'dark' ? '#e8e8e8' : '#1f2937';

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: ${theme.font};
    font-size: ${basePx}pt;
    color: ${textColor};
    background: ${bgColor};
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  @page { size: A4; margin: 0; }
</style>
</head>
<body>${bodyContent}</body>
</html>`;
}