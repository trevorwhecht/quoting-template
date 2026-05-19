import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function POST(req: Request) {
  const body = await req.json()
  const { firstName, lastName, email, phone, company } = body

  if (!firstName?.trim() || !lastName?.trim()) {
    return NextResponse.json({ data: null, error: "First and last name are required" }, { status: 400 })
  }
  if (!phone?.trim()) {
    return NextResponse.json({ data: null, error: "Phone is required" }, { status: 400 })
  }

  const resolvedEmail = email?.trim() || `guest-${crypto.randomUUID()}@guest.local`

  try {
    const user = await prisma.user.create({
      data: {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: resolvedEmail,
        phone: phone.trim(),
        companyName: company?.trim() || null,
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
