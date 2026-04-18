'use client';

import { Toaster, toast as hotToast } from 'react-hot-toast';

// ─── Toaster provider ─────────────────────────────────────────────────────────
// Drop <ToastProvider /> into your root layout once.

export function ToastProvider() {
  return (
    <Toaster
      position="top-right"
      gutter={8}
      containerStyle={{ top: 64 }} // below the top navbar
      toastOptions={{
        duration: 4000,
        style: {
          background: 'transparent',
          boxShadow: 'none',
          padding: 0,
          margin: 0,
          maxWidth: '360px',
        },
      }}
      children={(t) => <CustomToast t={t} />}
    />
  );
}

// ─── Custom toast renderer ────────────────────────────────────────────────────

function CustomToast({ t }: { t: any }) {
  const isSuccess = t.type === 'success';
  const isError   = t.type === 'error';
  const isLoading = t.type === 'loading';

  const icon = isSuccess ? (
    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-green-100 text-green-600">
      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
      </svg>
    </div>
  ) : isError ? (
    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-red-100 text-red-500">
      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
      </svg>
    </div>
  ) : isLoading ? (
    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-surface-100">
      <span className="h-4 w-4 animate-spin rounded-full border-2 border-surface-300 border-t-hr-500" />
    </div>
  ) : (
    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-hr-50 text-hr-600">
      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    </div>
  );

  return (
    <div
      style={{
        opacity: t.visible ? 1 : 0,
        transform: t.visible ? 'translateY(0)' : 'translateY(-8px)',
        transition: 'opacity 200ms ease, transform 200ms ease',
      }}
      className="flex items-start gap-3 rounded-xl border border-surface-100 bg-white px-4 py-3 shadow-lg"
    >
      {icon}
      <div className="flex-1 min-w-0 pt-0.5">
        {typeof t.message === 'string' ? (
          <p className="text-sm font-medium text-surface-900 leading-snug">{t.message}</p>
        ) : (
          t.message
        )}
      </div>
      <button
        onClick={() => hotToast.dismiss(t.id)}
        className="shrink-0 flex h-5 w-5 items-center justify-center rounded-md text-surface-300 hover:bg-surface-50 hover:text-surface-500 transition-colors mt-0.5"
      >
        <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}

// ─── Toast helpers ────────────────────────────────────────────────────────────
// Use these throughout the app instead of raw hotToast calls.

export const toast = {
  success: (message: string) => hotToast.success(message),
  error:   (message: string) => hotToast.error(message),
  info:    (message: string) => hotToast(message),
  loading: (message: string) => hotToast.loading(message),
  dismiss: (id?: string)     => hotToast.dismiss(id),
  promise: <T,>(
    promise: Promise<T>,
    msgs: { loading: string; success: string; error: string },
  ) =>
    hotToast.promise(promise, {
      loading: msgs.loading,
      success: msgs.success,
      error:   msgs.error,
    }),
};

// ─── Mutation toast helpers ───────────────────────────────────────────────────
// Convenience wrappers for common mutation patterns.

export const mutationToast = {
  profileUpdated:   () => toast.success('Profile saved successfully'),
  profileError:     () => toast.error('Failed to save profile. Please try again.'),
  resumeUploaded:      () => toast.success('Resume uploaded — AI analysis started!'),
  resumeUploadError:   () => toast.error('Upload failed. Please try again.'),
  resumeTypeError:     () => toast.error('Invalid file type. Please upload a PDF, DOC, DOCX, or TXT file.'),
  resumeDeleted:    () => toast.success('Resume deleted'),
  resumeDeleteError:() => toast.error('Failed to delete resume.'),
  networkError:     () => toast.error('Network error — check your connection.'),
  genericError:     () => toast.error('Something went wrong. Please try again.'),
};