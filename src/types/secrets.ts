// types/secrets.ts
// Domain types for the Secrets Manager feature.
// SECURITY NOTE: These types intentionally have NO field for the secret value.
// The value is write-only; it is never returned from the API.

// ─── Database document shape (backend reference, never sent to frontend) ─────
// DO NOT add a `value` or `plaintext` field here — it must never be exposed.

export interface SecretMeta {
  id:          string;
  name:        string;          // e.g. "ANTHROPIC_API_KEY"
  description: string | null;   // human-readable purpose
  createdAt:   string;          // ISO 8601
  updatedAt:   string;          // ISO 8601
  updatedBy:   string;          // admin UID
}

export interface SecretStatus extends SecretMeta {
  maskedPreview: string;        // e.g. "sk_l************"
}

// ─── API request bodies ───────────────────────────────────────────────────────

export interface CreateSecretDto {
  name:         string;
  value:        string;         // write-only; accepted by API, never returned
  description?: string;
}

export interface UpdateSecretDto {
  value:        string;         // write-only; accepted by API, never returned
  description?: string;
}

// ─── API response shapes ──────────────────────────────────────────────────────

export interface UpsertSecretResponse {
  id:        string;
  name:      string;
  updatedAt: string;
  isNew:     boolean;
}

export interface ListSecretsResponse {
  success: boolean;
  data:    SecretMeta[];
  total:   number;
}

export interface SecretStatusResponse {
  success: boolean;
  data:    SecretStatus;
}

// ─── UI state ─────────────────────────────────────────────────────────────────

export type SecretModalMode = 'create' | 'edit';

export interface SecretModalState {
  open:   boolean;
  mode:   SecretModalMode;
  secret: SecretMeta | null;   // null when creating new
}

// Well-known secret names for the preset picker in the UI
export const WELL_KNOWN_SECRETS: { name: string; description: string; group: string }[] = [
  // ── AI Router providers (priority order) ────────────────────────────────────
  { name: 'GEMINI_API_KEY',        description: 'Google Gemini 1.5 Flash – PRIMARY AI provider',                  group: 'AI Router' },
  { name: 'FIREWORKS_API_KEY',     description: 'Fireworks AI Llama 3 70B – FALLBACK AI provider',                group: 'AI Router' },
  { name: 'MISTRAL_API_KEY',       description: 'Mistral Small – BACKUP AI provider',                             group: 'AI Router' },
  { name: 'OPENROUTER_API_KEY',    description: 'OpenRouter Llama 3 / DeepSeek – EMERGENCY AI provider',          group: 'AI Router' },
  { name: 'ANTHROPIC_API_KEY',     description: 'Claude 3 Haiku – LAST RESORT AI provider',                      group: 'AI Router' },
  // ── Platform services ────────────────────────────────────────────────────────
  { name: 'SUPABASE_SERVICE_ROLE_KEY', description: 'Supabase – service role key for server-side DB and auth access', group: 'Platform' },
  { name: 'STRIPE_SECRET_KEY',     description: 'Stripe – payment processing and subscription management',        group: 'Platform' },
  { name: 'STRIPE_WEBHOOK_SECRET', description: 'Stripe – webhook signature verification',                        group: 'Platform' },
  { name: 'SENDGRID_API_KEY',      description: 'SendGrid – transactional email delivery',                        group: 'Platform' },
  { name: 'REDIS_URL',             description: 'Redis – caching and rate limiting connection string',             group: 'Platform' },
  // ── Market Intelligence APIs ─────────────────────────────────────────────────
  { name: 'MARKET_API_APP_KEY',    description: 'Adzuna / SerpAPI – labor market intelligence data',              group: 'Market Intelligence' },
];

// The 5 AI provider keys that the AI Router requires — used to show coverage status
export const AI_ROUTER_SECRETS = [
  { name: 'GEMINI_API_KEY',     label: 'Gemini',     priority: 'PRIMARY'    },
  { name: 'FIREWORKS_API_KEY',  label: 'Fireworks',  priority: 'FALLBACK'   },
  { name: 'MISTRAL_API_KEY',    label: 'Mistral',    priority: 'BACKUP'     },
  { name: 'OPENROUTER_API_KEY', label: 'OpenRouter', priority: 'EMERGENCY'  },
  { name: 'ANTHROPIC_API_KEY',  label: 'Claude',     priority: 'LAST RESORT'},
] as const;