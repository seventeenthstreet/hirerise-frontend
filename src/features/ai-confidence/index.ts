/**
 * @file src/features/ai-confidence/index.ts
 *
 * Barrel export for the AI Confidence feature.
 *
 * Preserves API → Hooks → UI → Pages boundary:
 *   Pages import from this index, never from sub-files directly.
 */

export { useAIExplanation } from './hooks/useAIExplanation';
export type { AIExplanationResult } from './hooks/useAIExplanation';
export { AIExplanationOverlay } from './components/AIExplanationOverlay';
