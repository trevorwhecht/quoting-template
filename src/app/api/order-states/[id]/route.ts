import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ data: null, error: "Unauthorized" }, { status: 401 })
  if (session.user.role !== "admin") return NextResponse.json({ data: null, error: "Forbidden" }, { status: 403 })

  const { id } = await params
  const body = await req.json()
  const { name, color, description, isActive, sortOrder } = body

  const update: Record<string, any> = {}
  if (name !== undefined) update.name = name
  if (color !== undefined) update.color = color
  if (description !== undefined) update.description = description
  if (isActive !== undefined) update.isActive = isActive
  if (sortOrder !== undefined) update.sortOrder = sortOrder

  const state = await prisma.orderState.update({ where: { id: Number(id) }, data: update })
  return NextResponse.json({ data: state, error: null })
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ data: null, error: "Unauthorized" }, { status: 401 })
  if (session.user.role !== "admin") return NextResponse.json({ data: null, error: "Forbidden" }, { status: 403 })

  const { id } = await params
  const state = await prisma.orderState.findUnique({ where: { id: Number(id) } })
  if (!state) return NextResponse.json({ data: null, error: "Not found" }, { status: 404 })
  if (state.isRequired) return NextResponse.json({ data: null, error: "Cannot delete a required state" }, { status: 400 })

  await prisma.orderState.delete({ where: { id: Number(id) } })
  return NextResponse.json({ data: { id: Number(id) }, error: null })
}
