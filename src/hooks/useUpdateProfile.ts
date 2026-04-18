// hooks/useUpdateProfile.ts
//
// Mutation hook — PATCH /api/v1/users/me.
// Invalidates the profile cache on success so all consumers
// (dashboard stats, sidebar tier badge, profile form) refresh automatically.

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { userService, type UpdateProfileDto } from '@/services/userService';
import { PROFILE_KEY } from './useProfile';

/**
 * useUpdateProfile()
 *
 * @example
 *   const { mutateAsync, isPending, isError } = useUpdateProfile();
 *   await mutateAsync({ name: 'Jane', targetRole: 'Senior Engineer' });
 */
export function useUpdateProfile() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: UpdateProfileDto) => userService.updateProfile(data),

    onSuccess: () => {
      // Invalidate profile so all subscribers get fresh data
      queryClient.invalidateQueries({ queryKey: PROFILE_KEY });
    },
  });
}