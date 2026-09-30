import type { Metadata } from "next"

import { ProductsPage } from "@/features/catalog"

export const metadata: Metadata = { title: "Products" }

export default function Page() {
  return <ProductsPage />
}
