import type { AllowRule } from "@workspace/bff"

/**
 * What the website's sessionless BFF may forward (spec §8.5): the public
 * landlord routes for plans, legal documents, lookups, config, coupons and
 * self-service registration. No admin or affiliate route is reachable.
 */
export const publicAllowList: readonly AllowRule[] = [
  { methods: ["GET"], prefix: "/api/plans" },
  { methods: ["GET"], prefix: "/api/legal-documents/" },
  { methods: ["GET"], prefix: "/api/lookups/" },
  { methods: ["GET"], prefix: "/api/platform/config" },
  { methods: ["POST"], prefix: "/api/platform-coupons/validate" },
  { methods: ["POST"], prefix: "/api/register" },
  { methods: ["GET"], prefix: "/api/register/" },
  { methods: ["POST"], prefix: "/api/contact" },
]
