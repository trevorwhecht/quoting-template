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
      user: { select: { id: true, firstName: true, lastName: true, email: true } },
      _count: { select: { orderLineItems: true } },
    },
    orderBy: { createdAt: "desc" },
  })

  const serialized = orders.map((o) => serializeOrder(o))
  const data = role === "employee" ? serialized.map(stripAdminFields) : serialized

  return NextResponse.json({ data, error: null })
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ data: null, error: "Unauthorized" }, { status: 401 })

  const role = session.user.role
  if (role !== "admin" && role !== "employee") {
    return NextResponse.json({ data: null, error: "Forbidden" }, { status: 403 })
  }

  const body = await req.json()
  const { userId, nickname, customerNotes, notes, dueDate, lineItems = [], stateId = 1 } = body

  if (!Array.isArray(lineItems) || lineItems.length === 0) {
    return NextResponse.json({ data: null, error: "At least one line item is required" }, { status: 400 })
  }

  const taxSetting = await prisma.universalSettings.findUnique({ where: { setting: "taxRate" } })
  const taxRate = taxSetting ? Number(taxSetting.value) : 0

  const totals = computeOrderTotals({ lineItems, setUpCosts: [], taxRate })

  const order = await prisma.order.create({
    data: {
      userId: userId || null,
      stateId,
      nickname: nickname || null,
      customerNotes: customerNotes || null,
      notes: notes || null,
      dueDate: dueDate ? new Date(dueDate) : null,
      ...totals,
      createdBy: session.user.email ?? null,
      orderLineItems: {
        create: lineItems.map((li: any, idx: number) => ({
          description: li.description,
          qty: li.qty,
          unitPrice: li.unitPrice,
          lineTotal: li.qty * li.unitPrice,
          unitCost: li.unitCost ?? 0,
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

  const serialized = serializeOrder(order)
  return NextResponse.json({ data: role === "employee" ? stripAdminFields(serialized) : serialized, error: null }, { status: 201 })
}
