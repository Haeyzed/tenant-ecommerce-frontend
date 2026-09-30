import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@workspace/ui/components/empty"
import { Icon } from "@workspace/ui/icons"

/** Shown when the platform has switched self-service sign-up off (503 registration_unavailable). */
export function SignupPaused({ supportEmail }: { supportEmail: string | null }) {
  return (
    <Empty className="border">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <Icon name="clock" />
        </EmptyMedia>
        <EmptyTitle>Sign-ups are paused</EmptyTitle>
        <EmptyDescription>
          New stores can&apos;t be created right now. Please check back soon
          {supportEmail ? (
            <>
              {" "}
              or contact <a href={`mailto:${supportEmail}`}>{supportEmail}</a>
            </>
          ) : null}
          .
        </EmptyDescription>
      </EmptyHeader>
    </Empty>
  )
}
