import { cn } from "@workspace/ui/lib/utils"

const STEPS = [
  { key: "details", label: "Details" },
  { key: "verify", label: "Verify email" },
  { key: "setup", label: "Set up" },
] as const

export type SignupStep = (typeof STEPS)[number]["key"]

/** A compact progress indicator for the sign-up steps. */
export function SignupSteps({ current }: { current: SignupStep }) {
  const index = STEPS.findIndex((s) => s.key === current)

  return (
    <ol className="flex items-center gap-2 text-xs" aria-label="Sign-up progress">
      {STEPS.map((step, i) => (
        <li key={step.key} className="flex flex-1 flex-col gap-1.5" aria-current={i === index ? "step" : undefined}>
          <span className={cn("h-1 rounded-full bg-muted", i <= index && "bg-primary")} />
          <span className={cn("text-muted-foreground", i === index && "font-medium text-foreground")}>{step.label}</span>
        </li>
      ))}
    </ol>
  )
}
