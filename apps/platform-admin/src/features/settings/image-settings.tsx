"use client"

import { useQuery } from "@tanstack/react-query"
import { useRef, useState } from "react"

import { isApiError } from "@workspace/api-client"
import { Button } from "@workspace/ui/components/button"
import { ConfirmDialog } from "@workspace/ui/components/confirm-dialog"
import { Field, FieldDescription, FieldTitle } from "@workspace/ui/components/field"
import { Spinner } from "@workspace/ui/components/spinner"
import { toast } from "@workspace/ui/components/toast"
import { Icon } from "@workspace/ui/icons"

import { platformConfigQuery, useImageSetting } from "./api"
import { FIELDS, IMAGE_SLOTS, fieldLabel } from "./meta"

const ACCEPT = "image/png,image/jpeg,image/webp,image/gif"

function ImageSlot({ settingKey, slot, url }: { settingKey: string; slot: string; url: string | null }) {
  const input = useRef<HTMLInputElement>(null)
  const { upload, remove } = useImageSetting()
  const [confirmRemove, setConfirmRemove] = useState(false)
  const label = fieldLabel(settingKey)
  const busy = upload.isPending || remove.isPending

  async function onFile(file: File | undefined) {
    if (!file) return
    try {
      await upload.mutateAsync({ slot, file })
      toast.add({ title: `${label} updated`, type: "success" })
    } catch (error) {
      const message = isApiError(error) ? (error.fieldErrors.image?.join(" ") ?? error.message) : "The upload failed."
      toast.add({ title: `Couldn't upload the ${label.toLowerCase()}`, description: message, type: "error" })
    } finally {
      if (input.current) input.current.value = ""
    }
  }

  return (
    <Field className="rounded-xl border p-4">
      <div className="flex items-start gap-4">
        <div className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-lg border bg-muted">
          {url ? (
            // eslint-disable-next-line @next/next/no-img-element -- media host URLs vary per environment
            <img src={url} alt="" className="size-full object-contain" />
          ) : (
            <Icon name="image" className="size-6 text-muted-foreground" />
          )}
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <FieldTitle>{label}</FieldTitle>
          <FieldDescription>{FIELDS[settingKey]?.description ?? "PNG, JPG, WebP or GIF."}</FieldDescription>
          <div className="mt-2 flex flex-wrap gap-2">
            <input ref={input} type="file" accept={ACCEPT} className="sr-only" aria-label={`Upload ${label}`} onChange={(e) => void onFile(e.target.files?.[0])} />
            <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => input.current?.click()}>
              {upload.isPending ? <Spinner data-icon="inline-start" /> : <Icon name="upload" data-icon="inline-start" />}
              {url ? "Replace" : "Upload"}
            </Button>
            {url ? (
              <Button type="button" variant="ghost" size="sm" disabled={busy} onClick={() => setConfirmRemove(true)}>
                Remove
              </Button>
            ) : null}
          </div>
        </div>
      </div>
      <ConfirmDialog
        open={confirmRemove}
        onOpenChange={setConfirmRemove}
        title={`Remove the ${label.toLowerCase()}?`}
        description="The website and emails fall back to the platform name until you upload a new one."
        confirmLabel="Remove"
        destructive
        pending={remove.isPending}
        onConfirm={async () => {
          await remove.mutateAsync(slot).catch(() => toast.add({ title: "Couldn't remove the image", type: "error" }))
          setConfirmRemove(false)
        }}
      />
    </Field>
  )
}

/** The general group's images, uploaded through the media endpoint (BG-12). */
export function ImageSettings({ keys }: { keys: string[] }) {
  const config = useQuery(platformConfigQuery())
  const slots = keys.filter((key) => IMAGE_SLOTS[key])
  if (slots.length === 0) return null

  return (
    <div className="grid gap-3 lg:grid-cols-3">
      {slots.map((key) => {
        const slot = IMAGE_SLOTS[key]
        if (!slot) return null
        const url = config.data?.[`${key.replace(/_media_id$/, "")}_url`]
        return <ImageSlot key={key} settingKey={key} slot={slot} url={typeof url === "string" ? url : null} />
      })}
    </div>
  )
}
