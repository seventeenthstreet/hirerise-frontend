/**
 * pages/admin/master-data/salary-benchmarks.config.tsx
 * WP-ADMIN-COMP-03 §11 — no salary fields or business rules invented; this
 * mirrors exactly what adminCmsGeneric.factory.js's salaryBenchmarksModule
 * allowedFields expose: description, minSalary, maxSalary, medianSalary, year.
 * The backend performs no cross-field validation (e.g. min <= median <= max
 * is NOT enforced server-side), so none is added here either.
 */

import type { AdminSalaryBenchmark } from '@/lib/api/adminCmsSalaryBenchmarks';
import type { MasterDataColumn, MasterDataFieldConfig } from '@/components/master-data';

export interface SalaryBenchmarkFormValues extends Record<string, unknown> {
  name: string;
  description: string;
  minSalary: number | undefined;
  maxSalary: number | undefined;
  medianSalary: number | undefined;
  year: number | undefined;
}

export const EMPTY_SALARY_BENCHMARK_FORM_VALUES: SalaryBenchmarkFormValues = {
  name: '',
  description: '',
  minSalary: undefined,
  maxSalary: undefined,
  medianSalary: undefined,
  year: undefined,
};

export function salaryBenchmarkToFormValues(sb: AdminSalaryBenchmark): SalaryBenchmarkFormValues {
  return {
    name: sb.name,
    description: sb.description ?? '',
    minSalary: sb.minSalary ?? undefined,
    maxSalary: sb.maxSalary ?? undefined,
    medianSalary: sb.medianSalary ?? undefined,
    year: sb.year ?? undefined,
  };
}

export const SALARY_BENCHMARK_FIELDS: MasterDataFieldConfig<SalaryBenchmarkFormValues>[] = [
  { name: 'name', label: 'Name', type: 'text', placeholder: 'e.g. Senior Backend Engineer — Bangalore', required: true, maxLength: 200 },
  { name: 'minSalary', label: 'Min salary', type: 'number', min: 0 },
  { name: 'medianSalary', label: 'Median salary', type: 'number', min: 0 },
  { name: 'maxSalary', label: 'Max salary', type: 'number', min: 0 },
  { name: 'year', label: 'Year', type: 'number', min: 2000, max: 2100 },
  { name: 'description', label: 'Description', type: 'textarea', placeholder: 'Source / methodology notes', maxLength: 500 },
];

function formatCurrency(value: number | null): string {
  if (value === null || value === undefined) return '—';
  return new Intl.NumberFormat('en-IN').format(value);
}

export const SALARY_BENCHMARK_COLUMNS: MasterDataColumn<AdminSalaryBenchmark>[] = [
  { key: 'name', header: 'Name', render: (sb) => <span className="font-medium">{sb.name}</span> },
  { key: 'minSalary', header: 'Min', render: (sb) => formatCurrency(sb.minSalary), widthClassName: 'w-24' },
  { key: 'medianSalary', header: 'Median', render: (sb) => formatCurrency(sb.medianSalary), widthClassName: 'w-24' },
  { key: 'maxSalary', header: 'Max', render: (sb) => formatCurrency(sb.maxSalary), widthClassName: 'w-24' },
  { key: 'year', header: 'Year', render: (sb) => sb.year ?? '—', widthClassName: 'w-20' },
  { key: 'updatedAt', header: 'Updated', render: (sb) => (sb.updatedAt ? new Date(sb.updatedAt).toLocaleDateString() : '—'), widthClassName: 'w-28' },
];
