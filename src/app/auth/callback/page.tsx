/**
 * app/auth/callback/page.tsx
 *
 * This page is shown briefly while the server-side route handler at
 * /api/auth/callback processes the OAuth code exchange.
 *
 * It does NOT call exchangeCodeForSession — that is handled entirely
 * by the Route Handler at src/app/api/auth/callback/route.ts which
 * runs on the server, has cookie access, and redirects to /dashboard.
 *
 * This page only renders if something navigates to /auth/callback
 * without going through the route handler first (e.g. a stale link).
 */
export default function AuthCallbackPage() {
  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: '#07090f',
    }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{
          width: 32,
          height: 32,
          border: '2px solid #3c72f8',
          borderTopColor: 'transparent',
          borderRadius: '50%',
          animation: 'spin 0.8s linear infinite',
          margin: '0 auto 16px',
        }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        <p style={{ color: '#5f6d87', fontSize: 14 }}>Completing sign in…</p>
      </div>
    </div>
  );
}