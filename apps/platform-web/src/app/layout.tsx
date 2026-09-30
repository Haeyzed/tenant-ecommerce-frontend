import type { Metadata } from "next"
import { Geist_Mono, Inter } from "next/font/google"

import "@workspace/ui/globals.css"
import { cn } from "@workspace/ui/lib/utils"

import { loadPlatformConfig } from "@/server/api"
import { SiteShell } from "@/shell/site-shell"
import { SiteProviders } from "@/shell/providers"

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" })
const fontMono = Geist_Mono({ subsets: ["latin"], variable: "--font-mono" })

export async function generateMetadata(): Promise<Metadata> {
  const { name } = await loadPlatformConfig()
  return { title: { default: name, template: `%s · ${name}` } }
}

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const config = await loadPlatformConfig()

  return (
    <html lang="en" suppressHydrationWarning className={cn("antialiased", fontMono.variable, "font-sans", inter.variable)}>
      <body className="bg-background">
        <SiteProviders>
          <SiteShell config={config}>{children}</SiteShell>
        </SiteProviders>
      </body>
    </html>
  )
}
