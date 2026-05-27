/**
 * @file lib/analytics.ts
 * @description Centralized analytics primitives for the HireRise SaaS platform.
 *
 * PHASE 0 HARDENING — SaaS Maturity Layer (Pre-Implementation)
 *
 * Changes in this revision:
 *  1. EVENT VERSIONING
 *     - Internal EventEnvelope wraps every dispatched payload.
 *     - ANALYTICS_SCHEMA_VERSION is the single controlled constant.
 *     - Version is injected inside dispatch — NEVER at call sites.
 *     - AnalyticsEvent public type is unchanged — no call-site breakage.
 *
 *  2. SESSION + FLOW CONTEXT INJECTION
 *     - Every envelope carries sessionId + flowId when set via AppContext.
 *     - Injected at dispatch time, not at call sites.
 *     - setAnalyticsSession / setAnalyticsFlow called once by AppContext.
 *
 *  3. FUNNEL DUAL-SYSTEM CONTRACT
 *     - sessionStorage = UI correctness layer (survives reload/retry).
 *     - Analytics dispatch = source of truth for attribution.
 *     - Contract: start / complete / drop — each fires exactly once.
 *     - FunnelAnalyticsContract exported for hooks layer consumption.
 *
 * ARCHITECTURE (unchanged):
 *  API → Hooks → UI → Pages → Guards → Context
 *  Pure lib module — no React, no hooks, no side-effects on import.
 *
 * ADAPTER PATTERN:
 *  dispatch() is the single egress point. Swap providers by replacing
 *  only the adapter block inside dispatch(). All call-sites are untouched.
 */

// ─────────────────────────────────────────────────────────────────────────────
// VERSIONING — centrally controlled, never passed from call sites
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Schema version for all outbound analytics envelopes.
 *
 * Increment this when the envelope shape or EventMap types change in a way
 * that would break downstream consumers (dashboards, pipelines, exports).
 *
 * Convention: YYYY.minor — e.g. "2025.1", "2025.2"
 * DO NOT pass this from call sites. It is injected by dispatch() automatically.
 */
const ANALYTICS_SCHEMA_VERSION = '2025.1' as const;

// ─────────────────────────────────────────────────────────────────────────────
// EVENT MAP — typed schema. All trackEvent calls must match a key here.
// ─────────────────────────────────────────────────────────────────────────────

export interface EventMap {
  // ── Resume ──────────────────────────────────────────────────────────────────
  resume_file_selected:       { file_size_kb: number; file_type?: string };
  resume_upload_started:      { file_size_kb: number };
  resume_upload_success:      Record<string, never>;
  resume_upload_failed:       Record<string, never>;
  resume_processing_started:  Record<string, never>;
  resume_processing_done:     { attempts: number };
  resume_processing_failed:   { errorCode?: string };
  resume_polling_timeout:     { attempts: number };
  // ── Onboarding ──────────────────────────────────────────────────────────────
  onboarding_started:         { variant: 'student' | 'professional' };
  onboarding_step_saved:      { step: string };
  onboarding_step_error:      { step: string; errorCode?: string };
  onboarding_completed:       { variant: 'student' | 'professional'; durationMs?: number };
  // ── Direction ───────────────────────────────────────────────────────────────
  direction_page_viewed:      Record<string, never>;
  direction_selected:         { direction: 'education' | 'career' | 'market' };
  // ── Dashboard ───────────────────────────────────────────────────────────────
  dashboard_viewed:           Record<string, never>;
  dashboard_rescore_clicked:  Record<string, never>;
  dashboard_widget_error:     { widget: string };
  chi_missing_requirement_cta_clicked: { requirement: string; route: string };
  // ── Quota ────────────────────────────────────────────────────────────────────
  quota_banner_shown:         { source?: string };
  quota_modal_shown:          { source?: string; widget?: string };
  quota_upgrade_clicked:      { source?: string };
  // ── Feature Flag Exposure ────────────────────────────────────────────────────
  flag_exposure:              { flag: string; variant: string; sessionId?: string };
  // ── Generic page view ────────────────────────────────────────────────────────
  page_viewed:                { page: string };
  // ── Action dispatcher outcomes ───────────────────────────────────────────────
  // FIX TS2345: trackEvent('action.failed') and trackEvent('action.executed')
  // are called by actionDispatcher.ts but these keys were absent from EventMap.
  // Added here with the exact payload shapes used at the call sites.
  // No call-site changes required — the keys now resolve correctly.
  'action.failed': {
    action_id:   string;
    action_type: string;
    target:      string;
    severity:    string;
    reason:      string;
  };
  'action.executed': {
    action_id:   string;
    action_type: string;
    target:      string;
    severity:    string;
    attempts:    number;
  };
  // ── Integration observability ────────────────────────────────────────────────
  'metrics.integration.health': {
    sources:          Record<string, boolean>;
    partial:          boolean;
    source:           string;
    /** Execution mode at resolution time. Internal — never forwarded to UI. */
    mode?:            'single' | 'hybrid' | 'mock';
    /**
     * True when the adapter determined alerts should be suppressed (e.g. mock mode).
     *
     * WHY keep suppress_alerts AND add alert_policy?
     *   suppress_alerts (boolean) is the original field. Existing dashboard queries,
     *   alert rules, and data-export pipelines filter on suppress_alerts === true.
     *   Removing or renaming it would silently break those consumers — a boolean
     *   field cannot be versioned away once it is in a live event schema.
     *   It MUST remain in every payload permanently.
     *
     *   alert_policy ('suppress' | 'allow') is the forward-compatible successor.
     *   It maps 1:1 to suppress_alerts today, but the string union can grow new
     *   states ('throttle', 'escalate', etc.) without touching any boolean consumer.
     *   New internal code should read alert_policy; legacy consumers read suppress_alerts.
     *
     *   DO NOT "simplify" by removing suppress_alerts — that silently breaks
     *   production alert rules. Both fields are intentional and load-bearing.
     */
    suppress_alerts?: boolean;
    /**
     * Forward-compatible typed alert policy derived from _meta.
     * See AlertPolicy + getAlertPolicy() in metaHelpers.ts for the extension contract.
     * Prefer this field over suppress_alerts for all new code paths.
     */
    alert_policy?:    'suppress' | 'allow';
  };
}

export type EventName = keyof EventMap;

/** Fields automatically appended by useAnalytics hook enrichment. */
export interface UserEnrichment {
  user_type?:           string | null;
  onboarding_complete?: boolean;
  resume_uploaded?:     boolean;
  tier?:                string;
}

// ─────────────────────────────────────────────────────────────────────────────
// EVENT ENVELOPE — discriminated union; payload type enforced per _type
//
// Each _type variant carries a strictly-typed payload, enforced at compile
// time via TypeScript discriminated unions. dispatch() is overloaded to
// select the correct variant per call. Call sites are unaware of the envelope.
// ─────────────────────────────────────────────────────────────────────────────

/** Shared header fields injected on every envelope variant. */
interface EnvelopeBase {
  _v:    typeof ANALYTICS_SCHEMA_VERSION;
  _ts:   number;
  _sid?: string;
  _fid?: string;
}

/** _type === 'event': payload must be a valid AnalyticsEvent. */
interface EventEnvelopeEvent extends EnvelopeBase {
  _type:   'event';
  payload: AnalyticsEvent;
}

/** _type === 'page': payload must include { page: string } + timestamp. */
interface EventEnvelopePage extends EnvelopeBase {
  _type:   'page';
  payload: PageViewEvent;
}

/**
 * _type === 'funnel': payload must be a FunnelStepEvent.
 * FunnelStepEvent carries funnel, step, status (started|completed|dropped|error).
 */
interface EventEnvelopeFunnel extends EnvelopeBase {
  _type:   'funnel';
  payload: FunnelStepEvent;
}

/** Discriminated union — payload type is exact and enforced per _type. */
type EventEnvelope =
  | EventEnvelopeEvent
  | EventEnvelopePage
  | EventEnvelopeFunnel;

// ─────────────────────────────────────────────────────────────────────────────
// SESSION + FLOW CONTEXT — injected by AppContext, never by call sites
//
// AppContext calls setAnalyticsSession(sessionId) once after generating the
// sessionId. It calls setAnalyticsFlow / clearAnalyticsFlow around major flows.
// All values are module-level so they are available synchronously to dispatch().
// ─────────────────────────────────────────────────────────────────────────────

let _sessionId: string | undefined = undefined;
let _flowId:    string | undefined = undefined;

/**
 * Called once by AppContext after sessionId is generated.
 * Must NOT be called from pages, hooks, or UI layer.
 */
export function setAnalyticsSession(sessionId: string): void {
  _sessionId = sessionId;
}

/**
 * Called by AppContext when a major flow begins (onboarding, resume upload, etc.).
 * Must NOT be called from pages, hooks, or UI layer.
 */
export function setAnalyticsFlow(flowId: string): void {
  _flowId = flowId;
}

/**
 * Called by AppContext when a major flow ends or is abandoned.
 * Must NOT be called from pages, hooks, or UI layer.
 */
export function clearAnalyticsFlow(): void {
  _flowId = undefined;
}

// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC TYPES — call sites use these; envelope is internal
// ─────────────────────────────────────────────────────────────────────────────

/** A fully-typed analytics event payload (as seen by call sites). */
export interface AnalyticsEvent<K extends EventName = EventName> {
  name:      K;
  props:     EventMap[K] & UserEnrichment;
  timestamp: number;
}

export interface PageViewEvent {
  page:      string;
  referrer?: string;
  timestamp: number;
}

export type FunnelStatus = 'started' | 'completed' | 'dropped' | 'error';

export interface FunnelStepEvent {
  funnel:     string;
  step:       string;
  status:     FunnelStatus;
  metadata?:  Record<string, unknown>;
  timestamp:  number;
}

// ─────────────────────────────────────────────────────────────────────────────
// IDEMPOTENCY — prevents duplicate events during retries / remounts
// ─────────────────────────────────────────────────────────────────────────────

const _firedKeys = new Set<string>();

export function hasBeenFired(key: string): boolean {
  return _firedKeys.has(key);
}

export function markFired(key: string): void {
  _firedKeys.add(key);
}

export function clearIdempotencyKey(key: string): void {
  _firedKeys.delete(key);
}

export function clearIdempotencyPrefix(prefix: string): void {
  // Snapshot keys first — mutating a Set while iterating it is spec-legal
  // but is a known footgun (newly-added keys during iteration get visited).
  // Collect matches into an array, then delete in a separate pass.
  const toDelete: string[] = [];
  for (const key of _firedKeys) {
    if (key.startsWith(prefix)) toDelete.push(key);
  }
  for (const key of toDelete) {
    _firedKeys.delete(key);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// FUNNEL SESSION — UI correctness layer (sessionStorage)
//
// Dual-system design:
//  sessionStorage  → UI state machine (survives reload, drives guard logic)
//  analytics events → source of truth for funnel attribution and drop analysis
//
// Contract per funnel:
//  start()    → fires 'started' analytics event + writes 'started' to storage
//  complete() → fires 'completed' analytics event + writes 'terminal' to storage
//  drop()     → fires 'dropped' analytics event + writes 'terminal' to storage
//  error()    → fires 'error' analytics event + writes 'terminal' to storage
//
// error() is terminal — identical guard rules to complete/drop:
//  - cannot fire before start
//  - cannot fire twice
//  - allows retry via resetFunnel()
//
// Each status fires at most ONCE per funnel (guarded by guardFunnelTransition).
// The analytics event IS the canonical record. sessionStorage is UI scaffolding.
// ─────────────────────────────────────────────────────────────────────────────

type FunnelState = 'started' | 'terminal';
const FUNNEL_SESSION_KEY = '__hr_funnels';

function readFunnelSessions(): Record<string, FunnelState> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = sessionStorage.getItem(FUNNEL_SESSION_KEY);
    return raw ? (JSON.parse(raw) as Record<string, FunnelState>) : {};
  } catch {
    return {};
  }
}

function writeFunnelSessions(sessions: Record<string, FunnelState>): void {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.setItem(FUNNEL_SESSION_KEY, JSON.stringify(sessions));
  } catch {
    // sessionStorage full or unavailable — degrade gracefully
  }
}

/**
 * Validate and record a funnel state transition.
 * Returns false if the transition is illegal (caller should skip dispatch).
 *
 * sessionStorage is the UI source of truth for guard checks.
 * Analytics dispatch is the attribution source of truth for completeness.
 */
function guardFunnelTransition(funnel: string, status: FunnelStatus): boolean {
  const sessions = readFunnelSessions();
  const current  = sessions[funnel];

  if (status === 'started') {
    sessions[funnel] = 'started';
    writeFunnelSessions(sessions);
    return true;
  }

  if (!current) {
    if (process.env.NODE_ENV === 'development') {
      console.warn(`[Analytics] Funnel "${funnel}" reached "${status}" without prior "started". Skipping.`);
    }
    return false;
  }

  if (current === 'terminal') {
    if (process.env.NODE_ENV === 'development') {
      console.warn(`[Analytics] Funnel "${funnel}" already terminal. Duplicate "${status}" skipped.`);
    }
    return false;
  }

  sessions[funnel] = 'terminal';
  writeFunnelSessions(sessions);
  return true;
}

export function resetFunnel(funnel: string): void {
  // [FIX 1] Clear BOTH layers so the next start() → terminal sequence is clean:
  //  1. In-process Set — allows funnelContract.complete/error to fire again
  //  2. sessionStorage — allows guardFunnelTransition to allow the next terminal
  _closedFunnels.delete(funnel);
  const sessions = readFunnelSessions();
  delete sessions[funnel];
  writeFunnelSessions(sessions);
}

// ─────────────────────────────────────────────────────────────────────────────
// FUNNEL ANALYTICS CONTRACT — exported surface for hooks layer
//
// Provides a typed, intent-clear API for the three canonical funnel
// transitions. Each method handles both the sessionStorage guard and
// the analytics dispatch atomically — they cannot diverge.
// ─────────────────────────────────────────────────────────────────────────────

export interface FunnelAnalyticsContract {
  /** Mark funnel as started. Survives reload. Safe to call on retry. */
  start(funnel: string, step: string, metadata?: Record<string, unknown>): void;
  /** Mark funnel as successfully completed. Fires once per funnel. */
  complete(funnel: string, step: string, metadata?: Record<string, unknown>): void;
  /** Mark funnel as dropped / abandoned. Fires once per funnel. */
  drop(funnel: string, step: string, metadata?: Record<string, unknown>): void;
  /**
   * Mark funnel as errored. Terminal state — same guard rules as complete/drop.
   * Use for unrecoverable failures (API errors, quota exhaustion, timeout).
   * To retry after error, call resetFunnel(name) first then start() again.
   *
   * @param reason - Machine-readable error reason (e.g. 'api_500', 'quota_exceeded')
   */
  error(funnel: string, reason: string, metadata?: Record<string, unknown>): void;
}

/**
 * The canonical funnel contract implementation.
 *
 * Both layers (sessionStorage + analytics) are written atomically per call.
 * Import this in hooks that orchestrate funnel flows.
 *
 * @example
 * import { funnelContract } from '@/lib/analytics';
 * funnelContract.start('resume_upload', 'file_selected');
 * funnelContract.complete('resume_upload', 'processing_done', { attempts: 3 });
 */
// ── IN-PROCESS FUNNEL CLOSE GUARD ────────────────────────────────────────────
// Dual-layer protection against double-terminal:
//
//  Layer 1 (this Set): in-process guard — zero I/O, synchronous.
//   Catches races within the same JS execution context where two async
//   branches both read 'started' from sessionStorage before either has
//   written 'terminal'. Example: a polling tick resolves 'done' at the same
//   moment the timeout branch fires — both see 'started' in storage, both
//   would dispatch a terminal event without this guard.
//
//  Layer 2 (guardFunnelTransition): sessionStorage guard — survives reload.
//   Catches duplicates across page reloads and effect re-runs (StrictMode).
//
// resetFunnel() clears BOTH layers so retry flows get a clean slate.
//
// This Set is module-scoped (singleton per page load) — intentional.
// It lives alongside the sessionStorage keys it mirrors.
const _closedFunnels = new Set<string>();

export const funnelContract: FunnelAnalyticsContract = {
  start(funnel, step, metadata) {
    // [FIX] Clear in-process closed-funnel entry BEFORE any guard or dispatch.
    // Ensures: (1) retry flows start cleanly without requiring a manual
    // resetFunnel() call at every call site, and (2) no memory growth from
    // stale entries accumulating across long sessions where the same funnel
    // is started many times. The sessionStorage guard is unchanged.
    _closedFunnels.delete(funnel);
    trackFunnelStep(funnel, step, 'started', metadata);
  },
  complete(funnel, step, metadata) {
    // [FIX 1] In-process guard — blocks duplicate terminal within same frame.
    // guardFunnelTransition (sessionStorage) is the second layer.
    if (_closedFunnels.has(funnel)) {
      if (process.env.NODE_ENV === 'development') {
        console.warn(`[Analytics] funnelContract.complete("${funnel}") blocked — already closed in this session.`);
      }
      return;
    }
    _closedFunnels.add(funnel);
    trackFunnelStep(funnel, step, 'completed', metadata);
  },
  drop(funnel, step, metadata) {
    // [FIX 1] Same in-process guard as complete().
    if (_closedFunnels.has(funnel)) {
      if (process.env.NODE_ENV === 'development') {
        console.warn(`[Analytics] funnelContract.drop("${funnel}") blocked — already closed in this session.`);
      }
      return;
    }
    _closedFunnels.add(funnel);
    trackFunnelStep(funnel, step, 'dropped', metadata);
  },
  error(funnel, reason, metadata) {
    // [FIX 1] Same in-process guard as complete().
    if (_closedFunnels.has(funnel)) {
      if (process.env.NODE_ENV === 'development') {
        console.warn(`[Analytics] funnelContract.error("${funnel}", "${reason}") blocked — already closed in this session.`);
      }
      return;
    }
    _closedFunnels.add(funnel);
    // reason is merged into metadata so the step field carries the error identifier
    trackFunnelStep(funnel, reason, 'error', { reason, ...metadata });
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// INTERNAL DISPATCH — single egress point
//
// Every outbound event is wrapped in an EventEnvelope here.
// Version, timestamp, sessionId, flowId are injected — never from call sites.
// ─────────────────────────────────────────────────────────────────────────────

function dispatch(type: 'event',   payload: AnalyticsEvent):  void;
function dispatch(type: 'page',    payload: PageViewEvent):   void;
function dispatch(type: 'funnel',  payload: FunnelStepEvent): void;
function dispatch(
  type:    'event' | 'page' | 'funnel',
  payload: AnalyticsEvent | PageViewEvent | FunnelStepEvent,
): void {
  if (typeof window === 'undefined') return;

  try {
    // ── Build versioned discriminated envelope ─────────────────────────────
    // Narrowed via explicit _type branches — no unsafe cast needed.
    // Each branch constrains payload to the exact type for that _type variant.
    // `satisfies EnvelopeBase` gives compile-time shape checking without
    // `as const` readonly spreading, which conflicts with EventEnvelope's
    // mutable field types when destructured into each variant branch.
    const base = {
      _v:   ANALYTICS_SCHEMA_VERSION,
      _ts:  Date.now(),
      _sid: _sessionId,
      _fid: _flowId,
    } satisfies EnvelopeBase;

    let envelope: EventEnvelope;

    // switch gives TypeScript exhaustiveness control — the `never` branch
    // below turns any future unhandled _type into a compile-time error,
    // not a silent runtime gap.  No runtime cost: the `never` branch is
    // unreachable by construction (overloads constrain `type` to the union).
    switch (type) {
      case 'event':
        envelope = { ...base, _type: 'event',  payload: payload as AnalyticsEvent  };
        break;
      case 'page':
        envelope = { ...base, _type: 'page',   payload: payload as PageViewEvent   };
        break;
      case 'funnel':
        envelope = { ...base, _type: 'funnel', payload: payload as FunnelStepEvent };
        break;
      default: {
        // Exhaustiveness sentinel — if `type` is ever extended without adding
        // a matching case above, this line fails to compile: Type 'X' is not
        // assignable to type 'never'.  Zero runtime impact (unreachable).
        const _exhaustive: never = type;
        void _exhaustive;
        return;
      }
    }

    if (process.env.NODE_ENV === 'development') {
      console.debug(`[Analytics:${envelope._type}]`, envelope);
    }

    // ── Production adapter hook ────────────────────────────────────────────
    // Replace this block to wire your provider. The envelope is the payload:
    //
    // Segment:
    //   if (type === 'event') {
    //     const e = envelope.payload as AnalyticsEvent;
    //     window.analytics?.track(e.name, {
    //       ...e.props,
    //       _v: envelope._v, _sid: envelope._sid, _fid: envelope._fid,
    //     });
    //   }
    //
    // PostHog:
    //   posthog.capture(e.name, { ...e.props, $session_id: envelope._sid });
    //
    // Until a provider is wired, buffer in window.__analyticsQueue for replay:
    const win   = window as unknown as Record<string, unknown>;
    const queue = ((win.__analyticsQueue ??= []) as unknown[]);
    queue.push(envelope);
  } catch {
    if (process.env.NODE_ENV === 'development') {
      console.warn('[Analytics] dispatch error — swallowed');
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC API
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Track a named user action or system event.
 * Props are typed against EventMap — no arbitrary prop drift.
 *
 * @param idempotencyKey - Optional. If provided, the event fires at most once
 *   per page session. Use for events inside polling loops or effects that may
 *   run multiple times (upload_started, funnel milestones).
 *
 * @example
 * trackEvent('resume_upload_started', { file_size_kb: 240 });
 * trackEvent('resume_processing_started', {}, { idempotencyKey: `resume_start_${jobId}` });
 */
export function trackEvent<K extends EventName>(
  name: K,
  props: EventMap[K],
  options?: { idempotencyKey?: string },
): void {
  if (options?.idempotencyKey) {
    if (hasBeenFired(options.idempotencyKey)) return;
    markFired(options.idempotencyKey);
  }

  dispatch('event', { name, props: props ?? {}, timestamp: Date.now() });
}

/**
 * Track a page view. Called from the Pages layer after route resolution.
 */
export function trackPageView(page: string, referrer?: string): void {
  dispatch('page', {
    page,
    referrer: referrer ?? (typeof document !== 'undefined' ? document.referrer : undefined),
    timestamp: Date.now(),
  });
}

/**
 * Track a funnel step transition.
 *
 * Funnel integrity is enforced automatically via sessionStorage guard.
 * Analytics dispatch is the source of truth for funnel attribution.
 * Use funnelContract.start/complete/drop instead of calling this directly.
 */
export function trackFunnelStep(
  funnel: string,
  step: string,
  status: FunnelStatus,
  metadata?: Record<string, unknown>,
): void {
  const allowed = guardFunnelTransition(funnel, status);
  if (!allowed) return;

  dispatch('funnel', {
    funnel,
    step,
    status,
    metadata: metadata ?? {},
    timestamp: Date.now(),
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

export const FUNNELS = {
  RESUME_UPLOAD: 'resume_upload',
  ONBOARDING:    'onboarding',
  DIRECTION:     'direction_selection',
  DASHBOARD:     'dashboard',
} as const;

export const EVENTS = {
  RESUME_FILE_SELECTED:        'resume_file_selected',
  RESUME_UPLOAD_STARTED:       'resume_upload_started',
  RESUME_UPLOAD_SUCCESS:       'resume_upload_success',
  RESUME_UPLOAD_FAILED:        'resume_upload_failed',
  RESUME_PROCESSING_STARTED:   'resume_processing_started',
  RESUME_PROCESSING_DONE:      'resume_processing_done',
  RESUME_PROCESSING_FAILED:    'resume_processing_failed',
  RESUME_POLLING_TIMEOUT:      'resume_polling_timeout',
  ONBOARDING_STARTED:          'onboarding_started',
  ONBOARDING_STEP_SAVED:       'onboarding_step_saved',
  ONBOARDING_STEP_ERROR:       'onboarding_step_error',
  ONBOARDING_COMPLETED:        'onboarding_completed',
  DIRECTION_PAGE_VIEWED:       'direction_page_viewed',
  DIRECTION_SELECTED:          'direction_selected',
  DASHBOARD_VIEWED:            'dashboard_viewed',
  DASHBOARD_RESCORE_CLICKED:   'dashboard_rescore_clicked',
  DASHBOARD_WIDGET_ERROR:      'dashboard_widget_error',
  CHI_MISSING_REQUIREMENT_CTA: 'chi_missing_requirement_cta_clicked',
  QUOTA_BANNER_SHOWN:          'quota_banner_shown',
  QUOTA_MODAL_SHOWN:           'quota_modal_shown',
  QUOTA_UPGRADE_CLICKED:       'quota_upgrade_clicked',
  FLAG_EXPOSURE:               'flag_exposure',
  // Action dispatcher outcome events — mirrors EventMap additions above
  ACTION_FAILED:               'action.failed',
  ACTION_EXECUTED:             'action.executed',
} as const satisfies Record<string, EventName>;

export const PAGES = {
  HOME:       '/',
  DIRECTION:  '/direction',
  ONBOARDING: '/onboarding',
  RESUME:     '/resume',
  DASHBOARD:  '/dashboard',
} as const;
// ─────────────────────────────────────────────────────────────────────────────
// METRICS RESOLVERS — integration bridge for lib/api/metrics.ts
//
// These functions are called by lib/api/metrics.ts when INTEGRATION_ENABLED=true.
// They delegate to the metricsApi endpoint registry (endpoints/metrics.ts),
// which in turn calls the backend via apiClient.
//
// Signature contract:
//   resolveXxxMetrics(filters: MetricFilters, signal?: AbortSignal): Promise<XxxMetrics>
//
// The hook and UI layers have zero awareness of this indirection.
// ─────────────────────────────────────────────────────────────────────────────

import { metricsApi } from '@/lib/api/endpoints/metrics';
import type {
  MetricFilters,
  OverviewMetrics,
  ResumeFunnelMetrics,
  OnboardingFunnelMetrics,
  PerformanceMetrics,
  ReliabilityMetrics,
  ExperimentMetrics,
} from '@/lib/api/metrics-types';

/**
 * Resolve overview metrics via the integration layer.
 * Delegates to metricsApi.getOverview.
 * Note: signal is accepted to match the lib/api/metrics.ts contract but is not
 * forwarded — apiClient (used by metricsApi) does not support AbortSignal.
 */
export function resolveOverviewMetrics(
  filters: MetricFilters,
  _signal?: AbortSignal,
): Promise<OverviewMetrics> {
  return metricsApi.getOverview(filters);
}

/**
 * Resolve resume funnel metrics via the integration layer.
 * Delegates to metricsApi.getFunnel.
 */
export function resolveResumeFunnelMetrics(
  filters: MetricFilters,
  _signal?: AbortSignal,
): Promise<ResumeFunnelMetrics> {
  return metricsApi.getFunnel(filters);
}

/**
 * Resolve onboarding funnel metrics via the integration layer.
 * Delegates to metricsApi.getOnboarding.
 */
export function resolveOnboardingMetrics(
  filters: MetricFilters,
  _signal?: AbortSignal,
): Promise<OnboardingFunnelMetrics> {
  return metricsApi.getOnboarding(filters);
}

/**
 * Resolve processing performance metrics via the integration layer.
 * Delegates to metricsApi.getPerformance.
 */
export function resolvePerformanceMetrics(
  filters: MetricFilters,
  _signal?: AbortSignal,
): Promise<PerformanceMetrics> {
  return metricsApi.getPerformance(filters);
}

/**
 * Resolve reliability/error metrics via the integration layer.
 * Delegates to metricsApi.getReliability.
 */
export function resolveReliabilityMetrics(
  filters: MetricFilters,
  _signal?: AbortSignal,
): Promise<ReliabilityMetrics> {
  return metricsApi.getReliability(filters);
}

/**
 * Resolve experiment/feature-flag metrics via the integration layer.
 * Delegates to metricsApi.getExperiments.
 */
export function resolveExperimentMetrics(
  filters: MetricFilters,
  _signal?: AbortSignal,
): Promise<ExperimentMetrics> {
  return metricsApi.getExperiments(filters);
}