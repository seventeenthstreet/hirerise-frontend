/**
 * POST /api/career/simulate
 *
 * Runs the Career Path Simulation engine for a given user state.
 * Pure computation — no DB, no AI call. Target < 300 ms.
 *
 * Input  (JSON body):
 *   currentRole   string          Required. User's present role title.
 *   userSkills    string[]        Required. Skills the user currently has.
 *   experience    number          Required. Total years of experience (≥ 0).
 *   atsScore      number | null   Optional. Resume ATS score 0–100.
 *   location      LocationTier    Optional. Default: 'metro'.
 *   includeLateral boolean        Optional. Include cross-family pivots. Default: true.
 *
 * Output (JSON body):
 *   {
 *     success: true,
 *     data: {
 *       path: SimulatedPathStep[]   — all reachable roles, vertical first then lateral
 *     }
 *   }
 *
 * Errors:
 *   400  MISSING_FIELDS       — currentRole, userSkills, or experience absent
 *   400  INVALID_SKILLS       — userSkills is not a non-empty-string array
 *   400  INVALID_EXPERIENCE   — experience is not a finite non-negative number
 *   400  INVALID_ATS          — atsScore present but outside 0–100
 *   404  ROLE_NOT_FOUND       — currentRole not in careerPaths dataset
 *   401  Unauthorized / Invalid token
 *   500  Internal error
 */
import { NextRequest, NextResponse }   from 'next/server';
import { verifySupabaseToken } from '@/lib/auth';
import { simulateCareerPath }           from '@/lib/services/careerPathService';
import { CAREER_PATHS }                 from '@/lib/data/careerPaths';
import type { SimulateCareerPathInput } from '@/lib/services/careerPathService';
import type { LocationTier }            from '@/lib/salaryData';

// ─── Validation helpers ───────────────────────────────────────────────────────

const VALID_LOCATIONS = new Set<string>(['metro', 'tier1', 'tier2', 'tier3', 'remote']);

/** Returns a { field, message } error object or null if the body is valid. */
function validate(body: unknown): { field: string; message: string } | null {
  if (!body || typeof body !== 'object') {
    return { field: 'body', message: 'Request body must be a JSON object.' };
  }

  const b = body as Record<string, unknown>;

  // ── currentRole ────────────────────────────────────────────────────────────
  if (typeof b.currentRole !== 'string' || !b.currentRole.trim()) {
    return { field: 'currentRole', message: 'currentRole must be a non-empty string.' };
  }

  // ── userSkills ─────────────────────────────────────────────────────────────
  if (!Array.isArray(b.userSkills)) {
    return { field: 'userSkills', message: 'userSkills must be an array.' };
  }
  if (b.userSkills.some(s => typeof s !== 'string')) {
    return { field: 'userSkills', message: 'Every item in userSkills must be a string.' };
  }

  // ── experience ─────────────────────────────────────────────────────────────
  if (b.experience === undefined || b.experience === null) {
    return { field: 'experience', message: 'experience is required.' };
  }
  if (typeof b.experience !== 'number' || !isFinite(b.experience) || b.experience < 0) {
    return { field: 'experience', message: 'experience must be a finite number ≥ 0.' };
  }

  // ── atsScore (optional) ────────────────────────────────────────────────────
  if (b.atsScore !== undefined && b.atsScore !== null) {
    if (typeof b.atsScore !== 'number' || !isFinite(b.atsScore) ||
        b.atsScore < 0 || b.atsScore > 100) {
      return { field: 'atsScore', message: 'atsScore must be a number between 0 and 100.' };
    }
  }

  // ── location (optional) ────────────────────────────────────────────────────
  if (b.location !== undefined && !VALID_LOCATIONS.has(b.location as string)) {
    return {
      field: 'location',
      message: `location must be one of: ${[...VALID_LOCATIONS].join(', ')}.`,
    };
  }

  return null;
}

// ─── Route handler ────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  // ── Auth ──────────────────────────────────────────────────────────────────
  const token = req.headers.get('authorization')?.replace('Bearer ', '').trim();
  if (!token) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized' },
      { status: 401 },
    );
  }

  const uid = await verifySupabaseToken(token);
  if (!uid) {
    return NextResponse.json(
      { success: false, error: 'Invalid token' },
      { status: 401 },
    );
  }

  // ── Parse ─────────────────────────────────────────────────────────────────
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { success: false, error: 'Request body is not valid JSON.' },
      { status: 400 },
    );
  }

  // ── Validate ──────────────────────────────────────────────────────────────
  const validationError = validate(body);
  if (validationError) {
    return NextResponse.json(
      { success: false, error: validationError.message, field: validationError.field },
      { status: 400 },
    );
  }

  const {
    currentRole,
    userSkills,
    experience,
    atsScore      = null,
    location      = 'metro',
    includeLateral = true,
  } = body as {
    currentRole:    string;
    userSkills:     string[];
    experience:     number;
    atsScore?:      number | null;
    location?:      LocationTier;
    includeLateral?: boolean;
  };

  // ── Role existence check ──────────────────────────────────────────────────
  // O(1) lookup — CAREER_PATHS is a plain object, no iteration needed.
  const normalisedRole = currentRole.toLowerCase().trim();
  if (!CAREER_PATHS[normalisedRole]) {
    return NextResponse.json(
      {
        success: false,
        error:   `Role "${currentRole}" was not found in the career path dataset.`,
        field:   'currentRole',
        // Surface the closest suggestions to help callers self-correct
        hint:    'Use getAllRoles() on the client to browse available role titles.',
      },
      { status: 404 },
    );
  }

  // ── Simulate (pure, synchronous — no await) ───────────────────────────────
  try {
    const input: SimulateCareerPathInput = {
      currentRole:    normalisedRole,
      userSkills:     userSkills.map(s => s.trim()).filter(Boolean),
      experience,
      atsScore:       atsScore ?? null,
      location,
      includeLateral,
    };

    const path = simulateCareerPath(input);

    return NextResponse.json({ success: true, data: { path } });

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Simulation failed.';
    console.error('[POST /api/career/simulate]', message);
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 },
    );
  }
}