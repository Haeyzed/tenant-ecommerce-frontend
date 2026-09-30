import { platformBff } from "@/server/bff"

export const GET = (request: Request) => platformBff.expired(request)
