/**
 * pages/admin/jobs.config.tsx
 *
 * Job-list-specific column configuration for MasterDataTable, following the
 * pattern established in users.config.tsx / skills.config.tsx: this is the
 * ONLY place job-list column knowledge lives — JobsPage.tsx stays generic.
 *
 * All columns render fields that exist on the real "jobs" table (see
 * lib/api/adminJobs.ts's AdminJob type / job.repository.js) — no fabricated
 * fields (no status/lifecycle column exists on this table).
 */

import type { AdminJob } from '@/lib/api/adminJobs';
import type { MasterDataColumn } from '@/components/master-data';

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

function formatSalary(job: AdminJob): string {
  if (job.salary_min == null && job.salary_max == null) return '—';
  const currency = job.salary_currency || '';
  const fmt = (n: number) => n.toLocaleString();
  if (job.salary_min != null && job.salary_max != null) {
    return `${currency} ${fmt(job.salary_min)} – ${fmt(job.salary_max)}`.trim();
  }
  const single = job.salary_min ?? job.salary_max;
  return single != null ? `${currency} ${fmt(single)}`.trim() : '—';
}

export const JOB_COLUMNS: MasterDataColumn<AdminJob>[] = [
  {
    key: 'title',
    header: 'Title',
    render: (job) => <span className="font-medium">{job.title}</span>,
  },
  {
    key: 'company',
    header: 'Company',
    render: (job) => <span className="text-muted-foreground">{job.company || '—'}</span>,
  },
  {
    key: 'location',
    header: 'Location',
    render: (job) => <span className="text-muted-foreground">{job.location || '—'}</span>,
    widthClassName: 'w-40',
  },
  {
    key: 'source',
    header: 'Source',
    render: (job) => (
      <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
        {job.source}
      </span>
    ),
    widthClassName: 'w-28',
  },
  {
    key: 'salary',
    header: 'Salary',
    render: (job) => <span className="text-muted-foreground">{formatSalary(job)}</span>,
    widthClassName: 'w-40',
  },
  {
    key: 'fetched_at',
    header: 'Fetched',
    render: (job) => <span className="text-muted-foreground">{formatDate(job.fetched_at)}</span>,
    widthClassName: 'w-28',
  },
];
