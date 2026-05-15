import { withAuth } from "next-auth/middleware"
import { NextResponse } from "next/server"

export default withAuth(
  function proxy(req) {
    const role = req.nextauth.token?.role
    const { pathname } = req.nextUrl

    // Users (customers) cannot access the staff dashboard
    if (pathname.startsWith("/dashboard") && role === "user") {
      return NextResponse.redirect(new URL("/account", req.url))
    }

    return NextResponse.next()
  },
  {
    callbacks: {
      authorized({ token, req }) {
        const { pathname } = req.nextUrl
        if (pathname.startsWith("/dashboard") || pathname.startsWith("/account")) {
          return !!token
        }
        return true
      },
    },
  }
)

export const config = {
  matcher: ["/dashboard/:path*", "/account/:path*"],
}
