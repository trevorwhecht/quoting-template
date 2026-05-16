import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { serializeOrder, stripAdminFields } from "@/services/orderService"

export async function GET(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const session = await getServerSession(authOptions)
  const role = session?.user?.role ?? "anonymous"

  const order = await prisma.order.findUnique({
    where: { token },
    include: {
      state: true,
      user: { select: { id: true, firstName: true, lastName: true, email: true, phone: true, companyName: true } },
      orderLineItems: { include: { variants: true }, orderBy: { sortOrder: "asc" as const } },
      setUpCosts: true,
      payments: { orderBy: { paidAt: "desc" as const } },
    },
  })

  if (!order) return NextResponse.json({ data: null, error: "Not found" }, { status: 404 })

  const serialized = serializeOrder(order)
  let data = role === "admin" ? serialized : stripAdminFields(serialized)
  if (role !== "admin" && role !== "employee") {
    const { notes: _notes, ...rest } = data
    data = rest
  }
  return NextResponse.json({ data, error: null })
}
