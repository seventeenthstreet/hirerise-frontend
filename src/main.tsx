import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'
import { validateEnv } from './lib/env'

// FIX-02: Removed the stray `console.log('SUPABASE URL:', ...)` statement
// that previously appeared before the import block. Top-level statements
// before imports are invalid in standard ES modules and also leaked the
// Supabase project URL to the browser console on every page load.

// FIX-08: Validate required Vite env vars before mounting the app.
// If VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY are missing or corrupted
// (e.g. by a UTF-8 BOM in .env.local), fail loudly here with an actionable
// console error instead of silently falling back to a broken Supabase
// client later. AppErrorBoundary (inside <App />) will still catch any
// throw from getSupabaseClient() during render as a second line of
// defense, but validating here gives the clearest, earliest signal.
try {
  validateEnv();
} catch (err) {
  // eslint-disable-next-line no-console
  console.error(err instanceof Error ? err.message : err);
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)