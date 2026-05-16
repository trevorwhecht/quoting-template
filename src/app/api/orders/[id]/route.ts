import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { serializeOrder, stripAdminFields, computeOrderTotals } from "@/services/orderService"

const ORDER_DETAIL_INCLUDE = {
  state: true,
  user: { select: { id: true, firstName: true, lastName: true, email: true, phone: true, companyName: true } },
  orderLineItems: { include: { variants: true }, orderBy: { sortOrder: "asc" as const } },
  setUpCosts: true,
  payments: { orderBy: { paidAt: "desc" as const } },
}

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ data: null, error: "Unauthorized" }, { status: 401 })

  const role = session.user.role
  if (role !== "admin" && role !== "employee") {
    return NextResponse.json({ data: null, error: "Forbidden" }, { status: 403 })
  }

  const { id } = await params
  const order = await prisma.order.findUnique({ where: { id: Number(id) }, include: ORDER_DETAIL_INCLUDE })
  if (!order) return NextResponse.json({ data: null, error: "Not found" }, { status: 404 })

  const serialized = serializeOrder(order)
  return NextResponse.json({ data: role === "employee" ? stripAdminFields(serialized) : serialized, error: null })
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ data: null, error: "Unauthorized" }, { status: 401 })

  const role = session.user.role
  if (role !== "admin" && role !== "employee") {
    return NextResponse.json({ data: null, error: "Forbidden" }, { status: 403 })
  }

  const { id } = await params
  const orderId = Number(id)
  const body = await req.json()

  const {
    stateId, nickname, customerNotes, notes, dueDate, dueDateEnd, startDate,
    isHardDeadline, paymentPlan, isPaid, discountManual, discountReferral,
    discountMistake, rushFeeAmount, rushFeePercent, rushFeeDays,
    needsShipping, finalPrice, lineItems,
  } = body

  const scalarUpdate: Record<string, any> = { updatedBy: session.user.email ?? null }
  if (stateId !== undefined) scalarUpdate.stateId = stateId
  if (nickname !== undefined) scalarUpdate.nickname = nickname
  if (customerNotes !== undefined) scalarUpdate.customerNotes = customerNotes
  if (notes !== undefined) scalarUpdate.notes = notes
  if (dueDate !== undefined) scalarUpdate.dueDate = dueDate ? new Date(dueDate) : null
  if (dueDateEnd !== undefined) scalarUpdate.dueDateEnd = dueDateEnd ? new Date(dueDateEnd) : null
  if (startDate !== undefined) scalarUpdate.startDate = startDate ? new Date(startDate) : null
  if (isHardDeadline !== undefined) scalarUpdate.isHardDeadline = isHardDeadline
  if (paymentPlan !== undefined) scalarUpdate.paymentPlan = paymentPlan
  if (isPaid !== undefined) scalarUpdate.isPaid = isPaid
  if (needsShipping !== undefined) scalarUpdate.needsShipping = needsShipping
  if (finalPrice !== undefined) scalarUpdate.finalPrice = finalPrice
  if (discountManual !== undefined) scalarUpdate.discountManual = discountManual
  if (discountReferral !== undefined) scalarUpdate.discountReferral = discountReferral
  if (discountMistake !== undefined) scalarUpdate.discountMistake = discountMistake
  if (rushFeeAmount !== undefined) scalarUpdate.rushFeeAmount = rushFeeAmount
  if (rushFeePercent !== undefined) scalarUpdate.rushFeePercent = rushFeePercent
  if (rushFeeDays !== undefined) scalarUpdate.rushFeeDays = rushFeeDays

  if (stateId === 6) scalarUpdate.completedDate = new Date()
  if (stateId !== undefined && stateId !== 6) scalarUpdate.completedDate = null

  if (lineItems !== undefined) {
    const currentOrder = await prisma.order.findUnique({
      where: { id: orderId },
      select: { discountManual: true, discountReferral: true, discountMistake: true, rushFeeAmount: true },
    })

    const taxSetting = await prisma.universalSettings.findUnique({ where: { setting: "taxRate" } })
    const taxRate = taxSetting ? Number(taxSetting.value) : 0

    const existingSetUpCosts = await prisma.setUpCost.findMany({ where: { orderId } })
    const scCosts = existingSetUpCosts.map((s) => ({ userTotal: Number(s.userTotal), adminTotal: Number(s.adminTotal) }))

    const totals = computeOrderTotals({
      lineItems,
      setUpCosts: scCosts,
      taxRate,
      discountManual: scalarUpdate.discountManual !== undefined ? scalarUpdate.discountManual : Number(currentOrder?.discountManual ?? 0),
      discountReferral: scalarUpdate.discountReferral !== undefined ? scalarUpdate.discountReferral : Number(currentOrder?.discountReferral ?? 0),
      discountMistake: scalarUpdate.discountMistake !== undefined ? scalarUpdate.discountMistake : Number(currentOrder?.discountMistake ?? 0),
      rushFeeAmount: scalarUpdate.rushFeeAmount !== undefined ? scalarUpdate.rushFeeAmount : Number(currentOrder?.rushFeeAmount ?? 0),
    })
    Object.assign(scalarUpdate, totals)

    await prisma.orderLineItem.deleteMany({ where: { orderId } })
    await prisma.orderLineItem.createMany({
      data: lineItems.map((li: any, idx: number) => ({
        orderId,
        description: li.description,
        qty: li.qty,
        unitPrice: li.unitPrice,
        lineTotal: li.qty * li.unitPrice,
        unitCost: li.unitCost ?? 0,
        sortOrder: idx,
        notes: li.notes || null,
      })),
    })
  }

  const updated = await prisma.order.update({
    where: { id: orderId },
    data: scalarUpdate,
    include: ORDER_DETAIL_INCLUDE,
  })

  if (stateId !== undefined && updated.userId) {
    const STATE_NOTIFICATIONS: Record<number, { title: string; message: string }> = {
      2: { title: "Quote Ready to Review", message: `Your quote #${orderId} has been reviewed and is ready for your approval.` },
      3: { title: "Order In Progress", message: `We've started working on your order #${orderId}. Estimated completion date will be set soon.` },
      4: { title: "Awaiting Pickup", message: `Your order #${orderId} is complete and ready for pickup!` },
      5: { title: "Awaiting Payment", message: `Your order #${orderId} is ready. Please arrange final payment before pickup.` },
      6: { title: "Order Complete", message: `Your order #${orderId} has been completed. Thank you for your business!` },
    }
    const notifData = STATE_NOTIFICATIONS[stateId as number]
    if (notifData) {
      await prisma.notification.create({
        data: { userId: updated.userId, orderId, type: "state_changed", title: notifData.title, message: notifData.message },
      }).catch(() => {})
    }
  }

  const serialized = serializeOrder(updated)
  return NextResponse.json({ data: role === "employee" ? stripAdminFields(serialized) : serialized, error: null })
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ data: null, error: "Unauthorized" }, { status: 401 })

  if (session.user.role !== "admin") {
    return NextResponse.json({ data: null, error: "Forbidden" }, { status: 403 })
  }

  const { id } = await params
  await prisma.order.delete({ where: { id: Number(id) } })
  return NextResponse.json({ data: { id: Number(id) }, error: null })
}
