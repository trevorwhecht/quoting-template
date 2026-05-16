import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== "admin") {
    return NextResponse.json({ data: null, error: "Forbidden" }, { status: 403 })
  }
  const { id } = await params
  const body = await req.json()
  const { name, description, unitLabel, defaultRate, defaultCost, sortOrder, isActive } = body

  const updated = await prisma.setupFeePreset.update({
    where: { id: Number(id) },
    data: {
      ...(name !== undefined && { name }),
      ...(description !== undefined && { description }),
      ...(unitLabel !== undefined && { unitLabel }),
      ...(defaultRate !== undefined && { defaultRate }),
      ...(defaultCost !== undefined && { defaultCost }),
      ...(sortOrder !== undefined && { sortOrder }),
      ...(isActive !== undefined && { isActive }),
    },
  })
  return NextResponse.json({ data: updated, error: null })
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== "admin") {
    return NextResponse.json({ data: null, error: "Forbidden" }, { status: 403 })
  }
  const { id } = await params
  await prisma.setupFeePreset.delete({ where: { id: Number(id) } })
  return NextResponse.json({ data: { id: Number(id) }, error: null })
}
