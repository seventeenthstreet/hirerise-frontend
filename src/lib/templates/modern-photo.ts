/**
 * lib/templates/modern-photo.ts
 *
 * MODERN WITH PHOTO template
 * Layout: fixed left sidebar (photo + contact + skills) | right main content
 * Style:  blue accent, circular photo prominently at top of sidebar,
 *         name + role in sidebar header, right column has full content sections.
 *         Auto-selected when user has a profile photo.
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

export function buildModernPhoto(
  resume: ResumeContent,
  custom: ResumeCustomization,
): string {
  const p      = resume.personalInfo;
  const accent = custom.accentColor || '#2563eb';
  const base   = px(custom.fontSize);

  const visible = custom.sectionOrder.filter(
    s => !custom.hiddenSections.includes(s),
  );

  const sectionMap: Record<string, string> = {
    summary:    buildSummary(resume, accent, base),
    experience: buildExperience(resume, accent, base),
    skills:     '',   // skills go in sidebar
    education:  buildEducation(resume, accent, base),
  };

  return `
<div style="font-family:'Calibri',Arial,sans-serif;font-size:${base}pt;color:#1e293b;
            background:#fff;min-height:297mm;display:grid;
            grid-template-columns:210px 1fr;">

  <!-- ── SIDEBAR ─────────────────────────────────────────────────────────── -->
  <div style="background:${accent};min-height:297mm;padding:32px 18px 28px;
              display:flex;flex-direction:column;gap:0;">

    <!-- Photo -->
    ${p.photo_url ? `
    <div style="text-align:center;margin-bottom:18px;">
      <img src="${esc(p.photo_url)}" alt="Profile"
           style="width:110px;height:110px;border-radius:50%;object-fit:cover;
                  border:4px solid rgba(255,255,255,.5);display:inline-block;
                  box-shadow:0 4px 16px rgba(0,0,0,.25);"/>
    </div>` : `
    <div style="text-align:center;margin-bottom:18px;">
      <div style="width:110px;height:110px;border-radius:50%;background:rgba(255,255,255,.15);
                  border:4px solid rgba(255,255,255,.3);display:inline-flex;
                  align-items:center;justify-content:center;font-size:36pt;color:rgba(255,255,255,.5);">
        👤
      </div>
    </div>`}

    <!-- Name + Role -->
    <div style="text-align:center;margin-bottom:20px;padding-bottom:18px;
                border-bottom:1px solid rgba(255,255,255,.25);">
      <div style="font-size:${base + 5}pt;font-weight:900;color:#fff;
                  line-height:1.2;margin-bottom:5px;word-break:break-word;">
        ${esc(p.name) || 'Your Name'}
      </div>
      ${resume.targetRole ? `
      <div style="font-size:${base - 1}pt;color:rgba(255,255,255,.8);
                  font-weight:600;line-height:1.3;font-style:italic;">
        ${esc(resume.targetRole)}
      </div>` : ''}
    </div>

    <!-- Contact -->
    <div style="margin-bottom:20px;">
      <div style="font-size:${base - 2}pt;font-weight:800;text-transform:uppercase;
                  letter-spacing:.14em;color:rgba(255,255,255,.5);margin-bottom:10px;">
        Contact
      </div>
      ${[
        { icon: '✉', val: p.email },
        { icon: '📞', val: p.phone },
        { icon: '📍', val: p.location },
        { icon: '🔗', val: p.linkedin },
        { icon: '🌐', val: p.website },
      ].filter(x => x.val).map(x => `
      <div style="display:flex;gap:8px;align-items:flex-start;margin-bottom:8px;">
        <span style="font-size:${base - 1}pt;flex-shrink:0;margin-top:1px;">${x.icon}</span>
        <span style="font-size:${base - 1}pt;color:rgba(255,255,255,.85);
                     word-break:break-all;line-height:1.4;">${esc(x.val)}</span>
      </div>`).join('')}
    </div>

    <!-- Skills -->
    ${resume.skills?.length && !custom.hiddenSections.includes('skills') ? `
    <div>
      <div style="font-size:${base - 2}pt;font-weight:800;text-transform:uppercase;
                  letter-spacing:.14em;color:rgba(255,255,255,.5);margin-bottom:10px;">
        Skills
      </div>
      ${resume.skills.map(sk => `
      <div style="font-size:${base - 1}pt;color:#fff;padding:5px 10px;
                  background:rgba(255,255,255,.12);border-radius:4px;
                  margin-bottom:5px;font-weight:500;line-height:1.3;">
        ${esc(sk)}
      </div>`).join('')}
    </div>` : ''}

  </div>

  <!-- ── MAIN CONTENT ───────────────────────────────────────────────────── -->
  <div style="padding:32px 57px 28px 32px;">
    ${visible.filter(s => s !== 'skills').map(s => sectionMap[s] || '').join('')}
  </div>

</div>`;
}

// ─── Section helpers ──────────────────────────────────────────────────────────

function sectionHeader(title: string, accent: string, base: number): string {
  return `
  <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px;">
    <div style="font-size:${base - 1}pt;font-weight:800;text-transform:uppercase;
                letter-spacing:.12em;color:${accent};">${title}</div>
    <div style="flex:1;height:2px;background:linear-gradient(90deg,${accent}50,transparent);"></div>
  </div>`;
}

function buildSummary(resume: ResumeContent, accent: string, base: number): string {
  if (!resume.summary) return '';
  return `
  <div style="margin-bottom:20px;">
    ${sectionHeader('Professional Summary', accent, base)}
    <p style="font-size:${base}pt;color:#374151;line-height:1.65;margin:0;
              border-left:3px solid ${accent};padding:10px 14px;
              background:${accent}08;border-radius:0 6px 6px 0;">
      ${esc(resume.summary)}
    </p>
  </div>`;
}

function buildExperience(resume: ResumeContent, accent: string, base: number): string {
  if (!resume.experience?.length) return '';
  return `
  <div style="margin-bottom:20px;">
    ${sectionHeader('Work Experience', accent, base)}
    ${resume.experience.map((exp, i) => `
    <div style="margin-bottom:14px;padding-left:14px;
                border-left:2px solid ${i === 0 ? accent : accent + '40'};
                position:relative;">
      <div style="position:absolute;left:-5px;top:6px;width:8px;height:8px;
                  border-radius:50%;background:${accent};"></div>
      <div style="display:flex;justify-content:space-between;align-items:baseline;
                  flex-wrap:wrap;gap:4px;margin-bottom:2px;">
        <div>
          <span style="font-size:${base + 1}pt;font-weight:800;color:#111;">
            ${esc(exp.jobTitle)}
          </span>
          <span style="font-size:${base}pt;color:${accent};font-weight:600;margin-left:6px;">
            ${esc(exp.company)}
          </span>
        </div>
        <span style="font-size:${base - 1}pt;color:#94a3b8;white-space:nowrap;">
          ${esc(exp.period)}
        </span>
      </div>
      <ul style="margin:5px 0 0 16px;padding:0;">
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
    <div style="padding:10px 14px;border:1px solid ${accent}25;border-radius:8px;
                background:${accent}06;margin-bottom:8px;">
      <div style="font-size:${base + 1}pt;font-weight:800;color:#111;margin-bottom:2px;">
        ${esc(edu.degree)}
      </div>
      <div style="font-size:${base}pt;color:${accent};font-weight:600;margin-bottom:2px;">
        ${esc(edu.school)}
      </div>
      <div style="font-size:${base - 1}pt;color:#94a3b8;">
        ${esc(edu.year)}${edu.grade ? ` · ${esc(edu.grade)}` : ''}
      </div>
    </div>`).join('')}
  </div>`;
}