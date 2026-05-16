import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET(req: Request) {
  const session = await getServerSession(authOptions)
  const role = session?.user?.role ?? "anonymous"
  const isAdmin = role === "admin"
  const isStaff = role === "admin" || role === "employee"

  const showAll = isAdmin && new URL(req.url).searchParams.get("all") === "1"

  const presets = await prisma.setupFeePreset.findMany({
    where: showAll ? undefined : { isActive: true },
    orderBy: { sortOrder: "asc" },
  })

  const data = isStaff ? presets : presets.map(({ defaultCost: _dc, ...p }) => p)
  return NextResponse.json({ data, error: null })
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== "admin") {
    return NextResponse.json({ data: null, error: "Forbidden" }, { status: 403 })
  }
  const body = await req.json()
  const { name, description, unitLabel, defaultRate, defaultCost, sortOrder } = body
  if (!name) return NextResponse.json({ data: null, error: "name is required" }, { status: 400 })

  const preset = await prisma.setupFeePreset.create({
    data: {
      name,
      description: description || null,
      unitLabel: unitLabel || "Per Item",
      defaultRate: defaultRate ?? 0,
      defaultCost: defaultCost ?? 0,
      sortOrder: sortOrder ?? 0,
    },
  })
  return NextResponse.json({ data: preset, error: null }, { status: 201 })
}
