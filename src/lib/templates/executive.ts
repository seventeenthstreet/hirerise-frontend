/**
 * lib/templates/executive.ts
 *
 * EXECUTIVE template
 * Layout: centred double-border header, single wide column, ruled section breaks
 * Style:  amber/gold accent, Georgia + small-caps headings, generous line-height,
 *         photo badge top-right, experience in indented blocks with ruled bottom,
 *         skills in 3-column grid, premium feel throughout
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

export function buildExecutive(
  resume: ResumeContent,
  custom: ResumeCustomization,
): string {
  const p         = resume.personalInfo;
  const accent    = custom.accentColor || '#92400e';
  const gold      = accent;
  const base      = px(custom.fontSize);
  const showPhoto = custom.showPhoto && !!p.photo_url;

  const contacts = [p.email, p.phone, p.location, p.linkedin, p.website]
    .filter(Boolean)
    .join('   ·   ');

  const visible = custom.sectionOrder.filter(
    s => !custom.hiddenSections.includes(s),
  );

  const sectionMap: Record<string, string> = {
    summary:    buildSummary(resume, gold, base),
    experience: buildExperience(resume, gold, base),
    skills:     buildSkills(resume, gold, base),
    education:  buildEducation(resume, gold, base),
  };

  return `
<div style="font-family:Georgia,'Times New Roman',serif;font-size:${base}pt;
            color:#1c1917;background:#fffdf7;min-height:270mm;padding:36px 57px 36px 71px;">

  <!-- DOUBLE-BORDER HEADER -->
  <div style="border-top:3px solid ${gold};border-bottom:3px solid ${gold};
              padding:18px 0;margin-bottom:6px;position:relative;text-align:center;">
    <!-- thin inner rules -->
    <div style="position:absolute;top:5px;left:0;right:0;border-top:1px solid ${gold}50;"></div>
    <div style="position:absolute;bottom:5px;left:0;right:0;border-bottom:1px solid ${gold}50;"></div>

    ${showPhoto ? `
    <img src="${esc(p.photo_url)}" alt="Profile"
         style="position:absolute;right:0;top:50%;transform:translateY(-50%);
                width:70px;height:70px;border-radius:4px;object-fit:cover;
                border:2px solid ${gold}50;"/>` : ''}

    <div style="font-size:${base + 14}pt;font-weight:700;letter-spacing:.04em;
                color:#1c1917;line-height:1.05;margin-bottom:5px;
                text-transform:uppercase;">
      ${esc(p.name) || 'Your Name'}
    </div>
    ${resume.targetRole ? `
    <div style="font-size:${base + 1}pt;color:${gold};letter-spacing:.08em;
                font-variant:small-caps;margin-bottom:8px;">
      ${esc(resume.targetRole)}
    </div>` : ''}
    <div style="font-size:${base - 1}pt;color:#78716c;letter-spacing:.04em;
                font-family:'Helvetica Neue',Arial,sans-serif;">
      ${esc(contacts)}
    </div>
  </div>
  <div style="margin-bottom:24px;"></div>

  <!-- BODY -->
  ${visible.map(s => sectionMap[s] || '').join('')}

</div>`;
}

function sectionHeader(title: string, gold: string, base: number): string {
  return `
  <div style="margin-bottom:10px;">
    <div style="font-size:${base - 1}pt;font-weight:700;text-transform:uppercase;
                letter-spacing:.18em;color:${gold};font-variant:small-caps;
                font-family:'Helvetica Neue',Arial,sans-serif;">${title}</div>
    <div style="border-bottom:1px solid ${gold}40;margin-top:4px;"></div>
  </div>`;
}

function buildSummary(resume: ResumeContent, gold: string, base: number): string {
  if (!resume.summary) return '';
  return `
  <div style="margin-bottom:20px;">
    ${sectionHeader('Executive Profile', gold, base)}
    <p style="font-size:${base}pt;color:#3c3836;line-height:1.75;margin:0;
              text-align:justify;font-style:italic;">
      ${esc(resume.summary)}
    </p>
  </div>`;
}

function buildExperience(resume: ResumeContent, gold: string, base: number): string {
  if (!resume.experience?.length) return '';
  return `
  <div style="margin-bottom:20px;">
    ${sectionHeader('Professional Experience', gold, base)}
    ${resume.experience.map(exp => `
    <div style="margin-bottom:16px;padding-bottom:14px;border-bottom:1px dotted ${gold}30;">
      <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:4px;">
        <div>
          <span style="font-size:${base + 1}pt;font-weight:700;color:#1c1917;
                       font-variant:small-caps;letter-spacing:.02em;">${esc(exp.jobTitle)}</span>
          <span style="font-size:${base}pt;color:${gold};margin-left:8px;">·</span>
          <span style="font-size:${base}pt;color:${gold};font-weight:600;margin-left:8px;">${esc(exp.company)}</span>
        </div>
        <span style="font-size:${base - 1}pt;color:#a8a29e;font-style:italic;
                     white-space:nowrap;font-family:'Helvetica Neue',Arial,sans-serif;">${esc(exp.period)}</span>
      </div>
      <ul style="margin:6px 0 0 20px;padding:0;">
        ${exp.bullets.filter(b => b.trim()).map(b =>
          `<li style="font-size:${base}pt;color:#44403c;margin-bottom:4px;line-height:1.65;">${esc(b)}</li>`
        ).join('')}
      </ul>
    </div>`).join('')}
  </div>`;
}

function buildSkills(resume: ResumeContent, gold: string, base: number): string {
  if (!resume.skills?.length) return '';
  return `
  <div style="margin-bottom:20px;">
    ${sectionHeader('Core Competencies', gold, base)}
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:5px 12px;">
      ${resume.skills.map(sk => `
      <div style="font-size:${base - 1}pt;color:#44403c;padding:4px 0;
                  border-bottom:1px solid ${gold}20;display:flex;align-items:center;gap:6px;">
        <span style="color:${gold};font-size:${base - 2}pt;">◆</span>
        ${esc(sk)}
      </div>`).join('')}
    </div>
  </div>`;
}

function buildEducation(resume: ResumeContent, gold: string, base: number): string {
  if (!resume.education?.length) return '';
  return `
  <div style="margin-bottom:20px;">
    ${sectionHeader('Education', gold, base)}
    ${resume.education.map(edu => `
    <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:8px;">
      <div>
        <span style="font-size:${base + 1}pt;font-weight:700;color:#1c1917;
                     font-variant:small-caps;">${esc(edu.degree)}</span>
        <span style="font-size:${base}pt;color:${gold};margin-left:8px;">${esc(edu.school)}</span>
        ${edu.grade ? `<span style="font-size:${base - 1}pt;color:#a8a29e;margin-left:6px;font-style:italic;">${esc(edu.grade)}</span>` : ''}
      </div>
      <span style="font-size:${base - 1}pt;color:#a8a29e;white-space:nowrap;
                   font-family:'Helvetica Neue',Arial,sans-serif;">${esc(edu.year)}</span>
    </div>`).join('')}
  </div>`;
}