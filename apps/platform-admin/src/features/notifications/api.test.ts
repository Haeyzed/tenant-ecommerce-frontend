import { describe, expect, it } from "vitest"

import { previewText, templateGroup, templateName, unknownPlaceholders } from "./api"

describe("unknownPlaceholders", () => {
  const allowed = ["owner_name", "platform_name"]

  it("accepts known placeholders, with or without inner spaces", () => {
    expect(unknownPlaceholders("Hi {{owner_name}} from {{ platform_name }}", allowed)).toEqual([])
  })

  it("reports each unknown placeholder once", () => {
    expect(unknownPlaceholders("{{ownr_name}} {{ownr_name}} {{code}}", allowed)).toEqual(["ownr_name", "code"])
  })

  it("ignores braces that aren't placeholders", () => {
    expect(unknownPlaceholders("{single} {{ Not Valid }}", allowed)).toEqual([])
  })
})

describe("previewText", () => {
  it("shows placeholders as the API's sample values", () => {
    expect(previewText("Hello {{ owner_name }}, welcome to {{platform_name}}.")).toBe("Hello [owner_name], welcome to [platform_name].")
  })
})

describe("template labels", () => {
  it("names a template from the last part of its key", () => {
    expect(templateName("tenant.legal_reacceptance_required")).toBe("Legal reacceptance required")
  })

  it("groups by key prefix and falls back to a readable prefix", () => {
    expect(templateGroup("subscription.renewal_failed")).toBe("Billing")
    expect(templateGroup("platform_user.invited")).toBe("Platform team")
    expect(templateGroup("helpdesk.reply")).toBe("Helpdesk")
  })
})
