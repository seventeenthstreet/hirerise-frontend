/**
 * components/admin-shell/AdminSidebar.tsx
 *
 * Admin console sidebar — desktop persistent rail + mobile drawer overlay.
 * Structural twin of app-shell/AppSidebar, swapping role-resolved
 * AppNavigation for the static AdminNavigation. Kept as a separate
 * component (rather than parameterizing AppSidebar) because AppSidebar's
 * public contract is coupled to `userType`/`userName` for the
 * student/professional shell, and widening that contract was out of scope
 * for this fix — see WP-ADMIN-01C-FIX certification report.
 *
 * RESPONSIVE STRATEGY (same as AppSidebar):
 *  - lg+ : static sidebar rendered alongside content
 *  - < lg : overlay drawer, controlled by `isOpen` prop
 */

import { AdminNavigation } from './AdminNavigation';

interface AdminSidebarProps {
  /** Mobile drawer open state (ignored on lg+). */
  isOpen: boolean;
  /** Called when the user taps the overlay or a nav item on mobile. */
  onClose: () => void;
}

export function AdminSidebar({ isOpen, onClose }: AdminSidebarProps) {
  return (
    <>
      {/* ── DESKTOP SIDEBAR ─────────────────────────────────────────────── */}
      <aside className="hidden lg:flex lg:flex-shrink-0" aria-label="Admin navigation">
        <SidebarInner />
      </aside>

      {/* ── MOBILE OVERLAY ──────────────────────────────────────────────── */}
      {isOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/40 lg:hidden"
          aria-hidden="true"
          onClick={onClose}
        />
      )}

      <div
        className={[
          'fixed inset-y-0 left-0 z-40 flex lg:hidden',
          'transition-transform duration-250 ease-in-out',
          isOpen ? 'translate-x-0' : '-translate-x-full',
        ].join(' ')}
        aria-label="Mobile admin navigation"
      >
        <SidebarInner onNavigate={onClose} />
      </div>
    </>
  );
}

function SidebarInner({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <div className="flex w-56 flex-col bg-background border-r border-border">
      <div className="flex h-14 shrink-0 items-center border-b border-border px-4">
        <span className="text-sm font-bold tracking-tight text-foreground">
          HireRise Admin
        </span>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-4">
        <AdminNavigation onNavigate={onNavigate} />
      </div>
    </div>
  );
}
