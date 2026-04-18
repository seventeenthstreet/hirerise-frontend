/**
 * POST /api/resume/export/pdf
 *
 * Puppeteer removed (not available in Next.js frontend bundle).
 *
 * Strategy: return the resume as a print-ready HTML page.
 * The browser's native print dialog (Ctrl+P → Save as PDF) produces
 * identical A4 output to Puppeteer — no server-side Chrome needed.
 *
 * Two response modes depending on Accept header:
 *   Accept: text/html        → returns full print-ready HTML page
 *   Accept: application/pdf  → returns the HTML page (browser prints it)
 *
 * The frontend should open the returned URL in a new tab and call
 * window.print() — or simply use the /export/html route and let the
 * user Ctrl+P. This is the standard approach for Next.js deployments
 * where Puppeteer cannot run.
 */

import { NextRequest, NextResponse }                             from 'next/server';
import { verifySupabaseToken }                                   from '@/lib/auth';
import { getTemplate }                                           from '@/lib/templates';
import { validateResumeForExport, ResumeValidationError }        from '@/lib/supabase';
import type { ResumeContent, TemplateId, ResumeCustomization }   from '@/lib/supabase';

// ── Print-ready HTML wrapper ───────────────────────────────────────────────────
// Injects @media print CSS so the browser's native Save as PDF produces
// a clean A4 document with no browser chrome, headers, or footers.

function wrapForPrint(resumeHtml: string, filename: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${filename}</title>
  <style>
    @page {
      size: A4;
      margin: 0;
    }
    @media print {
      html, body {
        width: 210mm;
        height: 297mm;
        margin: 0;
        padding: 0;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
      /* Hide the auto-print prompt button when printing */
      #print-prompt { display: none !important; }
    }
    @media screen {
      body {
        background: #f0f0f0;
        display: flex;
        flex-direction: column;
        align-items: center;
        padding: 24px;
        font-family: sans-serif;
      }
      #print-prompt {
        background: #2563eb;
        color: white;
        border: none;
        border-radius: 8px;
        padding: 12px 28px;
        font-size: 15px;
        font-weight: 600;
        cursor: pointer;
        margin-bottom: 20px;
        box-shadow: 0 2px 8px rgba(0,0,0,0.15);
      }
      #print-prompt:hover { background: #1d4ed8; }
      #resume-container {
        background: white;
        box-shadow: 0 4px 24px rgba(0,0,0,0.12);
        width: 210mm;
        min-height: 297mm;
      }
    }
  </style>
</head>
<body>
  <button id="print-prompt" onclick="window.print()">
    ⬇ Save as PDF (Ctrl+P)
  </button>
  <div id="resume-container">
    ${resumeHtml}
  </div>
  <script>
    // Auto-trigger print dialog after a short delay
    // so the page renders fully before the dialog opens.
    setTimeout(() => window.print(), 800);
  </script>
</body>
</html>`;
}

// ── Route handler ──────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const token = req.headers.get('authorization')?.replace('Bearer ', '').trim();
    if (!token) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

    const uid = await verifySupabaseToken(token);
    if (!uid)  return NextResponse.json({ success: false, error: 'Invalid token' }, { status: 401 });

    const body: {
      resumeData:     ResumeContent;
      templateId?:    TemplateId;
      customization?: Partial<ResumeCustomization>;
    } = await req.json();

    if (!body.resumeData) {
      return NextResponse.json({ success: false, error: 'resumeData required' }, { status: 400 });
    }

    // ── Validate before export ─────────────────────────────────────────────────
    try {
      validateResumeForExport(body.resumeData);
    } catch (err) {
      if (err instanceof ResumeValidationError) {
        return NextResponse.json({
          success: false,
          error:   `Cannot export: missing required fields — ${err.fields.join(', ')}`,
          fields:  err.fields,
        }, { status: 422 });
      }
      throw err;
    }

    // ── Build HTML ─────────────────────────────────────────────────────────────
    const resumeHtml = getTemplate(body.templateId ?? 'modern', body.resumeData, body.customization);
    const name       = (body.resumeData.personalInfo?.name || 'resume')
      .replace(/\s+/g, '_').toLowerCase();
    const filename   = `${name}_resume`;
    const printHtml  = wrapForPrint(resumeHtml, filename);

    // Return as HTML — the browser opens it in a new tab and auto-triggers print
    return new Response(printHtml, {
      status: 200,
      headers: {
        'Content-Type':  'text/html; charset=utf-8',
        'Cache-Control': 'no-store',
      },
    });

  } catch (err: any) {
    console.error('[/api/resume/export/pdf]', err.message);
    return NextResponse.json({
      success: false,
      error:   'PDF export failed. Please try again.',
    }, { status: 500 });
  }
}
