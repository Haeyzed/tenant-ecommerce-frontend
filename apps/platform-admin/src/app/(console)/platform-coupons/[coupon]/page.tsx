import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { CouponDetail } from "@/features/coupons"

export const metadata: Metadata = { title: "Coupon" }

export default async function Page({ params }: PageProps<"/platform-coupons/[coupon]">) {
  const id = Number((await params).coupon)
  if (!Number.isInteger(id) || id <= 0) notFound()

  return <CouponDetail id={id} />
}
