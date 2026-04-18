/**
 * lib/templates/creative.ts
 *
 * CREATIVE template
 * Layout: two-column — narrow dark sidebar (left) + wide content area (right)
 * Style:  purple accent, sidebar holds photo/contact/skills,
 *         main area has styled section markers, coloured role badges,
 *         staggered timeline experience blocks
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

export function buildCreative(
  resume: ResumeContent,
  custom: ResumeCustomization,
): string {
  const p         = resume.personalInfo;
  const accent    = custom.accentColor || '#7c3aed';
  const base      = px(custom.fontSize);
  const showPhoto = custom.showPhoto && !!p.photo_url;

  const visible = custom.sectionOrder.filter(
    s => !custom.hiddenSections.includes(s),
  );

  const sectionMap: Record<string, string> = {
    summary:    buildSummary(resume, accent, base),
    experience: buildExperience(resume, accent, base),
    skills:     '',  // skills always go to sidebar
    education:  buildEducation(resume, accent, base),
  };

  return `
<div style="font-family:'Georgia',serif;font-size:${base}pt;color:#1a1a2e;
            background:#fff;min-height:270mm;display:grid;
            grid-template-columns:200px 1fr;">

  <!-- SIDEBAR -->
  <div style="background:${accent};min-height:270mm;padding:24px 16px;
              display:flex;flex-direction:column;gap:20px;">

    ${showPhoto ? `
    <!-- Photo -->
    <div style="text-align:center;">
      <img src="${esc(p.photo_url)}" alt="Profile"
           style="width:100px;height:100px;border-radius:50%;object-fit:cover;
                  border:4px solid rgba(255,255,255,.4);display:block;margin:0 auto;"/>
    </div>` : ''}

    <!-- Name in sidebar -->
    <div style="text-align:center;">
      <div style="font-size:${base + 4}pt;font-weight:900;color:#fff;
                  line-height:1.15;margin-bottom:4px;">
        ${esc(p.name) || 'Your Name'}
      </div>
      ${resume.targetRole ? `
      <div style="font-size:${base - 1}pt;color:rgba(255,255,255,.75);
                  font-style:italic;line-height:1.3;">
        ${esc(resume.targetRole)}
      </div>` : ''}
    </div>

    <!-- Divider -->
    <div style="border-bottom:1px solid rgba(255,255,255,.3);"></div>

    <!-- Contact -->
    <div>
      <div style="font-size:${base - 2}pt;font-weight:700;text-transform:uppercase;
                  letter-spacing:.14em;color:rgba(255,255,255,.55);margin-bottom:8px;
                  font-family:'Helvetica Neue',Arial,sans-serif;">Contact</div>
      ${[
        { icon: '✉', val: p.email },
        { icon: '📞', val: p.phone },
        { icon: '📍', val: p.location },
        { icon: '🔗', val: p.linkedin },
        { icon: '🌐', val: p.website },
      ].filter(x => x.val).map(x => `
      <div style="display:flex;gap:7px;align-items:flex-start;margin-bottom:6px;">
        <span style="font-size:${base - 1}pt;flex-shrink:0;">${x.icon}</span>
        <span style="font-size:${base - 1}pt;color:rgba(255,255,255,.85);word-break:break-all;
                     line-height:1.4;">${esc(x.val)}</span>
      </div>`).join('')}
    </div>

    <!-- Skills always in sidebar -->
    ${resume.skills?.length && !custom.hiddenSections.includes('skills') ? `
    <div>
      <div style="font-size:${base - 2}pt;font-weight:700;text-transform:uppercase;
                  letter-spacing:.14em;color:rgba(255,255,255,.55);margin-bottom:10px;
                  font-family:'Helvetica Neue',Arial,sans-serif;">Skills</div>
      ${resume.skills.map(sk => `
      <div style="font-size:${base - 1}pt;color:rgba(255,255,255,.9);padding:5px 10px;
                  background:rgba(255,255,255,.12);border-radius:4px;
                  margin-bottom:5px;font-weight:600;">${esc(sk)}</div>`).join('')}
    </div>` : ''}

  </div>

  <!-- MAIN -->
  <div style="padding:28px 57px 28px 28px;">
    ${visible.filter(s => s !== 'skills').map(s => sectionMap[s] || '').join('')}
  </div>

</div>`;
}

function sectionHeader(title: string, accent: string, base: number): string {
  return `
  <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px;">
    <div style="width:4px;height:22px;background:${accent};border-radius:2px;flex-shrink:0;"></div>
    <div style="font-size:${base}pt;font-weight:800;text-transform:uppercase;
                letter-spacing:.1em;color:${accent};
                font-family:'Helvetica Neue',Arial,sans-serif;">${title}</div>
  </div>`;
}

function buildSummary(resume: ResumeContent, accent: string, base: number): string {
  if (!resume.summary) return '';
  return `
  <div style="margin-bottom:20px;padding:14px 16px;background:${accent}0a;
              border-radius:8px;border:1px solid ${accent}20;">
    ${sectionHeader('About Me', accent, base)}
    <p style="font-size:${base}pt;color:#374151;line-height:1.65;margin:0;">
      ${esc(resume.summary)}
    </p>
  </div>`;
}

function buildExperience(resume: ResumeContent, accent: string, base: number): string {
  if (!resume.experience?.length) return '';
  return `
  <div style="margin-bottom:20px;">
    ${sectionHeader('Experience', accent, base)}
    ${resume.experience.map((exp, i) => `
    <div style="margin-bottom:16px;position:relative;padding-left:20px;">
      <!-- timeline dot -->
      <div style="position:absolute;left:0;top:5px;width:10px;height:10px;
                  border-radius:50%;background:${accent};opacity:${1 - i * 0.15};"></div>
      ${i < resume.experience.length - 1 ? `
      <div style="position:absolute;left:4px;top:18px;width:2px;
                  background:${accent}30;height:calc(100% + 4px);"></div>` : ''}

      <div style="display:flex;justify-content:space-between;flex-wrap:wrap;gap:4px;margin-bottom:3px;">
        <div>
          <span style="font-size:${base + 1}pt;font-weight:800;color:#111;">
            ${esc(exp.jobTitle)}
          </span>
          <span style="display:inline-block;font-size:${base - 1}pt;font-weight:700;
                       padding:2px 8px;border-radius:20px;background:${accent}18;
                       color:${accent};margin-left:7px;
                       font-family:'Helvetica Neue',Arial,sans-serif;">
            ${esc(exp.company)}
          </span>
        </div>
        <span style="font-size:${base - 1}pt;color:#94a3b8;
                     font-family:'Helvetica Neue',Arial,sans-serif;white-space:nowrap;">
          ${esc(exp.period)}
        </span>
      </div>
      <ul style="margin:6px 0 0 16px;padding:0;">
        ${exp.bullets.filter(b => b.trim()).map(b =>
          `<li style="font-size:${base}pt;color:#475569;margin-bottom:3px;line-height:1.55;">${esc(b)}</li>`
        ).join('')}
      </ul>
    </div>`).join('')}
  </div>`;
}

function buildEducation(resume: ResumeContent, accent: string, base: number): string {
  if (!resume.education?.length) return '';
  return `
  <div style="margin-bottom:20px;">
    ${sectionHeader('Education', accent, base)}
    ${resume.education.map(edu => `
    <div style="margin-bottom:10px;display:flex;align-items:flex-start;gap:12px;">
      <div style="width:8px;height:8px;border-radius:50%;background:${accent};
                  flex-shrink:0;margin-top:4px;"></div>
      <div>
        <div style="font-size:${base + 1}pt;font-weight:800;color:#111;">${esc(edu.degree)}</div>
        <div style="font-size:${base}pt;color:${accent};font-weight:600;">${esc(edu.school)}</div>
        <div style="font-size:${base - 1}pt;color:#94a3b8;
                    font-family:'Helvetica Neue',Arial,sans-serif;">
          ${esc(edu.year)}${edu.grade ? ` · ${esc(edu.grade)}` : ''}
        </div>
      </div>
    </div>`).join('')}
  </div>`;
}