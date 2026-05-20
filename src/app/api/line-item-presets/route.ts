import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export function serializePreset(p: any) {
  return { ...p, defaultPrice: Number(p.defaultPrice), defaultCost: Number(p.defaultCost) }
}

export async function GET(req: Request) {
  const session = await getServerSession(authOptions)
  const isAdmin = session?.user?.role === "admin"
  const showAll = isAdmin && new URL(req.url).searchParams.get("all") === "1"

  const presets = await prisma.lineItemPreset.findMany({
    where: showAll ? undefined : { isActive: true },
    orderBy: { sortOrder: "asc" },
  })
  const serialized = presets.map(serializePreset)
  // Strip internal cost from public (unauthenticated) responses
  const data = isAdmin ? serialized : serialized.map(({ defaultCost: _c, ...p }) => p)
  return NextResponse.json({ data, error: null })
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== "admin") {
    return NextResponse.json({ data: null, error: "Forbidden" }, { status: 403 })
  }
  const body = await req.json()
  const { name, description, defaultPrice, defaultCost, sortOrder } = body
  if (!name) return NextResponse.json({ data: null, error: "name is required" }, { status: 400 })

  const preset = await prisma.lineItemPreset.create({
    data: {
      name,
      description: description || null,
      defaultPrice: defaultPrice ?? 0,
      defaultCost: defaultCost ?? 0,
      sortOrder: sortOrder ?? 0,
    },
  })
  return NextResponse.json({ data: serializePreset(preset), error: null }, { status: 201 })
}
