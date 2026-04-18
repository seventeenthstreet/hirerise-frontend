/**
 * lib/getToken.ts
 *
 * Place at: src/lib/getToken.ts
 *
 * Single helper that returns the current auth token for API calls.
 * Replaces the Firebase pattern:
 *   import { getIdToken } from 'firebase/auth';
 *   import { firebaseAuth } from '@/lib/firebase';
 *   const user = firebaseAuth.currentUser;
 *   const token = await getIdToken(user);
 *
 * With:
 *   import { getAuthToken } from '@/lib/getToken';
 *   const token = await getAuthToken();
 *
 * Used by: JobMatchCard, CareerGrowth, AutoApply, InterviewPrep,
 *          SalaryPredictor, and any other component that calls APIs.
 *
 * MIGRATION: In every component that does:
 *   const user = firebaseAuth.currentUser;
 *   if (!user) return;
 *   const token = await getIdToken(user);
 *
 * Replace with:
 *   const token = await getAuthToken();
 *   if (!token) return;
 */

import { getIdToken as supabaseGetToken } from '@/lib/auth';

/**
 * getAuthToken()
 *
 * Returns the current Supabase JWT access token, or null if not authenticated.
 * The token is automatically refreshed by Supabase if expired.
 */
export async function getAuthToken(): Promise<string | null> {
  return supabaseGetToken();
}

/**
 * getAuthHeaders()
 *
 * Returns a headers object with the Bearer token set.
 * Convenient for fetch() calls.
 *
 * Usage:
 *   const headers = await getAuthHeaders();
 *   if (!headers) return; // not authenticated
 *   const res = await fetch('/api/...', { method: 'POST', headers, body: ... });
 */
export async function getAuthHeaders(): Promise<HeadersInit | null> {
  const token = await getAuthToken();
  if (!token) return null;
  return {
    'Authorization': `Bearer ${token}`,
    'Content-Type':  'application/json',
  };
}