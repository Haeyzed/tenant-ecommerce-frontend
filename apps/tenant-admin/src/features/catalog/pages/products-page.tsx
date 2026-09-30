"use client"

import { useQuery, useQueryClient } from "@tanstack/react-query"
import Link from "next/link"
import { useQueryStates } from "nuqs"
import { useEffect, useMemo, useState } from "react"

import { useCan } from "@workspace/access/react"
import { isApiError } from "@workspace/api-client"
import { EntityCombobox } from "@workspace/admin-kit/lookup"
import { StateView } from "@workspace/admin-kit/states"
import {
  DataTable,
  summarizeBulk,
  type DataColumn,
} from "@workspace/admin-kit/table"
import { formatDate, formatMoney } from "@workspace/format"
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@workspace/ui/components/avatar"
import { Button } from "@workspace/ui/components/button"
import { ConfirmDialog } from "@workspace/ui/components/confirm-dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@workspace/ui/components/input-group"
import { PageHeader } from "@workspace/ui/components/page-header"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@workspace/ui/components/sheet"
import { StatusBadge } from "@workspace/ui/components/status-badge"
import { toast } from "@workspace/ui/components/toast"
import { Icon } from "@workspace/ui/icons"

import { lookupQuery, lookupSearch, type LookupItem } from "@/features/lookups"
import { useStore } from "@/shell/store-context"

import {
  PRODUCT_TYPES,
  productListParams,
  productListQuery,
  useDeleteProduct,
  useProductBulk,
  useSetProductActive,
  type ProductListFilters,
  type ProductRow,
} from "../api/products"

const TYPE_LABELS: Record<string, string> = {
  simple: "Simple",
  variable: "Variable",
  bundle: "Bundle",
  digital: "Digital",
  service: "Service",
}
const ROUTES = {
  create: "tenant.catalog.admin.products.store",
  update: "tenant.catalog.admin.products.update",
  delete: "tenant.catalog.admin.products.destroy",
  bulk: "tenant.catalog.admin.products.bulk",
}

function useDebouncedCallback(
  value: string,
  delay: number,
  onSettle: (value: string) => void
) {
  useEffect(() => {
    const timer = setTimeout(() => onSettle(value), delay)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only the typed value restarts the timer
  }, [value, delay])
}

function Filters({
  filters,
  setFilters,
  compact,
}: {
  filters: ProductListFilters
  setFilters: (f: Partial<ProductListFilters>) => void
  compact?: boolean
}) {
  const queryClient = useQueryClient()
  // The selected brand and category come from the URL ids and the cached lookups,
  // so a shared or reloaded URL shows the right labels.
  const brands = useQuery({
    ...lookupQuery("brands"),
    enabled: filters.brand_id !== null,
  })
  const categories = useQuery({
    ...lookupQuery("categories"),
    enabled: filters.category_id !== null,
  })
  const brand =
    filters.brand_id === null
      ? null
      : (brands.data?.find((b) => b.value === filters.brand_id) ?? null)
  const category =
    filters.category_id === null
      ? null
      : (categories.data?.find((c) => c.value === filters.category_id) ?? null)

  const wrap = compact ? "flex flex-col gap-4" : "contents"

  return (
    <div className={wrap}>
      <Select
        value={filters.product_type ?? "all"}
        onValueChange={(value) =>
          setFilters({
            product_type:
              value === "all" || value === null
                ? null
                : (value as ProductListFilters["product_type"]),
            page: 1,
          })
        }
        items={[
          { value: "all", label: "All types" },
          ...PRODUCT_TYPES.map((t) => ({
            value: t,
            label: TYPE_LABELS[t] ?? t,
          })),
        ]}
      >
        <SelectTrigger
          aria-label="Product type"
          className={compact ? "w-full" : "w-36"}
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            <SelectItem value="all">All types</SelectItem>
            {PRODUCT_TYPES.map((t) => (
              <SelectItem key={t} value={t}>
                {TYPE_LABELS[t]}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
      <Select
        value={
          filters.is_active === null
            ? "all"
            : filters.is_active
              ? "active"
              : "inactive"
        }
        onValueChange={(value) =>
          setFilters({
            is_active:
              value === "active" ? true : value === "inactive" ? false : null,
            page: 1,
          })
        }
        items={[
          { value: "all", label: "Any status" },
          { value: "active", label: "Active" },
          { value: "inactive", label: "Inactive" },
        ]}
      >
        <SelectTrigger
          aria-label="Status"
          className={compact ? "w-full" : "w-32"}
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            <SelectItem value="all">Any status</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="inactive">Inactive</SelectItem>
          </SelectGroup>
        </SelectContent>
      </Select>
      <div className={compact ? "w-full" : "w-44"}>
        <EntityCombobox<LookupItem>
          queryKey={["lookup-search", "brands"]}
          search={lookupSearch(queryClient, "brands")}
          value={brand}
          onChange={(item) =>
            setFilters({ brand_id: item ? Number(item.value) : null, page: 1 })
          }
          getId={(b) => b.value}
          getLabel={(b) => b.label}
          placeholder="Any brand"
          emptyText="No brands"
        />
      </div>
      <div className={compact ? "w-full" : "w-44"}>
        <EntityCombobox<LookupItem>
          queryKey={["lookup-search", "categories"]}
          search={lookupSearch(queryClient, "categories")}
          value={category}
          onChange={(item) =>
            setFilters({ category_id: item ? Number(item.value) : null, page: 1 })
          }
          getId={(c) => c.value}
          getLabel={(c) => c.label}
          placeholder="Any category"
          emptyText="No categories"
        />
      </div>
    </div>
  )
}

/** The product list (spec §27.2, §18.1): search, filters, bulk activate/deactivate, row actions. */
export function ProductsPage() {
  const { currency, display } = useStore()
  const [filters, setFilters] = useQueryStates(productListParams, {
    clearOnDefault: true,
    history: "replace",
  })
  const [search, setSearch] = useState(filters.search)
  const query = useQuery(productListQuery(filters))
  const bulk = useProductBulk()
  const setActive = useSetProductActive()
  const remove = useDeleteProduct()
  const [pendingDelete, setPendingDelete] = useState<ProductRow | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  const canCreate = useCan(ROUTES.create)
  const canUpdate = useCan(ROUTES.update)
  const canDelete = useCan(ROUTES.delete)
  const canBulk = useCan(ROUTES.bulk)

  useDebouncedCallback(search, 300, (value) => {
    if (value !== filters.search) void setFilters({ search: value, page: 1 })
  })

  const filtered = Boolean(
    filters.search ||
    filters.product_type ||
    filters.is_active !== null ||
    filters.brand_id !== null ||
    filters.category_id !== null
  )
  const activeFilterCount = [
    filters.product_type,
    filters.is_active,
    filters.brand_id,
    filters.category_id,
  ].filter((v) => v !== null).length

  const columns = useMemo<DataColumn<ProductRow>[]>(
    () => [
      {
        id: "product",
        header: "Product",
        mobile: "title",
        cell: (p) => (
          <span className="flex min-w-0 items-center gap-3">
            <Avatar className="size-9 shrink-0 rounded-lg">
              {p.image_url ? (
                <AvatarImage
                  src={p.image_url}
                  alt=""
                  className="object-cover"
                />
              ) : null}
              <AvatarFallback className="rounded-lg">
                <Icon
                  name="products"
                  className="size-4 text-muted-foreground"
                />
              </AvatarFallback>
            </Avatar>
            <span className="flex min-w-0 flex-col">
              <span className="truncate">{p.name}</span>
              {p.sku ? (
                <span className="truncate text-xs font-normal text-muted-foreground">
                  SKU {p.sku}
                </span>
              ) : null}
            </span>
          </span>
        ),
      },
      {
        id: "type",
        header: "Type",
        hideable: true,
        mobile: "detail",
        cell: (p) => TYPE_LABELS[p.product_type] ?? p.product_type,
      },
      {
        id: "price",
        header: "Price",
        align: "end",
        mobile: "subtitle",
        cell: (p) => formatMoney(p.price, currency),
      },
      {
        id: "categories",
        header: "Categories",
        hideable: true,
        mobile: "detail",
        cell: (p) =>
          p.categories.length ? (
            <span className="block max-w-48 truncate">
              {p.categories.map((c) => c.name).join(", ")}
            </span>
          ) : (
            <span className="text-muted-foreground">—</span>
          ),
      },
      {
        id: "brand",
        header: "Brand",
        hideable: true,
        defaultHidden: true,
        mobile: "hidden",
        cell: (p) =>
          p.brand?.name ?? <span className="text-muted-foreground">—</span>,
      },
      {
        id: "status",
        header: "Status",
        mobile: "meta",
        cell: (p) => (
          <StatusBadge tone={p.is_active ? "success" : "muted"}>
            {p.is_active ? "Active" : "Inactive"}
          </StatusBadge>
        ),
      },
      {
        id: "created",
        header: "Added",
        hideable: true,
        mobile: "hidden",
        cell: (p) => formatDate(p.created_at, display),
      },
    ],
    [currency, display]
  )

  async function runBulk(
    action: "activate" | "deactivate",
    ids: string[],
    clear: () => void
  ) {
    try {
      const result = await bulk.mutateAsync({ action, ids: ids.map(Number) })
      const summary = summarizeBulk(
        result,
        { one: "product", many: "products" },
        action === "activate" ? "activated" : "deactivated"
      )
      toast.add({
        title: summary.title,
        description: summary.description,
        type: summary.type,
      })
      clear()
    } catch (error) {
      toast.add({
        title: "Bulk update failed",
        description: isApiError(error) ? error.message : "Try again.",
        type: "error",
      })
    }
  }

  async function toggleActive(product: ProductRow) {
    try {
      await setActive.mutateAsync({
        id: product.id,
        isActive: !product.is_active,
      })
      toast.add({
        title: product.is_active
          ? `${product.name} deactivated`
          : `${product.name} activated`,
        type: "success",
      })
    } catch (error) {
      toast.add({
        title: "Couldn't update the product",
        description: isApiError(error) ? error.message : undefined,
        type: "error",
      })
    }
  }

  async function confirmDelete() {
    if (!pendingDelete) return
    setDeleteError(null)
    try {
      await remove.mutateAsync(pendingDelete.id)
      toast.add({ title: `${pendingDelete.name} deleted`, type: "success" })
      setPendingDelete(null)
    } catch (error) {
      setDeleteError(
        isApiError(error) ? error.message : "The product could not be deleted."
      )
    }
  }

  const clearFilters = () => {
    setSearch("")
    void setFilters({
      search: "",
      product_type: null,
      is_active: null,
      brand_id: null,
      category_id: null,
      page: 1,
    })
  }

  return (
    <>
      <PageHeader
        title="Products"
        description="Everything you sell, with prices, categories and availability."
        actions={
          canCreate ? (
            <Button nativeButton={false} render={<Link href="/products/new" />}>
              <Icon name="add" data-icon="inline-start" />
              Add product
            </Button>
          ) : null
        }
      />

      <DataTable<ProductRow>
        tableId="products"
        columns={columns}
        rows={query.data?.items}
        getRowId={(p) => String(p.id)}
        isLoading={query.isPending}
        isFetching={query.isFetching}
        error={query.error}
        onRetry={() => void query.refetch()}
        rowHref={(p) => `/products/${p.id}`}
        filtered={filtered}
        paging={{
          pagination: query.data?.pagination,
          onPageChange: (page) => void setFilters({ page }),
          onPerPageChange: (per_page) => void setFilters({ per_page, page: 1 }),
        }}
        toolbar={
          <>
            <InputGroup className="w-full sm:w-72">
              <InputGroupAddon>
                <Icon name="search" />
              </InputGroupAddon>
              <InputGroupInput
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search name, SKU or barcode"
                aria-label="Search products"
              />
            </InputGroup>
            <div className="hidden flex-wrap items-center gap-2 lg:flex">
              <Filters
                filters={filters}
                setFilters={(f) => void setFilters(f)}
              />
            </div>
            <Sheet>
              <SheetTrigger
                render={<Button variant="outline" className="lg:hidden" />}
              >
                <Icon name="filter" data-icon="inline-start" />
                Filters
                {activeFilterCount > 0 ? (
                  <span className="ms-1 rounded-full bg-primary px-1.5 text-xs text-primary-foreground">
                    {activeFilterCount}
                  </span>
                ) : null}
              </SheetTrigger>
              <SheetContent side="bottom" className="max-h-[85svh]">
                <SheetHeader>
                  <SheetTitle>Filter products</SheetTitle>
                  <SheetDescription>
                    Narrow the list by type, status, brand or category.
                  </SheetDescription>
                </SheetHeader>
                <div className="px-4">
                  <Filters
                    compact
                    filters={filters}
                    setFilters={(f) => void setFilters(f)}
                  />
                </div>
                <SheetFooter>
                  <Button variant="outline" onClick={clearFilters}>
                    Clear filters
                  </Button>
                </SheetFooter>
              </SheetContent>
            </Sheet>
            {filtered ? (
              <Button
                variant="ghost"
                onClick={clearFilters}
                className="hidden lg:inline-flex"
              >
                Clear
              </Button>
            ) : null}
          </>
        }
        bulkActions={
          canBulk
            ? (ids, clear) => (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={bulk.isPending}
                    onClick={() => void runBulk("activate", ids, clear)}
                  >
                    Activate
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={bulk.isPending}
                    onClick={() => void runBulk("deactivate", ids, clear)}
                  >
                    Deactivate
                  </Button>
                </>
              )
            : undefined
        }
        rowActions={(p) =>
          canUpdate || canDelete ? (
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Actions for ${p.name}`}
                  />
                }
              >
                <Icon name="more" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="min-w-44">
                <DropdownMenuGroup>
                  <DropdownMenuItem
                    render={<Link href={`/products/${p.id}`} />}
                  >
                    <Icon name="show" />
                    View
                  </DropdownMenuItem>
                  {canUpdate ? (
                    <>
                      <DropdownMenuItem
                        render={<Link href={`/products/${p.id}/edit`} />}
                      >
                        <Icon name="edit" />
                        Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => void toggleActive(p)}>
                        <Icon name={p.is_active ? "hide" : "check"} />
                        {p.is_active ? "Deactivate" : "Activate"}
                      </DropdownMenuItem>
                    </>
                  ) : null}
                </DropdownMenuGroup>
                {canDelete ? (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuGroup>
                      <DropdownMenuItem
                        variant="destructive"
                        onClick={() => setPendingDelete(p)}
                      >
                        <Icon name="delete" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuGroup>
                  </>
                ) : null}
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null
        }
        emptyState={
          <StateView
            icon="products"
            title="No products yet"
            description="Add your first product to start building your catalogue."
            action={
              canCreate ? (
                <Button
                  nativeButton={false}
                  render={<Link href="/products/new" />}
                >
                  <Icon name="add" data-icon="inline-start" />
                  Add product
                </Button>
              ) : undefined
            }
          />
        }
        noResultsState={
          <StateView
            icon="search"
            title="No products match your filters"
            description="Try a different search or clear the filters."
            action={
              <Button variant="outline" onClick={clearFilters}>
                Clear filters
              </Button>
            }
          />
        }
      />

      <ConfirmDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => {
          if (!open) {
            setPendingDelete(null)
            setDeleteError(null)
          }
        }}
        title={`Delete ${pendingDelete?.name ?? "product"}?`}
        description="The product is removed from your catalogue and store. Orders that include it keep their history."
        confirmLabel="Delete product"
        destructive
        pending={remove.isPending}
        onConfirm={() => void confirmDelete()}
      >
        {deleteError ? (
          <p className="text-sm text-destructive">{deleteError}</p>
        ) : null}
      </ConfirmDialog>
    </>
  )
}
