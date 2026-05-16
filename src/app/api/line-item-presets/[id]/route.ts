import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { serializePreset } from "../route"

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== "admin") {
    return NextResponse.json({ data: null, error: "Forbidden" }, { status: 403 })
  }
  const { id } = await params
  const body = await req.json()
  const { name, description, defaultPrice, defaultCost, sortOrder, isActive } = body

  const updated = await prisma.lineItemPreset.update({
    where: { id: Number(id) },
    data: {
      ...(name !== undefined && { name }),
      ...(description !== undefined && { description }),
      ...(defaultPrice !== undefined && { defaultPrice }),
      ...(defaultCost !== undefined && { defaultCost }),
      ...(sortOrder !== undefined && { sortOrder }),
      ...(isActive !== undefined && { isActive }),
    },
  })
  return NextResponse.json({ data: serializePreset(updated), error: null })
}
