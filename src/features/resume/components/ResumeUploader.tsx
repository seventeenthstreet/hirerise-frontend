'use client';

// features/resume/components/ResumeUploader.tsx  — V2 PREMIUM
//
// ─── ROOT CAUSE: 0.00 MB BUG ─────────────────────────────────────────────────
//
// Source 1 — TIMING: If extractMetadata() is called after an async boundary
//   (e.g. inside a setTimeout, Promise.then, or setState callback), some
//   browsers have already garbage-collected the File blob reference, silently
//   zeroing file.size. Fix: read file.size synchronously in the event handler,
//   before any await or state update.
//
// Source 2 — WRONG BRANCH: The old formatBytes guard was:
//   `if (!bytes || bytes === 0) return '—'`
//   This is correct, BUT some callers bypassed it and did inline arithmetic
//   like `(resume.fileSize / (1024*1024)).toFixed(2)` directly on a null/0
//   server value, producing "0.00". Fix: route ALL size display through
//   formatBytes() — never do arithmetic at the call site.
//
// Source 3 — STALE STATE: If the parent component re-renders and passes a new
//   `file` prop that has been cloned/serialised (e.g. from FormData), the size
//   is lost. Fix: capture metadata immediately from the live File object and
//   store sizeBytes as a plain number in state — never re-derive it.
//
// ─── V2 UX CHANGES ───────────────────────────────────────────────────────────
//   • State machine: idle → selected → uploading → processing → done | error
//   • UploadDropzone: illustrated cloud icon, drag animation, format pills
//   • FilePreviewCard: large success header, bold name, muted meta, type badge,
//       "Replace file" secondary button, hover scale micro-interaction
//   • ProcessingState: 3-step animated pipeline (✔ upload → ⚡ extract → 🔍 analyse)
//   • ErrorBanner: icon, message, dismissible X
//   • TrustLine: shield icon + security copy beneath upload areas
//   • All exports named so they can be used standalone in other flows

import { useRef, useState, useCallback } from 'react';
import { useResumes, useUploadResume, useDeleteResume } from '../hooks';
import { useAiJobPoller } from '@/hooks/useAiJobPoller';
import type { Resume, JobStatus } from '@/services/resumeService';
import { cn } from '@/utils/cn';

// ─── Constants ─────────────────────────────────────────────────────────────────

const ACCEPTED_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
] as const;

const MAX_SIZE_MB = 10;

// ─── Types ─────────────────────────────────────────────────────────────────────

interface FileMetadata {
  name: string;
  /**
   * Pre-formatted label — computed synchronously from file.size at selection.
   * < 1 KB  → "N B"
   * < 1 MB  → "N.N KB"   ← PREVENTS "0.00 MB" for small files
   * ≥ 1 MB  → "N.NN MB"
   */
  sizeLabel: string;
  /** Raw bytes stored to avoid re-reading the File later. */
  sizeBytes: number;
  typeLabel: 'PDF' | 'DOCX' | 'Unknown';
  mimeType: string;
}

/** Discriminated union — prevents impossible combinations. */
type UploadViewState =
  | { tag: 'idle' }
  | { tag: 'selected';   meta: FileMetadata }
  | { tag: 'uploading';  meta: FileMetadata }
  | { tag: 'processing'; meta: FileMetadata; jobId: string }
  | { tag: 'done';       meta: FileMetadata }
  | { tag: 'error';      message: string };

// ─── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Single source of truth for byte → label conversion.
 * NEVER call .toFixed() outside this function.
 */
function formatBytes(bytes: number | null | undefined): string {
  if (bytes === null || bytes === undefined || bytes === 0) return '—';
  if (bytes < 1_024)            return `${bytes} B`;
  if (bytes < 1_024 * 1_024)   return `${(bytes / 1_024).toFixed(1)} KB`;
  return `${(bytes / (1_024 * 1_024)).toFixed(2)} MB`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    year: 'numeric', month: 'short', day: 'numeric',
  });
}

function getMimeLabel(mime: string): 'PDF' | 'DOCX' | 'Unknown' {
  if (mime === 'application/pdf') return 'PDF';
  if (
    mime === 'application/msword' ||
    mime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ) return 'DOCX';
  return 'Unknown';
}

/**
 * Extract FileMetadata from a live File object.
 * MUST be called synchronously in the DOM event handler.
 * Do NOT await or defer — browsers may zero file.size after the microtask.
 */
function extractMetadata(file: File): FileMetadata {
  return {
    name:      file.name,
    sizeLabel: formatBytes(file.size),  // read immediately
    sizeBytes: file.size,
    typeLabel: getMimeLabel(file.type),
    mimeType:  file.type,
  };
}

function validateFile(file: File): string | null {
  if (!file)           return 'No file selected.';
  if (file.size === 0) return 'This file appears to be empty. Please choose a valid resume.';
  if (!(ACCEPTED_TYPES as readonly string[]).includes(file.type)) {
    const ext = file.name.split('.').pop()?.toUpperCase() ?? 'file';
    return `${ext} files are not supported. Please upload a PDF or DOCX.`;
  }
  if (file.size > MAX_SIZE_MB * 1_024 * 1_024)
    return `File is ${formatBytes(file.size)}, which exceeds the ${MAX_SIZE_MB} MB limit.`;
  return null;
}

// ─── Shared icon primitives ────────────────────────────────────────────────────

function IconShield({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
        d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
    </svg>
  );
}

function IconCheckCircle({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

function IconXCircle({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M9.75 9.75l4.5 4.5m0-4.5l-4.5 4.5M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

// ─── FileTypeIcon ──────────────────────────────────────────────────────────────

function FileTypeIcon({
  mimeType,
  size = 'md',
}: {
  mimeType: string;
  size?: 'sm' | 'md' | 'lg';
}) {
  const isPdf   = mimeType === 'application/pdf';
  const dims    = { sm: 'h-9 w-9',   md: 'h-12 w-12',  lg: 'h-16 w-16' }[size];
  const iconDim = { sm: 'h-[18px] w-[18px]', md: 'h-6 w-6', lg: 'h-8 w-8' }[size];
  const radii   = { sm: 'rounded-lg', md: 'rounded-xl', lg: 'rounded-2xl' }[size];

  return (
    <div
      className={cn(
        'flex flex-shrink-0 items-center justify-center transition-colors',
        dims, radii,
        isPdf ? 'bg-rose-50 ring-1 ring-rose-100' : 'bg-sky-50 ring-1 ring-sky-100',
      )}
      aria-hidden
    >
      <svg
        className={cn(iconDim, isPdf ? 'text-rose-400' : 'text-sky-400')}
        fill="none" stroke="currentColor" viewBox="0 0 24 24"
      >
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75}
          d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
        {!isPdf && (
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
            d="M9 13.5l1.5 4.5 1.5-3.75 1.5 3.75L15 13.5" />
        )}
      </svg>
    </div>
  );
}

// ─── TypeBadge ─────────────────────────────────────────────────────────────────

function TypeBadge({ typeLabel, mimeType }: { typeLabel: string; mimeType: string }) {
  const isPdf = mimeType === 'application/pdf';
  return (
    <span className={cn(
      'inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-semibold tracking-wide ring-1',
      isPdf
        ? 'bg-rose-50 text-rose-600 ring-rose-200'
        : 'bg-sky-50 text-sky-600 ring-sky-200',
    )}>
      {typeLabel}
    </span>
  );
}

// ─── StatusBadge ───────────────────────────────────────────────────────────────

type DisplayStatus = Resume['status'];

const STATUS_CFG: Record<DisplayStatus, { badge: string; dot: string; label: string }> = {
  pending:    { badge: 'bg-blue-50 text-blue-600 ring-blue-200',        dot: 'bg-blue-400 animate-pulse',   label: 'Queued'    },
  processing: { badge: 'bg-amber-50 text-amber-600 ring-amber-200',     dot: 'bg-amber-400 animate-pulse',  label: 'Analyzing' },
  completed:  { badge: 'bg-emerald-50 text-emerald-700 ring-emerald-200', dot: 'bg-emerald-400',            label: 'Analyzed'  },
  failed:     { badge: 'bg-red-50 text-red-600 ring-red-200',           dot: 'bg-red-400',                  label: 'Failed'    },
};

function StatusBadge({ status }: { status: DisplayStatus }) {
  const s = STATUS_CFG[status] ?? STATUS_CFG.processing;
  return (
    <span className={cn(
      'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ring-1',
      s.badge,
    )}>
      <span className={cn('h-1.5 w-1.5 flex-shrink-0 rounded-full', s.dot)} />
      {s.label}
    </span>
  );
}

// ─── TrustLine ─────────────────────────────────────────────────────────────────

function TrustLine() {
  return (
    <p className="flex items-center justify-center gap-1.5 text-[11px] text-surface-400">
      <IconShield className="h-3.5 w-3.5 flex-shrink-0" />
      Your resume is processed securely and never shared with third parties.
    </p>
  );
}

// ─── ErrorBanner ───────────────────────────────────────────────────────────────

interface ErrorBannerProps {
  message: string;
  onDismiss?: () => void;
}

export function ErrorBanner({ message, onDismiss }: ErrorBannerProps) {
  return (
    <div
      role="alert"
      className="animate-slide-up flex items-start gap-3 rounded-xl border border-red-100 bg-red-50 px-4 py-3"
    >
      <IconXCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-red-500" />
      <p className="flex-1 text-[12px] font-medium leading-relaxed text-red-700">{message}</p>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss"
          className="ml-auto flex-shrink-0 text-red-400 transition-colors hover:text-red-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400 focus-visible:ring-offset-1"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      )}
    </div>
  );
}

// ─── UploadDropzone ────────────────────────────────────────────────────────────

interface UploadDropzoneProps {
  onFile: (file: File) => void;
  disabled?: boolean;
}

export function UploadDropzone({ onFile, disabled = false }: UploadDropzoneProps) {
  const inputRef                      = useRef<HTMLInputElement>(null);
  const [dragging, setDragging]       = useState(false);
  const [localError, setLocalError]   = useState<string | null>(null);

  const process = useCallback((file: File | null | undefined) => {
    if (!file) return;
    const err = validateFile(file);
    if (err) { setLocalError(err); return; }
    setLocalError(null);
    onFile(file);
  }, [onFile]);

  return (
    <div className="space-y-3">
      <div
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-label="Upload resume — click or drag a file here"
        aria-disabled={disabled}
        onKeyDown={(e) => !disabled && e.key === 'Enter' && inputRef.current?.click()}
        onDragEnter={() => !disabled && setDragging(true)}
        onDragLeave={() => setDragging(false)}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          if (!disabled) process(e.dataTransfer.files[0]);
        }}
        onClick={() => !disabled && inputRef.current?.click()}
        className={cn(
          'group relative flex flex-col items-center justify-center overflow-hidden rounded-2xl',
          'border-2 border-dashed px-8 py-14 text-center',
          'cursor-pointer select-none transition-all duration-300',
          disabled && 'pointer-events-none opacity-50',
          dragging
            ? 'scale-[1.012] border-hr-400 bg-hr-50'
            : 'border-surface-200 bg-white hover:border-hr-300 hover:bg-hr-50/30',
        )}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".pdf,.doc,.docx"
          className="sr-only"
          disabled={disabled}
          onChange={(e) => {
            process(e.target.files?.[0]);
            e.target.value = '';
          }}
        />

        {/* Upload cloud icon */}
        <div className={cn(
          'relative mb-5 flex h-16 w-16 items-center justify-center rounded-2xl ring-1 transition-all duration-300',
          dragging
            ? 'bg-hr-100 ring-hr-200'
            : 'bg-surface-50 ring-surface-200 group-hover:bg-hr-50 group-hover:ring-hr-200',
        )}>
          <svg
            className={cn(
              'h-8 w-8 transition-all duration-300',
              dragging ? 'text-hr-500 scale-110' : 'text-surface-400 group-hover:text-hr-400',
            )}
            fill="none" stroke="currentColor" viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.4}
              d="M12 16.5V9.75m0 0l3 3m-3-3l-3 3M6.75 19.5a4.5 4.5 0 01-1.41-8.775 5.25 5.25 0 0110.233-2.33 3 3 0 013.758 3.848A3.752 3.752 0 0118 19.5H6.75z" />
          </svg>
        </div>

        <h3 className={cn(
          'mb-1.5 text-[15px] font-semibold tracking-tight transition-colors',
          dragging ? 'text-hr-700' : 'text-surface-800',
        )}>
          {dragging ? 'Release to upload' : 'Drag & drop your resume here'}
        </h3>
        <p className="mb-5 text-[12px] text-surface-400">or click to browse your files</p>

        {/* Format pills */}
        <div className="flex items-center gap-2">
          <span className="rounded-md bg-rose-50 px-2.5 py-1 text-[11px] font-semibold text-rose-500 ring-1 ring-rose-100">PDF</span>
          <span className="rounded-md bg-sky-50 px-2.5 py-1 text-[11px] font-semibold text-sky-500 ring-1 ring-sky-100">DOCX</span>
          <span className="text-[11px] text-surface-400">· Max {MAX_SIZE_MB} MB</span>
        </div>
      </div>

      {localError && <ErrorBanner message={localError} onDismiss={() => setLocalError(null)} />}
      <TrustLine />
    </div>
  );
}

// ─── FilePreviewCard ───────────────────────────────────────────────────────────

interface FilePreviewCardProps {
  meta: FileMetadata;
  onReplaceFile: () => void;
}

export function FilePreviewCard({ meta, onReplaceFile }: FilePreviewCardProps) {
  return (
    <div className="animate-slide-up space-y-3">
      <div className={cn(
        'group relative overflow-hidden rounded-2xl border bg-white p-5',
        'border-emerald-100 ring-1 ring-emerald-100/60 shadow-card-md',
        'transition-all duration-200 hover:shadow-card-lg hover:scale-[1.004]',
      )}>
        {/* Decorative corner tint */}
        <div
          aria-hidden
          className="pointer-events-none absolute right-0 top-0 h-28 w-28 rounded-full bg-emerald-50/70"
          style={{ transform: 'translate(35%, -35%)' }}
        />

        <div className="relative flex items-start gap-4">
          <FileTypeIcon mimeType={meta.mimeType} size="lg" />

          <div className="flex-1 min-w-0 pt-0.5">
            {/* Success header */}
            <div className="mb-2 flex items-center gap-2">
              <IconCheckCircle className="h-[18px] w-[18px] flex-shrink-0 text-emerald-500" />
              <span className="text-[11px] font-semibold uppercase tracking-widest text-emerald-600">
                Resume uploaded successfully
              </span>
            </div>

            {/* File name — bold, primary */}
            <p className="mb-2 truncate text-[15px] font-semibold leading-snug text-surface-900">
              {meta.name}
            </p>

            {/* Metadata — muted */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[12px] font-medium text-surface-500">{meta.sizeLabel}</span>
              <span className="text-[12px] text-surface-300">·</span>
              <TypeBadge typeLabel={meta.typeLabel} mimeType={meta.mimeType} />
            </div>
          </div>

          {/* Replace file button */}
          <button
            type="button"
            onClick={onReplaceFile}
            className={cn(
              'flex-shrink-0 rounded-lg px-3 py-1.5 text-[12px] font-semibold',
              'text-surface-500 ring-1 ring-surface-200 transition-all duration-150',
              'hover:bg-surface-50 hover:text-surface-800 hover:ring-surface-300',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-hr-400 focus-visible:ring-offset-2',
              'active:scale-[0.96]',
            )}
          >
            Replace file
          </button>
        </div>
      </div>

      <TrustLine />
    </div>
  );
}

// ─── ProcessingState ───────────────────────────────────────────────────────────

const PIPELINE_STEPS: Array<{
  label: string;
  subLabel: string;
  icon: string;
  triggerStatus: JobStatus | 'uploading';
}> = [
  { label: 'Upload complete',       subLabel: 'File received securely',              icon: '✔',  triggerStatus: 'uploading'  },
  { label: 'Extracting skills',     subLabel: 'Identifying your competencies',        icon: '⚡', triggerStatus: 'pending'    },
  { label: 'Analysing experience',  subLabel: 'Building your career intelligence',    icon: '🔍', triggerStatus: 'processing' },
];

function getPipelineStep(status: JobStatus | 'uploading'): number {
  if (status === 'uploading')                        return 0;
  if (status === 'pending')                          return 1;
  if (status === 'processing')                       return 2;
  if (status === 'completed' || status === 'failed') return 3;
  return 0;
}

interface ProcessingStateProps {
  jobId: string | null;
  isUploading: boolean;
  fileMeta: FileMetadata | null;
  onReset: () => void;
}

export function ProcessingState({ jobId, isUploading, fileMeta, onReset }: ProcessingStateProps) {
  const { data: job } = useAiJobPoller(isUploading ? null : jobId);

  const status: JobStatus | 'uploading' = isUploading
    ? 'uploading'
    : (job?.status ?? 'pending');

  const currentStep = getPipelineStep(status);
  const isDone      = status === 'completed' || status === 'failed';
  const isFailed    = status === 'failed';

  return (
    <div className={cn(
      'animate-fade-in rounded-2xl border p-6 transition-all duration-300',
      isFailed ? 'border-red-100 bg-red-50'
        : isDone ? 'border-emerald-100 bg-emerald-50'
        : 'border-hr-100 bg-hr-50/60',
    )}>

      {/* File identity strip */}
      {fileMeta && (
        <div className="mb-5 flex items-center gap-3 rounded-xl border border-white bg-white/80 px-4 py-2.5 shadow-card">
          <FileTypeIcon mimeType={fileMeta.mimeType} size="sm" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-semibold text-surface-800">{fileMeta.name}</p>
            <div className="mt-0.5 flex items-center gap-1.5">
              <span className="text-[11px] text-surface-400">{fileMeta.sizeLabel}</span>
              <span className="text-[11px] text-surface-300">·</span>
              <TypeBadge typeLabel={fileMeta.typeLabel} mimeType={fileMeta.mimeType} />
            </div>
          </div>
        </div>
      )}

      {/* State icon */}
      <div className="mb-4 flex flex-col items-center gap-2">
        {isFailed ? (
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
            <IconXCircle className="h-7 w-7 text-red-500" />
          </div>
        ) : isDone ? (
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100">
            <IconCheckCircle className="h-7 w-7 text-emerald-500" />
          </div>
        ) : (
          <div className="relative h-12 w-12">
            <div className="h-12 w-12 animate-spin rounded-full border-2 border-hr-200 border-t-hr-500" />
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="h-2 w-2 animate-pulse rounded-full bg-hr-400" />
            </div>
          </div>
        )}

        <p className={cn(
          'text-[14px] font-semibold',
          isFailed ? 'text-red-700' : isDone ? 'text-emerald-700' : 'text-hr-700',
        )}>
          {isFailed
            ? 'Analysis failed — please try again'
            : isDone
            ? 'Resume analysed successfully!'
            : 'Analysing your resume…'}
        </p>

        {!isDone && !isFailed && (
          <p className="animate-pulse text-[12px] text-surface-400">Usually takes 15–30 seconds</p>
        )}
      </div>

      {/* Step pipeline */}
      <ol className="space-y-2">
        {PIPELINE_STEPS.map((step, i) => {
          const done   = i < currentStep || (isDone && !isFailed);
          const active = i === currentStep && !isDone;
          const failed = isFailed && i === currentStep;

          return (
            <li
              key={step.label}
              className={cn(
                'flex items-center gap-3 rounded-xl px-4 py-3 transition-all duration-300',
                done   ? 'bg-white/70' :
                active ? 'bg-white shadow-card' :
                         'opacity-40',
              )}
            >
              <span className={cn(
                'flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-[11px] font-bold transition-all',
                done   ? 'bg-emerald-400 text-white' :
                failed ? 'bg-red-400 text-white'     :
                active ? 'bg-hr-500 text-white'      :
                         'bg-surface-200 text-surface-400',
              )}>
                {done ? '✓' : failed ? '✕' : step.icon}
              </span>

              <div className="flex-1 min-w-0">
                <p className={cn(
                  'text-[12px] font-semibold leading-none',
                  done || active ? 'text-surface-800' : 'text-surface-400',
                )}>
                  {step.label}
                </p>
                {(done || active) && (
                  <p className="mt-0.5 text-[11px] text-surface-400">{step.subLabel}</p>
                )}
              </div>

              {/* Bounce dots for active step */}
              {active && (
                <span className="flex gap-0.5" aria-hidden>
                  {[0, 1, 2].map((d) => (
                    <span
                      key={d}
                      className="h-1 w-1 animate-bounce rounded-full bg-hr-400"
                      style={{ animationDelay: `${d * 150}ms` }}
                    />
                  ))}
                </span>
              )}

              {done && <IconCheckCircle className="h-4 w-4 flex-shrink-0 text-emerald-400" />}
            </li>
          );
        })}
      </ol>

      {(isDone || isFailed) && (
        <div className="mt-5 flex justify-center">
          <button
            onClick={onReset}
            className={cn(
              'rounded-lg px-5 py-2 text-[13px] font-semibold transition-all duration-150',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
              'active:scale-[0.97]',
              isFailed
                ? 'bg-red-500 text-white hover:bg-red-600 focus-visible:ring-red-400'
                : 'bg-hr-600 text-white hover:bg-hr-700 focus-visible:ring-hr-400',
            )}
          >
            {isFailed ? 'Try again' : 'Upload another'}
          </button>
        </div>
      )}
    </div>
  );
}

// ─── ResumeItem ────────────────────────────────────────────────────────────────

function ResumeItem({ resume }: { resume: Resume }) {
  const del = useDeleteResume();
  const [conf, setConf] = useState(false);

  return (
    <li className={cn(
      'group flex items-start gap-4 rounded-xl border border-surface-100 bg-white p-4',
      'shadow-card transition-all duration-200 hover:shadow-card-md hover:border-surface-200',
    )}>
      <FileTypeIcon mimeType={resume.mimeType ?? 'application/pdf'} size="sm" />

      <div className="flex-1 min-w-0">
        <div className="mb-0.5 flex flex-wrap items-center gap-2">
          <p className="truncate text-[13px] font-semibold text-surface-900">{resume.fileName}</p>
          <StatusBadge status={(resume.status as DisplayStatus) ?? 'processing'} />
        </div>
        {/* formatBytes ensures correct conversion — guards null/0 from server */}
        <p className="text-[11px] text-surface-400">
          {formatBytes(resume.fileSize)} · Uploaded {formatDate(resume.uploadedAt)}
        </p>

        {(resume.extractedSkills?.length ?? 0) > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {resume.extractedSkills.slice(0, 6).map((s) => (
              <span key={s} className="rounded-md bg-hr-50 px-1.5 py-0.5 text-[10px] font-medium text-hr-600 ring-1 ring-hr-100">
                {s}
              </span>
            ))}
            {resume.extractedSkills.length > 6 && (
              <span className="rounded-md bg-surface-50 px-1.5 py-0.5 text-[10px] text-surface-400 ring-1 ring-surface-200">
                +{resume.extractedSkills.length - 6}
              </span>
            )}
          </div>
        )}
      </div>

      <div className="flex-shrink-0 opacity-0 transition-opacity group-hover:opacity-100">
        {conf ? (
          <div className="flex items-center gap-1">
            <button
              onClick={() => del.mutate(resume.id)}
              disabled={del.isPending}
              className="rounded-md bg-red-50 px-2 py-1 text-[11px] font-semibold text-red-600 hover:bg-red-100 disabled:opacity-50 transition-colors"
            >
              {del.isPending ? '…' : 'Delete'}
            </button>
            <button
              onClick={() => setConf(false)}
              className="rounded-md px-2 py-1 text-[11px] font-medium text-surface-400 hover:text-surface-600 transition-colors"
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            onClick={() => setConf(true)}
            aria-label={`Delete ${resume.fileName}`}
            className="flex h-7 w-7 items-center justify-center rounded-lg text-surface-300 hover:bg-red-50 hover:text-red-400 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-300"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75}
                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        )}
      </div>
    </li>
  );
}

// ─── HistorySkeleton ───────────────────────────────────────────────────────────

function HistorySkeleton() {
  return (
    <ul className="space-y-3" aria-busy aria-label="Loading resume history">
      {[1, 2].map((i) => (
        <li key={i} className="flex gap-4 rounded-xl border border-surface-100 bg-white p-4 shadow-card">
          <div className="h-9 w-9 flex-shrink-0 animate-skeleton rounded-xl bg-surface-100" />
          <div className="flex-1 space-y-2">
            <div className="h-[14px] w-52 animate-skeleton rounded-md bg-surface-100" />
            <div className="h-3 w-32 animate-skeleton rounded-md bg-surface-100" />
          </div>
        </li>
      ))}
    </ul>
  );
}

// ─── ResumeUploader (root component) ──────────────────────────────────────────

export function ResumeUploader() {
  const { data, isLoading, isError } = useResumes();
  const upload = useUploadResume();
  const resumes = data?.items ?? [];

  // Hidden input ref for "Replace file" trigger
  const replaceInputRef = useRef<HTMLInputElement>(null);

  // Full state machine — single source of truth
  const [view, setView] = useState<UploadViewState>({ tag: 'idle' });

  /**
   * Core handler — called whenever a valid file is chosen (click or drop).
   *
   * IMPORTANT: extractMetadata() is called HERE, synchronously, before any
   * state update or async call. This guarantees file.size is read from the
   * live File object and will never be 0 due to async timing.
   */
  const handleFile = useCallback((file: File) => {
    const meta = extractMetadata(file); // ← synchronous, must be first

    setView({ tag: 'uploading', meta });

    upload.mutate(file, {
      onSuccess: (result) => {
        const jobId = result.jobId ?? result.resumeId ?? null;
        if (jobId) {
          setView({ tag: 'processing', meta, jobId });
        } else {
          setView({ tag: 'done', meta });
        }
      },
      onError: (err) => {
        const message = (err as Error)?.message ?? 'Upload failed. Please try again.';
        setView({ tag: 'error', message });
      },
    });
  }, [upload]);

  const handleReset = useCallback(() => {
    upload.reset();
    setView({ tag: 'idle' });
  }, [upload]);

  const handleReplaceFile = useCallback(() => {
    upload.reset();
    setView({ tag: 'idle' });
    setTimeout(() => replaceInputRef.current?.click(), 50);
  }, [upload]);

  return (
    <div className="space-y-8">

      {/* ── Upload zone — driven by state machine ───────────────────────── */}
      {(() => {
        switch (view.tag) {
          case 'idle':
            return <UploadDropzone onFile={handleFile} />;

          case 'selected':
          case 'uploading':
            return (
              <div className="space-y-3">
                <FilePreviewCard meta={view.meta} onReplaceFile={handleReplaceFile} />
                {view.tag === 'uploading' && (
                  <div className="flex items-center justify-center gap-2 text-[12px] text-surface-400">
                    <span className="h-3 w-3 animate-spin rounded-full border border-hr-400 border-t-transparent" />
                    Uploading securely…
                  </div>
                )}
              </div>
            );

          case 'processing':
            return (
              <ProcessingState
                jobId={view.jobId}
                isUploading={false}
                fileMeta={view.meta}
                onReset={handleReset}
              />
            );

          case 'done':
            return <FilePreviewCard meta={view.meta} onReplaceFile={handleReplaceFile} />;

          case 'error':
            return (
              <div className="space-y-4">
                <ErrorBanner message={view.message} onDismiss={handleReset} />
                <UploadDropzone onFile={handleFile} />
              </div>
            );

          default:
            return <UploadDropzone onFile={handleFile} />;
        }
      })()}

      {/* Hidden input for replace-file flow */}
      <input
        ref={replaceInputRef}
        type="file"
        accept=".pdf,.doc,.docx"
        className="sr-only"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
          e.target.value = '';
        }}
      />

      {/* ── Upload history ────────────────────────────────────────────────── */}
      <div>
        <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-widest text-surface-400">
          Upload history
        </h3>

        {isError ? (
          <ErrorBanner message="Failed to load resume history. Please refresh the page." />
        ) : isLoading ? (
          <HistorySkeleton />
        ) : resumes.length === 0 ? (
          <div className="flex h-20 items-center justify-center rounded-xl border border-dashed border-surface-200 bg-white">
            <p className="text-[12px] text-surface-300">No resumes uploaded yet</p>
          </div>
        ) : (
          <ul className="space-y-3">
            {resumes.map((resume) => (
              <ResumeItem key={resume.id} resume={resume} />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}