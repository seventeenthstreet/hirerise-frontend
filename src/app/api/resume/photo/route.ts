/**
 * POST /api/resume/photo
 * Converts uploaded profile photo to a base64 data URL.
 * No external storage required — the data URL is embedded directly
 * in the resume HTML and PDF, and stored as part of resume content.
 */
import { NextRequest, NextResponse } from 'next/server';
import { verifySupabaseToken } from '@/lib/auth';

const MAX_SIZE = 2 * 1024 * 1024; // 2 MB

export async function POST(req: NextRequest) {
  try {
    const token = req.headers.get('authorization')?.replace('Bearer ', '').trim();
    if (!token) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

    const uid = await verifySupabaseToken(token);
    if (!uid)  return NextResponse.json({ success: false, error: 'Invalid token' }, { status: 401 });

    const formData = await req.formData();
    const file     = formData.get('photo') as File | null;

    if (!file) {
      return NextResponse.json({ success: false, error: 'No photo file provided' }, { status: 400 });
    }
    if (!file.type.startsWith('image/')) {
      return NextResponse.json({ success: false, error: 'File must be an image (JPG, PNG, WebP)' }, { status: 400 });
    }
    if (file.size > MAX_SIZE) {
      return NextResponse.json({ success: false, error: 'Photo must be under 2 MB' }, { status: 400 });
    }

    const buffer    = Buffer.from(await file.arrayBuffer());
    const base64    = buffer.toString('base64');
    const mimeType  = file.type === 'image/jpg' ? 'image/jpeg' : file.type;
    const photo_url = `data:${mimeType};base64,${base64}`;

    return NextResponse.json({ success: true, data: { photo_url } });

  } catch (err: any) {
    console.error('[/api/resume/photo]', err.message);
    return NextResponse.json(
      { success: false, error: err.message ?? 'Photo upload failed' },
      { status: 500 },
    );
  }
}

export async function DELETE(req: NextRequest) {
  // With base64 storage there is nothing server-side to delete
  try {
    const token = req.headers.get('authorization')?.replace('Bearer ', '').trim();
    if (!token) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    const uid = await verifySupabaseToken(token);
    if (!uid)  return NextResponse.json({ success: false, error: 'Invalid token' }, { status: 401 });
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message ?? 'Delete failed' }, { status: 500 });
  }
}