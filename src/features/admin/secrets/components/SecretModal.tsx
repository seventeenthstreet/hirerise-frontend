'use client';

// features/admin/secrets/components/SecretModal.tsx
//
// Write-only modal for creating or updating a secret.
//
// SECURITY BEHAVIOUR:
//  - The value <input> is always type="password" — browser will not display it.
//  - When editing an existing secret, the input is empty + placeholder "••••••••••••••••".
//    The admin must re-enter the value to update; the existing value is never pre-filled.
//  - The value string is transferred to the API and then immediately discarded;
//    it is never stored in React state beyond the duration of the form submission.
//  - autocomplete="new-password" prevents browser password managers from auto-filling
//    (they should not leak previously saved secret values into this field).

import { useState, useRef, useEffect } from 'react';
import { Modal }          from '@/components/ui/Modal';
import { Button }         from '@/components/ui/Button';
import { Input }          from '@/components/ui/Input';
import { useUpsertSecret } from '../hooks/useSecrets';
import { WELL_KNOWN_SECRETS } from '@/types/secrets';
import type { SecretMeta, SecretModalMode } from '@/types/secrets';

interface SecretModalProps {
  open:    boolean;
  mode:    SecretModalMode;
  secret:  SecretMeta | null;   // null when creating
  onClose: () => void;
  onSaved: (name: string, isNew: boolean) => void;
}

export function SecretModal({ open, mode, secret, onClose, onSaved }: SecretModalProps) {
  const isEdit = mode === 'edit' && !!secret;

  // Controlled form state
  const [name,        setName]        = useState('');
  const [description, setDescription] = useState('');
  const [showPreset,  setShowPreset]  = useState(false);

  // value lives in a ref, NOT in React state.
  // This prevents the plaintext appearing in React DevTools memory snapshots.
  const valueRef = useRef<HTMLInputElement>(null);

  const upsert = useUpsertSecret();

  // Populate fields when opening for edit
  useEffect(() => {
    if (open) {
      if (isEdit && secret) {
        setName(secret.name);
        setDescription(secret.description || '');
      } else {
        setName('');
        setDescription('');
      }
      // Always clear the value field — never pre-fill with existing secret
      if (valueRef.current) valueRef.current.value = '';
    }
  }, [open, isEdit, secret]);

  const handlePresetSelect = (presetName: string, presetDesc: string) => {
    setName(presetName);
    setDescription(presetDesc);
    setShowPreset(false);
    valueRef.current?.focus();
  };

  const handleSubmit = async () => {
    const value = valueRef.current?.value ?? '';

    // Validation
    if (!name.trim()) {
      alert('Secret name is required.');
      return;
    }
    if (!value.trim()) {
      alert('Secret value is required. For edits, you must re-enter the full value.');
      return;
    }

    try {
      const result = await upsert.mutateAsync({
        name:        name.trim(),
        value,                   // plaintext — sent over HTTPS, never stored client-side
        description: description.trim() || undefined,
      });

      // Immediately wipe the value input to reduce window of exposure
      if (valueRef.current) valueRef.current.value = '';

      onSaved(result.name, result.isNew);
      onClose();
    } catch (err) {
      // Log to console so the error is visible in DevTools
      console.error('[SecretModal] Save failed:', err);
      // upsert.isError + upsert.error will show the message below the button
      // Input value is intentionally kept so the admin can retry without re-typing
    }
  };

  const handleClose = () => {
    // Wipe value on close regardless of outcome
    if (valueRef.current) valueRef.current.value = '';
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title={isEdit ? `Update Secret — ${secret?.name}` : 'Add New Secret'}
      size="md"
    >
      <div className="space-y-5 py-1">

        {/* Security notice */}
        <div className="flex items-start gap-2.5 rounded-lg border border-amber-200 bg-amber-50 px-3.5 py-3">
          <svg className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
          </svg>
          <p className="text-xs leading-relaxed text-amber-800">
            <strong>Write-only field.</strong> Secret values are encrypted with AES-256-GCM before storage
            and are never returned by the API. Once saved, the value cannot be retrieved — only replaced.
          </p>
        </div>

        {/* Name field */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="block text-sm font-medium text-surface-700">
              Secret Name
            </label>
            {!isEdit && (
              <button
                type="button"
                onClick={() => setShowPreset(v => !v)}
                className="text-xs text-hr-600 hover:text-hr-700 font-medium"
              >
                {showPreset ? 'Hide presets' : 'Choose from presets'}
              </button>
            )}
          </div>

          {/* Preset picker — grouped by category */}
          {showPreset && !isEdit && (() => {
            const groups = WELL_KNOWN_SECRETS.reduce<Record<string, typeof WELL_KNOWN_SECRETS>>((acc, p) => {
              const g = p.group ?? 'Other';
              if (!acc[g]) acc[g] = [];
              acc[g].push(p);
              return acc;
            }, {});
            return (
              <div className="mb-2 rounded-lg border border-surface-100 bg-surface-50 max-h-64 overflow-y-auto">
                {Object.entries(groups).map(([group, presets]) => (
                  <div key={group}>
                    <div className="sticky top-0 px-3 py-1.5 bg-surface-100/80 backdrop-blur-sm">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-surface-500">{group}</p>
                    </div>
                    <div className="divide-y divide-surface-100">
                      {presets.map(p => (
                        <button
                          key={p.name}
                          type="button"
                          onClick={() => handlePresetSelect(p.name, p.description)}
                          className="w-full text-left px-3 py-2.5 hover:bg-white transition-colors"
                        >
                          <p className="text-xs font-mono font-semibold text-surface-900">{p.name}</p>
                          <p className="text-[11px] text-surface-500 mt-0.5">{p.description}</p>
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            );
          })()}

          <Input
            value={name}
            onChange={e => setName(e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, '_'))}
            placeholder="e.g. ANTHROPIC_API_KEY"
            disabled={isEdit}         // Name cannot be changed — only value
            className="font-mono text-sm"
          />
          {isEdit && (
            <p className="mt-1 text-[11px] text-surface-400">
              Secret names cannot be renamed. Delete and re-create if needed.
            </p>
          )}
        </div>

        {/* Description field */}
        <div>
          <label className="block mb-1.5 text-sm font-medium text-surface-700">
            Description <span className="text-surface-400 font-normal">(optional)</span>
          </label>
          <Input
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="e.g. Claude AI – used for resume scoring"
            maxLength={200}
          />
        </div>

        {/* Value field — WRITE-ONLY */}
        <div>
          <label className="block mb-1.5 text-sm font-medium text-surface-700">
            Secret Value
            <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-red-700">
              <svg className="h-2.5 w-2.5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
              </svg>
              Write-only
            </span>
          </label>

          {/* SECURITY: value is stored in a ref, not React state.
              type="password" ensures it's not displayed.
              autocomplete="new-password" prevents browser autofill.  */}
          <input
            ref={valueRef}
            type="password"
            autoComplete="new-password"
            spellCheck={false}
            placeholder={isEdit ? '••••••••••••••••  (enter new value to replace)' : 'Paste secret value here…'}
            className="w-full rounded-lg border border-surface-200 bg-white px-3 py-2 text-sm font-mono
              placeholder:text-surface-300 focus:border-hr-500 focus:outline-none focus:ring-2 focus:ring-hr-100
              transition-colors"
          />
          {isEdit && (
            <p className="mt-1.5 text-[11px] text-surface-400">
              You must enter the complete new value. The existing value cannot be retrieved or displayed.
            </p>
          )}
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-2 border-t border-surface-100">
          <Button variant="ghost" onClick={handleClose} disabled={upsert.isPending}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            loading={upsert.isPending}
            leftIcon={
              <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z" />
              </svg>
            }
          >
            {upsert.isPending
              ? 'Encrypting & saving…'
              : isEdit
                ? 'Update Secret'
                : 'Save Secret'}
          </Button>
        </div>

        {upsert.isError && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3">
            <p className="text-sm text-red-700 font-medium">Save failed</p>
            <p className="text-xs text-red-600 mt-0.5">
              {(upsert.error as Error)?.message || 'Unknown error — check browser console for details.'}
            </p>
          </div>
        )}
      </div>
    </Modal>
  );
}