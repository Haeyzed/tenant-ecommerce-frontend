"use client"

import { useQuery } from "@tanstack/react-query"

import { ErrorState } from "@workspace/admin-kit/states"
import { PageHeader } from "@workspace/ui/components/page-header"
import { Skeleton } from "@workspace/ui/components/skeleton"

import { couponQuery } from "./api"
import { CouponForm } from "./coupon-form"

/** Loads the coupon, then edits it with the shared form. */
export function CouponEdit({ id }: { id: number }) {
  const query = useQuery(couponQuery(id))

  if (query.isPending) return <Skeleton className="h-96 w-full" />
  if (query.isError) return <ErrorState error={query.error} onRetry={() => void query.refetch()} size="page" />

  return (
    <>
      <PageHeader title={`Edit ${query.data.coupon.code}`} description={query.data.coupon.name} />
      <CouponForm key={query.data.coupon.id} coupon={query.data.coupon} />
    </>
  )
}
