import type { AuthBrand } from "@workspace/admin-kit/auth"

import type { PlatformBranding } from "@/server/api"

/** The platform console's sign-in panel. */
export function platformBrand(branding: PlatformBranding, headline: string, blurb: string): AuthBrand {
  return { name: branding.name, logoUrl: branding.logoUrl, caption: "Platform administration", headline, blurb, icon: "building" }
}
