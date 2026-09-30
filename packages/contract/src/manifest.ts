/**
 * The shape of one route manifest entry (spec §13.4). The manifests
 * themselves are generated into ./generated/routes.{context}.ts from the
 * backend's `php artisan frontend:contract` bundle.
 */
export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE"

export type RouteEntry = {
  readonly methods: readonly HttpMethod[]
  readonly uri: string
  readonly group: string | null
  readonly actor: string | null
  /** Feature key from `feature:{key}`; null for core routes. */
  readonly module: string | null
  /** The derived permission; null when the route needs none. */
  readonly permission: string | null
  readonly windDown: boolean
  readonly readWhenInactive: boolean
  readonly idempotency: boolean
  readonly usageLimit: string | null
}
