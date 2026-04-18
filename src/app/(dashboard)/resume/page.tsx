'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useResumes } from '@/hooks/useResumes';
import { useUploadResume } from '@/hooks/useUploadResume';
import { useDeleteResume } from '@/hooks/useDeleteResume';
import { PageHeader, Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { NoResumesEmpty } from '@/components/ui/EmptyState';
import { ListSkeleton } from '@/components/ui/LoadingSkeleton';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { QueryError } from '@/components/ui/ErrorState';
import { mutationToast } from '@/components/ui/Toast';
import { cn } from '@/utils/cn';

// ─── Resume card ──────────────────────────────────────────────────────────────

function ResumeCard({ resume }: { resume: any }) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const { mutate: deleteResume, isPending: deleting } = useDeleteResume();

  const handleDelete = () => {
    deleteResume(resume.id, {
      onSuccess: () => { mutationToast.resumeDeleted(); setConfirmOpen(false); },
      onError:   () => { mutationToast.resumeDeleteError(); setConfirmOpen(false); },
    });
  };

  const statusVariant: Record<string, 'success' | 'warning' | 'neutral' | 'info'> = {
    processed:  'success',
    processing: 'warning',
    pending:    'info',
    failed:     'neutral',
  };

  const status = resume.status ?? 'pending';

  return (
    <>
      <div className="group flex items-center gap-4 rounded-xl border border-surface-100 bg-white p-4 shadow-card hover:shadow-card-md hover:-translate-y-0.5 transition-all duration-150">
        {/* File icon */}
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-hr-50 text-hr-600">
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75}
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-semibold text-surface-900 truncate">
              {resume.filename ?? resume.name ?? 'Resume'}
            </p>
            <span className={cn(
              'rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize border',
              status === 'processed'  ? 'bg-green-50 text-green-700 border-green-100' :
              status === 'processing' ? 'bg-amber-50 text-amber-700 border-amber-100' :
              status === 'pending'    ? 'bg-hr-50 text-hr-700 border-hr-100' :
                                       'bg-surface-50 text-surface-500 border-surface-100',
            )}>
              {status === 'processing' && (
                <span className="mr-1 inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-amber-500 align-middle" />
              )}
              {status}
            </span>
            {resume.isPrimary && (
              <span className="rounded-full bg-hr-50 border border-hr-100 px-2 py-0.5 text-[10px] font-semibold text-hr-700">
                Primary
              </span>
            )}
          </div>
          <div className="mt-0.5 flex items-center gap-3 text-xs text-surface-400">
            {resume.uploadedAt && (
              <span>Uploaded {new Date(resume.uploadedAt).toLocaleDateString()}</span>
            )}
            {resume.fileSize && (
              <span>{(resume.fileSize / 1024).toFixed(0)} KB</span>
            )}
          </div>
        </div>

        {/* Actions — visible on hover */}
        <div className="flex shrink-0 items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          {resume.downloadUrl && (
            <a
              href={resume.downloadUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex h-8 w-8 items-center justify-center rounded-lg text-surface-400 hover:bg-surface-50 hover:text-surface-700 transition-colors"
              title="Download"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75}
                  d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
            </a>
          )}
          <button
            onClick={() => setConfirmOpen(true)}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-surface-400 hover:bg-red-50 hover:text-red-500 transition-colors"
            title="Delete resume"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75}
                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      </div>

      {/* Confirm delete */}
      <ConfirmDialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={handleDelete}
        loading={deleting}
        title="Delete this resume?"
        description="This action cannot be undone. Your career analysis data may be affected."
        confirmLabel="Delete resume"
        variant="danger"
      />
    </>
  );
}

// ─── Upload zone ──────────────────────────────────────────────────────────────

function UploadZone() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const { mutate: upload, isPending } = useUploadResume();
  const [dragOver, setDragOver] = useState(false);

  const handleFile = (file: File) => {
    if (!file.name.match(/\.(pdf|doc|docx|txt)$/i)) {
      mutationToast.resumeTypeError();
      return;
    }
    upload(file, {
      onSuccess: () => {
        mutationToast.resumeUploaded();
        setTimeout(() => router.push('/dashboard'), 1500);
      },
      onError: (err: any) => {
        // Show the server's message if it's a file-type rejection, otherwise generic
        const msg: string = err?.message ?? '';
        if (msg.toLowerCase().includes('type') || msg.toLowerCase().includes('unsupported') || msg.toLowerCase().includes('format')) {
          mutationToast.resumeTypeError();
        } else {
          mutationToast.resumeUploadError();
        }
      },
    });
  };

  return (
    <div
      onClick={() => !isPending && fileRef.current?.click()}
      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
      className={cn(
        'flex flex-col items-center justify-center rounded-2xl border-2 border-dashed p-10 transition-all duration-150',
        isPending
          ? 'cursor-default border-hr-300 bg-hr-50'
          : dragOver
            ? 'cursor-copy border-hr-400 bg-hr-50 scale-[1.01]'
            : 'cursor-pointer border-surface-200 bg-surface-50 hover:border-hr-300 hover:bg-hr-50/60',
      )}
    >
      <input
        ref={fileRef}
        type="file"
        className="hidden"
        accept=".pdf,.doc,.docx,.txt"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ''; }}
      />

      {isPending ? (
        <>
          <div className="h-10 w-10 animate-spin rounded-full border-2 border-hr-200 border-t-hr-500 mb-3" />
          <p className="text-sm font-semibold text-hr-700">Uploading your resume…</p>
          <p className="mt-1 text-xs text-hr-400">This may take a few seconds</p>
        </>
      ) : (
        <>
          <div className={cn(
            'mb-4 flex h-12 w-12 items-center justify-center rounded-2xl transition-colors',
            dragOver ? 'bg-hr-100 text-hr-600' : 'bg-white text-surface-400 shadow-card',
          )}>
            <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75}
                d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
          </div>
          <p className="text-sm font-semibold text-surface-700">
            {dragOver ? 'Drop to upload' : 'Drop your resume here'}
          </p>
          <p className="mt-1 text-xs text-surface-400">PDF, DOC, DOCX or TXT — up to 10 MB</p>
          <div className="mt-5 inline-flex h-9 items-center gap-2 rounded-lg bg-hr-600 px-4 text-xs font-semibold text-white shadow-sm pointer-events-none">
            <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Choose file
          </div>
        </>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ResumesPage() {
  const { data, isLoading, isError, error, refetch } = useResumes();
  const resumes: any[] = (data as any)?.resumes ?? (Array.isArray(data) ? data : []);

  return (
    <div className="animate-slide-up space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold tracking-tight text-surface-900">Resumes</h2>
          <p className="mt-0.5 text-sm text-surface-400">
            Upload your CV to unlock AI skill extraction and career analysis.
          </p>
        </div>
      </div>

      {/* Upload zone */}
      <UploadZone />

      {/* List */}
      <div>
        <div className="mb-3 flex items-center gap-2">
          <h3 className="text-xs font-semibold uppercase tracking-widest text-surface-400">
            Your resumes
          </h3>
          {!isLoading && resumes.length > 0 && (
            <span className="rounded-full bg-surface-100 px-2 py-0.5 text-[10px] font-semibold text-surface-500">
              {resumes.length}
            </span>
          )}
        </div>

        {isLoading ? (
          <ListSkeleton rows={2} />
        ) : isError ? (
          <QueryError error={error} onRetry={() => refetch()} />
        ) : resumes.length === 0 ? (
          <NoResumesEmpty />
        ) : (
          <div className="space-y-3">
            {resumes.map((r: any) => <ResumeCard key={r.id} resume={r} />)}
          </div>
        )}
      </div>

      {/* Info tip */}
      <div className="rounded-xl border border-hr-100 bg-hr-50 p-4">
        <div className="flex gap-3">
          <span className="shrink-0 text-hr-400 mt-0.5">
            <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
            </svg>
          </span>
          <div>
            <p className="text-xs font-semibold text-hr-700 mb-0.5">How it works</p>
            <p className="text-xs text-hr-600 leading-relaxed">
              After upload, AI extracts your skills and experience in under a minute.
              Your Career Health Index updates automatically once processing is complete.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}