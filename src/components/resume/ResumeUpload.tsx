'use client';

import { useState, useRef } from 'react';
import type { ApiClientError } from '@/lib/api/core';

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

interface ResumeUploadProps {
  /** Called with the selected file — page layer owns the upload & polling logic. */
  onUpload: (file: File) => Promise<void>;
  /** Uploading state passed from the page/hook layer. */
  isUploading: boolean;
  /** Upload error from the page/hook layer. */
  error: ApiClientError | null;
}

const ACCEPTED_EXTENSIONS = ['.pdf', '.doc', '.docx', '.txt'];
const ACCEPTED_MIME = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
];
const MAX_SIZE_MB = 10;
const MAX_SIZE_B  = MAX_SIZE_MB * 1024 * 1024;

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENT
// Named export — matches page import: import { ResumeUpload } from '...'
// Pure display: no hooks, no API calls. Calls onUpload(file) and stops there.
// ─────────────────────────────────────────────────────────────────────────────

export function ResumeUpload({ onUpload, isUploading, error }: ResumeUploadProps) {
  const [dragOver,  setDragOver]  = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);
  const [fileName,  setFileName]  = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // ── Validation ────────────────────────────────────────────────────────────
  function validateFile(file: File): string | null {
    const ext = '.' + (file.name.split('.').pop()?.toLowerCase() ?? '');
    if (!ACCEPTED_EXTENSIONS.includes(ext) && !ACCEPTED_MIME.includes(file.type)) {
      return `Unsupported file type. Please upload a PDF, DOC, DOCX, or TXT file.`;
    }
    if (file.size > MAX_SIZE_B) {
      return `File is too large. Maximum size is ${MAX_SIZE_MB} MB.`;
    }
    return null;
  }

  function handleFile(file: File | null) {
    if (!file) return;
    const validationError = validateFile(file);
    if (validationError) {
      setFileError(validationError);
      setFileName(null);
      return;
    }
    setFileError(null);
    setFileName(file.name);
    onUpload(file);
  }

  // ── Event handlers ────────────────────────────────────────────────────────
  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    handleFile(e.target.files?.[0] ?? null);
    e.target.value = ''; // allow re-selecting the same file
  }

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragOver(false);
    handleFile(e.dataTransfer.files?.[0] ?? null);
  }

  function handleDragOver(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragOver(true);
  }

  function handleDragLeave(e: React.DragEvent<HTMLDivElement>) {
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setDragOver(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      inputRef.current?.click();
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="w-full">

      {/* Drop zone */}
      <div
        role="button"
        tabIndex={isUploading ? -1 : 0}
        aria-disabled={isUploading}
        aria-label="Upload resume — click or drag a file here"
        onClick={() => !isUploading && inputRef.current?.click()}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onKeyDown={handleKeyDown}
        className={[
          'relative flex flex-col items-center justify-center gap-4 rounded-xl border-2 border-dashed',
          'px-6 py-14 transition-colors duration-150 outline-none',
          'focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2',
          isUploading
            ? 'cursor-not-allowed border-muted bg-muted/30'
            : dragOver
            ? 'cursor-copy border-primary bg-primary/5'
            : 'cursor-pointer border-border bg-card hover:border-primary/50 hover:bg-muted/30',
        ].join(' ')}
      >
        {/* Icon */}
        <div className={[
          'flex h-12 w-12 items-center justify-center rounded-full',
          dragOver ? 'bg-primary/10' : 'bg-muted',
        ].join(' ')}>
          {isUploading ? (
            <span className="h-5 w-5 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-muted-foreground" />
          ) : (
            <svg
              className={['h-6 w-6', dragOver ? 'text-primary' : 'text-muted-foreground'].join(' ')}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
          )}
        </div>

        {/* Label */}
        <div className="text-center">
          <p className="text-sm font-medium text-foreground">
            {isUploading
              ? 'Uploading…'
              : dragOver
              ? 'Drop your file here'
              : fileName ?? 'Drag & drop your resume here'}
          </p>
          {!isUploading && (
            <p className="mt-1 text-xs text-muted-foreground">
              or{' '}
              <span className="text-primary underline underline-offset-2">browse to upload</span>
              {' '}— PDF, DOC, DOCX, TXT up to {MAX_SIZE_MB} MB
            </p>
          )}
        </div>

        {/* Hidden file input */}
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPTED_EXTENSIONS.join(',')}
          aria-label="Resume file input"
          className="sr-only"
          onChange={handleInputChange}
          disabled={isUploading}
        />
      </div>

      {/* Client-side validation error */}
      {fileError && (
        <p role="alert" className="mt-3 text-sm text-destructive">
          {fileError}
        </p>
      )}

      {/* API error from parent */}
      {error && !fileError && (
        <div
          role="alert"
          className="mt-4 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
        >
          {error.message ?? 'Upload failed. Please try again.'}
        </div>
      )}
    </div>
  );
}