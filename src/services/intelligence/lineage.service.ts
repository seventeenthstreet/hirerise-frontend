/**
 * lineage.service.ts
 *
 * HireRise — Phase 2A.1.3 — LIN-01 Remediation + LIN-01A-R2 Governance & Timestamp Integrity
 *
 * Sole owner of all writes to public.signal_lineage.
 * Orchestrates the complete governance lifecycle: proposal → approval/rejection.
 * Delegates all audit persistence to RegistryAuditService (never writes
 * directly to signal_registry_audit_log).
 *
 * Architecture basis:
 *   - Phase 2A.1.2 Approved Architecture
 *   - R1 Final Approved Amendment
 *   - Sprint 1B Security & Service Specification (SVC-01)
 *   - Package G4 Service Layer Architecture Specification
 *   - Package G4B (RegistryAuditService — dependency)
 *   - AMD-07: service_role key server-side only
 *   - AMD-08: service-layer validation before all database operations
 *   - AMD-10: transaction atomicity via PostgreSQL RPC wrapper pattern
 *   - SEC-RLS-02: writes succeed with RLS enabled via service_role
 *   - LIN-01: read-path remediation (Phase 2A.1.3)
 *     - Item 1: A07 v2 service-layer modifications applied
 *     - Item 2: getLineageSummary() refactored to call fn_get_signal_lineage_summary RPC
 *     - Item 3: getLineageAuditLog() and getRegistryAuditEvents() Sprint 1C wrappers added
 *   - LIN-01A-R2: governance and timestamp integrity remediation
 *     - C01-E: four-eyes enforcement restored via two-phase approval preflight
 *     - C02-C: LineageSummaryRecord DTO introduced; updatedAt fabrication eliminated
 *
 * LIN-01 Remediation Changes (this file):
 *   T1-01 / Item 1  — A07 v2 modifications applied:
 *                     LineageErrorCode extended with WEIGHT_REVIEW_NOT_REQUIRED,
 *                     WEIGHT_REVIEW_ALREADY_COMPLETED.
 *                     LineageRecord extended with weightReviewRequired,
 *                     weightReviewCompletedAt.
 *                     mapRowToLineageRecord() always maps both new fields.
 *                     completeWeightReview() added with full v2 error translation
 *                     (all four DB guard strings → typed LineageErrorCode values)
 *                     and typed field access replacing (lineage as any) casts.
 *   T1-02 / Item 2  — getLineageSummary() replaced with RPC-based implementation
 *                     calling fn_get_signal_lineage_summary(). Bidirectional key
 *                     match. proposedBy now correctly populated.
 *   T2-01 / Item 3  — getLineageAuditLog() and getRegistryAuditEvents() Sprint 1C
 *                     wrappers added.
 *
 * LIN-01A-R2 Remediation Changes (DEFECT-C01, DEFECT-C02):
 *   C01-E — approveLineageTransition() restructured to two-phase preflight:
 *             Phase 1: fetchLineageRowById() — row existence and state validation.
 *             Phase 2: fn_get_signal_lineage_summary() — proposedBy sourced from
 *               the only correct data path (LEFT JOIN to signal_registry_audit_log).
 *             Four-eyes guard executes against RPC-sourced proposedBy.
 *             Missing or empty proposedBy is a hard GOVERNANCE_VIOLATION — approval
 *             does not continue when proposer identity cannot be proven.
 *             Database constraint (signal_lineage_no_self_approval) resumes its
 *             correct role as defence-in-depth backstop.
 *   C02-C — LineageSummaryRecord introduced as the dedicated DTO for
 *             fn_get_signal_lineage_summary output. Matches the Sprint 1C RPC
 *             output contract exactly. Does not contain updatedAt (not projected
 *             by the RPC). getLineageSummary() return type changed to
 *             Promise<LineageSummaryRecord[]>. mapRpcRowToLineageRecord() renamed
 *             to mapRpcRowToLineageSummaryRecord(). No fabricated timestamps remain.
 *             LineageRecord unchanged — remains the DTO for direct table reads.
 *
 * Out of scope (per LIN-01A task spec):
 *   - getSuccessorSignals(): unchanged per unresolved fn_get_signal_successors
 *     contract questions (LIN-01A exclusion).
 *   - Recursive lineage traversal / fn_get_lineage_chain(): Track 3.
 *   - Rejection-state / lifecycle_status redesign: A05-related.
 *   - Admin API routes, controllers, frontend changes.
 *
 * Database contract (signal_lineage — 16 columns post-A07):
 *   id                            uuid           PK, generated
 *   predecessor_signal_key        text           NOT NULL
 *   successor_signal_key          text           NULLABLE
 *   lineage_type                  lineage_type   NOT NULL (enum)
 *   lineage_reason                text           NOT NULL
 *   effective_date                date           NOT NULL
 *   taxonomy_version              text           NOT NULL
 *   proposed_at                   timestamptz    NOT NULL, default now()
 *   approved_by                   text           NULLABLE
 *   approved_at                   timestamptz    NULLABLE
 *   triggered_by_pipeline_run_id  text           NULLABLE
 *   created_at                    timestamptz    NOT NULL, default now()
 *   updated_at                    timestamptz    NOT NULL, managed by trigger
 *   weight_review_required        boolean        NOT NULL, default true  (A07)
 *   weight_review_completed_at    timestamptz    NULLABLE               (A07)
 *
 * NOTE: proposed_by is NOT a column on signal_lineage. It is stored exclusively
 * in signal_registry_audit_log.event_payload->>'proposedBy' for the
 * lineage_event_proposed record, correlated via lineage_id FK.
 * fn_get_signal_lineage_summary() sources proposed_by via LEFT JOIN.
 * Direct table reads (getSuccessorSignals, fetchLineageRowById) correctly return
 * undefined/empty for this field; callers requiring proposed_by must use
 * getLineageSummary().
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  RegistryAuditService,
  REGISTRY_EVENT_TYPE,
  LINEAGE_TYPE,
  type LineageType,
  type AuditWriteResult,
} from "./registry-audit.service";

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 1 — Re-export LineageType for consumers
// ─────────────────────────────────────────────────────────────────────────────

export { LINEAGE_TYPE, type LineageType };

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 2 — Error Types
// ─────────────────────────────────────────────────────────────────────────────

/**
 * LIN-01 Item 1 (A07 v2 Mod 1): WEIGHT_REVIEW_NOT_REQUIRED and
 * WEIGHT_REVIEW_ALREADY_COMPLETED added to support completeWeightReview()
 * typed error translation.
 */
export type LineageErrorCode =
  // Validation errors
  | "VALIDATION_ERROR"
  | "INVALID_SIGNAL_KEY"
  | "INVALID_LINEAGE_TYPE"
  | "INVALID_TAXONOMY_VERSION"
  | "INVALID_LINEAGE_REASON"
  | "INVALID_EFFECTIVE_DATE"
  | "INVALID_SUCCESSOR_KEY"
  | "DUPLICATE_PROPOSAL"
  | "INCOMPATIBLE_LINEAGE_STATE"
  // Approval/rejection errors
  | "LINEAGE_NOT_FOUND"
  | "INVALID_LINEAGE_STATE"
  | "SELF_APPROVAL_NOT_PERMITTED"
  | "TAXONOMY_VERSION_EXPIRED"
  // Governance errors
  | "GOVERNANCE_VIOLATION"
  | "WEIGHT_REVIEW_NOT_REQUIRED"       // weight_review_required = false on lineage row
  | "WEIGHT_REVIEW_ALREADY_COMPLETED"  // weight_review_completed_at already set
  // Persistence / audit errors
  | "AUDIT_WRITE_FAILURE"
  | "PERSISTENCE_ERROR"
  | "DATABASE_ERROR";

export class LineageServiceError extends Error {
  public readonly code: LineageErrorCode;
  public readonly context?: Record<string, unknown>;

  constructor(
    code: LineageErrorCode,
    message: string,
    context?: Record<string, unknown>
  ) {
    super(message);
    this.name = "LineageServiceError";
    this.code = code;
    this.context = context;
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, LineageServiceError);
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 3 — Input / Output Interfaces
// ─────────────────────────────────────────────────────────────────────────────

export interface ProposeLineageTransitionInput {
  predecessorSignalKey: string;
  /**
   * Null is valid only when lineageType = 'retired_no_successor'.
   * For all other lineage types, this must be a non-empty string.
   */
  successorSignalKey: string | null;
  lineageType: LineageType;
  /** Human-readable rationale. Minimum 10 characters. */
  lineageReason: string;
  /** Must be >= today's date at time of proposal. */
  effectiveDate: Date;
  /** Taxonomy version. Must be non-empty. Stored as plain text. */
  taxonomyVersion: string;
  /** Identity of the proposing actor. */
  proposedBy: string;
  /** Optional pipeline run traceability reference. */
  triggeredByPipelineRunId?: string | null;
}

export interface ProposeLineageTransitionResult {
  lineageId: string;
  status: "proposed";
  proposedAt: Date;
}

export interface ApproveLineageTransitionInput {
  lineageId: string;
  approvedBy: string;
}

export interface ApproveLineageTransitionResult {
  lineageId: string;
  status: "approved";
  approvedAt: Date;
}

export interface RejectLineageTransitionInput {
  lineageId: string;
  rejectedBy: string;
  /** Human-readable rejection rationale. Minimum 10 characters. */
  rejectionReason: string;
}

export interface RejectLineageTransitionResult {
  lineageId: string;
  status: "rejected";
  rejectedAt: Date;
}

/**
 * LIN-01 Item 1 (A07 v2 Mod 2): Input interface for completeWeightReview().
 */
export interface CompleteWeightReviewInput {
  /** UUID of the approved signal_lineage row. Must be a valid UUID. */
  lineageId:               string;
  /** Identity of the actor completing the review. Must be non-empty. */
  completedBy:             string;
  /** Predecessor signal key from the lineage row. Must be non-empty. */
  signalKey:               string;
  /** Taxonomy version at time of completion. Must be non-empty. */
  taxonomyVersion:         string;
  /** Signal weight before the weight review. Must be a finite number. */
  previousWeight:          number;
  /** Signal weight after the weight review. Must be a finite number. */
  newWeight:               number;
  /** Human-readable review outcome summary. Must be non-empty. */
  reviewOutcome:           string;
  /** UUID of the approved signal_weight_versions row. Nullable. */
  signalWeightVersionsId?: string | null;
}

/**
 * LIN-01 Item 1 (A07 v2 Mod 2): Result interface for completeWeightReview().
 */
export interface CompleteWeightReviewResult {
  lineageId:               string;
  status:                  "weight_review_completed";
  weightReviewCompletedAt: Date;
}

export interface ValidateLineageTransitionInput {
  predecessorSignalKey: string;
  successorSignalKey: string | null;
  lineageType: LineageType;
  lineageReason: string;
  effectiveDate: Date;
  taxonomyVersion: string;
  proposedBy: string;
}

export interface ValidationViolation {
  field: string;
  code: LineageErrorCode;
  message: string;
}

export interface ValidateLineageTransitionResult {
  valid: boolean;
  violations: ValidationViolation[];
}

/**
 * A single lineage row as returned by read methods.
 *
 * LIN-01 Item 1 (A07 v2 Mod 3): Extended with weightReviewRequired and
 * weightReviewCompletedAt. Both fields are non-optional because:
 * - weight_review_required is NOT NULL on the database column.
 * - weight_review_completed_at is always present on the row (value may be null).
 * mapRowToLineageRecord() and mapRpcRowToLineageSummaryRecord() always populate both.
 *
 * NOTE: proposedBy is populated ONLY when the record originates from the
 * fn_get_signal_lineage_summary RPC (getLineageSummary()). Records from
 * fetchLineageRowById() and getSuccessorSignals() will have proposedBy as an
 * empty string because signal_lineage has no proposed_by column.
 */
export interface LineageRecord {
  id: string;
  predecessorSignalKey: string;
  successorSignalKey: string | null;
  lineageType: LineageType;
  lineageReason: string;
  effectiveDate: Date;
  taxonomyVersion: string;
  proposedBy: string;
  proposedAt: Date;
  approvedBy: string | null;
  approvedAt: Date | null;
  triggeredByPipelineRunId: string | null;
  createdAt: Date;
  updatedAt: Date;
  /** Maps signal_lineage.weight_review_required (boolean NOT NULL DEFAULT true). */
  weightReviewRequired: boolean;
  /** Maps signal_lineage.weight_review_completed_at (timestamptz NULL). */
  weightReviewCompletedAt: Date | null;
}

/**
 * LIN-01A-R2 (C02-C): Dedicated DTO for fn_get_signal_lineage_summary output.
 *
 * This interface matches the Sprint 1C RPC output contract EXACTLY.
 * It must never contain a field that is not projected by the RPC.
 *
 * fn_get_signal_lineage_summary RETURNS TABLE:
 *   lineage_id                  uuid
 *   predecessor_signal_key      text
 *   successor_signal_key        text
 *   lineage_type                text
 *   lineage_reason              text
 *   effective_date              date
 *   taxonomy_version            text
 *   proposed_by                 text        (LEFT JOIN — may be null if audit record missing)
 *   proposed_at                 timestamptz (aliased from sl.created_at per Sprint 1C §3.1)
 *   approved_by                 text
 *   approved_at                 timestamptz
 *   weight_review_required      boolean
 *   weight_review_completed_at  timestamptz
 *   triggered_by_pipeline_run_id uuid
 *
 * Fields NOT in this DTO (not projected by the RPC):
 *   updatedAt — signal_lineage.updated_at is not projected. It must not be
 *               fabricated. Consumers requiring updatedAt must use a direct
 *               table read (fetchLineageRowById) or await a Sprint 1C amendment
 *               that adds updated_at to the RPC projection.
 *   createdAt — not projected separately; proposedAt maps sl.created_at per §3.1.
 *
 * Relationship to LineageRecord:
 *   LineageRecord is the DTO for direct signal_lineage table reads (write-path
 *   preflight, getSuccessorSignals). It includes updatedAt (available from the
 *   direct read) and has proposedBy as empty string (column does not exist on
 *   the table).
 *   LineageSummaryRecord is the DTO for the governed read surface. It has
 *   proposedBy correctly populated and does not include updatedAt.
 */
export interface LineageSummaryRecord {
  /** Maps RPC column: lineage_id (uuid). */
  id: string;
  predecessorSignalKey: string;
  successorSignalKey: string | null;
  lineageType: LineageType;
  lineageReason: string;
  effectiveDate: Date;
  taxonomyVersion: string;
  /**
   * Proposer identity sourced from signal_registry_audit_log via LEFT JOIN
   * inside fn_get_signal_lineage_summary on lineage_id FK where
   * event_type = 'lineage_event_proposed'. Null if the audit record is missing
   * (governance integrity gap — surfaced as null rather than blocking the read).
   */
  proposedBy: string | null;
  /** Maps RPC column: proposed_at (sl.created_at per Sprint 1C Spec §3.1). */
  proposedAt: Date;
  approvedBy: string | null;
  approvedAt: Date | null;
  triggeredByPipelineRunId: string | null;
  /** Maps signal_lineage.weight_review_required (boolean NOT NULL DEFAULT true). */
  weightReviewRequired: boolean;
  /** Maps signal_lineage.weight_review_completed_at (timestamptz NULL). */
  weightReviewCompletedAt: Date | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 3B — Sprint 1C Read-Path Output Interfaces (LIN-01 Item 3)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * LIN-01 Item 3: Output record for getLineageAuditLog().
 * Maps the output contract of fn_get_lineage_audit_log() (Sprint 1C RPC-03).
 *
 * Note: proposed_by is intentionally excluded from this interface — the audit
 * log RPC represents completed governance decisions only, and the RPC contract
 * does not include proposed_by in its output projection.
 */
export interface LineageAuditLogRecord {
  /** UUID of the signal_lineage row. */
  lineageId: string;
  predecessorSignalKey: string;
  successorSignalKey: string | null;
  lineageType: LineageType;
  lineageReason: string;
  effectiveDate: Date;
  taxonomyVersion: string;
  approvedBy: string | null;
  approvedAt: Date;
  weightReviewRequired: boolean;
  weightReviewCompletedAt: Date | null;
  /** UUID of the correlated signal_registry_audit_log row. Null if audit record missing. */
  auditEventId: string | null;
  /** performed_at of the correlated audit event. Null if audit record missing. */
  auditEventCreatedAt: Date | null;
}

/**
 * LIN-01 Item 3: Input parameters for getLineageAuditLog().
 */
export interface GetLineageAuditLogInput {
  /** Signal key (predecessor OR successor). Non-empty. */
  signalKey: string;
  /**
   * Range start (inclusive). Must be <= toDate.
   * Applied to approved_at on signal_lineage rows.
   */
  fromDate: Date;
  /**
   * Range end (inclusive). Must be >= fromDate.
   * Applied to approved_at on signal_lineage rows.
   */
  toDate: Date;
}

/**
 * LIN-01 Item 3: Output record for getRegistryAuditEvents().
 * Maps the output contract of fn_get_registry_audit_events() (Sprint 1C RPC-04).
 *
 * event_payload is typed as Record<string, unknown> per LIN-01A Item 3 typing
 * requirements (avoid any; use Record<string, unknown> or stronger).
 */
export interface RegistryAuditEventRecord {
  /** UUID of the signal_registry_audit_log row. */
  auditEventId: string;
  signalKey: string;
  /** Registry event type — cast from registry_audit_event_type_enum. */
  eventType: string;
  /**
   * Raw event payload as stored. Not transformed or summarised.
   * Typed as Record<string, unknown> — callers must narrow as required.
   */
  eventPayload: Record<string, unknown>;
  performedBy: string;
  taxonomyVersion: string;
  /** Aliased from performed_at per Sprint 1C Spec §3.4 output contract. */
  createdAt: Date;
}

/**
 * LIN-01 Item 3: Input parameters for getRegistryAuditEvents().
 */
export interface GetRegistryAuditEventsInput {
  /** Signal key. Non-empty. */
  signalKey: string;
  /**
   * Range start (inclusive). Must be <= toDate.
   * Applied to performed_at on signal_registry_audit_log rows.
   */
  fromDate: Date;
  /**
   * Range end (inclusive). Must be >= fromDate.
   * Applied to performed_at on signal_registry_audit_log rows.
   */
  toDate: Date;
  /**
   * Optional event type filter. If provided, must be a valid
   * REGISTRY_EVENT_TYPE value. Validated at service layer before RPC call
   * (AMD-08 pre-call validation).
   */
  eventType?: string | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 4 — Approved lineage_type set (runtime guard)
// Mirror of LINEAGE_TYPE for Set-based validation
// ─────────────────────────────────────────────────────────────────────────────

const ALL_LINEAGE_TYPES = new Set<string>(Object.values(LINEAGE_TYPE));

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 5 — LineageService
// ─────────────────────────────────────────────────────────────────────────────

export class LineageService {
  /**
   * AMD-07: Both clients must be initialised server-side only.
   * supabase: service_role Supabase client — bypasses RLS.
   * auditService: RegistryAuditService instance (dependency injection).
   *
   * Dependency injection enables test doubles for both DB and audit service.
   */
  constructor(
    private readonly supabase: SupabaseClient,
    private readonly auditService: RegistryAuditService
  ) {}

  // ── proposeLineageTransition() ───────────────────────────────────────────

  /**
   * Creates a new proposed lineage transition in signal_lineage and records
   * a lineage_event_proposed audit event via RegistryAuditService.
   *
   * AMD-08: all validation runs before any database operation.
   * AMD-10: lineage INSERT + audit INSERT are executed atomically via the
   * fn_propose_lineage_transition PostgreSQL RPC wrapper.
   *
   * THROWS LineageServiceError on any failure.
   */
  async proposeLineageTransition(
    input: ProposeLineageTransitionInput
  ): Promise<ProposeLineageTransitionResult> {
    // ── AMD-08: full validation before DB ─────────────────────────────────
    const validation = await this.validateLineageTransition({
      predecessorSignalKey: input.predecessorSignalKey,
      successorSignalKey:   input.successorSignalKey,
      lineageType:          input.lineageType,
      lineageReason:        input.lineageReason,
      effectiveDate:        input.effectiveDate,
      taxonomyVersion:      input.taxonomyVersion,
      proposedBy:           input.proposedBy,
    });

    if (!validation.valid) {
      const primary = validation.violations[0];
      throw new LineageServiceError(
        primary.code,
        primary.message,
        { violations: validation.violations }
      );
    }

    // ── Duplicate proposal check (VAL-8) ──────────────────────────────────
    await this.assertNoDuplicateProposal(
      input.predecessorSignalKey,
      input.lineageType,
      input.taxonomyVersion
    );

    // ── Incompatible state check (VAL-9) ──────────────────────────────────
    await this.assertNoIncompatibleApprovedLineage(
      input.predecessorSignalKey,
      input.lineageType
    );

    // ── AMD-10: Atomic propose + audit via RPC ────────────────────────────
    const proposalPayload = {
      p_predecessor_signal_key:       input.predecessorSignalKey.trim(),
      p_successor_signal_key:         input.successorSignalKey?.trim() ?? null,
      p_lineage_type:                 input.lineageType,
      p_lineage_reason:               input.lineageReason.trim(),
      p_effective_date:               this.formatDate(input.effectiveDate),
      p_taxonomy_version:             input.taxonomyVersion.trim(),
      p_proposed_by:                  input.proposedBy.trim(),
      p_triggered_by_pipeline_run_id: input.triggeredByPipelineRunId?.trim() ?? null,
    };

    const { data, error } = await this.supabase.rpc(
      "fn_propose_lineage_transition",
      proposalPayload
    );

    if (error || !data) {
      throw new LineageServiceError(
        "PERSISTENCE_ERROR",
        "Failed to persist lineage proposal",
        { supabaseErrorMessage: error?.message }
      );
    }

    const result = data as { lineage_id: string; proposed_at: string };

    return {
      lineageId:  result.lineage_id,
      status:     "proposed",
      proposedAt: new Date(result.proposed_at),
    };
  }

  // ── approveLineageTransition() ───────────────────────────────────────────

  /**
   * Approves an existing proposed lineage transition.
   *
   * LIN-01A-R2 (C01-E): Two-phase approval preflight restores AMD-08 four-eyes
   * enforcement. signal_lineage has no proposed_by column; the proposer identity
   * is stored exclusively in signal_registry_audit_log and is only accessible
   * via fn_get_signal_lineage_summary (LEFT JOIN to audit log on lineage_id).
   *
   * Phase 1 — fetchLineageRowById():
   *   Validates row existence and proposed state. Provides predecessorSignalKey
   *   required for Phase 2.
   *
   * Phase 2 — fn_get_signal_lineage_summary():
   *   Sources proposedBy from the governed read RPC. Filters result to the
   *   specific lineage_id. Executes four-eyes guard against the RPC-sourced
   *   proposedBy value.
   *
   * Mandatory governance rule (LIN-01A-R1 design approval):
   *   If proposedBy is null, empty, or the lineage_id cannot be located in
   *   the RPC response, approval is hard-blocked with GOVERNANCE_VIOLATION.
   *   Approval must never continue when proposer identity cannot be proven.
   *   The database constraint (signal_lineage_no_self_approval via
   *   fn_approve_lineage_transition) resumes its correct role as
   *   defence-in-depth backstop only.
   *
   * AMD-10: approval UPDATE + audit INSERT are executed atomically via the
   * fn_approve_lineage_transition PostgreSQL RPC wrapper.
   *
   * THROWS LineageServiceError on any failure.
   */
  async approveLineageTransition(
    input: ApproveLineageTransitionInput
  ): Promise<ApproveLineageTransitionResult> {
    // ── AMD-08: validate inputs before any DB operation ───────────────────
    if (!input.lineageId || !this.isValidUUID(input.lineageId)) {
      throw new LineageServiceError(
        "VALIDATION_ERROR",
        "lineageId must be a valid UUID",
        { lineageId: input.lineageId }
      );
    }
    if (!input.approvedBy || input.approvedBy.trim().length === 0) {
      throw new LineageServiceError(
        "VALIDATION_ERROR",
        "approvedBy must be non-empty"
      );
    }

    // ── PHASE 1: State validation via direct table read ───────────────────
    // fetchLineageRowById() provides row existence confirmation and the state
    // fields (approvedAt, approvedBy, predecessorSignalKey, taxonomyVersion,
    // lineageType, successorSignalKey) needed for both the state guard and
    // the approval RPC call. proposedBy is NOT sourced here — signal_lineage
    // has no proposed_by column; mapRowToLineageRecord() sets it to "".

    const proposal = await this.fetchLineageRowById(input.lineageId);

    // ── State guard: must be in proposed state ────────────────────────────
    if (proposal.approvedAt !== null || proposal.approvedBy !== null) {
      throw new LineageServiceError(
        "INVALID_LINEAGE_STATE",
        "Lineage transition is already approved",
        { lineageId: input.lineageId }
      );
    }

    // ── PHASE 2: Obtain proposedBy from governed read RPC ─────────────────
    // fn_get_signal_lineage_summary is the only correct data path for
    // proposed_by — it sources it via LEFT JOIN to signal_registry_audit_log
    // on lineage_id FK where event_type = 'lineage_event_proposed'.
    // The result is filtered to the specific lineage_id.
    // Using predecessorSignalKey from Phase 1 as the required p_signal_key.

    const { data: summaryData, error: summaryError } = await this.supabase.rpc(
      "fn_get_signal_lineage_summary",
      { p_signal_key: proposal.predecessorSignalKey }
    );

    if (summaryError) {
      throw new LineageServiceError(
        "DATABASE_ERROR",
        "Failed to retrieve proposer identity for four-eyes validation",
        {
          supabaseErrorMessage: summaryError.message,
          lineageId: input.lineageId,
        }
      );
    }

    // Locate the specific lineage row within the RPC result set.
    const summaryRows = (summaryData ?? []) as Array<Record<string, unknown>>;
    const summaryRow = summaryRows.find(
      (r) => (r.lineage_id as string) === input.lineageId
    );

    // ── GOVERNANCE_VIOLATION: proposer identity cannot be proven ──────────
    // Per LIN-01A-R1 mandatory rule: if proposedBy is null, empty, or the
    // lineage_id is not found in the RPC result, approval is hard-blocked.
    // Governance requires proven proposer identity before the four-eyes check.

    if (!summaryRow) {
      throw new LineageServiceError(
        "GOVERNANCE_VIOLATION",
        "Proposer identity cannot be verified: lineage record not found in governance summary",
        { lineageId: input.lineageId, predecessorSignalKey: proposal.predecessorSignalKey }
      );
    }

    const proposedBy = summaryRow.proposed_by as string | null;

    if (!proposedBy || proposedBy.trim().length === 0) {
      throw new LineageServiceError(
        "GOVERNANCE_VIOLATION",
        "Proposer identity cannot be verified: proposed_by is absent from the lineage audit record. Approval is blocked until the governance integrity gap is resolved.",
        { lineageId: input.lineageId }
      );
    }

    // ── FOUR-EYES ENFORCEMENT (AMD-08) ────────────────────────────────────
    // Service-layer check fires against RPC-sourced proposedBy.
    // Database constraint is defence-in-depth backstop only.

    if (
      input.approvedBy.trim().toLowerCase() ===
      proposedBy.trim().toLowerCase()
    ) {
      throw new LineageServiceError(
        "SELF_APPROVAL_NOT_PERMITTED",
        "The approver must be different from the proposer (four-eyes governance)",
        {
          lineageId:  input.lineageId,
          proposedBy,
          approvedBy: input.approvedBy,
        }
      );
    }

    // ── AMD-10: Atomic approval + audit via RPC ───────────────────────────
    const { data, error } = await this.supabase.rpc(
      "fn_approve_lineage_transition",
      {
        p_lineage_id:             input.lineageId,
        p_approved_by:            input.approvedBy.trim(),
        p_predecessor_signal_key: proposal.predecessorSignalKey,
        p_successor_signal_key:   proposal.successorSignalKey,
        p_lineage_type:           proposal.lineageType,
        p_taxonomy_version:       proposal.taxonomyVersion,
      }
    );

    if (error || !data) {
      if (error?.message?.includes("self_approval")) {
        throw new LineageServiceError(
          "SELF_APPROVAL_NOT_PERMITTED",
          "Database governance constraint rejected self-approval (defence-in-depth)",
          { supabaseErrorMessage: error.message }
        );
      }
      if (error?.message?.includes("not in proposed state")) {
        throw new LineageServiceError(
          "INVALID_LINEAGE_STATE",
          "Lineage transition is not in proposed state",
          { lineageId: input.lineageId }
        );
      }
      if (error?.message?.includes("taxonomy_version_expired")) {
        throw new LineageServiceError(
          "TAXONOMY_VERSION_EXPIRED",
          "The taxonomy version on this proposal is no longer valid",
          { taxonomyVersion: proposal.taxonomyVersion }
        );
      }
      throw new LineageServiceError(
        "PERSISTENCE_ERROR",
        "Failed to persist lineage approval",
        { supabaseErrorMessage: error?.message, lineageId: input.lineageId }
      );
    }

    const result = data as { approved_at: string };

    return {
      lineageId:  input.lineageId,
      status:     "approved",
      approvedAt: new Date(result.approved_at),
    };
  }

  // ── rejectLineageTransition() ────────────────────────────────────────────

  /**
   * Rejects a proposed lineage transition. Self-rejection is permitted —
   * the four-eyes constraint applies only to approval.
   *
   * Rejection is recorded via signal_metadata_changed audit event with
   * action: 'lineage_rejected' in the payload (consistent with the approved
   * registry_event_type enum — no dedicated rejection event type exists).
   *
   * AMD-10: rejection UPDATE + audit INSERT are executed atomically via the
   * fn_reject_lineage_transition PostgreSQL RPC wrapper.
   *
   * THROWS LineageServiceError on any failure.
   */
  async rejectLineageTransition(
    input: RejectLineageTransitionInput
  ): Promise<RejectLineageTransitionResult> {
    // ── AMD-08: validate inputs before DB ─────────────────────────────────
    if (!input.lineageId || !this.isValidUUID(input.lineageId)) {
      throw new LineageServiceError(
        "VALIDATION_ERROR",
        "lineageId must be a valid UUID"
      );
    }
    if (!input.rejectedBy || input.rejectedBy.trim().length === 0) {
      throw new LineageServiceError(
        "VALIDATION_ERROR",
        "rejectedBy must be non-empty"
      );
    }
    if (!input.rejectionReason || input.rejectionReason.trim().length < 10) {
      throw new LineageServiceError(
        "INVALID_LINEAGE_REASON",
        "rejectionReason must be at least 10 characters",
        { length: input.rejectionReason?.length ?? 0 }
      );
    }

    // ── Fetch the proposal to confirm state ───────────────────────────────
    const proposal = await this.fetchLineageRowById(input.lineageId);

    if (proposal.approvedAt !== null) {
      throw new LineageServiceError(
        "INVALID_LINEAGE_STATE",
        "Cannot reject a lineage transition that is already approved",
        { lineageId: input.lineageId }
      );
    }

    // ── AMD-10: Atomic rejection update + audit via RPC ───────────────────
    const { data, error } = await this.supabase.rpc(
      "fn_reject_lineage_transition",
      {
        p_lineage_id:       input.lineageId,
        p_rejected_by:      input.rejectedBy.trim(),
        p_rejection_reason: input.rejectionReason.trim(),
        p_signal_key:       proposal.predecessorSignalKey,
        p_taxonomy_version: proposal.taxonomyVersion,
      }
    );

    if (error || !data) {
      if (error?.message?.includes("not in proposed state")) {
        throw new LineageServiceError(
          "INVALID_LINEAGE_STATE",
          "Lineage transition is not in proposed state (may have been concurrently modified)",
          { lineageId: input.lineageId }
        );
      }
      throw new LineageServiceError(
        "PERSISTENCE_ERROR",
        "Failed to persist lineage rejection",
        { supabaseErrorMessage: error?.message, lineageId: input.lineageId }
      );
    }

    const result = data as { rejected_at: string };

    return {
      lineageId:  input.lineageId,
      status:     "rejected",
      rejectedAt: new Date(result.rejected_at),
    };
  }

  // ── completeWeightReview() ───────────────────────────────────────────────

  /**
   * Marks a weight review complete for an approved lineage transition.
   * Sets weight_review_completed_at on the signal_lineage row and writes
   * a weight_review_completed audit event via an atomic PostgreSQL RPC.
   *
   * Sprint 1B §6.2.5. AMD-07, AMD-08, AMD-10.
   *
   * LIN-01 Item 1 (A07 v2 Mod 5):
   *   C-02  All four DB guard strings translate to typed LineageErrorCode values:
   *           lineage_not_found          → LINEAGE_NOT_FOUND
   *           not_approved               → GOVERNANCE_VIOLATION
   *           weight_review_not_required → WEIGHT_REVIEW_NOT_REQUIRED
   *           already_completed          → WEIGHT_REVIEW_ALREADY_COMPLETED
   *   M-02  AMD-08 validation covers all eight input fields (reviewOutcome,
   *           previousWeight, newWeight now validated).
   *   M-04  Typed field access: lineage.weightReviewRequired,
   *           lineage.weightReviewCompletedAt. No (lineage as any) casts.
   *
   * THROWS LineageServiceError on any failure.
   */
  async completeWeightReview(
    input: CompleteWeightReviewInput
  ): Promise<CompleteWeightReviewResult> {

    // ── AMD-08: Validate all inputs before any database operation ──────────
    // M-02 fix: validation covers all eight input fields, not just four.

    if (!input.lineageId || !this.isValidUUID(input.lineageId)) {
      throw new LineageServiceError(
        "VALIDATION_ERROR",
        "lineageId must be a valid UUID",
        { lineageId: input.lineageId }
      );
    }

    if (!input.completedBy || input.completedBy.trim().length === 0) {
      throw new LineageServiceError(
        "VALIDATION_ERROR",
        "completedBy must be non-empty"
      );
    }

    if (!input.signalKey || input.signalKey.trim().length === 0) {
      throw new LineageServiceError(
        "VALIDATION_ERROR",
        "signalKey must be non-empty"
      );
    }

    if (!input.taxonomyVersion || input.taxonomyVersion.trim().length === 0) {
      throw new LineageServiceError(
        "VALIDATION_ERROR",
        "taxonomyVersion must be non-empty"
      );
    }

    // M-02 fix: reviewOutcome validation
    if (!input.reviewOutcome || input.reviewOutcome.trim().length === 0) {
      throw new LineageServiceError(
        "VALIDATION_ERROR",
        "reviewOutcome must be non-empty"
      );
    }

    // M-02 fix: previousWeight must be a finite number (rejects NaN, Infinity, -Infinity)
    if (typeof input.previousWeight !== "number" || !isFinite(input.previousWeight)) {
      throw new LineageServiceError(
        "VALIDATION_ERROR",
        "previousWeight must be a finite number",
        { previousWeight: input.previousWeight }
      );
    }

    // M-02 fix: newWeight must be a finite number
    if (typeof input.newWeight !== "number" || !isFinite(input.newWeight)) {
      throw new LineageServiceError(
        "VALIDATION_ERROR",
        "newWeight must be a finite number",
        { newWeight: input.newWeight }
      );
    }

    // ── Fetch lineage row ─────────────────────────────────────────────────
    // fetchLineageRowById() throws LINEAGE_NOT_FOUND if row is absent.

    const lineage = await this.fetchLineageRowById(input.lineageId);

    // ── Service-layer governance guards (AMD-08, defence-in-depth) ────────
    // M-04 fix: typed field access — no (lineage as any) casts.
    // mapRowToLineageRecord() always populates weightReviewRequired and
    // weightReviewCompletedAt (Mod 4 fix ensures this).

    // Guard: lineage must be approved
    if (lineage.approvedAt === null) {
      throw new LineageServiceError(
        "GOVERNANCE_VIOLATION",
        "Weight review completion requires an approved lineage transition",
        { lineageId: input.lineageId }
      );
    }

    // Guard: weight review must be required on this row
    if (!lineage.weightReviewRequired) {
      throw new LineageServiceError(
        "WEIGHT_REVIEW_NOT_REQUIRED",
        "weight_review_required is false on this lineage row",
        { lineageId: input.lineageId }
      );
    }

    // Guard: idempotency — not already completed
    if (lineage.weightReviewCompletedAt !== null) {
      throw new LineageServiceError(
        "WEIGHT_REVIEW_ALREADY_COMPLETED",
        "weight_review_completed_at is already set on this lineage row",
        {
          lineageId:   input.lineageId,
          completedAt: lineage.weightReviewCompletedAt,
        }
      );
    }

    // ── AMD-10: UPDATE + audit INSERT via atomic RPC ───────────────────────

    const { data, error } = await this.supabase.rpc(
      "fn_complete_weight_review",
      {
        p_lineage_id:                input.lineageId,
        p_completed_by:              input.completedBy.trim(),
        p_signal_key:                input.signalKey.trim(),
        p_taxonomy_version:          input.taxonomyVersion.trim(),
        p_previous_weight:           input.previousWeight,
        p_new_weight:                input.newWeight,
        p_review_outcome:            input.reviewOutcome.trim(),
        p_signal_weight_versions_id: input.signalWeightVersionsId ?? null,
      }
    );

    if (error || !data) {
      // C-02 fix: all four DB guard strings translated to typed error codes.

      // DB guard 1: row not found (TOCTOU window between service fetch and RPC)
      if (error?.message?.includes("lineage_not_found")) {
        throw new LineageServiceError(
          "LINEAGE_NOT_FOUND",
          "Database guard: lineage row not found",
          { supabaseErrorMessage: error.message, lineageId: input.lineageId }
        );
      }

      // DB guard 2: not approved
      if (error?.message?.includes("not_approved")) {
        throw new LineageServiceError(
          "GOVERNANCE_VIOLATION",
          "Database guard: lineage row is not approved",
          { supabaseErrorMessage: error.message }
        );
      }

      // DB guard 3: weight review not required (defence-in-depth backstop)
      if (error?.message?.includes("weight_review_not_required")) {
        throw new LineageServiceError(
          "WEIGHT_REVIEW_NOT_REQUIRED",
          "Database guard: weight review is not required on this lineage row",
          { supabaseErrorMessage: error.message }
        );
      }

      // DB guard 4: already completed (concurrent race caught at DB layer)
      if (error?.message?.includes("already_completed")) {
        throw new LineageServiceError(
          "WEIGHT_REVIEW_ALREADY_COMPLETED",
          "Database guard: weight review already completed",
          { supabaseErrorMessage: error.message }
        );
      }

      // Unclassified database error
      throw new LineageServiceError(
        "PERSISTENCE_ERROR",
        "Failed to complete weight review",
        { supabaseErrorMessage: error?.message, lineageId: input.lineageId }
      );
    }

    const result = data as { weight_review_completed_at: string };

    return {
      lineageId:               input.lineageId,
      status:                  "weight_review_completed",
      weightReviewCompletedAt: new Date(result.weight_review_completed_at),
    };
  }

  // ── validateLineageTransition() ──────────────────────────────────────────

  /**
   * Dry-run validation of a proposed lineage transition.
   * No side effects — no writes, no audit events.
   * Returns ALL violations (not first-only) for a complete pre-flight report.
   *
   * This method does NOT throw on validation failures — it returns them
   * as violations. It only throws on DATABASE_ERROR.
   */
  async validateLineageTransition(
    input: ValidateLineageTransitionInput
  ): Promise<ValidateLineageTransitionResult> {
    const violations: ValidationViolation[] = [];

    // VAL-1: predecessorSignalKey non-empty
    if (
      !input.predecessorSignalKey ||
      input.predecessorSignalKey.trim().length === 0
    ) {
      violations.push({
        field:   "predecessorSignalKey",
        code:    "INVALID_SIGNAL_KEY",
        message: "predecessorSignalKey must be non-empty",
      });
    }

    // VAL-2: successorSignalKey null only for retired_no_successor
    if (
      input.lineageType !== LINEAGE_TYPE.RETIRED_NO_SUCCESSOR &&
      (input.successorSignalKey === null ||
        input.successorSignalKey.trim().length === 0)
    ) {
      violations.push({
        field:   "successorSignalKey",
        code:    "INVALID_SUCCESSOR_KEY",
        message: `successorSignalKey is required for lineage type '${input.lineageType}'`,
      });
    }

    // VAL-4: lineageType is a valid enum value
    if (!input.lineageType || !ALL_LINEAGE_TYPES.has(input.lineageType)) {
      violations.push({
        field:   "lineageType",
        code:    "INVALID_LINEAGE_TYPE",
        message: `'${input.lineageType}' is not a valid lineage_type value`,
      });
    }

    // VAL-5: lineageReason minimum length
    if (!input.lineageReason || input.lineageReason.trim().length < 10) {
      violations.push({
        field:   "lineageReason",
        code:    "INVALID_LINEAGE_REASON",
        message: "lineageReason must be at least 10 characters",
      });
    }

    // VAL-6: effectiveDate >= today
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (!input.effectiveDate || input.effectiveDate < today) {
      violations.push({
        field:   "effectiveDate",
        code:    "INVALID_EFFECTIVE_DATE",
        message: "effectiveDate must be today or in the future",
      });
    }

    // VAL-7: taxonomyVersion non-empty
    if (!input.taxonomyVersion || input.taxonomyVersion.trim().length === 0) {
      violations.push({
        field:   "taxonomyVersion",
        code:    "INVALID_TAXONOMY_VERSION",
        message: "taxonomyVersion must be non-empty",
      });
    }

    // proposedBy non-empty
    if (!input.proposedBy || input.proposedBy.trim().length === 0) {
      violations.push({
        field:   "proposedBy",
        code:    "VALIDATION_ERROR",
        message: "proposedBy must be non-empty",
      });
    }

    // VAL-3: signal key validation via fn_validate_signal_keys
    // Only run if the basic field checks passed (keys are non-empty)
    if (
      violations.filter(
        (v) =>
          v.field === "predecessorSignalKey" ||
          v.field === "successorSignalKey" ||
          v.field === "taxonomyVersion"
      ).length === 0 &&
      input.predecessorSignalKey.trim().length > 0
    ) {
      const keysToValidate = [input.predecessorSignalKey.trim()];
      if (
        input.lineageType !== LINEAGE_TYPE.RETIRED_NO_SUCCESSOR &&
        input.successorSignalKey
      ) {
        keysToValidate.push(input.successorSignalKey.trim());
      }

      const keyValidation = await this.validateSignalKeys(
        keysToValidate,
        input.taxonomyVersion.trim()
      );

      for (const invalidKey of keyValidation.invalidKeys) {
        violations.push({
          field:   "signalKey",
          code:    "INVALID_SIGNAL_KEY",
          message: `Signal key '${invalidKey.key}' is invalid: ${invalidKey.reason}`,
        });
      }

      if (!keyValidation.taxonomyVersionValid) {
        violations.push({
          field:   "taxonomyVersion",
          code:    "INVALID_TAXONOMY_VERSION",
          message: `Taxonomy version '${input.taxonomyVersion}' does not exist in signal_category_hierarchy`,
        });
      }
    }

    return {
      valid:      violations.length === 0,
      violations,
    };
  }

  // ── getLineageSummary() ──────────────────────────────────────────────────

  /**
   * Returns all lineage rows for a given signal key (all statuses, both
   * directions: predecessor OR successor match).
   *
   * LIN-01 Item 2 (T1-02): Calls fn_get_signal_lineage_summary Sprint 1C RPC.
   * LIN-01A-R2 (C02-C): Return type changed from LineageRecord[] to
   * LineageSummaryRecord[]. LineageSummaryRecord matches the Sprint 1C RPC
   * output contract exactly. updatedAt is absent — it is not projected by the
   * RPC and must not be fabricated.
   *
   * Read-only — no audit events emitted.
   * Returns empty array for unknown signal keys (not an error).
   *
   * THROWS LineageServiceError on DATABASE_ERROR.
   */
  async getLineageSummary(signalKey: string): Promise<LineageSummaryRecord[]> {
    // AMD-08: input validation before DB call
    if (!signalKey || signalKey.trim().length === 0) {
      throw new LineageServiceError(
        "INVALID_SIGNAL_KEY",
        "signalKey must be non-empty"
      );
    }

    const { data, error } = await this.supabase.rpc(
      "fn_get_signal_lineage_summary",
      { p_signal_key: signalKey.trim() }
    );

    if (error) {
      throw new LineageServiceError(
        "DATABASE_ERROR",
        "Failed to retrieve lineage summary",
        { supabaseErrorMessage: error.message, signalKey }
      );
    }

    return (data ?? []).map((row: Record<string, unknown>) =>
      this.mapRpcRowToLineageSummaryRecord(row)
    );
  }

  // ── getSuccessorSignals() ────────────────────────────────────────────────

  /**
   * Returns only APPROVED lineage rows where the given key is the predecessor.
   * Proposed and rejected rows are excluded.
   * Returns empty array if no approved successors exist.
   *
   * NOTE: Per LIN-01A approved scope, getSuccessorSignals() is explicitly
   * excluded from this remediation cycle. The current direct-query implementation
   * is retained unchanged. The unresolved fn_get_signal_successors minimal
   * projection contract question must be resolved before this method can be
   * refactored to use the Sprint 1C RPC.
   *
   * THROWS LineageServiceError on DATABASE_ERROR.
   */
  async getSuccessorSignals(predecessorKey: string): Promise<LineageRecord[]> {
    if (!predecessorKey || predecessorKey.trim().length === 0) {
      throw new LineageServiceError(
        "INVALID_SIGNAL_KEY",
        "predecessorKey must be non-empty"
      );
    }

    const { data, error } = await this.supabase
      .from("signal_lineage")
      .select("*")
      .eq("predecessor_signal_key", predecessorKey.trim())
      .not("approved_at", "is", null)
      .order("approved_at", { ascending: true });

    if (error) {
      throw new LineageServiceError(
        "DATABASE_ERROR",
        "Failed to retrieve successor signals",
        { supabaseErrorMessage: error.message, predecessorKey }
      );
    }

    return (data ?? []).map((row: Record<string, unknown>) =>
      this.mapRowToLineageRecord(row)
    );
  }

  // ── getLineageAuditLog() ─────────────────────────────────────────────────

  /**
   * Returns the approved lineage history for a signal key within a date range,
   * formatted for regulatory compliance. Correlated with signal_registry_audit_log
   * for audit chain evidence. Approved rows only.
   *
   * LIN-01 Item 3 (T2-01): Wraps fn_get_lineage_audit_log Sprint 1C RPC.
   *
   * AMD-08 pre-call validation:
   *   - signalKey: non-empty
   *   - fromDate and toDate: non-null
   *   - fromDate <= toDate
   *
   * Read-only — no audit events emitted.
   * Returns empty array if no matching rows found.
   *
   * THROWS LineageServiceError on VALIDATION_ERROR or DATABASE_ERROR.
   */
  async getLineageAuditLog(
    input: GetLineageAuditLogInput
  ): Promise<LineageAuditLogRecord[]> {
    // ── AMD-08: input validation before DB call ────────────────────────────
    if (!input.signalKey || input.signalKey.trim().length === 0) {
      throw new LineageServiceError(
        "INVALID_SIGNAL_KEY",
        "signalKey must be non-empty"
      );
    }

    if (!input.fromDate || !(input.fromDate instanceof Date) || isNaN(input.fromDate.getTime())) {
      throw new LineageServiceError(
        "VALIDATION_ERROR",
        "fromDate must be a valid Date"
      );
    }

    if (!input.toDate || !(input.toDate instanceof Date) || isNaN(input.toDate.getTime())) {
      throw new LineageServiceError(
        "VALIDATION_ERROR",
        "toDate must be a valid Date"
      );
    }

    if (input.fromDate > input.toDate) {
      throw new LineageServiceError(
        "VALIDATION_ERROR",
        "fromDate must not be after toDate",
        {
          fromDate: input.fromDate.toISOString(),
          toDate:   input.toDate.toISOString(),
        }
      );
    }

    const { data, error } = await this.supabase.rpc(
      "fn_get_lineage_audit_log",
      {
        p_signal_key: input.signalKey.trim(),
        p_from_date:  input.fromDate.toISOString(),
        p_to_date:    input.toDate.toISOString(),
      }
    );

    if (error) {
      throw new LineageServiceError(
        "DATABASE_ERROR",
        "Failed to retrieve lineage audit log",
        { supabaseErrorMessage: error.message, signalKey: input.signalKey }
      );
    }

    return (data ?? []).map((row: Record<string, unknown>) =>
      this.mapRpcRowToLineageAuditLogRecord(row)
    );
  }

  // ── getRegistryAuditEvents() ─────────────────────────────────────────────

  /**
   * Returns audit events from signal_registry_audit_log for a given signal
   * key, optionally filtered by event type, within a date range. Projects
   * raw event_payload JSONB without transformation.
   *
   * LIN-01 Item 3 (T2-01): Wraps fn_get_registry_audit_events Sprint 1C RPC.
   *
   * AMD-08 pre-call validation:
   *   - signalKey: non-empty
   *   - fromDate and toDate: non-null, fromDate <= toDate
   *   - eventType (if supplied): must be a valid REGISTRY_EVENT_TYPE value
   *
   * Read-only — no audit events emitted.
   * Returns empty array if no matching events found.
   *
   * THROWS LineageServiceError on VALIDATION_ERROR or DATABASE_ERROR.
   */
  async getRegistryAuditEvents(
    input: GetRegistryAuditEventsInput
  ): Promise<RegistryAuditEventRecord[]> {
    // ── AMD-08: input validation before DB call ────────────────────────────
    if (!input.signalKey || input.signalKey.trim().length === 0) {
      throw new LineageServiceError(
        "INVALID_SIGNAL_KEY",
        "signalKey must be non-empty"
      );
    }

    if (!input.fromDate || !(input.fromDate instanceof Date) || isNaN(input.fromDate.getTime())) {
      throw new LineageServiceError(
        "VALIDATION_ERROR",
        "fromDate must be a valid Date"
      );
    }

    if (!input.toDate || !(input.toDate instanceof Date) || isNaN(input.toDate.getTime())) {
      throw new LineageServiceError(
        "VALIDATION_ERROR",
        "toDate must be a valid Date"
      );
    }

    if (input.fromDate > input.toDate) {
      throw new LineageServiceError(
        "VALIDATION_ERROR",
        "fromDate must not be after toDate",
        {
          fromDate: input.fromDate.toISOString(),
          toDate:   input.toDate.toISOString(),
        }
      );
    }

    // Validate eventType against REGISTRY_EVENT_TYPE enum if provided
    const eventTypeValues = new Set<string>(Object.values(REGISTRY_EVENT_TYPE));
    if (
      input.eventType !== null &&
      input.eventType !== undefined &&
      input.eventType.trim().length > 0 &&
      !eventTypeValues.has(input.eventType.trim())
    ) {
      throw new LineageServiceError(
        "VALIDATION_ERROR",
        `eventType '${input.eventType}' is not a valid registry_audit_event_type_enum value`,
        { eventType: input.eventType }
      );
    }

    const { data, error } = await this.supabase.rpc(
      "fn_get_registry_audit_events",
      {
        p_signal_key:  input.signalKey.trim(),
        p_from_date:   input.fromDate.toISOString(),
        p_to_date:     input.toDate.toISOString(),
        p_event_type:  input.eventType?.trim() ?? null,
      }
    );

    if (error) {
      throw new LineageServiceError(
        "DATABASE_ERROR",
        "Failed to retrieve registry audit events",
        { supabaseErrorMessage: error.message, signalKey: input.signalKey }
      );
    }

    return (data ?? []).map((row: Record<string, unknown>) =>
      this.mapRpcRowToRegistryAuditEventRecord(row)
    );
  }

  // ── Private: fetchLineageRowById() ───────────────────────────────────────

  /**
   * Fetches a single lineage row by UUID via direct table access.
   * Used for write-path preflight (approve, reject, completeWeightReview).
   *
   * NOTE: proposedBy will be empty string in the returned LineageRecord because
   * signal_lineage has no proposed_by column. This is acceptable for write-path
   * use — the four-eyes check in approveLineageTransition() is not applicable
   * here since proposed_by is not available from the direct table read.
   * The database constraint fn_approve_lineage_transition provides the
   * defence-in-depth backstop.
   */
  private async fetchLineageRowById(lineageId: string): Promise<LineageRecord> {
    const { data, error } = await this.supabase
      .from("signal_lineage")
      .select("*")
      .eq("id", lineageId)
      .single();

    if (error || !data) {
      throw new LineageServiceError(
        "LINEAGE_NOT_FOUND",
        `Lineage transition '${lineageId}' not found`,
        { lineageId, supabaseErrorMessage: error?.message }
      );
    }

    return this.mapRowToLineageRecord(data as Record<string, unknown>);
  }

  // ── Private: assertNoDuplicateProposal() ─────────────────────────────────

  /**
   * VAL-8: Guards against duplicate proposals for the same predecessor key,
   * lineage type, and taxonomy version that are still in proposed state
   * (approved_at IS NULL).
   */
  private async assertNoDuplicateProposal(
    predecessorSignalKey: string,
    lineageType: LineageType,
    taxonomyVersion: string
  ): Promise<void> {
    const { data, error } = await this.supabase
      .from("signal_lineage")
      .select("id")
      .eq("predecessor_signal_key", predecessorSignalKey.trim())
      .eq("lineage_type", lineageType)
      .eq("taxonomy_version", taxonomyVersion.trim())
      .is("approved_at", null)
      .limit(1);

    if (error) {
      throw new LineageServiceError(
        "DATABASE_ERROR",
        "Failed to check for duplicate proposals",
        { supabaseErrorMessage: error.message }
      );
    }

    if (data && data.length > 0) {
      throw new LineageServiceError(
        "DUPLICATE_PROPOSAL",
        `A pending proposal already exists for predecessor '${predecessorSignalKey}' with lineage type '${lineageType}' and taxonomy version '${taxonomyVersion}'`,
        { existingLineageId: data[0].id }
      );
    }
  }

  // ── Private: assertNoIncompatibleApprovedLineage() ───────────────────────

  /**
   * VAL-9: Checks that the predecessor does not already have an approved
   * lineage transition of an incompatible type.
   *
   * Incompatibility matrix (Sprint 1 definition):
   * - A signal that already has an approved 'retired_no_successor' lineage
   *   cannot be the predecessor in any new proposal.
   * - A signal that already has an approved 'renamed_to' or 'superseded_by'
   *   lineage cannot be the predecessor for another terminal transition type.
   */
  private async assertNoIncompatibleApprovedLineage(
    predecessorSignalKey: string,
    proposedLineageType: LineageType
  ): Promise<void> {
    const { data, error } = await this.supabase
      .from("signal_lineage")
      .select("id, lineage_type")
      .eq("predecessor_signal_key", predecessorSignalKey.trim())
      .not("approved_at", "is", null)
      .limit(10);

    if (error) {
      throw new LineageServiceError(
        "DATABASE_ERROR",
        "Failed to check for incompatible lineage state",
        { supabaseErrorMessage: error.message }
      );
    }

    const terminalTypes = new Set<LineageType>([
      LINEAGE_TYPE.RETIRED_NO_SUCCESSOR,
      LINEAGE_TYPE.RENAMED_TO,
      LINEAGE_TYPE.SUPERSEDED_BY,
      LINEAGE_TYPE.MERGED_INTO,
    ]);

    if (data && data.length > 0) {
      for (const existing of data) {
        const existingType = existing.lineage_type as LineageType;
        if (terminalTypes.has(existingType)) {
          throw new LineageServiceError(
            "INCOMPATIBLE_LINEAGE_STATE",
            `Predecessor '${predecessorSignalKey}' already has an approved '${existingType}' transition. No further transitions are permitted.`,
            {
              predecessorSignalKey,
              existingLineageType: existingType,
              proposedLineageType,
              existingLineageId: existing.id,
            }
          );
        }
      }
    }
  }

  // ── Private: validateSignalKeys() ───────────────────────────────────────

  /**
   * Calls fn_validate_signal_keys (enhanced, SVC-03) to confirm signal keys
   * exist in intelligence_signal_registry and are in valid lifecycle states.
   */
  private async validateSignalKeys(
    signalKeys: string[],
    taxonomyVersion: string
  ): Promise<{
    validKeys: string[];
    invalidKeys: Array<{ key: string; reason: string }>;
    taxonomyVersionValid: boolean;
  }> {
    const { data, error } = await this.supabase.rpc(
      "fn_validate_signal_keys",
      {
        p_signal_keys:    signalKeys,
        p_taxonomy_version: taxonomyVersion,
        p_operation_type: "proposal",
      }
    );

    if (error) {
      throw new LineageServiceError(
        "DATABASE_ERROR",
        "Signal key validation failed",
        { supabaseErrorMessage: error.message }
      );
    }

    const result = data as {
      valid_keys: string[];
      invalid_keys: Array<{ key: string; reason: string }>;
      taxonomy_version_valid: boolean;
    };

    return {
      validKeys:            result.valid_keys ?? [],
      invalidKeys:          result.invalid_keys ?? [],
      taxonomyVersionValid: result.taxonomy_version_valid ?? false,
    };
  }

  // ── Private: mapRowToLineageRecord() ────────────────────────────────────

  /**
   * Maps a raw signal_lineage database row to a LineageRecord.
   * Used by fetchLineageRowById() and getSuccessorSignals() (direct table reads).
   *
   * LIN-01 Item 1 (A07 v2 Mod 4 — M-01 fix): weightReviewRequired and
   * weightReviewCompletedAt are now always mapped. Eliminates the type lie
   * where TypeScript believed the fields were present on LineageRecord but
   * runtime values were undefined.
   *
   * NOTE: proposedBy is set to empty string because signal_lineage has no
   * proposed_by column. Callers requiring proposedBy must use getLineageSummary()
   * which routes through fn_get_signal_lineage_summary and sources it from the
   * audit log JOIN.
   */
  private mapRowToLineageRecord(row: Record<string, unknown>): LineageRecord {
    return {
      id:                       row.id as string,
      predecessorSignalKey:     row.predecessor_signal_key as string,
      successorSignalKey:       row.successor_signal_key as string | null,
      lineageType:              row.lineage_type as LineageType,
      lineageReason:            row.lineage_reason as string,
      effectiveDate:            new Date(row.effective_date as string),
      taxonomyVersion:          row.taxonomy_version as string,
      // proposed_by is not a column on signal_lineage — empty string sentinel
      proposedBy:               "",
      proposedAt:               new Date(row.proposed_at as string),
      approvedBy:               row.approved_by as string | null,
      approvedAt:               row.approved_at
                                  ? new Date(row.approved_at as string)
                                  : null,
      triggeredByPipelineRunId: row.triggered_by_pipeline_run_id as string | null,
      createdAt:                new Date(row.created_at as string),
      updatedAt:                new Date(row.updated_at as string),
      // M-01 fix: always map weight review fields from DB row
      weightReviewRequired:     row.weight_review_required as boolean,
      weightReviewCompletedAt:  row.weight_review_completed_at
                                  ? new Date(row.weight_review_completed_at as string)
                                  : null,
    };
  }

  // ── Private: mapRpcRowToLineageSummaryRecord() ───────────────────────────

  /**
   * Maps a fn_get_signal_lineage_summary RPC result row to a LineageSummaryRecord.
   * Used exclusively by getLineageSummary().
   *
   * LIN-01A-R2 (C02-C): Renamed from mapRpcRowToLineageRecord(). Return type
   * changed from LineageRecord to LineageSummaryRecord. updatedAt is absent —
   * fn_get_signal_lineage_summary does not project updated_at and it must not
   * be fabricated. No synthetic timestamps. No placeholder values.
   *
   * Column mapping from Sprint 1C RPC output contract:
   *   lineage_id                  → id
   *   predecessor_signal_key      → predecessorSignalKey
   *   successor_signal_key        → successorSignalKey
   *   lineage_type                → lineageType
   *   lineage_reason              → lineageReason
   *   effective_date              → effectiveDate
   *   taxonomy_version            → taxonomyVersion
   *   proposed_by                 → proposedBy  (null if audit record missing)
   *   proposed_at                 → proposedAt  (sl.created_at alias per §3.1)
   *   approved_by                 → approvedBy
   *   approved_at                 → approvedAt
   *   weight_review_required      → weightReviewRequired
   *   weight_review_completed_at  → weightReviewCompletedAt
   *   triggered_by_pipeline_run_id → triggeredByPipelineRunId
   */
  private mapRpcRowToLineageSummaryRecord(
    row: Record<string, unknown>
  ): LineageSummaryRecord {
    return {
      id:                       row.lineage_id as string,
      predecessorSignalKey:     row.predecessor_signal_key as string,
      successorSignalKey:       row.successor_signal_key as string | null,
      lineageType:              row.lineage_type as LineageType,
      lineageReason:            row.lineage_reason as string,
      effectiveDate:            new Date(row.effective_date as string),
      taxonomyVersion:          row.taxonomy_version as string,
      // proposed_by sourced from RPC LEFT JOIN to audit log; null if
      // the lineage_event_proposed audit record is missing (governance gap).
      proposedBy:               (row.proposed_by as string | null) ?? null,
      proposedAt:               new Date(row.proposed_at as string),
      approvedBy:               row.approved_by as string | null,
      approvedAt:               row.approved_at
                                  ? new Date(row.approved_at as string)
                                  : null,
      triggeredByPipelineRunId: row.triggered_by_pipeline_run_id as string | null,
      weightReviewRequired:     row.weight_review_required as boolean,
      weightReviewCompletedAt:  row.weight_review_completed_at
                                  ? new Date(row.weight_review_completed_at as string)
                                  : null,
    };
  }

  // ── Private: mapRpcRowToLineageAuditLogRecord() ──────────────────────────

  /**
   * Maps a fn_get_lineage_audit_log RPC result row to a LineageAuditLogRecord.
   * Used exclusively by getLineageAuditLog().
   */
  private mapRpcRowToLineageAuditLogRecord(
    row: Record<string, unknown>
  ): LineageAuditLogRecord {
    return {
      lineageId:                (row.lineage_id ?? row.id) as string,
      predecessorSignalKey:     row.predecessor_signal_key as string,
      successorSignalKey:       row.successor_signal_key as string | null,
      lineageType:              row.lineage_type as LineageType,
      lineageReason:            row.lineage_reason as string,
      effectiveDate:            new Date(row.effective_date as string),
      taxonomyVersion:          row.taxonomy_version as string,
      approvedBy:               row.approved_by as string | null,
      approvedAt:               new Date(row.approved_at as string),
      weightReviewRequired:     row.weight_review_required as boolean,
      weightReviewCompletedAt:  row.weight_review_completed_at
                                  ? new Date(row.weight_review_completed_at as string)
                                  : null,
      auditEventId:             row.audit_event_id as string | null,
      auditEventCreatedAt:      row.audit_event_created_at
                                  ? new Date(row.audit_event_created_at as string)
                                  : null,
    };
  }

  // ── Private: mapRpcRowToRegistryAuditEventRecord() ───────────────────────

  /**
   * Maps a fn_get_registry_audit_events RPC result row to a RegistryAuditEventRecord.
   * Used exclusively by getRegistryAuditEvents().
   *
   * event_payload is cast to Record<string, unknown> per LIN-01A Item 3 typing
   * requirements. The RPC projects raw JSONB — callers must narrow as required.
   */
  private mapRpcRowToRegistryAuditEventRecord(
    row: Record<string, unknown>
  ): RegistryAuditEventRecord {
    return {
      auditEventId:    row.audit_event_id as string,
      signalKey:       row.signal_key as string,
      eventType:       row.event_type as string,
      // JSONB from RPC — cast to Record<string, unknown>; no any usage
      eventPayload:    (row.event_payload as Record<string, unknown>) ?? {},
      performedBy:     row.performed_by as string,
      taxonomyVersion: row.taxonomy_version as string,
      // RPC aliases performed_at as created_at per Sprint 1C Spec §3.4
      createdAt:       new Date(row.created_at as string),
    };
  }

  // ── Private: isValidUUID() ───────────────────────────────────────────────

  private isValidUUID(value: string): boolean {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value
    );
  }

  // ── Private: formatDate() ────────────────────────────────────────────────

  /** Formats a Date as YYYY-MM-DD for PostgreSQL date columns. */
  private formatDate(date: Date): string {
    return date.toISOString().split("T")[0];
  }
}