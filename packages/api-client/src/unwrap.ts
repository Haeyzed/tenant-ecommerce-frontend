import { ApiError, isEnvelope } from "./errors"
import type { CursorPage, CursorPagination, LengthAwarePagination, Page } from "./pagination"

/** What an openapi-fetch call resolves to. */
type CallResult<D> = { data?: D; error?: unknown; response: Response }

/** The `data` field of a success envelope. */
export type EnvelopeData<D> = NonNullable<D> extends { data: infer X } ? X : never
type Item<D> = EnvelopeData<D> extends (infer I)[] ? I : never

type CheckedEnvelope = { success: boolean; message: string; data?: unknown; meta?: unknown }

async function settle<D>(call: Promise<CallResult<D>>): Promise<CheckedEnvelope> {
  let result: CallResult<D>

  try {
    result = await call
  } catch (cause) {
    if (cause instanceof ApiError) throw cause
    if (cause instanceof DOMException && cause.name === "AbortError") throw cause
    throw ApiError.network(cause)
  }

  const { data, error, response } = result

  if (!response.ok || error !== undefined) {
    throw ApiError.fromResponse(response, error)
  }

  if (!isEnvelope(data) || !data.success) {
    throw ApiError.fromResponse(response.ok ? invalid(response) : response, data)
  }

  return data
}

function invalid(response: Response): Response {
  return new Response(null, { status: 500, headers: response.headers })
}

function metaOf(envelope: CheckedEnvelope): Record<string, unknown> {
  return typeof envelope.meta === "object" && envelope.meta !== null && !Array.isArray(envelope.meta)
    ? (envelope.meta as Record<string, unknown>)
    : {}
}

/** Resolves a call to the envelope's `data`, or throws ApiError (spec §12.2). */
export async function unwrap<D>(call: Promise<CallResult<D>>): Promise<EnvelopeData<D>> {
  const envelope = await settle(call)
  return envelope.data as EnvelopeData<D>
}

/** Resolves a length-aware list call to items plus meta.pagination. */
export async function unwrapPage<D>(call: Promise<CallResult<D>>): Promise<Page<Item<D>>> {
  const envelope = await settle(call)
  const { pagination, links: _links, ...rest } = metaOf(envelope)

  if (!Array.isArray(envelope.data) || typeof pagination !== "object" || pagination === null) {
    throw new ApiError({ status: 500, code: "invalid_response", message: "The server sent an unexpected response." })
  }

  return { items: envelope.data as Item<D>[], pagination: pagination as LengthAwarePagination, meta: rest }
}

/** Resolves a cursor list call to items plus the cursor pagination. */
export async function unwrapCursorPage<D>(call: Promise<CallResult<D>>): Promise<CursorPage<Item<D>>> {
  const envelope = await settle(call)
  const { pagination, links: _links, ...rest } = metaOf(envelope)

  if (!Array.isArray(envelope.data)) {
    throw new ApiError({ status: 500, code: "invalid_response", message: "The server sent an unexpected response." })
  }

  return { items: envelope.data as Item<D>[], pagination: pagination as CursorPagination, meta: rest }
}

/** Resolves a call to `{data, meta, message}` for callers that also need meta (for example unread counts). */
export async function unwrapWithMeta<D>(
  call: Promise<CallResult<D>>,
): Promise<{ data: EnvelopeData<D>; meta: Record<string, unknown>; message: string }> {
  const envelope = await settle(call)
  return { data: envelope.data as EnvelopeData<D>, meta: metaOf(envelope), message: envelope.message }
}
