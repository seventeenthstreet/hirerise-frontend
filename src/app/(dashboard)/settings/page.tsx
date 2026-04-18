'use client';

// app/(dashboard)/settings/page.tsx — /settings
// Account preferences, billing, and danger zone. Placeholder for Phase 5+.

import { useAuth } from '@/features/auth/components/AuthProvider';

// ─── Section card ─────────────────────────────────────────────────────────────

function SettingsSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-surface-100 bg-white shadow-card">
      <div className="border-b border-surface-100 px-6 py-4">
        <h3 className="text-sm font-semibold text-surface-900">{title}</h3>
      </div>
      <div className="px-6 py-5">{children}</div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const { user, plan, signOut } = useAuth();

  return (
    <div className="animate-slide-up max-w-2xl space-y-6">

      <div>
        <h2 className="text-lg font-bold tracking-tight text-surface-900">Settings</h2>
        <p className="mt-0.5 text-sm text-surface-400">Manage your account and preferences.</p>
      </div>

      {/* Account */}
      <SettingsSection title="Account">
        <div className="space-y-4">
          <div>
            <label className="text-xs font-semibold text-surface-500">Email</label>
            <p className="mt-1 rounded-lg border border-surface-100 bg-surface-50 px-3 py-2 text-sm text-surface-700">
              {user?.email}
            </p>
          </div>
          <div>
            <label className="text-xs font-semibold text-surface-500">Display name</label>
            <p className="mt-1 rounded-lg border border-surface-100 bg-surface-50 px-3 py-2 text-sm text-surface-700">
              {user?.displayName ?? <span className="italic text-surface-300">Not set</span>}
            </p>
          </div>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-surface-300">
            Profile editing — coming Phase 5
          </p>
        </div>
      </SettingsSection>

      {/* Subscription */}
      <SettingsSection title="Subscription">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold capitalize text-surface-900">{plan} plan</p>
            <p className="mt-0.5 text-xs capitalize text-surface-400">
              Status: <span className={user?.subscriptionStatus === 'active' ? 'text-green-600' : 'text-surface-400'}>{user?.subscriptionStatus}</span>
            </p>
          </div>
          <button
            disabled
            className="rounded-lg border border-surface-200 bg-white px-3 py-2 text-xs font-medium text-surface-400 cursor-not-allowed"
          >
            Upgrade plan
          </button>
        </div>
        <p className="mt-4 text-[10px] font-semibold uppercase tracking-widest text-surface-300">
          Billing management — coming Phase 5
        </p>
      </SettingsSection>

      {/* Notifications */}
      <SettingsSection title="Notifications">
        <p className="text-sm text-surface-400">Notification preferences will be available in a future update.</p>
        <p className="mt-3 text-[10px] font-semibold uppercase tracking-widest text-surface-300">
          Coming Phase 5
        </p>
      </SettingsSection>

      {/* Danger zone */}
      <SettingsSection title="Session">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-surface-700">Sign out of HireRise</p>
            <p className="mt-0.5 text-xs text-surface-400">You will be redirected to the login page.</p>
          </div>
          <button
            onClick={signOut}
            className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-600 transition-colors hover:bg-red-100"
          >
            Sign out
          </button>
        </div>
      </SettingsSection>
    </div>
  );
}