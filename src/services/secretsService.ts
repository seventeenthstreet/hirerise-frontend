// services/secretsService.ts
//
// Client-side API calls for the Secrets Manager.
//
// NOTE on response types:
//   apiFetch automatically unwraps the { success, data } envelope.
//   So if the backend returns { success: true, data: [...], total: N },
//   apiFetch returns { data: [...], total: N } directly to the caller.
//   Types here must reflect what apiFetch returns AFTER unwrapping.

import { apiFetch } from './apiClient';
import type {
  SecretMeta,
  SecretStatus,
  UpsertSecretResponse,
  CreateSecretDto,
} from '@/types/secrets';

export const secretsService = {

  /**
   * List all secrets — metadata only (no values).
   * Backend: { success: true, data: SecretMeta[], total }
   * apiFetch unwraps the outer envelope and returns successBody.data
   * which is the raw SecretMeta[] array directly.
   */
  list(): Promise<SecretMeta[]> {
    return apiFetch<SecretMeta[]>('/admin/secrets');
  },

  /**
   * Get masked preview for a specific secret.
   * Backend: { success, data: SecretStatus }
   * apiFetch unwraps to: SecretStatus directly
   */
  getStatus(name: string): Promise<SecretStatus> {
    return apiFetch<SecretStatus>(`/admin/secrets/${encodeURIComponent(name)}/status`);
  },

  /**
   * Create or update a secret.
   * value is write-only — never included in the API response.
   * Backend: { success, data: UpsertSecretResponse }
   * apiFetch unwraps to: UpsertSecretResponse directly
   */
  upsert(data: CreateSecretDto): Promise<UpsertSecretResponse> {
    return apiFetch<UpsertSecretResponse>('/admin/secrets', {
      method: 'POST',
      body:   JSON.stringify(data),
    });
  },

  /**
   * Delete a secret permanently.
   */
  delete(name: string): Promise<{ message: string }> {
    return apiFetch<{ message: string }>(
      `/admin/secrets/${encodeURIComponent(name)}`,
      { method: 'DELETE' }
    );
  },
};