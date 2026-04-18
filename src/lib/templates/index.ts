/**
 * lib/templates/index.ts
 *
 * Template loader — maps TemplateId → builder function
 * Wraps body content in a full HTML document for PDF/preview rendering.
 */

import type { ResumeContent, TemplateId, ResumeCustomization } from '@/lib/supabase';
import { buildModern }    from './modern';
import { buildMinimal }   from './minimal';
import { buildCreative }  from './creative';
import { buildExecutive } from './executive';
import { buildAts }       from './ats';
import { buildModernPhoto } from './modern-photo';

// ─── Font map per template ────────────────────────────────────────────────────

const TEMPLATE_FONT: Record<TemplateId, string> = {
  modern:    "Calibri, Arial, sans-serif",
  minimal:   "Georgia, 'Times New Roman', serif",
  creative:  "Georgia, serif",
  executive: "Georgia, 'Times New Roman', serif",
  ats:       "Arial, 'Helvetica Neue', sans-serif",
  'modern-photo': "Calibri, Arial, sans-serif",
};

const TEMPLATE_BG: Record<TemplateId, string> = {
  modern:    '#ffffff',
  minimal:   '#ffffff',
  creative:  '#ffffff',
  executive: '#fffdf7',
  ats:       '#ffffff',
  'modern-photo': '#ffffff',
};

// ─── Core API ─────────────────────────────────────────────────────────────────

/**
 * Builds a body-only HTML fragment for the given template.
 * Used by the live preview pane (inlined into an iframe or scaled div).
 */
export function getTemplateBody(
  templateId: TemplateId,
  resume: ResumeContent,
  customization: Partial<ResumeCustomization> = {},
): string {
  const custom = resolveCustomization(templateId, customization);

  switch (templateId) {
    case 'modern':    return buildModern(resume, custom);
    case 'minimal':   return buildMinimal(resume, custom);
    case 'creative':  return buildCreative(resume, custom);
    case 'executive': return buildExecutive(resume, custom);
    case 'ats':         return buildAts(resume, custom);
    case 'modern-photo': return buildModernPhoto(resume, custom);
    default:             return buildModern(resume, custom);
  }
}

/**
 * Builds a complete <!DOCTYPE html> document for PDF export.
 * Puppeteer renders this to get a pixel-perfect A4 PDF.
 */
export function getTemplate(
  templateId: TemplateId,
  resume: ResumeContent,
  customization: Partial<ResumeCustomization> = {},
): string {
  const custom   = resolveCustomization(templateId, customization);
  const body     = getTemplateBody(templateId, resume, custom);
  const font     = TEMPLATE_FONT[templateId] ?? TEMPLATE_FONT.modern;
  const bg       = TEMPLATE_BG[templateId]   ?? '#ffffff';
  const basePt   = custom.fontSize === 'small' ? 9 : custom.fontSize === 'large' ? 11 : 10;
  const textCol  = custom.colorTheme === 'dark' ? '#e8e8e8' : '#1f2937';
  const pageBg   = custom.colorTheme === 'dark' ? '#1a1a2e' : bg;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<style>
  *, *::before, *::after {
    box-sizing: border-box;
    margin: 0;
    padding: 0;
  }
  @page {
    size: 210mm 297mm;
    margin: 0;
  }
  html {
    width: 210mm;
    height: 297mm;
  }
  body {
    width: 210mm;
    min-height: 297mm;
    font-family: ${font};
    font-size: ${basePt}pt;
    color: ${textCol};
    background: ${pageBg};
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
    overflow-x: hidden;
  }
  ul { list-style-position: outside; }
  a  { color: inherit; text-decoration: none; }
  img { display: block; max-width: 100%; }
</style>
</head>
<body>${body}</body>
</html>`;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function resolveCustomization(
  templateId: TemplateId,
  partial: Partial<ResumeCustomization>,
): ResumeCustomization {
  // Per-template sensible defaults
  const defaults: Record<TemplateId, Partial<ResumeCustomization>> = {
    modern:    { accentColor: '#2563eb', showPhoto: false },
    minimal:   { accentColor: '#374151', showPhoto: false },
    creative:  { accentColor: '#7c3aed', showPhoto: true  },
    executive: { accentColor: '#92400e', showPhoto: false },
    ats:       { accentColor: '#111827', showPhoto: false },
    'modern-photo': { accentColor: '#2563eb', showPhoto: true  },
  };

  return {
    fontSize:       'medium',
    colorTheme:     'light',
    showPhoto:      false,
    accentColor:    '',
    sectionOrder:   ['summary', 'experience', 'skills', 'education'],
    hiddenSections: [],
    ...defaults[templateId],
    ...partial,
  };
}