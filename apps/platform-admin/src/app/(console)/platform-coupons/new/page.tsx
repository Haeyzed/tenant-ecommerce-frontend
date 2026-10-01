import type { Metadata } from "next"

import { PageHeader } from "@workspace/ui/components/page-header"

import { CouponForm } from "@/features/coupons"

export const metadata: Metadata = { title: "New coupon" }

export default function Page() {
  return (
    <>
      <PageHeader title="New coupon" description="A discount code stores can apply to their plan at sign-up or when changing plan." />
      <CouponForm coupon={null} />
    </>
  )
}
