/**
 * registry-audit.service.ts
 *
 * HireRise — Phase 2A.1 Sprint 1 — Package G4B
 *
 * Sole owner of all writes to public.signal_registry_audit_log.
 * Provides typed, validated, append-only audit event persistence for all
 * HireRise governance workflows.
 *
 * Architecture basis:
 *   - Phase 2A.1.2 Approved Architecture
 *   - R1 Final Approved Amendment (F1–F5)
 *   - Sprint 1B Security & Service Specification (SVC-02)
 *   - Package G4 Service Layer Architecture Specification
 *   - AMD-07: service_role key server-side only
 *   - AMD-08: service-layer validation before database operations
 *   - SEC-RLS-02: writes succeed with RLS enabled via service_role
 *
 * Database contract (signal_registry_audit_log — 8 columns, F3):
 *   id               uuid          PK, generated
 *   signal_key       text          NOT NULL
 *   event_type       registry_event_type  NOT NULL
 *   event_payload    jsonb         NOT NULL
 *   performed_by     text          NOT NULL
 *   taxonomy_version text          NOT NULL  (F5: plain text, no FK)
 *   lineage_id       uuid          NULLABLE  (F1: governed soft reference — no FK enforced)
 *   created_at       timestamptz   NOT NULL, default now()
 *
 * Security: All operations use the server-side service_role Supabase client.
 * This file must never be imported by any client-side module.
 * AMD-07 compliance is enforced at build configuration level.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 1 — Enum: registry_event_type
// Mirror of public.registry_event_type PostgreSQL enum (M1 — Package G1).
// DO NOT add or remove values without an approved architecture amendment.
// ─────────────────────────────────────────────────────────────────────────────

export const REGISTRY_EVENT_TYPE = {
  SIGNAL_REGISTERED:        "signal_registered",
  SIGNAL_ACTIVATED:         "signal_activated",
  SIGNAL_DEPRECATED:        "signal_deprecated",
  SIGNAL_RETIRED:           "signal_retired",
  LINEAGE_EVENT_PROPOSED:   "lineage_event_proposed",
  LINEAGE_EVENT_APPROVED:   "lineage_event_approved",
  WEIGHT_REVIEW_TRIGGERED:  "weight_review_triggered",
  WEIGHT_REVIEW_COMPLETED:  "weight_review_completed",
  ENGINE_FLAG_CHANGED:      "engine_flag_changed",
  SIGNAL_METADATA_CHANGED:  "signal_metadata_changed",
} as const;

export type RegistryEventType =
  (typeof REGISTRY_EVENT_TYPE)[keyof typeof REGISTRY_EVENT_TYPE];

const ALL_REGISTRY_EVENT_TYPES = new Set<string>(
  Object.values(REGISTRY_EVENT_TYPE)
);

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 2 — Enum: lineage_type
// Mirror of public.lineage_type PostgreSQL enum (M1 — Package G1).
// Used in lineage event payloads only.
// ─────────────────────────────────────────────────────────────────────────────

export const LINEAGE_TYPE = {
  SUCCEEDED_BY:         "succeeded_by",
  SPLIT_INTO:           "split_into",
  MERGED_INTO:          "merged_into",
  RENAMED_TO:           "renamed_to",
  SUPERSEDED_BY:        "superseded_by",
  AGGREGATED_FROM:      "aggregated_from",
  RETIRED_NO_SUCCESSOR: "retired_no_successor",
} as const;

export type LineageType =
  (typeof LINEAGE_TYPE)[keyof typeof LINEAGE_TYPE];

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 3 — Error Types
// ─────────────────────────────────────────────────────────────────────────────

export type RegistryAuditErrorCode =
  | "VALIDATION_ERROR"
  | "INVALID_EVENT_TYPE"
  | "NULL_PAYLOAD"
  | "MISSING_REQUIRED_PAYLOAD_FIELDS"
  | "INVALID_SIGNAL_KEY"
  | "INVALID_PERFORMED_BY"
  | "INVALID_TAXONOMY_VERSION"
  | "INVALID_LINEAGE_ID_FORMAT"
  | "PERSISTENCE_ERROR"
  | "DATABASE_ERROR";

export class RegistryAuditError extends Error {
  public readonly code: RegistryAuditErrorCode;
  public readonly context?: Record<string, unknown>;

  constructor(
    code: RegistryAuditErrorCode,
    message: string,
    context?: Record<string, unknown>
  ) {
    super(message);
    this.name = "RegistryAuditError";
    this.code = code;
    this.context = context;
    // Maintains proper stack trace in V8
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, RegistryAuditError);
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 4 — Input / Output Interfaces
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Base input for any registry audit write.
 * All fields are required unless explicitly noted.
 */
export interface AuditEventInput {
  /** The primary signal key being audited. Must be non-empty. */
  signalKey: string;
  /** The governance event type. Must be a valid RegistryEventType value. */
  eventType: RegistryEventType;
  /**
   * Structured event payload.
   * Must not be null, undefined, or an empty object.
   * Required fields vary by eventType — see validateAuditPayload().
   */
  eventPayload: Record<string, unknown>;
  /** Identity of the actor performing the action. Must be non-empty. */
  performedBy: string;
  /**
   * Taxonomy version at the time of the event.
   * Recorded as plain text (F5). Must be non-empty.
   * Do NOT perform a live taxonomy lookup — record the version as provided.
   */
  taxonomyVersion: string;
  /**
   * Optional governed soft reference to a signal_lineage row (F1).
   * Must be a valid UUID format if provided.
   * No foreign key constraint enforced at database level.
   */
  lineageId?: string | null;
}

/**
 * Returned by all write methods on success.
 * Write methods never throw — they return this result object.
 */
export interface AuditWriteSuccess {
  success: true;
  /** UUID of the newly created signal_registry_audit_log row. */
  auditEventId: string;
}

/**
 * Returned by all write methods on failure.
 * Write methods never throw — they return this result object.
 */
export interface AuditWriteFailure {
  success: false;
  error: {
    code: RegistryAuditErrorCode;
    message: string;
    context?: Record<string, unknown>;
  };
}

export type AuditWriteResult = AuditWriteSuccess | AuditWriteFailure;

/**
 * Input for recordLineageEvent() — extends base with lineage-specific fields.
 */
export interface LineageAuditEventInput {
  /** UUID of the signal_lineage row being recorded. Must be a valid UUID. */
  lineageId: string;
  /**
   * Governance action.
   * 'proposed' → emits LINEAGE_EVENT_PROPOSED.
   * 'approved' → emits LINEAGE_EVENT_APPROVED.
   */
  action: "proposed" | "approved";
  /** The predecessor signal key (the signal being transitioned FROM). */
  predecessorKey: string;
  /** The lineage transition type. */
  lineageType: LineageType;
  /**
   * The successor signal key (the signal being transitioned TO).
   * Null is only valid when lineageType = 'retired_no_successor'.
   */
  successorKey: string | null;
  /** Identity of the actor performing the action. */
  performedBy: string;
  /** Taxonomy version at the time of the event. */
  taxonomyVersion: string;
}

/**
 * Returned by validateAuditPayload().
 */
export interface PayloadValidationResult {
  valid: boolean;
  missingFields: string[];
  invalidFields: string[];
}

/**
 * Input for getAuditCorrelationData().
 */
export interface AuditCorrelationQuery {
  signalKey: string;
  fromDate?: Date;
  toDate?: Date;
  eventType?: RegistryEventType;
}

/**
 * A single row from signal_registry_audit_log, returned by read methods.
 */
export interface AuditCorrelationRecord {
  id: string;
  signalKey: string;
  eventType: RegistryEventType;
  eventPayload: Record<string, unknown>;
  performedBy: string;
  taxonomyVersion: string;
  lineageId: string | null;
  createdAt: Date;
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 5 — Payload Required-Field Matrix
// Canonical definition of required fields per registry_event_type.
// This matrix is the machine-verifiable contract referenced in G4 spec §7.
// ─────────────────────────────────────────────────────────────────────────────

const PAYLOAD_REQUIRED_FIELDS: Record<RegistryEventType, string[]> = {
  signal_registered: [
    "signalKey",
    "signalName",
    "taxonomyVersion",
    "registeredBy",
  ],
  signal_activated: [
    "signalKey",
    "taxonomyVersion",
    "activatedBy",
    "previousStatus",
  ],
  signal_deprecated: [
    "signalKey",
    "taxonomyVersion",
    "deprecatedBy",
    "deprecationReason",
  ],
  signal_retired: [
    "signalKey",
    "taxonomyVersion",
    "retiredBy",
    "retirementReason",
  ],
  lineage_event_proposed: [
    "lineageId",
    "lineageType",
    "predecessorKey",
    "successorKey",  // value may be null for retired_no_successor — but key must be present
    "proposedBy",
    "taxonomyVersion",
    "action",
  ],
  lineage_event_approved: [
    "lineageId",
    "lineageType",
    "predecessorKey",
    "successorKey",
    "approvedBy",
    "taxonomyVersion",
    "action",
  ],
  weight_review_triggered: [
    "signalKey",
    "taxonomyVersion",
    "triggeredBy",
    "reviewReason",
  ],
  weight_review_completed: [
    "signalKey",
    "taxonomyVersion",
    "completedBy",
    "previousWeight",
    "newWeight",
    "reviewOutcome",
  ],
  engine_flag_changed: [
    "signalKey",
    "taxonomyVersion",
    "changedBy",
    "flagName",
    "previousValue",
    "newValue",
  ],
  signal_metadata_changed: [
    "signalKey",
    "taxonomyVersion",
    "changedBy",
    "changedFields",
    "changeReason",
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 6 — UUID Validation Helper
// ─────────────────────────────────────────────────────────────────────────────

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isValidUUID(value: string): boolean {
  return UUID_REGEX.test(value);
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 7 — RegistryAuditService
// ─────────────────────────────────────────────────────────────────────────────

export class RegistryAuditService {
  /**
   * AMD-07: The Supabase client passed here must be initialised with the
   * service_role key server-side only. This constructor does not accept
   * a public/anon key client.
   *
   * Dependency injection: callers provide the client, allowing test doubles
   * to be substituted without module-level mocking.
   */
  constructor(private readonly supabase: SupabaseClient) {}

  // ── Public: recordRegistryEvent() ────────────────────────────────────────

  /**
   * Generic audit event recorder.
   * Validates all inputs and persists one immutable row to
   * signal_registry_audit_log.
   *
   * This method NEVER throws. All failures are returned as
   * AuditWriteResult { success: false }.
   * Callers in lineage.service.ts must check the success field and treat
   * failure as a rollback trigger for the enclosing transaction.
   *
   * Security: uses service_role client (bypasses RLS — F1 soft-reference
   * model, no FK constraint on lineage_id). Defense-in-depth validation
   * runs before any database call (AMD-08).
   */
  async recordRegistryEvent(
    input: AuditEventInput
  ): Promise<AuditWriteResult> {
    // ── AMD-08: all validation before any database call ────────────────────
    const baseValidation = this.validateBaseInput(input);
    if (!baseValidation.valid) {
      return this.failureResult(
        "VALIDATION_ERROR",
        `Base input validation failed: ${baseValidation.missingFields.concat(baseValidation.invalidFields).join(", ")}`,
        { violations: [...baseValidation.missingFields, ...baseValidation.invalidFields] }
      );
    }

    const payloadValidation = this.validateAuditPayload(
      input.eventType,
      input.eventPayload
    );
    if (!payloadValidation.valid) {
      return this.failureResult(
        "MISSING_REQUIRED_PAYLOAD_FIELDS",
        `Payload validation failed for event type '${input.eventType}'`,
        {
          missingFields: payloadValidation.missingFields,
          invalidFields: payloadValidation.invalidFields,
          eventType: input.eventType,
        }
      );
    }

    // ── Persist ────────────────────────────────────────────────────────────
    return this.persistAuditRow(input);
  }

  // ── Public: recordLineageEvent() ─────────────────────────────────────────

  /**
   * Records a lineage governance event (proposed or approved).
   * Constructs the canonical lineage event payload and delegates to
   * recordRegistryEvent().
   *
   * Soft-reference model (F1): lineageId is stored in the lineage_id column
   * and also in event_payload. No FK constraint is enforced at database level.
   *
   * This method NEVER throws.
   */
  async recordLineageEvent(
    input: LineageAuditEventInput
  ): Promise<AuditWriteResult> {
    // ── AMD-08: validate lineage-specific inputs before any DB call ────────
    if (!input.lineageId || !isValidUUID(input.lineageId)) {
      return this.failureResult(
        "INVALID_LINEAGE_ID_FORMAT",
        "lineageId must be a valid UUID",
        { lineageId: input.lineageId }
      );
    }
    if (!input.predecessorKey || input.predecessorKey.trim().length === 0) {
      return this.failureResult(
        "INVALID_SIGNAL_KEY",
        "predecessorKey must be non-empty"
      );
    }
    if (
      input.lineageType !== LINEAGE_TYPE.RETIRED_NO_SUCCESSOR &&
      (input.successorKey === null || input.successorKey.trim().length === 0)
    ) {
      return this.failureResult(
        "VALIDATION_ERROR",
        "successorKey must be non-empty unless lineageType is 'retired_no_successor'"
      );
    }
    if (!input.performedBy || input.performedBy.trim().length === 0) {
      return this.failureResult(
        "INVALID_PERFORMED_BY",
        "performedBy must be non-empty"
      );
    }
    if (!input.taxonomyVersion || input.taxonomyVersion.trim().length === 0) {
      return this.failureResult(
        "INVALID_TAXONOMY_VERSION",
        "taxonomyVersion must be non-empty"
      );
    }

    const eventType: RegistryEventType =
      input.action === "proposed"
        ? REGISTRY_EVENT_TYPE.LINEAGE_EVENT_PROPOSED
        : REGISTRY_EVENT_TYPE.LINEAGE_EVENT_APPROVED;

    // Construct canonical lineage event payload
    const performedByKey =
      input.action === "proposed" ? "proposedBy" : "approvedBy";

    const eventPayload: Record<string, unknown> = {
      lineageId:      input.lineageId,
      lineageType:    input.lineageType,
      predecessorKey: input.predecessorKey,
      successorKey:   input.successorKey,
      taxonomyVersion: input.taxonomyVersion,
      action:         input.action,
      [performedByKey]: input.performedBy,
    };

    return this.recordRegistryEvent({
      signalKey:       input.predecessorKey,
      eventType,
      eventPayload,
      performedBy:     input.performedBy,
      taxonomyVersion: input.taxonomyVersion,
      lineageId:       input.lineageId,
    });
  }

  // ── Public: validateAuditPayload() ───────────────────────────────────────

  /**
   * Validates a proposed event_payload against the required-field matrix
   * for the given eventType.
   *
   * Returns a PayloadValidationResult — never throws.
   * Used internally by recordRegistryEvent() and may be called externally
   * for pre-flight validation.
   */
  validateAuditPayload(
    eventType: RegistryEventType,
    payload: Record<string, unknown>
  ): PayloadValidationResult {
    const result: PayloadValidationResult = {
      valid: true,
      missingFields: [],
      invalidFields: [],
    };

    // Guard: null/undefined payload
    if (payload === null || payload === undefined) {
      return { valid: false, missingFields: ["(payload is null)"], invalidFields: [] };
    }

    // Guard: empty payload object
    if (Object.keys(payload).length === 0) {
      return { valid: false, missingFields: ["(payload is empty object)"], invalidFields: [] };
    }

    const requiredFields = PAYLOAD_REQUIRED_FIELDS[eventType];
    if (!requiredFields) {
      // Should never occur — eventType is validated upstream in recordRegistryEvent()
      return { valid: false, missingFields: [], invalidFields: ["(unknown eventType)"] };
    }

    for (const field of requiredFields) {
      if (!(field in payload)) {
        result.missingFields.push(field);
      }
    }

    // Field-level type checks for specific known types
    if ("changedFields" in payload && !Array.isArray(payload.changedFields)) {
      result.invalidFields.push("changedFields (must be an array)");
    }

    if (result.missingFields.length > 0 || result.invalidFields.length > 0) {
      result.valid = false;
    }

    return result;
  }

  // ── Public: getAuditCorrelationData() ────────────────────────────────────

  /**
   * Retrieves audit events for a signal key with optional date range and
   * event type filters.
   *
   * Read-only — no writes. No audit event emitted for reads.
   *
   * Unlike write methods, this method THROWS on DATABASE_ERROR because
   * read failures cannot be compensated by the caller transactionally.
   *
   * Security: uses service_role client. Callers are responsible for
   * ensuring this method is only invoked from server-side contexts.
   */
  async getAuditCorrelationData(
    query: AuditCorrelationQuery
  ): Promise<AuditCorrelationRecord[]> {
    if (!query.signalKey || query.signalKey.trim().length === 0) {
      throw new RegistryAuditError(
        "INVALID_SIGNAL_KEY",
        "signalKey must be non-empty for audit correlation query"
      );
    }

    if (query.fromDate && query.toDate && query.fromDate > query.toDate) {
      throw new RegistryAuditError(
        "VALIDATION_ERROR",
        "fromDate must be less than or equal to toDate",
        {
          fromDate: query.fromDate.toISOString(),
          toDate: query.toDate.toISOString(),
        }
      );
    }

    if (query.eventType && !ALL_REGISTRY_EVENT_TYPES.has(query.eventType)) {
      throw new RegistryAuditError(
        "INVALID_EVENT_TYPE",
        `Invalid event type filter: '${query.eventType}'`,
        { eventType: query.eventType }
      );
    }

    // Build parameterised query — no string concatenation
    let dbQuery = this.supabase
      .from("signal_registry_audit_log")
      .select("id, signal_key, event_type, event_payload, performed_by, taxonomy_version, lineage_id, created_at")
      .eq("signal_key", query.signalKey)
      .order("created_at", { ascending: true });

    if (query.eventType) {
      dbQuery = dbQuery.eq("event_type", query.eventType);
    }
    if (query.fromDate) {
      // Inclusive lower bound
      dbQuery = dbQuery.gte("created_at", query.fromDate.toISOString());
    }
    if (query.toDate) {
      // Inclusive upper bound (toDate is end-of-day inclusive)
      dbQuery = dbQuery.lte("created_at", query.toDate.toISOString());
    }

    const { data, error } = await dbQuery;

    if (error) {
      throw new RegistryAuditError(
        "DATABASE_ERROR",
        "Failed to retrieve audit correlation data",
        { supabaseErrorMessage: error.message, signalKey: query.signalKey }
      );
    }

    return (data ?? []).map((row) => ({
      id:              row.id as string,
      signalKey:       row.signal_key as string,
      eventType:       row.event_type as RegistryEventType,
      eventPayload:    row.event_payload as Record<string, unknown>,
      performedBy:     row.performed_by as string,
      taxonomyVersion: row.taxonomy_version as string,
      lineageId:       row.lineage_id as string | null,
      createdAt:       new Date(row.created_at as string),
    }));
  }

  // ── Event-specific recording methods ────────────────────────────────────
  // Thin wrappers over recordRegistryEvent() that enforce event-type-specific
  // payload shapes. Each maps to exactly one registry_event_type value.

  async recordSignalRegistered(params: {
    signalKey: string;
    signalName: string;
    taxonomyVersion: string;
    registeredBy: string;
    additionalPayload?: Record<string, unknown>;
  }): Promise<AuditWriteResult> {
    return this.recordRegistryEvent({
      signalKey:       params.signalKey,
      eventType:       REGISTRY_EVENT_TYPE.SIGNAL_REGISTERED,
      eventPayload:    {
        signalKey:       params.signalKey,
        signalName:      params.signalName,
        taxonomyVersion: params.taxonomyVersion,
        registeredBy:    params.registeredBy,
        ...params.additionalPayload,
      },
      performedBy:     params.registeredBy,
      taxonomyVersion: params.taxonomyVersion,
    });
  }

  async recordSignalActivated(params: {
    signalKey: string;
    taxonomyVersion: string;
    activatedBy: string;
    previousStatus: string;
    additionalPayload?: Record<string, unknown>;
  }): Promise<AuditWriteResult> {
    return this.recordRegistryEvent({
      signalKey:       params.signalKey,
      eventType:       REGISTRY_EVENT_TYPE.SIGNAL_ACTIVATED,
      eventPayload:    {
        signalKey:       params.signalKey,
        taxonomyVersion: params.taxonomyVersion,
        activatedBy:     params.activatedBy,
        previousStatus:  params.previousStatus,
        ...params.additionalPayload,
      },
      performedBy:     params.activatedBy,
      taxonomyVersion: params.taxonomyVersion,
    });
  }

  async recordSignalDeprecated(params: {
    signalKey: string;
    taxonomyVersion: string;
    deprecatedBy: string;
    deprecationReason: string;
    additionalPayload?: Record<string, unknown>;
  }): Promise<AuditWriteResult> {
    return this.recordRegistryEvent({
      signalKey:       params.signalKey,
      eventType:       REGISTRY_EVENT_TYPE.SIGNAL_DEPRECATED,
      eventPayload:    {
        signalKey:          params.signalKey,
        taxonomyVersion:    params.taxonomyVersion,
        deprecatedBy:       params.deprecatedBy,
        deprecationReason:  params.deprecationReason,
        ...params.additionalPayload,
      },
      performedBy:     params.deprecatedBy,
      taxonomyVersion: params.taxonomyVersion,
    });
  }

  async recordSignalRetired(params: {
    signalKey: string;
    taxonomyVersion: string;
    retiredBy: string;
    retirementReason: string;
    lineageId?: string | null;
    additionalPayload?: Record<string, unknown>;
  }): Promise<AuditWriteResult> {
    return this.recordRegistryEvent({
      signalKey:       params.signalKey,
      eventType:       REGISTRY_EVENT_TYPE.SIGNAL_RETIRED,
      eventPayload:    {
        signalKey:        params.signalKey,
        taxonomyVersion:  params.taxonomyVersion,
        retiredBy:        params.retiredBy,
        retirementReason: params.retirementReason,
        ...(params.lineageId ? { lineageId: params.lineageId } : {}),
        ...params.additionalPayload,
      },
      performedBy:     params.retiredBy,
      taxonomyVersion: params.taxonomyVersion,
      lineageId:       params.lineageId ?? null,
    });
  }

  async recordLineageProposed(params: {
    lineageId: string;
    predecessorKey: string;
    lineageType: LineageType;
    successorKey: string | null;
    proposedBy: string;
    taxonomyVersion: string;
  }): Promise<AuditWriteResult> {
    return this.recordLineageEvent({
      lineageId:      params.lineageId,
      action:         "proposed",
      predecessorKey: params.predecessorKey,
      lineageType:    params.lineageType,
      successorKey:   params.successorKey,
      performedBy:    params.proposedBy,
      taxonomyVersion: params.taxonomyVersion,
    });
  }

  async recordLineageApproved(params: {
    lineageId: string;
    predecessorKey: string;
    lineageType: LineageType;
    successorKey: string | null;
    approvedBy: string;
    taxonomyVersion: string;
  }): Promise<AuditWriteResult> {
    return this.recordLineageEvent({
      lineageId:      params.lineageId,
      action:         "approved",
      predecessorKey: params.predecessorKey,
      lineageType:    params.lineageType,
      successorKey:   params.successorKey,
      performedBy:    params.approvedBy,
      taxonomyVersion: params.taxonomyVersion,
    });
  }

  async recordWeightReviewTriggered(params: {
    signalKey: string;
    taxonomyVersion: string;
    triggeredBy: string;
    reviewReason: string;
    currentWeight?: number;
    additionalPayload?: Record<string, unknown>;
  }): Promise<AuditWriteResult> {
    return this.recordRegistryEvent({
      signalKey:       params.signalKey,
      eventType:       REGISTRY_EVENT_TYPE.WEIGHT_REVIEW_TRIGGERED,
      eventPayload:    {
        signalKey:      params.signalKey,
        taxonomyVersion: params.taxonomyVersion,
        triggeredBy:    params.triggeredBy,
        reviewReason:   params.reviewReason,
        ...(params.currentWeight !== undefined
          ? { currentWeight: params.currentWeight }
          : {}),
        ...params.additionalPayload,
      },
      performedBy:     params.triggeredBy,
      taxonomyVersion: params.taxonomyVersion,
    });
  }

  async recordWeightReviewCompleted(params: {
    signalKey: string;
    taxonomyVersion: string;
    completedBy: string;
    previousWeight: number;
    newWeight: number;
    reviewOutcome: string;
    additionalPayload?: Record<string, unknown>;
  }): Promise<AuditWriteResult> {
    return this.recordRegistryEvent({
      signalKey:       params.signalKey,
      eventType:       REGISTRY_EVENT_TYPE.WEIGHT_REVIEW_COMPLETED,
      eventPayload:    {
        signalKey:       params.signalKey,
        taxonomyVersion: params.taxonomyVersion,
        completedBy:     params.completedBy,
        previousWeight:  params.previousWeight,
        newWeight:       params.newWeight,
        reviewOutcome:   params.reviewOutcome,
        ...params.additionalPayload,
      },
      performedBy:     params.completedBy,
      taxonomyVersion: params.taxonomyVersion,
    });
  }

  async recordEngineFlagChanged(params: {
    signalKey: string;
    taxonomyVersion: string;
    changedBy: string;
    flagName: string;
    previousValue: unknown;
    newValue: unknown;
    additionalPayload?: Record<string, unknown>;
  }): Promise<AuditWriteResult> {
    return this.recordRegistryEvent({
      signalKey:       params.signalKey,
      eventType:       REGISTRY_EVENT_TYPE.ENGINE_FLAG_CHANGED,
      eventPayload:    {
        signalKey:       params.signalKey,
        taxonomyVersion: params.taxonomyVersion,
        changedBy:       params.changedBy,
        flagName:        params.flagName,
        previousValue:   params.previousValue,
        newValue:        params.newValue,
        ...params.additionalPayload,
      },
      performedBy:     params.changedBy,
      taxonomyVersion: params.taxonomyVersion,
    });
  }

  async recordSignalMetadataChanged(params: {
    signalKey: string;
    taxonomyVersion: string;
    changedBy: string;
    changedFields: string[];
    changeReason: string;
    lineageId?: string | null;
    additionalPayload?: Record<string, unknown>;
  }): Promise<AuditWriteResult> {
    return this.recordRegistryEvent({
      signalKey:       params.signalKey,
      eventType:       REGISTRY_EVENT_TYPE.SIGNAL_METADATA_CHANGED,
      eventPayload:    {
        signalKey:       params.signalKey,
        taxonomyVersion: params.taxonomyVersion,
        changedBy:       params.changedBy,
        changedFields:   params.changedFields,
        changeReason:    params.changeReason,
        ...(params.lineageId ? { lineageId: params.lineageId } : {}),
        ...params.additionalPayload,
      },
      performedBy:     params.changedBy,
      taxonomyVersion: params.taxonomyVersion,
      lineageId:       params.lineageId ?? null,
    });
  }

  // ── Private: validateBaseInput() ─────────────────────────────────────────

  /**
   * Validates the common fields present in every AuditEventInput.
   * Returns a PayloadValidationResult for consistent error aggregation.
   * AMD-08: runs before any database call.
   */
  private validateBaseInput(input: AuditEventInput): PayloadValidationResult {
    const missing: string[] = [];
    const invalid: string[] = [];

    if (!input.signalKey || input.signalKey.trim().length === 0) {
      missing.push("signalKey");
    }
    if (!input.eventType) {
      missing.push("eventType");
    } else if (!ALL_REGISTRY_EVENT_TYPES.has(input.eventType)) {
      invalid.push(`eventType ('${input.eventType}' is not a valid registry_event_type)`);
    }
    if (input.eventPayload === null || input.eventPayload === undefined) {
      missing.push("eventPayload");
    }
    if (!input.performedBy || input.performedBy.trim().length === 0) {
      missing.push("performedBy");
    }
    if (!input.taxonomyVersion || input.taxonomyVersion.trim().length === 0) {
      missing.push("taxonomyVersion");
    }
    if (input.lineageId !== undefined && input.lineageId !== null) {
      if (!isValidUUID(input.lineageId)) {
        invalid.push(`lineageId ('${input.lineageId}' is not a valid UUID)`);
      }
    }

    return {
      valid: missing.length === 0 && invalid.length === 0,
      missingFields: missing,
      invalidFields: invalid,
    };
  }

  // ── Private: persistAuditRow() ────────────────────────────────────────────

  /**
   * Executes the database INSERT to signal_registry_audit_log.
   * All validation must have passed before this method is called.
   * Returns AuditWriteResult — never throws.
   *
   * The insert uses the service_role client which bypasses RLS (SEC-RLS-02).
   * Defense-in-depth validation has already run (AMD-08).
   *
   * No UPDATE or DELETE is ever issued — append-only contract (F2/immutability).
   */
  private async persistAuditRow(
    input: AuditEventInput
  ): Promise<AuditWriteResult> {
    const insertPayload: Record<string, unknown> = {
      signal_key:       input.signalKey.trim(),
      event_type:       input.eventType,
      event_payload:    input.eventPayload,
      performed_by:     input.performedBy.trim(),
      taxonomy_version: input.taxonomyVersion.trim(),
      // F1: lineage_id is a governed soft reference — may be null
      lineage_id:       input.lineageId ?? null,
    };

    const { data, error } = await this.supabase
      .from("signal_registry_audit_log")
      .insert(insertPayload)
      .select("id")
      .single();

    if (error || !data) {
      return this.failureResult(
        "PERSISTENCE_ERROR",
        "Failed to persist audit event to signal_registry_audit_log",
        {
          supabaseErrorMessage: error?.message,
          signalKey: input.signalKey,
          eventType: input.eventType,
        }
      );
    }

    return {
      success: true,
      auditEventId: data.id as string,
    };
  }

  // ── Private: failureResult() ─────────────────────────────────────────────

  private failureResult(
    code: RegistryAuditErrorCode,
    message: string,
    context?: Record<string, unknown>
  ): AuditWriteFailure {
    return {
      success: false,
      error: { code, message, context },
    };
  }
}
