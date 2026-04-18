// services/userService.ts
//
// Interacts with /api/v1/users/* endpoints.
// Never constructs Authorization headers manually.
// Never includes uid in request payloads — backend uses req.user.uid.

import { apiFetch } from './apiClient';
import type { BackendUser, MeResponse } from '@/types/auth';

export interface UpdateProfileDto {
  name?:             string;
  location?:         string;
  experienceYears?:  number;
  targetRole?:       string;
  bio?:              string;
}

export const userService = {
  /** GET /api/v1/users/me */
  getMe(): Promise<MeResponse> {
    return apiFetch<MeResponse>('/users/me');
  },

  /**
   * PATCH /api/v1/users/me
   * Updates editable profile fields. uid must never be in the payload.
   * Returns the updated user document.
   */
  updateProfile(data: UpdateProfileDto): Promise<BackendUser> {
    return apiFetch<BackendUser>('/users/me', {
      method: 'PATCH',
      body:   JSON.stringify(data),
    });
  },

  /** GET /api/v1/users/me/subscription */
  getSubscription(): Promise<unknown> {
    return apiFetch('/users/me/subscription');
  },
};
