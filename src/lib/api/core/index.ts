/**
 * @file src/lib/api/core/index.ts
 * @description Public API surface for the Hirerise API layer.
 *
 * Single barrel export — all consumers import from '@/lib/api/core'.
 * Do NOT import from individual files (api-client, api-parser, etc.) directly.
 */

export {
  // Request functions
  apiRequest,
  apiRequestWithMeta,
  normalizeTransportError,
  axiosInstance,
  // Options type
  type ApiRequestOptions,
} from './api-client';

export {
  // Error class + factory
  ApiClientError,
  isApiClientError,
  isKnownErrorCode,
  ensureDataExists,
  makeFallbackError,
  logApiParsingError,
  logApiTransportError,
  mapErrorCodeToCategory,
  // Code registry
  BackendErrorCode,
  ERROR_CODE_TO_HTTP_STATUS,
} from './api-error';

export type {
  TransportErrorCategory,
} from './api-error';

export {
  // Parsers
  parseApiResponse,
  parseBackendSuccess,
  parseBackendPaginated,
  parseBackendError,
  // Guards
  isObject,
  hasSuccessFlag,
} from './api-parser';

export type {
  // Request config
  ApiRequestConfig,
  // Response envelopes
  ApiResponse,
  ApiSuccess,
  ApiFailure,
  PaginatedApiSuccess,
  // Meta
  PaginationMeta,
  RawResponseMeta,
  RawRateLimitMeta,
  RawPaginatedMeta,
  // Raw wire shapes
  RawApiSuccess,
  RawApiPaginatedSuccess,
  RawApiError,
  RawApiErrorV2,
  RawApiErrorLegacy,
  RawApiErrorTransitional,
  // Domain
  ErrorCategory,
  JobStatus,
  JobRef,
} from './api-types';