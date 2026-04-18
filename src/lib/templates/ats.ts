/**
 * lib/templates/ats.ts
 *
 * ATS OPTIMISED template
 * Layout: strict single-column, zero decorative styling
 * Style:  Arial only, black on white, no images/colours/tables,
 *         ALL CAPS section headers with simple underline, plain bullet dashes,
 *         contact on one line, skills as comma-separated plain text
 *         — every element designed to pass through ATS parsers cleanly
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

export function buildAts(
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
<div style="font-family:Arial,'Helvetica Neue',sans-serif;font-size:${base}pt;
            color:#000000;background:#ffffff;min-height:270mm;
            padding:24px 57px 24px 71px;line-height:1.4;">

  <!-- NAME -->
  <div style="font-size:${base + 8}pt;font-weight:700;color:#000;margin-bottom:2px;">
    ${esc(p.name) || 'Your Name'}
  </div>

  <!-- TARGET ROLE -->
  ${resume.targetRole ? `
  <div style="font-size:${base + 1}pt;font-weight:600;color:#000;margin-bottom:4px;">
    ${esc(resume.targetRole)}
  </div>` : ''}

  <!-- CONTACT ROW -->
  <div style="font-size:${base}pt;color:#000;margin-bottom:12px;">
    ${esc(contacts)}
  </div>

  <!-- HORIZONTAL RULE -->
  <div style="border-bottom:1px solid #000000;margin-bottom:12px;"></div>

  <!-- BODY -->
  ${visible.map(s => sectionMap[s] || '').join('')}

</div>`;
}

function sectionHeader(title: string, base: number): string {
  return `
  <div style="font-size:${base}pt;font-weight:700;text-transform:uppercase;
              color:#000;margin-bottom:2px;border-bottom:1px solid #000;
              padding-bottom:2px;letter-spacing:.05em;">
    ${title}
  </div>`;
}

function buildSummary(resume: ResumeContent, base: number): string {
  if (!resume.summary) return '';
  return `
  <div style="margin-bottom:12px;">
    ${sectionHeader('Professional Summary', base)}
    <p style="font-size:${base}pt;color:#000;line-height:1.5;margin:6px 0 0 0;">
      ${esc(resume.summary)}
    </p>
  </div>`;
}

function buildExperience(resume: ResumeContent, base: number): string {
  if (!resume.experience?.length) return '';
  return `
  <div style="margin-bottom:12px;">
    ${sectionHeader('Work Experience', base)}
    <div style="margin-top:6px;">
      ${resume.experience.map(exp => `
      <div style="margin-bottom:10px;">
        <div style="display:flex;justify-content:space-between;align-items:baseline;">
          <strong style="font-size:${base}pt;font-weight:700;color:#000;">
            ${esc(exp.jobTitle)}, ${esc(exp.company)}
          </strong>
          <span style="font-size:${base}pt;color:#000;white-space:nowrap;margin-left:10px;">
            ${esc(exp.period)}
          </span>
        </div>
        <ul style="margin:3px 0 0 18px;padding:0;list-style-type:disc;">
          ${exp.bullets.filter(b => b.trim()).map(b =>
            `<li style="font-size:${base}pt;color:#000;margin-bottom:2px;line-height:1.45;">${esc(b)}</li>`
          ).join('')}
        </ul>
      </div>`).join('')}
    </div>
  </div>`;
}

function buildSkills(resume: ResumeContent, base: number): string {
  if (!resume.skills?.length) return '';
  return `
  <div style="margin-bottom:12px;">
    ${sectionHeader('Skills', base)}
    <div style="font-size:${base}pt;color:#000;margin-top:6px;line-height:1.5;">
      ${resume.skills.map(s => esc(s)).join(', ')}
    </div>
  </div>`;
}

function buildEducation(resume: ResumeContent, base: number): string {
  if (!resume.education?.length) return '';
  return `
  <div style="margin-bottom:12px;">
    ${sectionHeader('Education', base)}
    <div style="margin-top:6px;">
      ${resume.education.map(edu => `
      <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:4px;">
        <div style="font-size:${base}pt;color:#000;">
          <strong>${esc(edu.degree)}</strong>, ${esc(edu.school)}${edu.grade ? ` (${esc(edu.grade)})` : ''}
        </div>
        <span style="font-size:${base}pt;color:#000;white-space:nowrap;margin-left:10px;">${esc(edu.year)}</span>
      </div>`).join('')}
    </div>
  </div>`;
}