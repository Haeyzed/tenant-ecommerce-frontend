"use client"

import { parseAsStringLiteral, useQueryState } from "nuqs"

import { useCan } from "@workspace/access/react"
import { PageHeader } from "@workspace/ui/components/page-header"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@workspace/ui/components/tabs"

import { ChannelsTab } from "./channels-tab"
import { TemplatesTab } from "./templates-tab"

const TABS = ["messages", "channels"] as const

/** Platform notifications (spec §25.1, §17): the wording of each message and where it is sent. */
export function NotificationsPage() {
  const [tab, setTab] = useQueryState("tab", parseAsStringLiteral(TABS).withDefault("messages"))
  const canSeeChannels = useCan("landlord.notifications.matrix.index")

  return (
    <>
      <PageHeader title="Notifications" description="The emails and in-app messages the platform sends to stores, affiliates, people signing up and your team." />
      <Tabs value={canSeeChannels ? tab : "messages"} onValueChange={(v) => void setTab(TABS.find((x) => x === v) ?? "messages")}>
        <TabsList>
          <TabsTrigger value="messages">Messages</TabsTrigger>
          {canSeeChannels ? <TabsTrigger value="channels">Channels</TabsTrigger> : null}
        </TabsList>
        <TabsContent value="messages" className="pt-4">
          <TemplatesTab />
        </TabsContent>
        {canSeeChannels ? (
          <TabsContent value="channels" className="pt-4">
            <ChannelsTab />
          </TabsContent>
        ) : null}
      </Tabs>
    </>
  )
}
