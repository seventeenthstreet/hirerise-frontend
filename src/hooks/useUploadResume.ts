// hooks/useUploadResume.ts
//
// Re-exports useUploadResume from useResumes.ts
// The resume page imports from '@/hooks/useUploadResume' — this barrel
// satisfies that import without duplicating any logic.

export { useUploadResume } from './useResumes';