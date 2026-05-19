import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { serializeOrder, stripAdminFields, computeOrderTotals } from "@/services/orderService"

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ data: null, error: "Unauthorized" }, { status: 401 })

  const role = session.user.role
  if (role !== "admin" && role !== "employee") {
    return NextResponse.json({ data: null, error: "Forbidden" }, { status: 403 })
  }

  const orders = await prisma.order.findMany({
    include: {
      state: { select: { id: true, name: true, color: true } },
      user: { select: { id: true, firstName: true, lastName: true, email: true, role: true } },
      _count: { select: { orderLineItems: true } },
    },
    orderBy: { createdAt: "desc" },
  })

  const serialized = orders.map((o) => serializeOrder(o))
  const data = role === "employee" ? serialized.map((o) => stripAdminFields(o)) : serialized

  return NextResponse.json({ data, error: null })
}

function generateToken(): string {
  return `ord-${crypto.randomUUID().replace(/-/g, "").slice(0, 16)}`
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  const role = session?.user?.role ?? "anonymous"
  const isStaff = role === "admin" || role === "employee"
  const isPublic = !session

  const body = await req.json()
  const { customerNotes, notes, dueDate, isHardDeadline, needsShipping, taxDeferralRequested, lineItems = [] } = body
  const userId = isStaff ? (body.userId || null) : null
  const nickname = body.nickname || null
  const stateId = isStaff ? (body.stateId ?? 1) : 1

  if (!Array.isArray(lineItems) || lineItems.length === 0) {
    return NextResponse.json({ data: null, error: "At least one line item is required" }, { status: 400 })
  }

  const taxSetting = await prisma.universalSettings.findUnique({ where: { setting: "taxRate" } })
  const taxRate = taxSetting ? Number(taxSetting.value) : 0
  // Normalize lineItems to ensure unitCost is always a number (public submissions omit it)
  const normalizedLineItems = lineItems.map((li: any) => ({ ...li, unitCost: li.unitCost ?? 0 }))
  const totals = computeOrderTotals({ lineItems: normalizedLineItems, setUpCosts: [], taxRate })

  const order = await prisma.order.create({
    data: {
      state: { connect: { id: stateId } },
      ...(userId ? { user: { connect: { id: userId } } } : {}),
      nickname,
      customerNotes: customerNotes || null,
      notes: isStaff ? (notes || null) : null,
      dueDate: dueDate ? new Date(dueDate) : null,
      isHardDeadline: isHardDeadline ?? false,
      needsShipping: needsShipping ?? false,
      taxDeferralRequested: taxDeferralRequested ?? false,
      token: generateToken(),
      ...totals,
      createdBy: session?.user?.email ?? "anonymous",
      orderLineItems: {
        create: normalizedLineItems.map((li: any, idx: number) => ({
          description: li.description,
          qty: li.qty,
          unitPrice: li.unitPrice ?? 0,
          lineTotal: li.qty * (li.unitPrice ?? 0),
          unitCost: isStaff ? (li.unitCost ?? 0) : 0,
          sortOrder: idx,
          notes: li.notes || null,
        })),
      },
    },
    include: {
      state: { select: { id: true, name: true, color: true } },
      user: { select: { id: true, firstName: true, lastName: true, email: true } },
      _count: { select: { orderLineItems: true } },
    },
  })

  // Notify all admins on public submission
  if (isPublic) {
    const admins = await prisma.user.findMany({ where: { role: "admin" }, select: { id: true } })
    await prisma.notification.createMany({
      data: admins.map((a) => ({
        userId: a.id,
        orderId: order.id,
        type: "order_submitted",
        title: "New Quote Request",
        message: `A new quote request (#${order.id}) was submitted via the Get Quote form.`,
        actionUrl: `/dashboard`,
      })),
    })
  }

  const serialized = serializeOrder(order)
  const data = role === "employee" ? stripAdminFields(serialized) : serialized
  return NextResponse.json({ data, error: null }, { status: 201 })
}
