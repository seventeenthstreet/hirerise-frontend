/**
 * lib/openai.ts
 *
 * Multi-provider AI client with automatic fallback.
 * Each provider is called directly — no OpenRouter dependency.
 *
 * Fallback order (configure via .env.local):
 *   1. Google Gemini      (GEMINI_API_KEY)
 *   2. Groq / LLaMA       (GROQ_API_KEY)
 *   3. OpenRouter         (OPENROUTER_API_KEY)  ← only if you have credits
 *   4. Mistral            (MISTRAL_API_KEY)
 *   5. Anthropic direct   (ANTHROPIC_API_KEY)
 *
 * Add whichever keys you have — providers without a key are skipped.
 * At least one key must be set or the system throws at startup.
 *
 * .env.local:
 *   GEMINI_API_KEY=AIza...
 *   GROQ_API_KEY=gsk_...
 *   OPENROUTER_API_KEY=sk-or-...      (optional — only if you have credits)
 *   MISTRAL_API_KEY=...               (optional)
 *   ANTHROPIC_API_KEY=sk-ant-...      (optional)
 */

import OpenAI from 'openai';

// ─── Provider configs ─────────────────────────────────────────────────────────

export interface ProviderConfig {
  name:     string;
  apiKey:   string | undefined;
  baseURL:  string;
  capable:  string;   // model for generation/enhancement
  fast:     string;   // model for quick rewrites
  headers?: Record<string, string>;
}

export const PROVIDERS: ProviderConfig[] = [
  {
    name:    'Gemini',
    apiKey:  process.env.GEMINI_API_KEY,
    baseURL: 'https://generativelanguage.googleapis.com/v1beta/openai',
    capable: 'gemini-2.0-flash',
    fast:    'gemini-2.0-flash',
  },
  {
    name:    'Groq',
    apiKey:  process.env.GROQ_API_KEY,
    baseURL: 'https://api.groq.com/openai/v1',
    capable: 'llama-3.3-70b-versatile',
    fast:    'llama-3.1-8b-instant',
  },
  {
    name:    'Grok',
    apiKey:  process.env.GROK_API_KEY,
    baseURL: 'https://api.x.ai/v1',
    capable: 'grok-3',
    fast:    'grok-3-mini',
  },
  {
    name:    'Mistral',
    apiKey:  process.env.MISTRAL_API_KEY,
    baseURL: 'https://api.mistral.ai/v1',
    capable: 'mistral-large-latest',
    fast:    'mistral-small-latest',
  },
  {
    name:    'OpenRouter',
    apiKey:  process.env.OPENROUTER_API_KEY,
    baseURL: 'https://openrouter.ai/api/v1',
    capable: 'deepseek/deepseek-chat-v3-0324:free',
    fast:    'meta-llama/llama-3.1-8b-instruct:free',
    headers: {
      'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000',
      'X-Title':      'HireRise Resume Builder',
    },
  },
  {
    name:    'Anthropic',
    apiKey:  process.env.ANTHROPIC_API_KEY,
    baseURL: 'https://api.anthropic.com/v1',
    capable: 'claude-3-5-sonnet-20241022',
    fast:    'claude-3-haiku-20240307',
  },
];

// ─── Get active providers (those with a key set) ──────────────────────────────

export function getActiveProviders(): ProviderConfig[] {
  return PROVIDERS.filter(p => !!p.apiKey?.trim());
}

// ─── Get OpenAI-compatible client for a provider ──────────────────────────────

const _clients = new Map<string, OpenAI>();

export function getClientForProvider(provider: ProviderConfig): OpenAI {
  if (_clients.has(provider.name)) return _clients.get(provider.name)!;

  const client = new OpenAI({
    apiKey:          provider.apiKey!,
    baseURL:         provider.baseURL,
    defaultHeaders:  provider.headers ?? {},
  });

  _clients.set(provider.name, client);
  return client;
}

export type ModelTier = 'capable' | 'fast';