import "next-auth"
import "next-auth/jwt"

declare module "next-auth" {
  interface User {
    role: string
    firstName: string
    lastName: string
  }
  interface Session {
    user: {
      id: string
      role: string
      firstName: string
      lastName: string
    } & import("next-auth").DefaultSession["user"]
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role: string
    firstName: string
    lastName: string
  }
}
