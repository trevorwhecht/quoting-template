import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ data: null, error: "Unauthorized" }, { status: 401 })

  const role = session.user.role
  if (role !== "admin" && role !== "employee") {
    return NextResponse.json({ data: null, error: "Forbidden" }, { status: 403 })
  }

  const states = await prisma.orderState.findMany({ orderBy: { sortOrder: "asc" } })
  return NextResponse.json({ data: states, error: null })
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ data: null, error: "Unauthorized" }, { status: 401 })
  if (session.user.role !== "admin") return NextResponse.json({ data: null, error: "Forbidden" }, { status: 403 })

  const body = await req.json()
  const { name, color, description } = body
  if (!name) return NextResponse.json({ data: null, error: "name is required" }, { status: 400 })

  const maxSort = await prisma.orderState.aggregate({ _max: { sortOrder: true } })
  const sortOrder = (maxSort._max.sortOrder ?? 0) + 1

  const state = await prisma.orderState.create({
    data: { name, color: color || null, description: description || null, sortOrder },
  })
  return NextResponse.json({ data: state, error: null }, { status: 201 })
}
