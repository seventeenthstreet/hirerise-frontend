'use client';

// app/(admin)/admin/secrets/page.tsx
// /admin/secrets — Secrets Manager (Master Admin only)
//
// Access control: This page is ONLY accessible to users with role === 'MASTER_ADMIN'.
// The AdminGuard in layout.tsx handles authentication.
// The MasterAdminGuard below handles role enforcement in the UI.
// The backend additionally enforces MASTER_ADMIN on every API call.

import { useAuth }      from '@/features/auth/components/AuthProvider';
import { AdminTopbar }  from '@/components/layout/AdminTopbar';
import { SecretsTable } from '@/features/admin/secrets/components/SecretsTable';
import { MarketApiConfigPanel } from '@/features/admin/marketIntelligence/components/MarketApiConfigPanel';

// ─── Master Admin guard ────────────────────────────────────────────────────────

function MasterAdminRequired({ children }: { children: React.ReactNode }) {
  const { isMasterAdmin, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-surface-200 border-t-hr-600" />
      </div>
    );
  }

  if (!isMasterAdmin) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center px-6">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-red-50 mb-4">
          <svg className="h-7 w-7 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75}
              d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
        </div>
        <h2 className="text-lg font-semibold text-surface-900 mb-1">Access Restricted</h2>
        <p className="text-sm text-surface-500 max-w-sm">
          The Secrets Manager is only accessible to Master Admins.
          Contact your platform administrator if you need access.
        </p>
      </div>
    );
  }

  return <>{children}</>;
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AdminSecretsPage() {
  return (
    <div className="flex flex-col h-full">
      <AdminTopbar title="Secrets Manager" />

      <div className="flex-1 overflow-y-auto p-6">
        <MasterAdminRequired>
          {/* Page header */}
          <div className="mb-6 flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2.5 mb-1">
                <h2 className="text-xl font-semibold text-surface-900">Secrets Manager</h2>
                <span className="inline-flex items-center gap-1 rounded-full bg-violet-100 px-2.5 py-0.5
                  text-[10px] font-bold uppercase tracking-wider text-violet-700">
                  <svg className="h-2.5 w-2.5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd"
                      d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                      clipRule="evenodd" />
                  </svg>
                  Master Admin Only
                </span>
              </div>
              <p className="text-sm text-surface-500 max-w-2xl">
                Store and manage encrypted API keys and credentials for backend services.
                All secrets are encrypted with AES-256-GCM before storage and
                are never returned in plaintext by the API.
              </p>
            </div>
          </div>

          {/* Security information cards */}
          <div className="mb-6 grid grid-cols-1 sm:grid-cols-3 gap-3">
            <SecurityCard
              icon="🔐"
              title="AES-256-GCM Encrypted"
              description="Every secret is encrypted with a unique IV before it touches Firestore."
            />
            <SecurityCard
              icon="🚫"
              title="Never Returned in API"
              description="The API only returns masked previews. Plaintext is never serialised into a response."
            />
            <SecurityCard
              icon="🛡️"
              title="HMAC Tamper-Sealed"
              description="Each record includes an HMAC-SHA256 signature bound to the secret's name."
            />
          </div>

          <SecretsTable />

          {/* Market Intelligence API Configuration */}
          <div className="mt-8">
            <div className="mb-4 flex items-center gap-2.5">
              <h3 className="text-base font-semibold text-surface-900">Market Intelligence APIs</h3>
              <span className="inline-flex items-center rounded-full bg-emerald-100 px-2.5 py-0.5
                text-[10px] font-bold uppercase tracking-wider text-emerald-700">
                Secret Manager
              </span>
            </div>
            <p className="mb-4 text-sm text-surface-500 max-w-2xl">
              Configure external labor market APIs (Adzuna, SerpAPI, or Custom).
              All credentials are stored exclusively in Secret Manager and never written to Firestore.
            </p>
            <MarketApiConfigPanel />
          </div>
        </MasterAdminRequired>
      </div>
    </div>
  );
}

// ─── Security info card ───────────────────────────────────────────────────────

function SecurityCard({ icon, title, description }: { icon: string; title: string; description: string }) {
  return (
    <div className="rounded-xl border border-surface-100 bg-white p-4 shadow-sm">
      <div className="mb-2 text-xl">{icon}</div>
      <p className="text-xs font-semibold text-surface-800 mb-0.5">{title}</p>
      <p className="text-[11px] text-surface-500 leading-relaxed">{description}</p>
    </div>
  );
}