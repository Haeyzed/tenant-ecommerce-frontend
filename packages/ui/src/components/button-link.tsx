"use client"

import { mergeProps } from "@base-ui/react/merge-props"
import { useRender } from "@base-ui/react/use-render"
import type { VariantProps } from "class-variance-authority"

import { buttonVariants } from "@workspace/ui/components/button"
import { cn } from "@workspace/ui/lib/utils"

/**
 * A link styled as a button. Navigation stays a real link for assistive
 * technology, whereas a Button rendering an anchor announces itself as a
 * button. Pass a router link through `render`: render={<Link href="/x" />}.
 */
function ButtonLink({
  className,
  variant = "default",
  size = "default",
  render,
  ...props
}: useRender.ComponentProps<"a"> & VariantProps<typeof buttonVariants>) {
  return useRender({
    defaultTagName: "a",
    render,
    props: mergeProps<"a">({ className: cn(buttonVariants({ variant, size, className })) }, props),
  })
}

export { ButtonLink }
