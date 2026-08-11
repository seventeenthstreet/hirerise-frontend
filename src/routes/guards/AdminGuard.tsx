/**
 * src/routes/guards/AdminGuard.tsx
 *
 * ADMIN GUARD — gates /admin routes on admin role.
 *
 * BEFORE: Stub that rendered children unconditionally.
 *
 * AFTER: Reads from AppContext. Requires both:
 *   1. Authenticated user (redirects to /auth/login if not)
 *   2. Admin role (redirects to /dashboard if the role check fails)
 *
 * WP-ADMIN-02A-FIX: Admin detection now reads user.role from the /users/me
 * response, mirroring the backend's accepted admin roles in
 * core/src/middleware/requireAdmin.middleware.js (hasAdminClaim / isMasterAdmin):
 * 'MASTER_ADMIN', 'admin', 'super_admin'. Previously this checked
 * user.plan === 'admin' / user.tier === 'enterprise', which do not correspond
 * to any backend admin field and left every admin user unable to reach /admin.
 *
 * WP-ADMIN-02B Phase 2: admin detection now delegates to the shared
 * isAdminUser() guard in lib/guards.ts instead of a private inline
 * ADMIN_ROLES array, so this check and AppEntryPage's post-login routing
 * check can never drift apart.
 */

import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppContext } from '@/context/AppContext';
import { isAdminUser } from '@/lib/guards';
import { PageLoading } from '@/components/ui';

interface AdminGuardProps {
  children: React.ReactNode;
}

export default function AdminGuard({ children }: AdminGuardProps) {
  const navigate = useNavigate();
  const { isHydrated, isError, user } = useAppContext();

  const isAdmin = isAdminUser(user);

  useEffect(() => {
    if (!isHydrated) return;

    if (isError || !user) {
      navigate('/auth/login', { replace: true });
      return;
    }

    if (!isAdmin) {
      navigate('/dashboard', { replace: true });
    }
  }, [isHydrated, isError, user, isAdmin, navigate]);

  if (!isHydrated) {
    return <PageLoading label="Loading HireRise…" />;
  }

  if (isError || !user || !isAdmin) {
    return null;
  }

  return <>{children}</>;
}
