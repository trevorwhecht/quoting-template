import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ data: null, error: "Unauthorized" }, { status: 401 })
  if (session.user.role !== "admin") return NextResponse.json({ data: null, error: "Forbidden" }, { status: 403 })

  const settings = await prisma.universalSettings.findMany()
  return NextResponse.json({ data: settings, error: null })
}

export async function PATCH(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ data: null, error: "Unauthorized" }, { status: 401 })
  if (session.user.role !== "admin") return NextResponse.json({ data: null, error: "Forbidden" }, { status: 403 })

  const body = await req.json()
  const { setting, value } = body
  if (!setting || value === undefined) {
    return NextResponse.json({ data: null, error: "setting and value are required" }, { status: 400 })
  }

  const updated = await prisma.universalSettings.upsert({
    where: { setting },
    update: { value: String(value), lastUpdatedBy: session.user.email ?? null },
    create: { setting, value: String(value) },
  })
  return NextResponse.json({ data: updated, error: null })
}
