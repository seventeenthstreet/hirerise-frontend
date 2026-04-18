/**
 * lib/templates/minimal.ts
 *
 * MINIMAL CLEAN template
 * Layout: left-aligned single column, name large & plain, thin hairline dividers
 * Style:  zero colour (monochrome), Georgia serif, generous white space,
 *         no pills/badges, inline contact row with pipes, compact skills CSV
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

export function buildMinimal(
  resume: ResumeContent,
  custom: ResumeCustomization,
): string {
  const p    = resume.personalInfo;
  const base = px(custom.fontSize);

  const contacts = [p.email, p.phone, p.location, p.linkedin, p.website]
    .filter(Boolean)
    .join('  |  ');

  const visible = custom.sectionOrder.filter(
    s => !custom.hiddenSections.includes(s),
  );

  const sectionMap: Record<string, string> = {
    summary:    buildSummary(resume, base),
    experience: buildExperience(resume, base),
    skills:     buildSkills(resume, base),
    education:  buildEducation(resume, base),
  };

  return `
<div style="font-family:Georgia,'Times New Roman',serif;font-size:${base}pt;
            color:#111;background:#fff;min-height:270mm;padding:32px 57px 32px 71px;">

  <!-- NAME BLOCK -->
  <div style="margin-bottom:6px;">
    <div style="font-size:${base + 14}pt;font-weight:700;letter-spacing:-.01em;
                color:#000;line-height:1.05;">
      ${esc(p.name) || 'Your Name'}
    </div>
    ${resume.targetRole ? `
    <div style="font-size:${base + 1}pt;font-style:italic;color:#444;margin-top:3px;">
      ${esc(resume.targetRole)}
    </div>` : ''}
  </div>

  <!-- CONTACT ROW -->
  <div style="font-size:${base - 1}pt;color:#555;margin-bottom:16px;font-family:'Helvetica Neue',Arial,sans-serif;">
    ${esc(contacts)}
  </div>

  <!-- HAIRLINE -->
  <div style="border-bottom:2px solid #111;margin-bottom:18px;"></div>

  <!-- BODY -->
  ${visible.map(s => sectionMap[s] || '').join('')}

</div>`;
}

function sectionHeader(title: string, base: number): string {
  return `
  <div style="font-size:${base - 1}pt;font-weight:700;text-transform:uppercase;
              letter-spacing:.15em;color:#111;margin-bottom:8px;
              font-family:'Helvetica Neue',Arial,sans-serif;">
    ${title}
  </div>`;
}

function buildSummary(resume: ResumeContent, base: number): string {
  if (!resume.summary) return '';
  return `
  <div style="margin-bottom:16px;">
    ${sectionHeader('Summary', base)}
    <p style="font-size:${base}pt;color:#333;line-height:1.7;margin:0;font-style:italic;">
      ${esc(resume.summary)}
    </p>
    <div style="border-bottom:1px solid #ddd;margin-top:14px;"></div>
  </div>`;
}

function buildExperience(resume: ResumeContent, base: number): string {
  if (!resume.experience?.length) return '';
  return `
  <div style="margin-bottom:16px;">
    ${sectionHeader('Experience', base)}
    ${resume.experience.map(exp => `
    <div style="margin-bottom:14px;">
      <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:1px;">
        <div>
          <span style="font-size:${base + 1}pt;font-weight:700;color:#000;">${esc(exp.jobTitle)}</span>
          <span style="font-size:${base}pt;color:#333;margin-left:5px;">— ${esc(exp.company)}</span>
        </div>
        <span style="font-size:${base - 1}pt;color:#888;font-family:'Helvetica Neue',Arial,sans-serif;
                     white-space:nowrap;">${esc(exp.period)}</span>
      </div>
      <ul style="margin:5px 0 0 18px;padding:0;list-style-type:disc;">
        ${exp.bullets.filter(b => b.trim()).map(b =>
          `<li style="font-size:${base}pt;color:#333;margin-bottom:3px;line-height:1.6;">${esc(b)}</li>`
        ).join('')}
      </ul>
    </div>`).join('')}
    <div style="border-bottom:1px solid #ddd;margin-top:4px;"></div>
  </div>`;
}

function buildSkills(resume: ResumeContent, base: number): string {
  if (!resume.skills?.length) return '';
  return `
  <div style="margin-bottom:16px;">
    ${sectionHeader('Skills', base)}
    <p style="font-size:${base}pt;color:#333;line-height:1.7;margin:0;
              font-family:'Helvetica Neue',Arial,sans-serif;">
      ${resume.skills.map(s => esc(s)).join('  ·  ')}
    </p>
    <div style="border-bottom:1px solid #ddd;margin-top:14px;"></div>
  </div>`;
}

function buildEducation(resume: ResumeContent, base: number): string {
  if (!resume.education?.length) return '';
  return `
  <div style="margin-bottom:16px;">
    ${sectionHeader('Education', base)}
    ${resume.education.map(edu => `
    <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:8px;">
      <div>
        <span style="font-size:${base}pt;font-weight:700;color:#000;">${esc(edu.degree)}</span>
        <span style="font-size:${base}pt;color:#333;margin-left:5px;">— ${esc(edu.school)}</span>
        ${edu.grade ? `<span style="font-size:${base - 1}pt;color:#666;margin-left:5px;">(${esc(edu.grade)})</span>` : ''}
      </div>
      <span style="font-size:${base - 1}pt;color:#888;font-family:'Helvetica Neue',Arial,sans-serif;
                   white-space:nowrap;">${esc(edu.year)}</span>
    </div>`).join('')}
  </div>`;
}