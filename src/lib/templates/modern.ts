/**
 * lib/templates/modern.ts
 *
 * MODERN PRO template
 * Layout: full-width centered hero header → horizontal rule → main content
 * Style:  bold blue accent, name centred, inline contact row, pill skills,
 *         left-bordered experience blocks, two-column education row
 */

import type { ResumeContent, ResumeCustomization } from '@/lib/supabase';

function esc(s: string | undefined | null): string {
  if (!s) return '';
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function px(size: ResumeCustomization['fontSize']): number {
  return size === 'small' ? 9 : size === 'large' ? 11 : 10;
}

export function buildModern(
  resume: ResumeContent,
  custom: ResumeCustomization,
): string {
  const p      = resume.personalInfo;
  const accent = custom.accentColor || '#2563eb';
  const base   = px(custom.fontSize);
  const showPhoto = custom.showPhoto && !!p.photo_url;

  const contacts = [p.email, p.phone, p.location, p.linkedin, p.website]
    .filter(Boolean)
    .map(c => `<span>${esc(c)}</span>`)
    .join(`<span style="color:#cbd5e1;margin:0 6px;">·</span>`);

  const visible = custom.sectionOrder.filter(
    s => !custom.hiddenSections.includes(s),
  );

  const sectionMap: Record<string, string> = {
    summary:    buildSummary(resume, accent, base),
    experience: buildExperience(resume, accent, base),
    skills:     buildSkills(resume, accent, base),
    education:  buildEducation(resume, accent, base),
  };

  return `
<div style="font-family:'Calibri',Arial,sans-serif;font-size:${base}pt;color:#1e293b;background:#fff;min-height:270mm;padding:0;">

  <!-- HERO HEADER -->
  <div style="background:linear-gradient(135deg,${accent} 0%,${accent}cc 100%);padding:28px 57px 24px 71px;position:relative;">
    ${showPhoto ? `<img src="${esc(p.photo_url)}" alt="Profile"
        style="position:absolute;top:50%;right:36px;transform:translateY(-50%);
               width:80px;height:80px;border-radius:50%;object-fit:cover;
               border:3px solid rgba(255,255,255,.6);"/>` : ''}
    <div style="max-width:${showPhoto ? 'calc(100% - 104px)' : '100%'};">
      <div style="font-size:${base + 12}pt;font-weight:900;color:#fff;letter-spacing:-.02em;line-height:1.1;margin-bottom:4px;">
        ${esc(p.name) || 'Your Name'}
      </div>
      ${resume.targetRole ? `
      <div style="font-size:${base + 1}pt;color:rgba(255,255,255,.85);font-weight:600;margin-bottom:10px;">
        ${esc(resume.targetRole)}
      </div>` : ''}
      <div style="font-size:${base - 1}pt;color:rgba(255,255,255,.75);display:flex;flex-wrap:wrap;gap:4px;align-items:center;">
        ${contacts}
      </div>
    </div>
  </div>

  <!-- BODY -->
  <div style="padding:24px 57px 24px 71px;">
    ${visible.map(s => sectionMap[s] || '').join('')}
  </div>

</div>`;
}

function sectionHeader(title: string, accent: string, base: number): string {
  return `
  <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px;">
    <div style="font-size:${base - 1}pt;font-weight:800;text-transform:uppercase;
                letter-spacing:.12em;color:${accent};">${title}</div>
    <div style="flex:1;height:2px;background:linear-gradient(90deg,${accent}40,transparent);"></div>
  </div>`;
}

function buildSummary(resume: ResumeContent, accent: string, base: number): string {
  if (!resume.summary) return '';
  return `
  <div style="margin-bottom:18px;">
    ${sectionHeader('Professional Summary', accent, base)}
    <p style="font-size:${base}pt;color:#374151;line-height:1.65;margin:0;
              background:${accent}08;border-left:3px solid ${accent};
              padding:10px 14px;border-radius:0 6px 6px 0;">
      ${esc(resume.summary)}
    </p>
  </div>`;
}

function buildExperience(resume: ResumeContent, accent: string, base: number): string {
  if (!resume.experience?.length) return '';
  return `
  <div style="margin-bottom:18px;">
    ${sectionHeader('Work Experience', accent, base)}
    ${resume.experience.map(exp => `
    <div style="margin-bottom:14px;padding-left:14px;border-left:2px solid ${accent}30;
                position:relative;">
      <div style="position:absolute;left:-5px;top:6px;width:8px;height:8px;
                  border-radius:50%;background:${accent};"></div>
      <div style="display:flex;justify-content:space-between;align-items:baseline;flex-wrap:wrap;gap:4px;margin-bottom:2px;">
        <div>
          <span style="font-size:${base + 1}pt;font-weight:800;color:#111;">${esc(exp.jobTitle)}</span>
          <span style="font-size:${base}pt;color:${accent};font-weight:600;margin-left:6px;">${esc(exp.company)}</span>
        </div>
        <span style="font-size:${base - 1}pt;color:#94a3b8;font-weight:600;">${esc(exp.period)}</span>
      </div>
      <ul style="margin:6px 0 0 16px;padding:0;">
        ${exp.bullets.filter(b => b.trim()).map(b =>
          `<li style="font-size:${base}pt;color:#475569;margin-bottom:3px;line-height:1.55;">${esc(b)}</li>`
        ).join('')}
      </ul>
    </div>`).join('')}
  </div>`;
}

function buildSkills(resume: ResumeContent, accent: string, base: number): string {
  if (!resume.skills?.length) return '';
  return `
  <div style="margin-bottom:18px;">
    ${sectionHeader('Skills', accent, base)}
    <div style="display:flex;flex-wrap:wrap;gap:6px;">
      ${resume.skills.map(sk => `
      <span style="font-size:${base - 1}pt;padding:4px 12px;border-radius:20px;
                   background:${accent}12;border:1px solid ${accent}30;
                   color:#1e293b;font-weight:600;">${esc(sk)}</span>`).join('')}
    </div>
  </div>`;
}

function buildEducation(resume: ResumeContent, accent: string, base: number): string {
  if (!resume.education?.length) return '';
  return `
  <div style="margin-bottom:18px;">
    ${sectionHeader('Education', accent, base)}
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
      ${resume.education.map(edu => `
      <div style="padding:10px 14px;border:1px solid ${accent}25;border-radius:8px;
                  background:${accent}06;">
        <div style="font-size:${base + 1}pt;font-weight:800;color:#111;margin-bottom:2px;">${esc(edu.degree)}</div>
        <div style="font-size:${base}pt;color:${accent};font-weight:600;margin-bottom:2px;">${esc(edu.school)}</div>
        <div style="font-size:${base - 1}pt;color:#94a3b8;">
          ${esc(edu.year)}${edu.grade ? ` · ${esc(edu.grade)}` : ''}
        </div>
      </div>`).join('')}
    </div>
  </div>`;
}