/** Pagination shapes built by APIResponse (spec §12.7). */
export type LengthAwarePagination = {
  current_page: number
  per_page: number
  from: number | null
  to: number | null
  total: number
  last_page: number
}

export type PageLinks = {
  first: string | null
  prev: string | null
  next: string | null
  last: string | null
}

export type CursorPagination = {
  per_page: number
  next_cursor: string | null
  prev_cursor: string | null
}

export type Page<T> = {
  items: T[]
  pagination: LengthAwarePagination
  meta: Record<string, unknown>
}

export type CursorPage<T> = {
  items: T[]
  pagination: CursorPagination
  meta: Record<string, unknown>
}

/** The page sizes the backend accepts; 100 is its maximum. */
export const PAGE_SIZES = [15, 25, 50, 100] as const
export type PageSize = (typeof PAGE_SIZES)[number]
