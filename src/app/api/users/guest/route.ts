import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ data: null, error: "Unauthorized" }, { status: 401 })
  if (session.user.role !== "admin") return NextResponse.json({ data: null, error: "Forbidden" }, { status: 403 })

  const body = await req.json()
  const { firstName, lastName, email, phone } = body

  if (!firstName || !lastName) {
    return NextResponse.json({ data: null, error: "firstName and lastName are required" }, { status: 400 })
  }

  const resolvedEmail = email?.trim() || `guest-${crypto.randomUUID()}@guest.local`

  try {
    const user = await prisma.user.create({
      data: {
        firstName,
        lastName,
        email: resolvedEmail,
        phone: phone || null,
        role: "guest",
      },
      select: { id: true, firstName: true, lastName: true, email: true, role: true },
    })
    return NextResponse.json({ data: user, error: null }, { status: 201 })
  } catch (e: any) {
    if (e?.code === "P2002") {
      return NextResponse.json({ data: null, error: "Email already in use" }, { status: 409 })
    }
    return NextResponse.json({ data: null, error: "Failed to create guest user" }, { status: 500 })
  }
}
