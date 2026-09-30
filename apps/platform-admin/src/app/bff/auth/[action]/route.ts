import { platformBff } from "@/server/bff"

type Context = { params: Promise<{ action: string }> }

/** login, logout, refresh, forgot and reset (spec §8.5, §9). */
export async function POST(request: Request, { params }: Context) {
  return platformBff.auth(request, (await params).action)
}
