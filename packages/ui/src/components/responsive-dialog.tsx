"use client"

import * as React from "react"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog"
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerTitle,
} from "@workspace/ui/components/drawer"
import { useIsMobile } from "@workspace/ui/hooks/use-mobile"
import { cn } from "@workspace/ui/lib/utils"

const DrawerModeContext = React.createContext(false)

type ResponsiveDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  children: React.ReactNode
  /**
   * `auto` (default): a bottom drawer below 768 px, a centred dialog above,
   * like ConfirmDialog. `dialog` or `drawer` force one presentation.
   */
  variant?: "auto" | "dialog" | "drawer"
}

/**
 * A dialog that becomes a bottom drawer on phones. The parts mirror the
 * Dialog ones, so a form keeps its header, fields and footer as they are:
 * in the drawer the content scrolls and the footer stays in view.
 */
function ResponsiveDialog({
  open,
  onOpenChange,
  children,
  variant = "auto",
}: ResponsiveDialogProps) {
  const isMobile = useIsMobile()
  const asDrawer = variant === "drawer" || (variant === "auto" && isMobile)

  return (
    <DrawerModeContext.Provider value={asDrawer}>
      {asDrawer ? (
        <Drawer open={open} onOpenChange={onOpenChange} showSwipeHandle>
          {children}
        </Drawer>
      ) : (
        <Dialog open={open} onOpenChange={onOpenChange}>
          {children}
        </Dialog>
      )}
    </DrawerModeContext.Provider>
  )
}

function ResponsiveDialogContent({
  className,
  children,
}: {
  className?: string
  children: React.ReactNode
}) {
  const asDrawer = React.useContext(DrawerModeContext)

  if (!asDrawer) {
    return <DialogContent className={className}>{children}</DialogContent>
  }

  return (
    <DrawerContent>
      <div
        data-slot="responsive-dialog-scroll"
        className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto overscroll-contain px-4 pt-2"
      >
        {children}
      </div>
    </DrawerContent>
  )
}

function ResponsiveDialogHeader({
  className,
  ...props
}: React.ComponentProps<"div">) {
  const asDrawer = React.useContext(DrawerModeContext)
  if (!asDrawer) return <DialogHeader className={className} {...props} />

  return (
    <div
      data-slot="responsive-dialog-header"
      className={cn("flex flex-col gap-1", className)}
      {...props}
    />
  )
}

function ResponsiveDialogTitle({
  className,
  ...props
}: React.ComponentProps<typeof DialogTitle>) {
  const asDrawer = React.useContext(DrawerModeContext)
  return asDrawer ? (
    <DrawerTitle className={className} {...props} />
  ) : (
    <DialogTitle className={className} {...props} />
  )
}

function ResponsiveDialogDescription({
  className,
  ...props
}: React.ComponentProps<typeof DialogDescription>) {
  const asDrawer = React.useContext(DrawerModeContext)
  return asDrawer ? (
    <DrawerDescription className={className} {...props} />
  ) : (
    <DialogDescription className={className} {...props} />
  )
}

/** In the drawer it sticks to the bottom; the primary action, last in source, sits on top, nearest the thumb. */
function ResponsiveDialogFooter({
  className,
  ...props
}: React.ComponentProps<"div">) {
  const asDrawer = React.useContext(DrawerModeContext)
  if (!asDrawer) return <DialogFooter className={className} {...props} />

  return (
    <div
      data-slot="responsive-dialog-footer"
      className={cn(
        "sticky bottom-0 z-10 -mx-4 mt-auto flex flex-col-reverse gap-2 border-t bg-popover p-4 pb-[max(1rem,env(safe-area-inset-bottom))] *:data-[slot=button]:h-10 *:data-[slot=button]:w-full",
        className
      )}
      {...props}
    />
  )
}

export {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogFooter,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
}
export type { ResponsiveDialogProps }
