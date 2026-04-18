// hooks/useDeleteResume.ts
//
// Re-exports useDeleteResume from useResumes.ts
// The resume page imports from '@/hooks/useDeleteResume' — this barrel
// satisfies that import without duplicating any logic.

export { useDeleteResume } from './useResumes';