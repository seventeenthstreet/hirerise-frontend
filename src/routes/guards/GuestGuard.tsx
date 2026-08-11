/**
 * src/routes/guards/GuestGuard.tsx
 *
 * GUEST GUARD — blocks authenticated users from auth pages (login, register).
 *
 * BEFORE: Stub that rendered children unconditionally.
 *   Logged-in users could navigate back to /auth/login and see the form.
 *
 * AFTER: Reads from AppContext.
 *   - While hydrating → renders children (don't block the login form unnecessarily)
 *   - Once hydrated + user present → redirects to / (AppEntryPage routes from there)
 *   - Once hydrated + no user → renders children (show login/register form)
 *
 * Note: /auth/callback is explicitly NOT wrapped by GuestGuard in the router —
 * Supabase OAuth always redirects here regardless of current session state.
 */

import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppContext } from '@/context/AppContext';

interface GuestGuardProps {
  children: React.ReactNode;
}

export default function GuestGuard({ children }: GuestGuardProps) {
  const navigate = useNavigate();
  const { isHydrated, user } = useAppContext();

  useEffect(() => {
    if (isHydrated && user) {
      navigate('/', { replace: true });
    }
  }, [isHydrated, user, navigate]);

  // Don't flash the auth form to a logged-in user who is about to be redirected
  if (isHydrated && user) {
    return null;
  }

  return <>{children}</>;
}
