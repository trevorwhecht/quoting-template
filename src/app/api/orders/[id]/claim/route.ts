import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ data: null, error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  const orderId = parseInt(id, 10)
  if (isNaN(orderId)) return NextResponse.json({ data: null, error: "Invalid order ID" }, { status: 400 })

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: { id: true, userId: true },
  })

  if (!order) return NextResponse.json({ data: null, error: "Order not found" }, { status: 404 })
  if (order.userId) return NextResponse.json({ data: null, error: "Order already claimed" }, { status: 409 })

  await prisma.order.update({
    where: { id: orderId },
    data: { userId: session.user.id },
  })

  return NextResponse.json({ data: { claimed: true }, error: null })
}
