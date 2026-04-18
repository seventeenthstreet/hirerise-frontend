'use client';

import { useEffect, useRef } from 'react';
import { cn } from '@/utils/cn';

// ─── Confirm Dialog ───────────────────────────────────────────────────────────

interface ConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title?: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'warning' | 'default';
  loading?: boolean;
}

const variantConfig = {
  danger: {
    iconBg: 'bg-red-100',
    iconColor: 'text-red-500',
    confirmCls: 'bg-red-600 hover:bg-red-700 focus-visible:ring-red-500 text-white',
    icon: (
      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75}
          d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
      </svg>
    ),
  },
  warning: {
    iconBg: 'bg-amber-100',
    iconColor: 'text-amber-500',
    confirmCls: 'bg-amber-500 hover:bg-amber-600 focus-visible:ring-amber-400 text-white',
    icon: (
      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75}
          d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
      </svg>
    ),
  },
  default: {
    iconBg: 'bg-hr-100',
    iconColor: 'text-hr-600',
    confirmCls: 'bg-hr-600 hover:bg-hr-700 focus-visible:ring-hr-500 text-white',
    icon: (
      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75}
          d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
};

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title = 'Are you sure?',
  description = 'This action cannot be undone.',
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'danger',
  loading = false,
}: ConfirmDialogProps) {
  const cfg = variantConfig[variant];
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handleKey);
    document.body.style.overflow = 'hidden';
    // Auto-focus cancel button on open (accessibility)
    setTimeout(() => cancelRef.current?.focus(), 50);
    return () => {
      document.removeEventListener('keydown', handleKey);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/20 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Dialog */}
      <div
        role="alertdialog"
        aria-modal
        aria-labelledby="confirm-title"
        aria-describedby="confirm-desc"
        className="relative w-full max-w-sm rounded-2xl border border-surface-100 bg-white shadow-2xl"
        style={{ animation: 'slideUp 150ms ease' }}
      >
        <div className="p-6">
          {/* Icon */}
          <div className={cn(
            'mb-4 flex h-11 w-11 items-center justify-center rounded-2xl',
            cfg.iconBg, cfg.iconColor,
          )}>
            {cfg.icon}
          </div>

          {/* Text */}
          <h3 id="confirm-title" className="text-sm font-bold text-surface-900">
            {title}
          </h3>
          <p id="confirm-desc" className="mt-1.5 text-sm text-surface-500 leading-relaxed">
            {description}
          </p>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-2 border-t border-surface-100 px-6 py-4">
          <button
            ref={cancelRef}
            onClick={onClose}
            disabled={loading}
            className="flex h-9 items-center justify-center rounded-lg border border-surface-200 px-4 text-sm font-medium text-surface-600 hover:bg-surface-50 disabled:opacity-50 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-surface-400"
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className={cn(
              'flex h-9 min-w-[80px] items-center justify-center rounded-lg px-4 text-sm font-semibold shadow-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 disabled:opacity-60',
              cfg.confirmCls,
            )}
          >
            {loading ? (
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
            ) : (
              confirmLabel
            )}
          </button>
        </div>
      </div>

      <style>{`
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(8px) scale(0.98); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>
    </div>
  );
}

// ─── useConfirm hook ──────────────────────────────────────────────────────────
// Convenience hook for imperative confirm dialogs.

import { useState, useCallback } from 'react';

interface UseConfirmOptions {
  title?: string;
  description?: string;
  confirmLabel?: string;
  variant?: 'danger' | 'warning' | 'default';
}

export function useConfirm(options: UseConfirmOptions = {}) {
  const [open, setOpen] = useState(false);
  const [resolve, setResolve] = useState<(v: boolean) => void>(() => () => {});

  const confirm = useCallback((): Promise<boolean> => {
    setOpen(true);
    return new Promise((res) => setResolve(() => res));
  }, []);

  const handleConfirm = () => { setOpen(false); resolve(true); };
  const handleCancel  = () => { setOpen(false); resolve(false); };

  const Dialog = ({ loading }: { loading?: boolean }) => (
    <ConfirmDialog
      open={open}
      onClose={handleCancel}
      onConfirm={handleConfirm}
      loading={loading}
      {...options}
    />
  );

  return { confirm, Dialog };
}
