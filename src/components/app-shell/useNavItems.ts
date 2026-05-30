/**
 * src/components/app-shell/useNavItems.ts
 *
 * Hook that resolves nav items from user_type.
 * Pure .ts — no JSX. Icon-bearing item arrays are defined in AppNavigation.tsx
 * and passed in, keeping this file component-free for Vite Fast Refresh.
 */

import type { NavItemDef } from './AppNavItem';

export type UserType = 'student' | 'professional' | 'market' | null | undefined;

export function useNavItems(
  userType:          UserType,
  coreItems:         NavItemDef[],
  professionalItems: NavItemDef[],
  studentItems:      NavItemDef[],
): { coreItems: NavItemDef[]; roleItems: NavItemDef[] } {
  const roleItems: NavItemDef[] =
    userType === 'professional' ? professionalItems
    : userType === 'student'    ? studentItems
    : [];

  return { coreItems, roleItems };
}