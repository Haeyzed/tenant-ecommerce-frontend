import { staffBff } from "@/server/bff"

export const GET = (request: Request) => staffBff.expired(request)
