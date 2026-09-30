/**
 * Laravel bracket-style query strings (spec §12.5):
 * `status[]=paid&status[]=shipped`, `cf[colour]=red`, `cf[weight][from]=1`.
 * Empty values (undefined, null, "") are omitted; booleans become 1 and 0.
 */
export function serializeQuery(query: Record<string, unknown>): string {
  const params = new URLSearchParams()

  const append = (key: string, value: unknown): void => {
    if (value === undefined || value === null || value === "") return

    if (Array.isArray(value)) {
      for (const item of value) append(`${key}[]`, item)
      return
    }

    if (value instanceof Date) {
      params.append(key, value.toISOString())
      return
    }

    if (typeof value === "object") {
      for (const [sub, item] of Object.entries(value as Record<string, unknown>)) append(`${key}[${sub}]`, item)
      return
    }

    if (typeof value === "boolean") {
      params.append(key, value ? "1" : "0")
      return
    }

    params.append(key, String(value))
  }

  for (const [key, value] of Object.entries(query)) append(key, value)

  return params.toString()
}
