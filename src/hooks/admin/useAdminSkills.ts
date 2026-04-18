// hooks/admin/useAdminSkills.ts
// TanStack Query hooks for Admin Skills CMS.
// Re-exports the hooks from features/admin to keep a clean central hooks/ entry point.

export {
  useAdminSkills,
  useAdminSkill,
  useCreateSkill,
  useUpdateSkill,
  useDeleteSkill,
  skillKeys,
} from '@/features/admin/cms/skills/hooks/useSkills';