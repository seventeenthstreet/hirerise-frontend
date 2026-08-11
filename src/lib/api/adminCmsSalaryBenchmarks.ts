/**
 * @file lib/api/adminCmsSalaryBenchmarks.ts
 * @description Frontend API wrappers for the Admin CMS Salary Benchmarks module (WP-ADMIN-COMP-03).
 *
 * Backend: generic factory instance (adminCmsGeneric.factory.js → salaryBenchmarksModule),
 * allowedFields: ['description', 'minSalary', 'maxSalary', 'medianSalary', 'year'].
 *
 * Per WP §11: no salary fields or business rules are invented here — this
 * mirrors exactly what the factory's allowedFields/_toCamel expose. There is
 * no backend validation on numeric ranges beyond "is a number", so the form
 * only enforces basic HTML number-input bounds, not business rules.
 *
 *   GET    /api/v1/admin/cms/salary-benchmarks       → listAdminSalaryBenchmarks
 *   POST   /api/v1/admin/cms/salary-benchmarks       → createAdminSalaryBenchmark
 *   PATCH  /api/v1/admin/cms/salary-benchmarks/:id   → updateAdminSalaryBenchmark
 *   DELETE /api/v1/admin/cms/salary-benchmarks/:id   → deleteAdminSalaryBenchmark (soft delete)
 */

import { apiRequest } from './core';

export interface AdminSalaryBenchmark {
  id:                string;
  name:              string;
  normalizedName:    string;
  description:       string | null;
  minSalary:         number | null;
  maxSalary:         number | null;
  medianSalary:      number | null;
  year:              number | null;
  status:            string;
  createdByAdminId:  string | null;
  updatedByAdminId:  string | null;
  sourceAgency:      string | null;
  softDeleted:       boolean;
  createdAt:         string;
  updatedAt:         string;
}

export interface ListAdminSalaryBenchmarksParams {
  status?: string;
  limit?:  number;
  offset?: number;
}

export interface ListAdminSalaryBenchmarksResponse {
  items: AdminSalaryBenchmark[];
  total: number;
}

export interface CreateAdminSalaryBenchmarkInput {
  name:          string;
  description?:  string;
  minSalary?:    number;
  maxSalary?:    number;
  medianSalary?: number;
  year?:         number;
}

export interface UpdateAdminSalaryBenchmarkInput {
  name?:         string;
  description?:  string;
  minSalary?:    number;
  maxSalary?:    number;
  medianSalary?: number;
  year?:         number;
}

const BASE_URL = '/api/v1/admin/cms/salary-benchmarks';

export function listAdminSalaryBenchmarks(params?: ListAdminSalaryBenchmarksParams): Promise<ListAdminSalaryBenchmarksResponse> {
  return apiRequest<ListAdminSalaryBenchmarksResponse>({ url: BASE_URL, method: 'GET', params: params as Record<string, unknown> });
}

export function createAdminSalaryBenchmark(input: CreateAdminSalaryBenchmarkInput): Promise<AdminSalaryBenchmark> {
  return apiRequest<AdminSalaryBenchmark>({ url: BASE_URL, method: 'POST', data: input });
}

export function updateAdminSalaryBenchmark(id: string, input: UpdateAdminSalaryBenchmarkInput): Promise<AdminSalaryBenchmark> {
  return apiRequest<AdminSalaryBenchmark>({ url: `${BASE_URL}/${id}`, method: 'PATCH', data: input });
}

export function deleteAdminSalaryBenchmark(id: string): Promise<null> {
  return apiRequest<null>({ url: `${BASE_URL}/${id}`, method: 'DELETE' });
}
