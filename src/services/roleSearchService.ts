/**
 * services/roleSearchService.ts
 *
 * Client-side service for role search RPCs:
 *   - search_roles_hybrid  → semantic + FTS + recency scoring
 *   - autocomplete_roles   → fast prefix + fuzzy autocomplete
 *
 * Uses the browser Supabase client (anon key, RLS-enforced).
 * Query embeddings are generated server-side via /api/roles/embed.
 */

import { supabase } from '@/lib/supabaseClient';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface HybridRoleResult {
  role_id:        string;
  role_name:      string;
  hybrid_score:   number;
  semantic_score: number;
  fts_score:      number;
  recency_score:  number;
}

export interface HybridSearchResponse {
  roles: HybridRoleResult[];
  total: number;
}

export interface AutocompleteItem {
  role_id:   string;
  role_name: string;
  score:     number;
}

export interface AutocompleteResponse {
  items: AutocompleteItem[];
}

export interface HybridSearchParams {
  query:       string;
  agency:      string;
  limit?:      number;
  offset?:     number;
  minSemantic?: number;
  minFts?:     number;
}

export interface AutocompleteParams {
  query:  string;
  agency: string;
  limit?: number;
}

// ─── Embed helper (calls Next.js API route) ───────────────────────────────────

async function getQueryEmbedding(query: string): Promise<number[]> {
  const res = await fetch('/api/roles/embed', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ query }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message ?? `Embed failed: ${res.status}`);
  }

  const { embedding } = await res.json();
  return embedding as number[];
}

// ─── Service ──────────────────────────────────────────────────────────────────

export const roleSearchService = {

  /**
   * Hybrid semantic + FTS + recency search.
   * Generates a query embedding server-side, then calls search_roles_hybrid RPC.
   */
  async hybridSearch(params: HybridSearchParams): Promise<HybridSearchResponse> {
    const {
      query,
      agency,
      limit      = 20,
      offset     = 0,
      minSemantic = 0.65,
      minFts      = 0.1,
    } = params;

    // 1. Get embedding for the query
    const embedding = await getQueryEmbedding(query);

    // 2. Call the RPC
    const { data, error } = await supabase.rpc('search_roles_hybrid', {
      p_query:           query,
      p_query_embedding: embedding,
      p_agency:          agency,
      p_limit:           limit,
      p_offset:          offset,
      p_min_semantic:    minSemantic,
      p_min_fts:         minFts,
    });

    if (error) throw new Error(error.message);

    return (data as HybridSearchResponse) ?? { roles: [], total: 0 };
  },

  /**
   * Fast autocomplete — prefix + fuzzy matching, no embedding needed.
   */
  async autocomplete(params: AutocompleteParams): Promise<AutocompleteResponse> {
    const { query, agency, limit = 10 } = params;

    const { data, error } = await supabase.rpc('autocomplete_roles', {
      p_query:  query,
      p_agency: agency,
      p_limit:  limit,
    });

    if (error) throw new Error(error.message);

    return (data as AutocompleteResponse) ?? { items: [] };
  },
};