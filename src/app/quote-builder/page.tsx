import { redirect, notFound } from "next/navigation"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import QuoteBuilder from "./QuoteBuilder"
import type { EmployeeFieldPermissions } from "@/services/orderService"

export default async function QuoteBuilderPage({
  searchParams,
}: {
  searchParams: Promise<{ orderId?: string; token?: string }>
}) {
  const { orderId: orderIdStr, token } = await searchParams
  const session = await getServerSession(authOptions)
  const role = session?.user?.role ?? "anonymous"
  const isStaff = role === "admin" || role === "employee"

  // Non-staff accessing by orderId is not allowed
  if (orderIdStr && !isStaff) redirect("/login")

  const settingKeys = role === "employee"
    ? ["taxRate", "employeeLineItemPriceAccess", "employeeLineItemCostAccess", "employeeSetupCostAccess"]
    : ["taxRate"]
  const settingRows = await prisma.universalSettings.findMany({
    where: { setting: { in: settingKeys } },
    select: { setting: true, value: true },
  })
  const settingsMap = Object.fromEntries(settingRows.map((r) => [r.setting, r.value]))
  const taxRate = Number(settingsMap.taxRate ?? 0)
  const employeePermissions: EmployeeFieldPermissions | undefined = role === "employee"
    ? {
        lineItemPriceAccess: (settingsMap.employeeLineItemPriceAccess ?? "view") as EmployeeFieldPermissions["lineItemPriceAccess"],
        lineItemCostAccess: (settingsMap.employeeLineItemCostAccess ?? "none") as EmployeeFieldPermissions["lineItemCostAccess"],
        setupCostAccess: (settingsMap.employeeSetupCostAccess ?? "edit") as EmployeeFieldPermissions["setupCostAccess"],
      }
    : undefined

  // Redirect logic for token-based access
  if (token) {
    const order = await prisma.order.findUnique({
      where: { token },
      select: { userId: true, stateId: true },
    })
    if (!order) notFound()

    // Logged-in user accessing another user's order → public page
    if (role === "user" && order.userId && order.userId !== session?.user?.id) {
      redirect(`/orders/${token}`)
    }
    // Anonymous accessing an order that belongs to a user → public page
    if (role === "anonymous" && order.userId) {
      redirect(`/orders/${token}`)
    }
  }

  return (
    <QuoteBuilder
      orderId={orderIdStr ? Number(orderIdStr) : undefined}
      token={token}
      role={role}
      taxRate={taxRate}
      sessionUserId={session?.user?.id ?? null}
      employeePermissions={employeePermissions}
    />
  )
}
