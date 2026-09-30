import { redirect } from "next/navigation"

/** The console home is the dashboard (spec §25.1). */
export default function Page() {
  redirect("/dashboard")
}
