import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { format, subMonths, startOfMonth } from "date-fns"

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ data: null, error: "Unauthorized" }, { status: 401 })
  if (session.user.role !== "admin") return NextResponse.json({ data: null, error: "Forbidden" }, { status: 403 })

  const twelveMonthsAgo = startOfMonth(subMonths(new Date(), 11))

  const completedOrders = await prisma.order.findMany({
    where: { completedDate: { gte: twelveMonthsAgo } },
    select: { completedDate: true, totalPrice: true, profit: true },
  })

  const byMonth: Record<string, { revenue: number; profit: number }> = {}
  for (const o of completedOrders) {
    if (!o.completedDate) continue
    const month = format(o.completedDate, "yyyy-MM")
    if (!byMonth[month]) byMonth[month] = { revenue: 0, profit: 0 }
    byMonth[month].revenue += Number(o.totalPrice)
    byMonth[month].profit += Number(o.profit)
  }
  const revenueByMonth = Object.entries(byMonth)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, v]) => ({ month, revenue: Math.round(v.revenue * 100) / 100, profit: Math.round(v.profit * 100) / 100 }))

  const ordersByState = await prisma.order.groupBy({
    by: ["stateId"],
    _count: { id: true },
  })
  const stateDetails = await prisma.orderState.findMany({ select: { id: true, name: true } })
  const stateMap = Object.fromEntries(stateDetails.map((s) => [s.id, s.name]))
  const ordersByStateResult = ordersByState.map((row) => ({
    stateId: row.stateId,
    stateName: stateMap[row.stateId] ?? "Unknown",
    count: row._count.id,
  }))

  const payments = await prisma.payment.groupBy({
    by: ["channel"],
    _sum: { amount: true },
    _count: { id: true },
  })
  const paymentsByChannel = payments.map((p) => ({
    channel: p.channel,
    total: Math.round(Number(p._sum.amount ?? 0) * 100) / 100,
    count: p._count.id,
  }))

  return NextResponse.json({
    data: { revenueByMonth, ordersByState: ordersByStateResult, paymentsByChannel },
    error: null,
  })
}
