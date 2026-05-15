import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ data: null, error: "Unauthorized" }, { status: 401 })
  if (session.user.role !== "admin") return NextResponse.json({ data: null, error: "Forbidden" }, { status: 403 })

  const { id } = await params
  const user = await prisma.user.findUnique({
    where: { id },
    select: { id: true, email: true, firstName: true, lastName: true, companyName: true, phone: true, role: true, createdAt: true },
  })
  if (!user) return NextResponse.json({ data: null, error: "Not found" }, { status: 404 })
  return NextResponse.json({ data: user, error: null })
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ data: null, error: "Unauthorized" }, { status: 401 })
  if (session.user.role !== "admin") return NextResponse.json({ data: null, error: "Forbidden" }, { status: 403 })

  const { id } = await params
  const body = await req.json()
  const { role } = body

  if (!role || !["admin", "employee", "user"].includes(role)) {
    return NextResponse.json({ data: null, error: "role must be admin, employee, or user" }, { status: 400 })
  }

  const me = await prisma.user.findUnique({ where: { email: session.user.email! }, select: { id: true } })
  if (me?.id === id && role !== "admin") {
    return NextResponse.json({ data: null, error: "Cannot demote your own account" }, { status: 400 })
  }

  const user = await prisma.user.update({
    where: { id },
    data: { role },
    select: { id: true, email: true, firstName: true, lastName: true, role: true, createdAt: true },
  })
  return NextResponse.json({ data: user, error: null })
}
