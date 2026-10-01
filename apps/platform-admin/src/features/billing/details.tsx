import type { ReactNode } from "react"

import { Card, CardContent, CardHeader, CardTitle } from "@workspace/ui/components/card"

/** A labelled fact on a detail page; empty values show a dash. */
export type Detail = { term: string; value: ReactNode; wide?: boolean }

/** A titled card of facts in two columns (one on phones). */
export function DetailCard({ title, details, action }: { title: string; details: Detail[]; action?: ReactNode }) {
  return (
    <Card className="min-w-0">
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <CardTitle>{title}</CardTitle>
        {action}
      </CardHeader>
      <CardContent>
        <dl className="grid grid-cols-1 gap-x-6 gap-y-4 text-sm sm:grid-cols-2">
          {details.map((d) => (
            <div key={d.term} className={d.wide ? "flex min-w-0 flex-col gap-0.5 sm:col-span-2" : "flex min-w-0 flex-col gap-0.5"}>
              <dt className="text-muted-foreground">{d.term}</dt>
              <dd className="min-w-0 break-words">{d.value === null || d.value === undefined || d.value === "" ? "—" : d.value}</dd>
            </div>
          ))}
        </dl>
      </CardContent>
    </Card>
  )
}
