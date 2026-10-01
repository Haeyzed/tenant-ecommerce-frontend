import { publicBff } from "@/server/bff"
import { withReferralToken } from "@/server/referral"

type Context = { params: Promise<{ path: string[] }> }

const handle = async (request: Request, { params }: Context) => {
  const path = (await params).path
  return publicBff.proxy(await withReferralToken(request, path), path)
}

export const GET = handle
export const POST = handle
