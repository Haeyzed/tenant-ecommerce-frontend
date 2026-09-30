import { useSyncExternalStore } from "react"

/**
 * Remembers the owner's email for this tab so the final "Open your admin"
 * link can prefill the login form (spec §24.3 step 6). Only the email is
 * kept, never the password. Storage can be unavailable; every access is
 * guarded and the flow works without it.
 */
const key = (registration: string) => `signup:${registration}:email`

export function rememberSignupEmail(registration: string, email: string) {
  try {
    sessionStorage.setItem(key(registration), email)
  } catch {
    // Private mode or blocked storage: the link simply has no email.
  }
}

function recallSignupEmail(registration: string): string | null {
  try {
    return sessionStorage.getItem(key(registration))
  } catch {
    return null
  }
}

const noSubscription = () => () => {}

/** The remembered email; null during server rendering and when storage is unavailable. */
export function useSignupEmail(registration: string): string | null {
  return useSyncExternalStore(
    noSubscription,
    () => recallSignupEmail(registration),
    () => null
  )
}
