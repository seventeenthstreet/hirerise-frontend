'use client';

// app/(admin)/admin/submit/page.tsx
// Contributor submit entry form — sends payload for admin review.

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { AdminTopbar } from '@/components/layout/AdminTopbar';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { pendingService, type EntityType } from '@/services/pendingService';
import toast from 'react-hot-toast';

// ─── Dynamic field definitions per entity type ────────────────────────────────

type FieldDef = {
  key: string;
  label: string;
  type: 'text' | 'textarea' | 'select' | 'number';
  required?: boolean;
  options?: { value: string; label: string }[];
  placeholder?: string;
};

const ENTITY_FIELDS: Record<EntityType, FieldDef[]> = {
  skill: [
    { key: 'name',        label: 'Skill name',    type: 'text',     required: true,  placeholder: 'e.g. TypeScript' },
    { key: 'category',    label: 'Category',      type: 'select',   required: true,
      options: [
        { value: 'technical',  label: 'Technical'  },
        { value: 'soft',       label: 'Soft skill' },
        { value: 'domain',     label: 'Domain'     },
        { value: 'tool',       label: 'Tool'       },
        { value: 'language',   label: 'Language'   },
        { value: 'framework',  label: 'Framework'  },
      ]},
    { key: 'description', label: 'Description',   type: 'textarea', placeholder: 'Brief description of this skill' },
    { key: 'aliases',     label: 'Aliases',        type: 'text',     placeholder: 'Comma-separated e.g. TS, TypeScript 5' },
  ],
  role: [
    { key: 'name',        label: 'Role title',     type: 'text',     required: true, placeholder: 'e.g. Senior Frontend Engineer' },
    { key: 'description', label: 'Description',    type: 'textarea', placeholder: 'What this role involves' },
    { key: 'level',       label: 'Seniority level', type: 'number',  placeholder: '1 (Junior) – 5 (Principal)' },
    { key: 'track',       label: 'Track',           type: 'select',
      options: [
        { value: 'individual_contributor', label: 'Individual Contributor' },
        { value: 'management',             label: 'Management'             },
        { value: 'specialist',             label: 'Specialist'             },
      ]},
  ],
  jobFamily: [
    { key: 'name',        label: 'Job family name', type: 'text',     required: true, placeholder: 'e.g. Engineering' },
    { key: 'description', label: 'Description',     type: 'textarea', placeholder: 'Overview of this job family' },
    { key: 'sector',      label: 'Sector',           type: 'text',     placeholder: 'e.g. Technology' },
  ],
  educationLevel: [
    { key: 'name',  label: 'Level name',   type: 'text',   required: true, placeholder: 'e.g. Bachelor\'s Degree' },
    { key: 'order', label: 'Sort order',   type: 'number', placeholder: '1 = lowest, higher = more advanced' },
    { key: 'code',  label: 'Short code',   type: 'text',   placeholder: 'e.g. BSC' },
  ],
  salaryBenchmark: [
    { key: 'name',       label: 'Benchmark name',   type: 'text',   required: true,  placeholder: 'e.g. Senior Engineer - London' },
    { key: 'minSalary',  label: 'Min salary (£)',    type: 'number', placeholder: '60000' },
    { key: 'maxSalary',  label: 'Max salary (£)',    type: 'number', placeholder: '90000' },
    { key: 'currency',   label: 'Currency',          type: 'text',   placeholder: 'GBP' },
    { key: 'location',   label: 'Location',          type: 'text',   placeholder: 'e.g. London, Remote' },
    { key: 'source',     label: 'Data source',       type: 'text',   placeholder: 'e.g. Glassdoor 2025' },
  ],
};

const ENTITY_OPTIONS: { value: EntityType; label: string }[] = [
  { value: 'skill',            label: 'Skill'             },
  { value: 'role',             label: 'Role'              },
  { value: 'jobFamily',        label: 'Job Family'        },
  { value: 'educationLevel',   label: 'Education Level'   },
  { value: 'salaryBenchmark',  label: 'Salary Benchmark'  },
];

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function SubmitEntryPage() {
  const router = useRouter();
  const [entityType, setEntityType] = useState<EntityType>('skill');
  const [values,     setValues]     = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  const fields = ENTITY_FIELDS[entityType];

  const handleEntityChange = (val: string) => {
    setEntityType(val as EntityType);
    setValues({});
  };

  const handleChange = (key: string, val: string) => {
    setValues(prev => ({ ...prev, [key]: val }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate required fields
    const missing = fields.filter(f => f.required && !values[f.key]?.trim());
    if (missing.length > 0) {
      toast.error(`Required: ${missing.map(f => f.label).join(', ')}`);
      return;
    }

    // Build payload — coerce numbers, strip empty strings
    const payload: Record<string, unknown> = {};
    for (const field of fields) {
      const val = values[field.key];
      if (!val && val !== '0') continue;
      payload[field.key] = field.type === 'number' ? Number(val) : val.trim();
    }

    setSubmitting(true);
    try {
      await pendingService.submit(entityType, payload);
      toast.success('Entry submitted for review!');
      router.push('/admin/my-entries');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to submit entry.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex h-full flex-col">
      <AdminTopbar title="Submit Entry" />
      <div className="flex-1 overflow-y-auto p-6 animate-slide-up">
        <div className="mx-auto max-w-xl">

          <div className="mb-6">
            <h2 className="text-lg font-bold text-surface-900">Submit a new entry</h2>
            <p className="mt-1 text-sm text-surface-500">
              Fill in the details below. A master admin will review and publish your submission.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Entity type selector */}
            <div className="rounded-xl border border-surface-100 bg-white p-5 shadow-card space-y-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-surface-800">
                  Entry type <span className="text-red-500">*</span>
                </label>
                <Select
                  value={entityType}
                  onChange={e => handleEntityChange(e.target.value)}
                  options={ENTITY_OPTIONS}
                />
              </div>
            </div>

            {/* Dynamic fields */}
            <div className="rounded-xl border border-surface-100 bg-white p-5 shadow-card space-y-4">
              <p className="text-xs font-semibold uppercase tracking-widest text-surface-400">Entry details</p>
              {fields.map(field => (
                <div key={field.key}>
                  <label className="mb-1.5 block text-sm font-medium text-surface-800">
                    {field.label}
                    {field.required && <span className="ml-0.5 text-red-500">*</span>}
                  </label>

                  {field.type === 'textarea' ? (
                    <textarea
                      value={values[field.key] ?? ''}
                      onChange={e => handleChange(field.key, e.target.value)}
                      rows={3}
                      placeholder={field.placeholder}
                      className="w-full rounded-lg border border-surface-200 px-3 py-2 text-sm text-surface-900 placeholder:text-surface-300 focus:border-hr-500 focus:outline-none focus:ring-2 focus:ring-hr-500"
                    />
                  ) : field.type === 'select' && field.options ? (
                    <Select
                      value={values[field.key] ?? ''}
                      onChange={e => handleChange(field.key, e.target.value)}
                      options={[{ value: '', label: `Select ${field.label}…` }, ...field.options]}
                    />
                  ) : (
                    <Input
                      type={field.type === 'number' ? 'number' : 'text'}
                      value={values[field.key] ?? ''}
                      onChange={e => handleChange(field.key, e.target.value)}
                      placeholder={field.placeholder}
                    />
                  )}
                </div>
              ))}
            </div>

            {/* Info */}
            <div className="rounded-lg border border-sky-100 bg-sky-50 px-4 py-3 text-xs text-sky-700">
              Your submission will be reviewed before going live. You can track status in <strong>My Entries</strong>.
            </div>

            {/* Actions */}
            <div className="flex gap-3">
              <Button type="button" variant="ghost" onClick={() => router.back()}>
                Cancel
              </Button>
              <Button type="submit" loading={submitting} className="flex-1">
                Submit for review
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}