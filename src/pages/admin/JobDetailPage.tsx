/**
 * @file src/pages/admin/JobDetailPage.tsx
 * @description WP-ADMIN-COMP-06 — Job detail view.
 *
 * Route: /admin/jobs/:jobId
 *
 * Read-only — every field here mirrors a real column on the "jobs" table
 * (see lib/api/adminJobs.ts's AdminJob type / job.repository.js). There is
 * no edit form: no single-job write endpoint exists, only bulk sync (see
 * JobsPage.tsx's header comment for the full rationale). Null fields
 * render "Unavailable" rather than being hidden or defaulted, following
 * the same contract UserDetailPage.tsx uses.
 */

import { useNavigate, useParams } from 'react-router-dom';
import { Card, CardContent, PageShell, Spinner, Button } from '@/components/ui';
import { MasterDataErrorState } from '@/components/master-data';
import { useAdminJobDetail } from '@/hooks/admin/useAdminJobs';
import { ROUTES } from '@/routes/routes.constants';

function Field({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 text-sm text-foreground">
        {value ? value : <span className="text-muted-foreground">Unavailable</span>}
      </dd>
    </div>
  );
}

function formatDateTime(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function formatSalary(min: number | null, max: number | null, currency: string | null): string | null {
  if (min == null && max == null) return null;
  const c = currency || '';
  const fmt = (n: number) => n.toLocaleString();
  if (min != null && max != null) return `${c} ${fmt(min)} – ${fmt(max)}`.trim();
  const single = min ?? max;
  return single != null ? `${c} ${fmt(single)}`.trim() : null;
}

export default function JobDetailPage() {
  const { jobId } = useParams<{ jobId: string }>();
  const navigate = useNavigate();
  const { data: job, isLoading, isError, error, refetch } = useAdminJobDetail(jobId ?? null);

  return (
    <PageShell>
      <div className="flex flex-col gap-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate(ROUTES.ADMIN_JOBS)}>
            ← Back to Jobs
          </Button>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-16">
            <Spinner />
          </div>
        ) : isError ? (
          <Card>
            <CardContent>
              <MasterDataErrorState error={error} onRetry={() => refetch()} entityLabelPlural="jobs" />
            </CardContent>
          </Card>
        ) : job ? (
          <>
            <div>
              <h1 className="text-xl font-semibold text-foreground">{job.title}</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                {job.company || 'Unknown company'} {job.location ? `· ${job.location}` : ''}
              </p>
            </div>

            <Card>
              <CardContent>
                <dl className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                  <Field label="Company" value={job.company} />
                  <Field label="Location" value={job.location} />
                  <Field label="Country" value={job.country} />
                  <Field label="Contract Type" value={job.contract_type} />
                  <Field label="Experience Level" value={job.experience_level} />
                  <Field label="Salary" value={formatSalary(job.salary_min, job.salary_max, job.salary_currency)} />
                  <Field label="Source" value={job.source} />
                  <Field label="External ID" value={job.external_id} />
                  <Field label="Posted" value={formatDateTime(job.posted_at)} />
                  <Field label="Fetched" value={formatDateTime(job.fetched_at)} />
                  <Field label="Created" value={formatDateTime(job.created_at)} />
                  <Field label="Redirect URL" value={job.redirect_url} />
                </dl>

                {job.redirect_url && (
                  <div className="mt-4">
                    <a
                      href={job.redirect_url}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="text-sm font-medium text-primary hover:underline"
                    >
                      Open original listing ↗
                    </a>
                  </div>
                )}

                {job.skills.length > 0 && (
                  <div className="mt-6">
                    <dt className="text-xs font-medium text-muted-foreground">Skills</dt>
                    <dd className="mt-1.5 flex flex-wrap gap-1.5">
                      {job.skills.map((skill) => (
                        <span
                          key={skill}
                          className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground"
                        >
                          {skill}
                        </span>
                      ))}
                    </dd>
                  </div>
                )}

                {job.description && (
                  <div className="mt-6">
                    <dt className="text-xs font-medium text-muted-foreground">Description</dt>
                    <dd className="mt-1.5 whitespace-pre-wrap text-sm text-foreground">{job.description}</dd>
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        ) : null}
      </div>
    </PageShell>
  );
}
