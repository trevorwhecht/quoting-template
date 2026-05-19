import { redirect } from "next/navigation"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import Account from "./Account"

export default async function AccountPage() {
  const session = await getServerSession(authOptions)
  if (!session) redirect("/login?redirect=/account")

  // Parallel fetch — orders and user are independent queries (async-parallel)
  const [orders, user] = await Promise.all([
    prisma.order.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        token: true,
        nickname: true,
        totalPrice: true,
        dueDate: true,
        stateId: true,
        state: { select: { name: true, color: true } },
      },
    }),
    prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        role: true,
        resellerLicenseUrl: true,
        resellerLicenseUploadedAt: true,
      },
    }),
  ])

  if (!user) redirect("/login")

  return <Account user={user} orders={orders} />
}
