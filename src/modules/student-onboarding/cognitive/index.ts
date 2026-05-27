/**
 * @file front/src/modules/student-onboarding/cognitive/index.ts
 *
 * Barrel export for the cognitive onboarding feature module.
 * Import from this index rather than reaching into subdirectories.
 */

export * from './types';
export * from './hooks/use-cognitive';

export { default as CognitiveProgress } from './components/CognitiveProgress';
export { default as DomainSection }     from './components/DomainSection';
export { default as ScenarioCard }      from './components/ScenarioCard';
