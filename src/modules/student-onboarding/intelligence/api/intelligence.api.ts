/**
 * @file front/src/modules/student-onboarding/intelligence/api/intelligence.api.ts
 *
 * Phase 3D — Cross-Domain Intelligence Layer
 * INTELLIGENCE DIAGNOSTIC API CLIENT
 *
 * SCOPE:
 *   Admin/diagnostic API calls only. Not student-facing.
 *   All endpoints require admin auth (enforced server-side).
 *
 * ARCHITECTURE:
 *   Uses apiRequest from lib/api/core/api-client.ts.
 *   Follows the same three-tier pattern as other onboarding API modules.
 *
 * DO NOT:
 *   - Call these endpoints from student-facing components.
 *   - Expose signal_weights directly in student UI.
 *   - Cache these responses in student-visible query keys.
 */

import { apiRequest } from '../../../../lib/api/core/api-client';
import type {
  GetSignalRegistryResponse,
  GetStudentVectorResponse,
  GetStudentConfidenceResponse,
  GetSignalEvidenceResponse,
  TriggerPipelineInput,
  TriggerPipelineResponse,
  SignalRegistryEntry,
  StudentSignalVector,
  SignalConfidenceModel,
  SignalEvidenceRecord,
  DbSignalRegistryRow,
  DbStudentSignalVector,
  DbSignalConfidenceModel,
  DbStudentSignalEvidence,
  IntelligenceDomain,
  SignalCategory,
  NormalizationStrategy,
  SignalKey,
  ContradictionSeverity,
} from '../types';

// ─────────────────────────────────────────────────────────────────────────────
// MAPPERS — DB → Domain
// ─────────────────────────────────────────────────────────────────────────────

function mapRegistryRow(row: DbSignalRegistryRow): SignalRegistryEntry {
  return {
    signalKey:             row.signal_key as SignalKey,
    taxonomyVersion:       row.taxonomy_version,
    category:              row.category as SignalCategory,
    primaryDomain:         row.primary_domain as IntelligenceDomain,
    compatibleDomains:     row.compatible_domains as IntelligenceDomain[],
    normalizationStrategy: row.normalization_strategy as NormalizationStrategy,
    aggregationCompatible: row.aggregation_compatible,
    longitudinalTrackable: row.longitudinal_trackable,
    displayName:           row.display_name,
    description:           row.description,
    signalVersion:         row.signal_version,
    isDeprecated:          row.deprecated_at !== null,
  };
}

function mapVector(row: DbStudentSignalVector): StudentSignalVector {
  return {
    aggregationVersion:  row.aggregation_version,
    signalWeights:       row.signal_weights as Partial<Record<SignalKey, number>>,
    domainVectors: {
      academic:     (row.domain_vectors?.academic    ?? {}) as Partial<Record<SignalKey, number>>,
      activity:     (row.domain_vectors?.activity    ?? {}) as Partial<Record<SignalKey, number>>,
      cognitive:    (row.domain_vectors?.cognitive   ?? {}) as Partial<Record<SignalKey, number>>,
      cross_domain: (row.domain_vectors?.cross_domain ?? {}) as Partial<Record<SignalKey, number>>,
    },
    evidenceSummary:     row.evidence_summary     as StudentSignalVector['evidenceSummary'],
    confidenceData:      row.confidence_data      as StudentSignalVector['confidenceData'],
    contradictionMetadata: Object.fromEntries(
      Object.entries(row.contradiction_metadata ?? {}).map(([k, v]) => [
        k,
        {
          signalA:    v.signal_a    as SignalKey,
          signalB:    v.signal_b    as SignalKey,
          weightA:    v.weight_a,
          weightB:    v.weight_b,
          severity:   v.severity    as ContradictionSeverity,
          resolved:   v.resolved,
          detectedAt: v.detected_at,
        },
      ]),
    ),
    pipelineRunId:       row.pipeline_run_id,
    domainsIncluded:     row.domains_included as IntelligenceDomain[],
    isCompleteVector:    row.is_complete_vector,
    aggregatedAt:        row.aggregated_at,
    updatedAt:           row.updated_at,
  };
}

function mapConfidenceModel(row: DbSignalConfidenceModel): SignalConfidenceModel {
  return {
    signalKey:                row.signal_key as SignalKey,
    aggregationVersion:       row.aggregation_version,
    evidenceCount:            row.evidence_count,
    sourceDiversity:          row.source_diversity,
    crossDomainReinforcement: row.cross_domain_reinforcement,
    contradictionSeverity:    row.contradiction_severity as ContradictionSeverity,
    compositeConfidence:      null,
    firstEvidenceAt:          row.first_evidence_at,
    lastEvidenceAt:           row.last_evidence_at,
    evidenceDelta30d:         row.evidence_delta_30d,
    computedAt:               row.computed_at,
  };
}

function mapEvidenceRecord(row: DbStudentSignalEvidence): SignalEvidenceRecord {
  return {
    id:                   row.id,
    signalKey:            row.signal_key as SignalKey,
    sourceType:           row.source_type           as SignalEvidenceRecord['sourceType'],
    sourceDomain:         row.source_domain          as IntelligenceDomain,
    sourceReferenceId:    row.source_reference_id,
    sourceReferenceTable: row.source_reference_table,
    contributionWeight:   row.contribution_weight,
    rawConfidence:        row.raw_confidence,
    evidenceMetadata:     row.evidence_metadata,
    taxonomyVersion:      row.taxonomy_version,
    aggregationVersion:   row.aggregation_version,
    recordedAt:           row.recorded_at,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// API FUNCTIONS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns the full active signal registry.
 * Admin only.
 */
export async function getSignalRegistry(): Promise<SignalRegistryEntry[]> {
  const data = await apiRequest<GetSignalRegistryResponse>({
    method: 'GET',
    url: '/api/v1/intelligence/registry',
  });
  return (data.registry ?? []).map(mapRegistryRow);
}

/**
 * Returns the current signal vector for a student.
 * Admin only.
 *
 * @param userId  — Supabase Auth UID
 */
export async function getStudentVector(userId: string): Promise<StudentSignalVector | null> {
  try {
    const data = await apiRequest<GetStudentVectorResponse>({
      method: 'GET',
      url: `/api/v1/intelligence/student/${userId}/vector`,
    });
    return data.vector ? mapVector(data.vector) : null;
  } catch (err: unknown) {
    // 404 = no vector yet; surface as null
    if ((err as { status?: number })?.status === 404) return null;
    throw err;
  }
}

/**
 * Returns confidence models for all signals for a student.
 * Admin only.
 *
 * @param userId  — Supabase Auth UID
 */
export async function getStudentConfidence(userId: string): Promise<SignalConfidenceModel[]> {
  const data = await apiRequest<GetStudentConfidenceResponse>({
    method: 'GET',
    url: `/api/v1/intelligence/student/${userId}/confidence`,
  });
  return (data.models ?? []).map(mapConfidenceModel);
}

/**
 * Returns evidence records for a specific signal for a student.
 * Admin only.
 *
 * @param userId    — Supabase Auth UID
 * @param signalKey — canonical signal key
 */
export async function getSignalEvidence(
  userId: string,
  signalKey: string,
): Promise<SignalEvidenceRecord[]> {
  const data = await apiRequest<GetSignalEvidenceResponse>({
    method: 'GET',
    url: `/api/v1/intelligence/student/${userId}/evidence/${signalKey}`,
  });
  return (data.evidence ?? []).map(mapEvidenceRecord);
}

/**
 * Triggers the intelligence aggregation pipeline for a student.
 * Admin only. dry_run defaults to true for safety.
 *
 * @param userId  — Supabase Auth UID
 * @param input   — { dry_run?: boolean }
 */
export async function triggerPipeline(
  userId: string,
  input: TriggerPipelineInput = { dry_run: true },
): Promise<TriggerPipelineResponse> {
  return apiRequest<TriggerPipelineResponse>({
    method: 'POST',
    url: `/api/v1/intelligence/student/${userId}/trigger`,
    data: input,
  });
}