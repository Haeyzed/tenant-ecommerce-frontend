/** The BFF answer to an auth call, parsed defensively. */
export type AuthResult = {
  ok: boolean
  status: number
  code: string
  message: string | null
  fieldErrors: Record<string, string[]>
  retryAfter: number | null
  network: boolean
}

/** POSTs JSON to a same-origin BFF auth route with the CSRF marker (spec §8.6). */
export async function postAuth(path: string, body: unknown): Promise<AuthResult> {
  let response: Response

  try {
    response = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Requested-With": "bff" },
      body: JSON.stringify(body),
    })
  } catch {
    return { ok: false, status: 0, code: "network_error", message: null, fieldErrors: {}, retryAfter: null, network: true }
  }

  const json = (await response.json().catch(() => null)) as {
    message?: string
    meta?: { error_code?: string }
    errors?: Record<string, string[]>
  } | null
  const retryAfter = Number(response.headers.get("Retry-After"))

  return {
    ok: response.ok,
    status: response.status,
    code: json?.meta?.error_code ?? "",
    message: json?.message ?? null,
    fieldErrors: json?.errors && typeof json.errors === "object" ? json.errors : {},
    retryAfter: Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter : null,
    network: false,
  }
}
