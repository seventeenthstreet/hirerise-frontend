/**
 * POST /api/resume/export/docx
 * Validates → builds Word document → returns binary DOCX
 */
import { NextRequest, NextResponse } from 'next/server';
import {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  AlignmentType, BorderStyle, WidthType, ShadingType, LevelFormat,
} from 'docx';
import { verifySupabaseToken } from '@/lib/auth';
import { validateResumeForExport, ResumeValidationError } from '@/lib/supabase';
import type { ResumeContent }                             from '@/lib/supabase';

const ACCENT = '2563EB';
const MUTED  = '6B7280';
const DARK   = '111827';

function hr(): Paragraph {
  return new Paragraph({
    border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: ACCENT, space: 1 } },
    spacing: { after: 120 },
  });
}

function sectionHead(text: string): Paragraph {
  return new Paragraph({
    children: [new TextRun({ text: text.toUpperCase(), bold: true, size: 20, color: ACCENT, font: 'Calibri' })],
    border:   { bottom: { style: BorderStyle.SINGLE, size: 4, color: ACCENT, space: 1 } },
    spacing:  { before: 240, after: 120 },
  });
}

function buildDocx(resume: ResumeContent): Document {
  const p        = resume.personalInfo;
  const children: (Paragraph | Table)[] = [];

  // Name + role + contact
  children.push(new Paragraph({
    children: [new TextRun({ text: p.name || 'Your Name', bold: true, size: 44, color: DARK, font: 'Calibri' })],
    spacing: { after: 40 },
  }));
  if (resume.targetRole) children.push(new Paragraph({
    children: [new TextRun({ text: resume.targetRole, size: 24, color: ACCENT, bold: true, font: 'Calibri' })],
    spacing: { after: 60 },
  }));

  const contacts = [p.email, p.phone, p.location, p.linkedin, p.website].filter(Boolean) as string[];
  if (contacts.length) {
    const runs: TextRun[] = [];
    contacts.forEach((c, i) => {
      runs.push(new TextRun({ text: c, size: 18, color: MUTED, font: 'Calibri' }));
      if (i < contacts.length - 1) runs.push(new TextRun({ text: '  ·  ', size: 18, color: ACCENT, font: 'Calibri' }));
    });
    children.push(new Paragraph({ children: runs, spacing: { after: 160 } }));
  }
  children.push(hr());

  // Summary
  if (resume.summary) {
    children.push(sectionHead('Professional Summary'));
    children.push(new Paragraph({
      children: [new TextRun({ text: resume.summary, size: 20, color: DARK, font: 'Calibri' })],
      spacing: { after: 80 },
    }));
  }

  // Experience
  if (resume.experience?.length) {
    children.push(sectionHead('Work Experience'));
    for (const exp of resume.experience) {
      children.push(new Paragraph({
        children: [
          new TextRun({ text: exp.jobTitle, bold: true, size: 22, color: DARK, font: 'Calibri' }),
          new TextRun({ text: '\t' }),
          new TextRun({ text: exp.period, size: 18, color: MUTED, font: 'Calibri' }),
        ],
        tabStops:  [{ type: 'right' as any, position: 9354 }],
        spacing:   { before: 80, after: 20 },
      }));
      children.push(new Paragraph({
        children: [new TextRun({ text: exp.company, size: 20, color: ACCENT, bold: true, font: 'Calibri' })],
        spacing:  { after: 60 },
      }));
      for (const b of exp.bullets.filter(x => x.trim())) {
        children.push(new Paragraph({
          numbering: { reference: 'bullets', level: 0 },
          children:  [new TextRun({ text: b, size: 19, color: DARK, font: 'Calibri' })],
          spacing:   { after: 40 },
        }));
      }
      children.push(new Paragraph({ spacing: { after: 80 } }));
    }
  }

  // Skills grid
  if (resume.skills?.length) {
    children.push(sectionHead('Skills'));
    const cols  = 4;
    const colW  = Math.floor(9354 / cols);
    const none  = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' };
    const borders = { top: none, bottom: none, left: none, right: none };
    const rows: string[][] = [];
    for (let i = 0; i < resume.skills.length; i += cols) rows.push(resume.skills.slice(i, i + cols));

    children.push(new Table({
      width: { size: 9354, type: WidthType.DXA },
      columnWidths: Array(cols).fill(colW),
      rows: rows.map(row => new TableRow({
        children: Array.from({ length: cols }, (_, ci) => {
          const sk = row[ci] ?? '';
          return new TableCell({
            borders, width: { size: colW, type: WidthType.DXA },
            margins: { top: 60, bottom: 60, left: 80, right: 80 },
            shading: sk ? { fill: 'EFF6FF', type: ShadingType.CLEAR } : { fill: 'FFFFFF', type: ShadingType.CLEAR },
            children: [new Paragraph({
              alignment: AlignmentType.CENTER,
              children: sk ? [new TextRun({ text: sk, size: 18, color: DARK, font: 'Calibri' })] : [],
            })],
          });
        }),
      })),
    }));
    children.push(new Paragraph({ spacing: { after: 120 } }));
  }

  // Education
  if (resume.education?.length) {
    children.push(sectionHead('Education'));
    for (const edu of resume.education) {
      children.push(new Paragraph({
        children: [
          new TextRun({ text: edu.degree, bold: true, size: 21, color: DARK, font: 'Calibri' }),
          new TextRun({ text: '\t' }),
          new TextRun({ text: edu.year + (edu.grade ? ` · ${edu.grade}` : ''), size: 18, color: MUTED, font: 'Calibri' }),
        ],
        tabStops: [{ type: 'right' as any, position: 9354 }],
        spacing:  { before: 60, after: 20 },
      }));
      children.push(new Paragraph({
        children: [new TextRun({ text: edu.school, size: 19, color: ACCENT, bold: true, font: 'Calibri' })],
        spacing:  { after: 80 },
      }));
    }
  }

  return new Document({
    numbering: {
      config: [{
        reference: 'bullets',
        levels: [{ level: 0, format: LevelFormat.BULLET, text: '•', alignment: AlignmentType.LEFT,
          style: { paragraph: { indent: { left: 360, hanging: 260 } }, run: { size: 20, color: ACCENT } } }],
      }],
    },
    styles: {
      default: {
        document: { run: { font: 'Calibri', size: 20, color: DARK }, paragraph: { spacing: { line: 276 } } },
      },
    },
    sections: [{
      properties: {
        page: { size: { width: 11906, height: 16838 }, margin: { top: 1134, right: 1134, bottom: 1134, left: 1418 } },
      },
      children,
    }],
  });
}

export async function POST(req: NextRequest) {
  try {
    const token = req.headers.get('authorization')?.replace('Bearer ', '').trim();
    if (!token) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    const uid = await verifySupabaseToken(token);
    if (!uid)  return NextResponse.json({ success: false, error: 'Invalid token' }, { status: 401 });

    const body: { resumeData: ResumeContent } = await req.json();
    if (!body.resumeData) return NextResponse.json({ success: false, error: 'resumeData required' }, { status: 400 });

    // ── Validate before export ────────────────────────────────────────────────
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

    const doc    = buildDocx(body.resumeData);
    const buffer = Buffer.from(await Packer.toBuffer(doc));
    const name   = (body.resumeData.personalInfo?.name || 'resume').replace(/\s+/g, '_').toLowerCase();

    return new Response(new Uint8Array(buffer), {
      status: 200,
      headers: {
        'Content-Type':        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'Content-Disposition': `attachment; filename="${name}_resume.docx"`,
        'Content-Length':      buffer.length.toString(),
        'Cache-Control':       'no-store',
      },
    });
  } catch (err: any) {
    console.error('[/api/resume/export/docx]', err.message);
    return NextResponse.json({ success: false, error: err.message ?? 'DOCX export failed' }, { status: 500 });
  }
}