import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { CouponEdit } from "@/features/coupons"

export const metadata: Metadata = { title: "Edit coupon" }

export default async function Page({ params }: PageProps<"/platform-coupons/[coupon]/edit">) {
  const id = Number((await params).coupon)
  if (!Number.isInteger(id) || id <= 0) notFound()

  return <CouponEdit id={id} />
}
