// app/api/upload/route.ts
//
// Proxies CV uploads from the onboarding page to the backend.
//
// The onboarding page sends the file under the field name 'resume'.
// This proxy attaches the Supabase Bearer token before forwarding to the backend.

import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function GET() {
  return Response.json({ message: 'Upload route working ✅' });
}

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    // Onboarding page sends under 'resume'; fall back to 'file' for legacy callers
    const file = (formData.get('resume') ?? formData.get('file')) as File | null;

    if (!file) {
      return Response.json(
        { success: false, error: 'No file uploaded' },
        { status: 400 }
      );
    }

    console.log(`[upload] File received: ${file.name} ${file.size} bytes`);

    // ── Retrieve the Supabase session token ──────────────────────────────
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll: () => cookieStore.getAll(),
          setAll: () => {}, // read-only in Route Handlers
        },
      }
    );

    const { data: { session } } = await supabase.auth.getSession();

    if (!session?.access_token) {
      console.warn('[upload] No active session — returning 401');
      return Response.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    console.log('[upload] Token obtained, forwarding to backend...');

    // ── Forward to the backend onboarding upload endpoint ────────────────
    // IMPORTANT: rename field 'file' → 'resume' to match multer's
    //            upload.single('resume') configuration on the backend.
    const backendForm = new FormData();
    backendForm.append('resume', file, file.name);

    const backendBase = process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, '') ?? '';
    const backendRes = await fetch(`${backendBase}/api/v1/onboarding/upload-cv`, {
      method: 'POST',
      body: backendForm,
      headers: {
        // Do NOT set Content-Type — fetch sets multipart/form-data + boundary automatically
        Authorization: `Bearer ${session.access_token}`,
      },
    });

    console.log(`[upload] Backend responded: ${backendRes.status}`);

    const body = await backendRes.json().catch(() => ({})) as Record<string, unknown>;

    if (!backendRes.ok) {
      console.error(`[upload] Backend error: ${backendRes.status}`, body);
      return Response.json(body, { status: backendRes.status });
    }

    // Surface the resumeId and any parsed data the onboarding page needs
    const data = (body.data ?? {}) as Record<string, unknown>;
    return Response.json({
      success: true,
      message: 'File uploaded successfully',
      resumeId: data.resumeId ?? null,
      parsedData: data.parsedData ?? null,
    });

  } catch (error) {
    console.error('[upload] Unexpected error:', error);
    return Response.json(
      { success: false, error: 'Upload failed' },
      { status: 500 }
    );
  }
}