"use client"

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
} from "@workspace/ui/components/alert-dialog"
import { Button } from "@workspace/ui/components/button"
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@workspace/ui/components/drawer"
import { Spinner } from "@workspace/ui/components/spinner"
import { useIsMobile } from "@workspace/ui/hooks/use-mobile"
import { Icon } from "@workspace/ui/icons"

type ConfirmDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: React.ReactNode
  confirmLabel: string
  cancelLabel?: string
  destructive?: boolean
  pending?: boolean
  onConfirm: () => void
  /**
   * `auto` (default): a bottom drawer below 768 px, a centred dialog above.
   * `dialog` or `drawer` force one presentation.
   */
  variant?: "auto" | "dialog" | "drawer"
  /** Extra content under the description, such as an error message. */
  children?: React.ReactNode
}

/**
 * A confirmation that states the consequence (spec §18.2). It stays open
 * while `pending` and cannot be dismissed then, so a failed action can show
 * its error and be retried.
 */
function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  cancelLabel = "Cancel",
  destructive = false,
  pending = false,
  onConfirm,
  variant = "auto",
  children,
}: ConfirmDialogProps) {
  const isMobile = useIsMobile()
  const asDrawer = variant === "drawer" || (variant === "auto" && isMobile)
  const handleOpenChange = (next: boolean) => {
    if (!pending) onOpenChange(next)
  }

  const confirmContent = (
    <>
      {pending ? <Spinner data-icon="inline-start" /> : null}
      {confirmLabel}
    </>
  )

  if (asDrawer) {
    return (
      <Drawer open={open} onOpenChange={handleOpenChange}>
        <DrawerContent>
          <DrawerHeader className="items-center gap-2 pt-2">
            {destructive ? (
              <span className="mb-1 flex size-10 items-center justify-center rounded-full bg-destructive/10 text-destructive">
                <Icon name="alert" className="size-5" />
              </span>
            ) : null}
            <DrawerTitle>{title}</DrawerTitle>
            <DrawerDescription>{description}</DrawerDescription>
          </DrawerHeader>
          {children ? <div className="px-4">{children}</div> : null}
          <DrawerFooter>
            {/* On a phone the primary action sits nearest the thumb, on top. */}
            <Button
              size="lg"
              variant={destructive ? "destructive" : "default"}
              disabled={pending}
              onClick={onConfirm}
            >
              {confirmContent}
            </Button>
            <Button
              size="lg"
              variant="outline"
              disabled={pending}
              onClick={() => handleOpenChange(false)}
            >
              {cancelLabel}
            </Button>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    )
  }

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          {destructive ? (
            <AlertDialogMedia className="bg-destructive/10 text-destructive">
              <Icon name="alert" />
            </AlertDialogMedia>
          ) : null}
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        {children}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>{cancelLabel}</AlertDialogCancel>
          <AlertDialogAction
            variant={destructive ? "destructive" : "default"}
            disabled={pending}
            onClick={onConfirm}
          >
            {confirmContent}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

export { ConfirmDialog }
export type { ConfirmDialogProps }
