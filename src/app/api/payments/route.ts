import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ data: null, error: "Unauthorized" }, { status: 401 })
  if (session.user.role !== "admin") return NextResponse.json({ data: null, error: "Forbidden" }, { status: 403 })

  const body = await req.json()
  const { orderId, amount, channel, note, paidAt } = body

  if (!orderId || !amount || !channel) {
    return NextResponse.json({ data: null, error: "orderId, amount, and channel are required" }, { status: 400 })
  }

  const me = await prisma.user.findUnique({ where: { email: session.user.email! }, select: { id: true } })

  const payment = await prisma.payment.create({
    data: {
      orderId: Number(orderId),
      userId: me?.id ?? null,
      amount: Number(amount),
      channel,
      note: note || null,
      paidAt: paidAt ? new Date(paidAt) : new Date(),
      createdBy: session.user.email ?? null,
    },
  })
  return NextResponse.json({ data: { ...payment, amount: Number(payment.amount) }, error: null }, { status: 201 })
}
