/**
 * features/profile/hooks/index.ts
 *
 * Re-exports from canonical hook locations.
 * All hook logic lives in src/hooks/ — never add logic here.
 */
export { useProfile, useUpdateProfile, PROFILE_KEY } from '@/hooks/useProfile';

// Legacy alias: profileKeys.me() → PROFILE_KEY
// Consumers should migrate to PROFILE_KEY directly.
export const profileKeys = {
  all: () => ['profile'] as const,
  me:  () => ['profile', 'me'] as const,
};