import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { computeOrderTotals } from "@/services/orderService"

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ data: null, error: "Unauthorized" }, { status: 401 })
  if (session.user.role !== "admin") return NextResponse.json({ data: null, error: "Forbidden" }, { status: 403 })

  const { id } = await params
  const body = await req.json()
  const { userTotal, adminTotal, customSetupItems } = body

  const existing = await prisma.setUpCost.findUnique({ where: { id: Number(id) } })
  if (!existing) return NextResponse.json({ data: null, error: "Not found" }, { status: 404 })

  const updated = await prisma.setUpCost.update({
    where: { id: Number(id) },
    data: {
      userTotal: userTotal !== undefined ? Number(userTotal) : undefined,
      adminTotal: adminTotal !== undefined ? Number(adminTotal) : undefined,
      customSetupItems: customSetupItems !== undefined ? customSetupItems : undefined,
    },
  })

  const taxSetting = await prisma.universalSettings.findUnique({ where: { setting: "taxRate" } })
  const taxRate = taxSetting ? Number(taxSetting.value) : 0

  const lineItems = await prisma.orderLineItem.findMany({ where: { orderId: existing.orderId } })
  const allSetUpCosts = await prisma.setUpCost.findMany({ where: { orderId: existing.orderId } })

  const totals = computeOrderTotals({
    lineItems: lineItems.map((li) => ({ qty: li.qty, unitPrice: Number(li.unitPrice), unitCost: Number(li.unitCost) })),
    setUpCosts: allSetUpCosts.map((s) => ({ userTotal: Number(s.userTotal), adminTotal: Number(s.adminTotal) })),
    taxRate,
  })

  await prisma.order.update({ where: { id: existing.orderId }, data: totals })

  return NextResponse.json({ data: { ...updated, userTotal: Number(updated.userTotal), adminTotal: Number(updated.adminTotal) }, error: null })
}
