/**
 * app/api/roles/embed/route.ts
 *
 * Server-side embedding endpoint.
 * Generates a 768-dim embedding for a query string using Gemini.
 * Called by roleSearchService before hybrid search.
 *
 * POST /api/roles/embed
 * Body: { query: string }
 * Returns: { embedding: number[] }
 */

import { NextRequest, NextResponse } from 'next/server';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const EMBED_URL      = `https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent`;

export async function POST(req: NextRequest) {
  try {
    // ── Validate API key ───────────────────────────────────────────────────
    if (!GEMINI_API_KEY) {
      return NextResponse.json(
        { message: 'GEMINI_API_KEY is not configured' },
        { status: 500 }
      );
    }

    // ── Parse body ─────────────────────────────────────────────────────────
    const body = await req.json().catch(() => null);
    const query = body?.query?.trim();

    if (!query || typeof query !== 'string') {
      return NextResponse.json(
        { message: 'query is required and must be a non-empty string' },
        { status: 400 }
      );
    }

    if (query.length < 2) {
      return NextResponse.json(
        { message: 'query must be at least 2 characters' },
        { status: 400 }
      );
    }

    // ── Generate embedding ─────────────────────────────────────────────────
    const geminiRes = await fetch(`${EMBED_URL}?key=${GEMINI_API_KEY}`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model:                'models/gemini-embedding-001',
        content:              { parts: [{ text: query }] },
        taskType:             'RETRIEVAL_QUERY',   // optimized for query-time
        outputDimensionality: 768,                 // match vector(768) column
      }),
    });

    if (!geminiRes.ok) {
      const errText = await geminiRes.text();
      console.error('[embed] Gemini error:', errText);
      return NextResponse.json(
        { message: `Embedding service error: ${geminiRes.status}` },
        { status: 502 }
      );
    }

    const geminiData = await geminiRes.json();
    const embedding: number[] = geminiData?.embedding?.values;

    if (!Array.isArray(embedding) || embedding.length !== 768) {
      return NextResponse.json(
        { message: 'Unexpected embedding shape from Gemini' },
        { status: 502 }
      );
    }

    return NextResponse.json({ embedding }, { status: 200 });

  } catch (err: any) {
    console.error('[embed] Unexpected error:', err);
    return NextResponse.json(
      { message: err?.message ?? 'Internal server error' },
      { status: 500 }
    );
  }
}