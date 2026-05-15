import { NextResponse } from "next/server"
import { hash } from "bcryptjs"
import { prisma } from "@/lib/prisma"

export async function POST(req: Request) {
  // TODO[7]: Rate limiting — this endpoint has no rate limit; add IP-based rate limiting
  // (e.g. Vercel KV + @upstash/ratelimit) before production to prevent account spam.

  const body = await req.json()
  const { email, password, firstName, lastName, phone, companyName, address } = body

  if (!email || !password || !firstName || !lastName) {
    return NextResponse.json(
      { data: null, error: "email, password, firstName, and lastName are required" },
      { status: 400 }
    )
  }

  if (password.length < 8) {
    return NextResponse.json(
      { data: null, error: "Password must be at least 8 characters" },
      { status: 400 }
    )
  }

  try {
    const hashedPassword = await hash(password, 12)

    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        firstName,
        lastName,
        phone: phone || null,
        companyName: companyName || null,
        role: "user",
      },
      select: { id: true, email: true, firstName: true, lastName: true, role: true },
    })

    if (address?.street) {
      await prisma.address.create({
        data: {
          userId: user.id,
          street: address.street,
          city: address.city || "",
          state: address.state || "",
          zipCode: address.zipCode || "",
          label: "primary",
        },
      })
    }

    return NextResponse.json({ data: user, error: null }, { status: 201 })
  } catch (e: any) {
    if (e?.code === "P2002") {
      return NextResponse.json({ data: null, error: "Email already in use" }, { status: 409 })
    }
    return NextResponse.json({ data: null, error: "Failed to create account" }, { status: 500 })
  }
}
