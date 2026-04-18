/**
 * features/profile/hooks/useProfile.ts
 *
 * ⚠️  DEPRECATED SHIM — DO NOT ADD LOGIC HERE.
 *
 * This file exists only to avoid breaking legacy import paths.
 * The canonical implementation (with Zustand hydration) lives at:
 *   src/hooks/useProfile.ts
 *
 * TODO: Migrate all imports referencing this path to:
 *   import { useProfile } from '@/hooks/useProfile';
 * Then delete this file.
 *
 * Find remaining usages:
 *   grep -r "features/profile/hooks/useProfile" src/
 */

export { useProfile, useUpdateProfile, PROFILE_KEY } from '@/hooks/useProfile';