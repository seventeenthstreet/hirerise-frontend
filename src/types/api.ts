// types/api.ts
//
// Mirrors the backend response envelope used consistently across all endpoints.
// { success: true, data: T }  or  { success: false, error: { code, message } }

export interface ApiSuccessResponse<T> {
  success: true;
  data: T;
}

export interface ApiErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
  };
  userMessage?: string;
  details?: unknown;
  retryAfterSeconds?: number;
  timestamp: string;
}

export type ApiResponse<T> = ApiSuccessResponse<T> | ApiErrorResponse;

/** Typed error thrown by apiFetch on non-2xx responses */
export class ApiError extends Error {
  readonly code: string;
  readonly status: number;
  readonly details?: unknown;

  constructor(message: string, code: string, status: number, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

/** Standard paginated list response shape (inferred from backend patterns) */
export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

/** Generic query params used by list endpoints */
export interface CmsQueryParams {
  page?: number;
  limit?: number;
  search?: string;
  category?: string;
}
