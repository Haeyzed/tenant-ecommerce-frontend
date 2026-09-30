import { staffBff } from "@/server/bff"

type Context = { params: Promise<{ action: string }> }

export async function POST(request: Request, { params }: Context) {
  switch ((await params).action) {
    case "login":
      return staffBff.login(request)
    case "logout":
      return staffBff.logout(request)
    case "refresh":
      return staffBff.refresh(request)
    default:
      return Response.json(
        {
          success: false,
          message: "The requested resource was not found.",
          data: null,
          meta: { error_code: "not_found", details: {} },
          errors: {},
        },
        { status: 404 }
      )
  }
}
