import { staffBff } from "@/server/bff"

type Context = { params: Promise<{ path: string[] }> }

const handle = async (request: Request, { params }: Context) => staffBff.proxy(request, (await params).path)

export const GET = handle
export const POST = handle
export const PUT = handle
export const PATCH = handle
export const DELETE = handle
