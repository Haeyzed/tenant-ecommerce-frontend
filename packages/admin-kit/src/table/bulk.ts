/** The result every bulk route returns (App\Shared\Support\BulkOperation, spec §19.1). */
export type BulkResult = {
  operation_id: string
  succeeded: number
  failed: number
  results: {
    id: number | string
    status: "ok" | "error"
    error: string | null
    message: string | null
  }[]
}

export function isBulkResult(value: unknown): value is BulkResult {
  return (
    typeof value === "object" &&
    value !== null &&
    "succeeded" in value &&
    "failed" in value &&
    Array.isArray((value as BulkResult).results)
  )
}

/**
 * A toast-ready summary: "12 products activated", or with partial failures
 * "10 activated, 2 failed: <first reason>".
 */
export function summarizeBulk(
  result: BulkResult,
  noun: { one: string; many: string },
  verb: string
): {
  title: string
  description: string | undefined
  type: "success" | "warning" | "error"
} {
  const n = (count: number) => `${count} ${count === 1 ? noun.one : noun.many}`

  if (result.failed === 0)
    return {
      title: `${n(result.succeeded)} ${verb}`,
      description: undefined,
      type: "success",
    }

  const reasons = [
    ...new Set(
      result.results
        .filter((r) => r.status === "error")
        .map((r) => r.message ?? r.error ?? "Failed")
    ),
  ]
  const description = `${reasons.slice(0, 2).join(" ")}${reasons.length > 2 ? " …" : ""}`

  if (result.succeeded === 0)
    return { title: `No ${noun.many} ${verb}`, description, type: "error" }
  return {
    title: `${n(result.succeeded)} ${verb}, ${result.failed} failed`,
    description,
    type: "warning",
  }
}
