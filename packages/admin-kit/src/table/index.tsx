"use client"

import {
  columnVisibilityFeature,
  rowSelectionFeature,
  tableFeatures,
  useTable,
  type ColumnDef,
  type ColumnVisibilityState,
  type RowData,
  type RowSelectionState,
} from "@tanstack/react-table"
import Link from "next/link"
import { useMemo, useState, useSyncExternalStore, type ReactNode } from "react"

import type { LengthAwarePagination } from "@workspace/api-client"
import { Button } from "@workspace/ui/components/button"
import { Checkbox } from "@workspace/ui/components/checkbox"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu"
import { Progress } from "@workspace/ui/components/progress"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"
import { Skeleton } from "@workspace/ui/components/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table"
import { Icon } from "@workspace/ui/icons"
import { cn } from "@workspace/ui/lib/utils"

import { ErrorState } from "../states"

export { isBulkResult, summarizeBulk, type BulkResult } from "./bulk"

const features = tableFeatures({ rowSelectionFeature, columnVisibilityFeature })

/** How a column is described by a feature. Rendering, sorting and layout only; data comes from the API. */
export type DataColumn<T> = {
  id: string
  header: string
  cell: (row: T) => ReactNode
  /** The API `sort` value for this column; omitted when the route cannot sort by it. */
  sortKey?: string
  /** Users may hide it; the first column and actions cannot be hidden. */
  hideable?: boolean
  /** Hidden until the user shows it. */
  defaultHidden?: boolean
  /** Card layout below 768 px: `title` and `subtitle` head the card, `meta` (a badge) sits beside the subtitle, `detail` rows follow, `hidden` is omitted. */
  mobile?: "title" | "subtitle" | "meta" | "detail" | "hidden"
  align?: "start" | "end"
  className?: string
}

export type SortState = {
  value: string | null
  onChange: (value: string | null) => void
}

export type PaginationControls = {
  pagination: LengthAwarePagination | undefined
  onPageChange: (page: number) => void
  onPerPageChange: (perPage: number) => void
}

type DataTableProps<T extends RowData> = {
  /** Stable id for stored column visibility, e.g. "products". */
  tableId: string
  columns: DataColumn<T>[]
  rows: T[] | undefined
  getRowId: (row: T) => string
  isLoading: boolean
  isFetching?: boolean
  error?: unknown
  onRetry?: () => void
  sort?: SortState
  paging?: PaginationControls
  rowHref?: (row: T) => string
  rowActions?: (row: T) => ReactNode
  /** When set, rows are selectable and this renders the bulk bar for the selected ids (spec §19.1). */
  bulkActions?: (selectedIds: string[], clear: () => void) => ReactNode
  /** Filters and search above the table. */
  toolbar?: ReactNode
  /** Shown when there are no rows and no filters: "no records yet". */
  emptyState: ReactNode
  /** Shown when filters match nothing: "no results for these filters". */
  noResultsState: ReactNode
  /** Whether any filter or search is active, to choose between the two empty states. */
  filtered: boolean
}

const PAGE_SIZE_OPTIONS = ["15", "25", "50", "100"]

function useStoredVisibility(tableId: string, columns: readonly { id: string; defaultHidden?: boolean | undefined }[]) {
  const defaults = useMemo<ColumnVisibilityState>(
    () => Object.fromEntries(columns.filter((c) => c.defaultHidden).map((c) => [c.id, false])),
    [columns]
  )
  const key = `admin:${typeof window === "undefined" ? "" : window.location.host}:table:${tableId}:columns`
  // Read through useSyncExternalStore: the server renders the defaults and the
  // browser switches to the saved choice without a hydration mismatch.
  const stored = useSyncExternalStore(subscribeToStorage, () => readStorage(key), () => null)
  // The choice made in this page, used when storage is unavailable.
  const [local, setLocal] = useState<ColumnVisibilityState | null>(null)

  const visibility = useMemo(() => local ?? { ...defaults, ...parseVisibility(stored) }, [local, defaults, stored])

  const update = (next: ColumnVisibilityState) => {
    setLocal(next)
    try {
      window.localStorage.setItem(key, JSON.stringify(next))
    } catch {
      // Storage unavailable: the choice lasts for this page only.
    }
  }

  return [visibility, update] as const
}

function subscribeToStorage(onChange: () => void) {
  window.addEventListener("storage", onChange)
  return () => window.removeEventListener("storage", onChange)
}

function readStorage(key: string): string | null {
  try {
    return window.localStorage.getItem(key)
  } catch {
    return null
  }
}

/** Saved visibility is untrusted input: keep only boolean entries. */
function parseVisibility(raw: string | null): ColumnVisibilityState {
  if (raw === null) return {}
  try {
    const parsed: unknown = JSON.parse(raw)
    if (typeof parsed !== "object" || parsed === null) return {}
    return Object.fromEntries(Object.entries(parsed).filter((entry): entry is [string, boolean] => typeof entry[1] === "boolean"))
  } catch {
    return {}
  }
}

function SortButton({
  column,
  sort,
}: {
  column: DataColumn<unknown>
  sort: SortState
}) {
  const key = column.sortKey as string
  const current =
    sort.value === key ? "asc" : sort.value === `-${key}` ? "desc" : null
  const next = current === null ? key : current === "asc" ? `-${key}` : null
  const label =
    current === "asc"
      ? "sorted ascending"
      : current === "desc"
        ? "sorted descending"
        : "not sorted"

  return (
    <Button
      variant="ghost"
      size="sm"
      className={cn(
        "-ms-2 h-7 gap-1 px-2 font-medium",
        column.align === "end" && "ms-auto -me-2"
      )}
      onClick={() => sort.onChange(next)}
      aria-label={`${column.header}, ${label}. Change sort.`}
    >
      {column.header}
      <Icon
        name={
          current === "asc"
            ? "arrowUp"
            : current === "desc"
              ? "arrowDown"
              : "sort"
        }
        className={cn("size-3.5", current === null && "opacity-50")}
      />
    </Button>
  )
}

function RowCheckbox({
  checked,
  onChange,
  label,
}: {
  checked: boolean
  onChange: (value: boolean) => void
  label: string
}) {
  return (
    <Checkbox
      checked={checked}
      onCheckedChange={(value) => onChange(value === true)}
      aria-label={label}
    />
  )
}

/**
 * The admin data table (spec §18.3). Server-driven: pagination, sorting
 * and filtering come from URL state and the API; selection is per page.
 */
export function DataTable<T extends RowData>(props: DataTableProps<T>) {
  const {
    columns,
    rows,
    getRowId,
    isLoading,
    isFetching,
    error,
    onRetry,
    sort,
    paging,
    rowHref,
    rowActions,
    bulkActions,
    toolbar,
    filtered,
  } = props
  const [visibility, setVisibility] = useStoredVisibility(props.tableId, columns)
  const [selection, setSelection] = useState<RowSelectionState>({})
  const data = useMemo<T[]>(() => rows ?? [], [rows])
  const selectable = bulkActions !== undefined

  // Selection is per page: it clears whenever the rows change (spec §18.3).
  // Reset during render (React's pattern for state derived from props).
  const [selectionRows, setSelectionRows] = useState(rows)
  if (selectionRows !== rows) {
    setSelectionRows(rows)
    setSelection({})
  }

  const tableColumns = useMemo<ColumnDef<typeof features, T>[]>(
    () =>
      columns.map((column) => ({
        id: column.id,
        header: column.header,
        cell: () => null,
      })),
    [columns]
  )

  const table = useTable({
    features,
    columns: tableColumns,
    data,
    getRowId: (row: T) => getRowId(row),
    enableRowSelection: selectable,
    state: { rowSelection: selection, columnVisibility: visibility },
    onRowSelectionChange: (updater) =>
      setSelection((prev) =>
        typeof updater === "function" ? updater(prev) : updater
      ),
    onColumnVisibilityChange: (updater) =>
      setVisibility(
        typeof updater === "function" ? updater(visibility) : updater
      ),
  })

  const visibleColumns = columns.filter(
    (column) => visibility[column.id] !== false
  )
  const selectedIds = Object.keys(selection)
  const pageRows = table.getRowModel().rows
  const allSelected =
    pageRows.length > 0 && selectedIds.length === pageRows.length
  const hideable = columns.filter((c) => c.hideable)
  const colSpan =
    visibleColumns.length + (selectable ? 1 : 0) + (rowActions ? 1 : 0)

  const header = (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
        {toolbar}
      </div>
      {hideable.length > 0 && data.length > 0 ? (
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                variant="outline"
                size="sm"
                className="hidden md:inline-flex"
              />
            }
          >
            <Icon name="filter" data-icon="inline-start" />
            Columns
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-48">
            <DropdownMenuGroup>
              <DropdownMenuLabel>Visible columns</DropdownMenuLabel>
              {hideable.map((column) => (
                <DropdownMenuCheckboxItem
                  key={column.id}
                  checked={visibility[column.id] !== false}
                  onCheckedChange={(checked) =>
                    setVisibility({
                      ...visibility,
                      [column.id]: checked === true,
                    })
                  }
                >
                  {column.header}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      ) : null}
    </div>
  )

  const bulkBar =
    selectable && selectedIds.length > 0 ? (
      <div
        role="region"
        aria-label="Bulk actions"
        className="flex flex-wrap items-center gap-2 rounded-lg border bg-muted/60 px-3 py-2 text-sm"
      >
        <span className="font-medium">{selectedIds.length} selected</span>
        <Button variant="ghost" size="sm" onClick={() => setSelection({})}>
          Clear
        </Button>
        <div className="ms-auto flex flex-wrap items-center gap-2">
          {bulkActions(selectedIds, () => setSelection({}))}
        </div>
      </div>
    ) : null

  let body: ReactNode

  if (error && !rows) {
    body = <ErrorState error={error} onRetry={onRetry} />
  } else if (!isLoading && data.length === 0) {
    body = filtered ? props.noResultsState : props.emptyState
  }

  const cellLink = (row: T, content: ReactNode, first: boolean) =>
    rowHref && first ? (
      <Link
        href={rowHref(row)}
        className="font-medium text-foreground underline-offset-4 outline-none hover:underline focus-visible:underline"
      >
        {content}
      </Link>
    ) : (
      content
    )

  return (
    <section
      className="flex min-w-0 flex-col gap-3"
      aria-busy={isLoading || isFetching}
    >
      {header}
      {bulkBar}
      <div className="relative min-w-0 overflow-hidden rounded-xl border bg-card">
        {isFetching && !isLoading ? (
          <Progress
            value={null}
            className="absolute inset-x-0 top-0 h-0.5 rounded-none"
            aria-label="Refreshing"
          />
        ) : null}

        {body ?? (
          <>
            {/* Desktop and tablet: a real table. */}
            <Table className="hidden md:table">
              <TableHeader className="bg-muted/40">
                <TableRow className="hover:bg-transparent">
                  {selectable ? (
                    <TableHead className="w-10 ps-4">
                      <RowCheckbox
                        checked={allSelected}
                        onChange={(value) =>
                          table.toggleAllPageRowsSelected(value)
                        }
                        label="Select all rows on this page"
                      />
                    </TableHead>
                  ) : null}
                  {visibleColumns.map((column, index) => (
                    <TableHead
                      key={column.id}
                      className={cn(
                        "text-muted-foreground",
                        index === 0 && !selectable && "ps-4",
                        column.align === "end" && "text-end",
                        column.className
                      )}
                      aria-sort={
                        sort && column.sortKey
                          ? sort.value === column.sortKey
                            ? "ascending"
                            : sort.value === `-${column.sortKey}`
                              ? "descending"
                              : "none"
                          : undefined
                      }
                    >
                      {sort && column.sortKey ? (
                        <SortButton
                          column={column as DataColumn<unknown>}
                          sort={sort}
                        />
                      ) : (
                        column.header
                      )}
                    </TableHead>
                  ))}
                  {rowActions ? (
                    <TableHead className="w-12 pe-4">
                      <span className="sr-only">Actions</span>
                    </TableHead>
                  ) : null}
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading
                  ? Array.from({ length: 8 }, (_, i) => (
                      <TableRow key={i} className="hover:bg-transparent">
                        {Array.from({ length: colSpan }, (_, j) => (
                          <TableCell key={j} className={cn(j === 0 && "ps-4")}>
                            <Skeleton
                              className={cn("h-4", j === 0 ? "w-40" : "w-20")}
                            />
                          </TableCell>
                        ))}
                      </TableRow>
                    ))
                  : pageRows.map((row) => (
                      <TableRow
                        key={row.id}
                        data-state={selection[row.id] ? "selected" : undefined}
                      >
                        {selectable ? (
                          <TableCell className="ps-4">
                            <RowCheckbox
                              checked={selection[row.id] === true}
                              onChange={(value) => row.toggleSelected(value)}
                              label="Select row"
                            />
                          </TableCell>
                        ) : null}
                        {visibleColumns.map((column, index) => (
                          <TableCell
                            key={column.id}
                            className={cn(
                              index === 0 && !selectable && "ps-4",
                              column.align === "end" && "text-end tabular-nums",
                              column.className
                            )}
                          >
                            {cellLink(
                              row.original,
                              column.cell(row.original),
                              index === 0
                            )}
                          </TableCell>
                        ))}
                        {rowActions ? (
                          <TableCell className="pe-4 text-end">
                            {rowActions(row.original)}
                          </TableCell>
                        ) : null}
                      </TableRow>
                    ))}
              </TableBody>
            </Table>

            {/* Below 768 px: one card per row with its primary fields (spec §18.3). */}
            <ul className="divide-y md:hidden" aria-label="Records">
              {isLoading
                ? Array.from({ length: 6 }, (_, i) => (
                    <li key={i} className="flex flex-col gap-2 p-4">
                      <Skeleton className="h-4 w-2/3" />
                      <Skeleton className="h-3 w-1/3" />
                    </li>
                  ))
                : pageRows.map((row) => {
                    const item = row.original
                    const title =
                      columns.find((c) => c.mobile === "title") ?? columns[0]
                    const subtitle = columns.find(
                      (c) => c.mobile === "subtitle"
                    )
                    const meta = columns.filter((c) => c.mobile === "meta")
                    const details = columns.filter((c) => c.mobile === "detail")

                    return (
                      <li
                        key={row.id}
                        className="flex gap-3 p-4"
                        data-state={selection[row.id] ? "selected" : undefined}
                      >
                        {selectable ? (
                          <div className="pt-0.5">
                            <RowCheckbox
                              checked={selection[row.id] === true}
                              onChange={(value) => row.toggleSelected(value)}
                              label="Select row"
                            />
                          </div>
                        ) : null}
                        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              {title ? (
                                <div className="truncate text-sm">
                                  {cellLink(item, title.cell(item), true)}
                                </div>
                              ) : null}
                              {subtitle || meta.length > 0 ? (
                                <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                                  {subtitle ? (
                                    <span className="truncate">
                                      {subtitle.cell(item)}
                                    </span>
                                  ) : null}
                                  {meta.map((column) => (
                                    <span key={column.id}>
                                      {column.cell(item)}
                                    </span>
                                  ))}
                                </div>
                              ) : null}
                            </div>
                            {rowActions ? (
                              <div className="-me-2 -mt-1 shrink-0">
                                {rowActions(item)}
                              </div>
                            ) : null}
                          </div>
                          {details.length > 0 ? (
                            <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                              {details.map((column) => (
                                <div
                                  key={column.id}
                                  className="flex min-w-0 flex-col"
                                >
                                  <dt className="text-muted-foreground">
                                    {column.header}
                                  </dt>
                                  <dd className="truncate">
                                    {column.cell(item)}
                                  </dd>
                                </div>
                              ))}
                            </dl>
                          ) : null}
                        </div>
                      </li>
                    )
                  })}
            </ul>
          </>
        )}
      </div>
      {paging && paging.pagination && data.length > 0 ? (
        <PaginationBar {...paging} pagination={paging.pagination} />
      ) : null}
    </section>
  )
}

function PaginationBar({
  pagination,
  onPageChange,
  onPerPageChange,
}: PaginationControls & { pagination: LengthAwarePagination }) {
  const {
    current_page: page,
    last_page: last,
    from,
    to,
    total,
    per_page: perPage,
  } = pagination

  return (
    <nav
      aria-label="Pagination"
      className="flex flex-col-reverse items-center justify-between gap-3 text-sm sm:flex-row"
    >
      <p className="text-muted-foreground">
        {from ?? 0}–{to ?? 0} of {total.toLocaleString()}
      </p>
      <div className="flex items-center gap-2">
        <div className="hidden items-center gap-2 sm:flex">
          <span className="text-muted-foreground">Rows</span>
          <Select
            value={String(perPage)}
            onValueChange={(value) => value && onPerPageChange(Number(value))}
            items={PAGE_SIZE_OPTIONS.map((v) => ({ value: v, label: v }))}
          >
            <SelectTrigger
              size="sm"
              className="w-18"
              aria-label="Rows per page"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {PAGE_SIZE_OPTIONS.map((option) => (
                  <SelectItem key={option} value={option}>
                    {option}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>
        <span className="px-1 text-muted-foreground tabular-nums">
          Page {page} of {Math.max(last, 1)}
        </span>
        <Button
          variant="outline"
          size="icon-sm"
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          aria-label="Previous page"
        >
          <Icon name="arrowLeft" />
        </Button>
        <Button
          variant="outline"
          size="icon-sm"
          onClick={() => onPageChange(page + 1)}
          disabled={page >= last}
          aria-label="Next page"
        >
          <Icon name="arrowRight" />
        </Button>
      </div>
    </nav>
  )
}
