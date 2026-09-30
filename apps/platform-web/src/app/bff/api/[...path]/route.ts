import { publicBff } from "@/server/bff"

type Context = { params: Promise<{ path: string[] }> }

const handle = async (request: Request, { params }: Context) =>
  publicBff.proxy(request, (await params).path)

export const GET = handle
export const POST = handle
