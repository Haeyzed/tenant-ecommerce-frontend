import type { BackendErrorCode } from "@workspace/contract/registries"

/** Codes produced by the frontend itself (spec §12.4). */
export type FrontendErrorCode = "network_error" | "upstream_unavailable" | "csrf_rejected" | "invalid_response"

/**
 * Every backend and frontend code, widened because a few backend codes are
 * built at runtime and cannot be listed. An unknown code is handled by status.
 */
export type ApiErrorCode = BackendErrorCode | FrontendErrorCode | (string & {})

type ApiErrorInit = {
  status: number
  code: ApiErrorCode
  message: string
  details?: Record<string, unknown>
  fieldErrors?: Record<string, string[]>
  requestId?: string | null
  retryAfter?: number | null
}

/** The one error type every API failure becomes (spec §12.4). */
export class ApiError extends Error {
  readonly status: number
  readonly code: ApiErrorCode
  readonly details: Record<string, unknown>
  readonly fieldErrors: Record<string, string[]>
  readonly requestId: string | null
  readonly retryAfter: number | null

  constructor(init: ApiErrorInit) {
    super(init.message)
    this.name = "ApiError"
    this.status = init.status
    this.code = init.code
    this.details = init.details ?? {}
    this.fieldErrors = init.fieldErrors ?? {}
    this.requestId = init.requestId ?? null
    this.retryAfter = init.retryAfter ?? null
  }

  /** Builds the error from a failed response and its parsed body (which may not be an envelope). */
  static fromResponse(response: Response, body: unknown): ApiError {
    const requestId = response.headers.get("X-Request-Id")
    const retryAfterHeader = response.headers.get("Retry-After")
    const retryAfter = retryAfterHeader !== null && /^\d+$/.test(retryAfterHeader) ? Number(retryAfterHeader) : null

    if (!isEnvelope(body)) {
      return new ApiError({
        status: response.status,
        code: response.status >= 500 ? "upstream_unavailable" : "invalid_response",
        message: response.status >= 500 ? "The service is temporarily unavailable." : "The server sent an unexpected response.",
        requestId,
        retryAfter,
      })
    }

    const meta = isRecord(body.meta) ? body.meta : {}

    return new ApiError({
      status: response.status,
      code: typeof meta.error_code === "string" ? meta.error_code : statusCode(response.status),
      message: body.message,
      details: isRecord(meta.details) ? meta.details : {},
      fieldErrors: toFieldErrors(body.errors),
      requestId,
      retryAfter,
    })
  }

  static network(cause: unknown): ApiError {
    const error = new ApiError({
      status: 0,
      code: "network_error",
      message: "We could not reach the server. Check your connection and try again.",
    })
    error.cause = cause
    return error
  }
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError
}

const MODULE_CODES = new Set(["feature_unavailable", "module_disabled", "module_locked", "module_suspended"])
const TENANT_STATE_CODES = new Set([
  "subscription_payment_required",
  "subscription_past_due",
  "tenant_provisioning",
  "tenant_suspended",
  "tenant_closed",
  "maintenance",
])

export const isModuleError = (e: unknown): e is ApiError => isApiError(e) && MODULE_CODES.has(e.code)
export const isLimitError = (e: unknown): e is ApiError => isApiError(e) && e.code === "limit_reached"
export const isValidation = (e: unknown): e is ApiError => isApiError(e) && e.status === 422 && Object.keys(e.fieldErrors).length > 0
export const isTenantState = (e: unknown): e is ApiError => isApiError(e) && TENANT_STATE_CODES.has(e.code)
export const isConflict = (e: unknown, code?: ApiErrorCode): e is ApiError =>
  isApiError(e) && e.status === 409 && (code === undefined || e.code === code)

/** Retryable for queries: network, upstream, 503 other than maintenance, and 429 (spec §12.5). */
export function isRetryable(e: unknown): boolean {
  if (!isApiError(e)) return false
  if (e.code === "network_error" || e.code === "upstream_unavailable") return true
  if (e.status === 503) return e.code !== "maintenance"
  return e.status === 429
}

type EnvelopeShape = { success: boolean; message: string; data?: unknown; meta?: unknown; errors?: unknown }

export function isEnvelope(body: unknown): body is EnvelopeShape {
  return isRecord(body) && typeof body.success === "boolean" && typeof body.message === "string"
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function toFieldErrors(errors: unknown): Record<string, string[]> {
  if (!isRecord(errors)) return {}

  const result: Record<string, string[]> = {}

  for (const [field, messages] of Object.entries(errors)) {
    if (Array.isArray(messages)) {
      result[field] = messages.filter((m): m is string => typeof m === "string")
    } else if (typeof messages === "string") {
      result[field] = [messages]
    }
  }

  return result
}

function statusCode(status: number): string {
  switch (status) {
    case 401:
      return "unauthenticated"
    case 403:
      return "forbidden"
    case 404:
      return "not_found"
    case 409:
      return "state_conflict"
    case 422:
      return "validation_failed"
    case 429:
      return "too_many_requests"
    default:
      return status >= 500 ? "server_error" : "http_error"
  }
}
