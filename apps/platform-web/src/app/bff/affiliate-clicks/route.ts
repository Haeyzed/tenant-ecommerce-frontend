import { recordClick } from "@/server/referral"

export const POST = (request: Request) => recordClick(request)
