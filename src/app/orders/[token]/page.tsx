import { notFound } from "next/navigation"
import Image from "next/image"
import Link from "next/link"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { Badge } from "@/components/ui/badge"
import { Lock } from "lucide-react"
import { format } from "date-fns"
import OrdersActionButtons from "./Orders-ActionButtons"

export const dynamic = "force-dynamic"

const siteUrl = process.env.NEXTAUTH_URL ?? process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"

export default async function OrderPublicPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const session = await getServerSession(authOptions)
  const role = session?.user?.role ?? "anonymous"

  const order = await prisma.order.findUnique({
    where: { token },
    select: {
      id: true,
      nickname: true,
      mainImage: true,
      stateId: true,
      paymentPlan: true,
      totalPrice: true,
      totalAmount: true,
      totalSetUpPrice: true,
      subTotal: true,
      salesTax: true,
      discountManual: true,
      dueDate: true,
      customerNotes: true,
      createdAt: true,
      state: { select: { name: true, color: true } },
      orderLineItems: {
        orderBy: { sortOrder: "asc" },
        select: { id: true, description: true, qty: true, unitPrice: true, lineTotal: true, notes: true },
      },
      setUpCosts: {
        select: { id: true, userTotal: true, customSetupItems: true },
      },
      payments: { select: { id: true, amount: true } },
    },
  })

  if (!order) notFound()

  const title = order.nickname ?? `Order #${order.id}`
  const shareUrl = `${siteUrl}/orders/${token}?name=${encodeURIComponent(title)}`
  const alreadyPaid = order.payments.reduce((s, p) => s + Number(p.amount), 0)
  const showDueNow = order.stateId === 2 && order.paymentPlan !== null && order.paymentPlan !== "pay_at_pickup"
  const isReadOnly = order.stateId >= 3
  const isAdmin = role === "admin"
  const discountManual = Number(order.discountManual ?? 0)

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
      {/* Hero image */}
      {order.mainImage ? (
        <div className="relative w-full aspect-video rounded-xl overflow-hidden bg-(--color-surface)">
          <Image src={order.mainImage} alt={title} fill className="object-cover object-center" unoptimized />
        </div>
      ) : null}

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-(--color-foreground)">{title}</h1>
          <p className="text-sm text-(--color-muted) mt-0.5">
            Order #{order.id} · {format(new Date(order.createdAt), "MMM d, yyyy")}
          </p>
        </div>
        <div className="flex flex-col items-end gap-1.5 shrink-0">
          <Badge
            variant="outline"
            style={{ borderColor: order.state.color ?? undefined, color: order.state.color ?? undefined }}
          >
            {order.state.name}
          </Badge>
          <OrdersActionButtons
            orderId={order.id}
            totalDueNow={Number(order.totalPrice)}
            showDueNow={showDueNow}
            shareUrl={shareUrl}
          />
          {alreadyPaid > 0 ? (
            <p className="text-xs text-(--color-success)">Already Paid: ${alreadyPaid.toFixed(2)}</p>
          ) : null}
        </div>
      </div>

      {/* View Only banner for state 3+ */}
      {isReadOnly ? (
        <div className="rounded-lg border border-(--color-border) bg-(--color-surface) px-4 py-3 text-sm text-(--color-muted) flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Lock size={14} />
            View Only — this order is in progress and can no longer be edited.
          </div>
          {isAdmin ? (
            <Link
              href={`/quote-builder?orderId=${order.id}`}
              className="inline-flex items-center h-7 px-2.5 text-[0.8rem] font-medium rounded-[min(var(--radius-md),12px)] border border-(--color-border) bg-(--color-background) hover:bg-(--color-surface) text-(--color-foreground) transition-colors"
            >
              Edit Order
            </Link>
          ) : null}
        </div>
      ) : null}

      {/* Customer notes */}
      {order.customerNotes ? (
        <p className="text-sm text-(--color-foreground) bg-(--color-surface) rounded-lg p-4 border border-(--color-border)">
          {order.customerNotes}
        </p>
      ) : null}

      {/* Order items */}
      {order.orderLineItems.length > 0 ? (
        <div className="border border-(--color-border) rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-(--color-border) bg-(--color-surface)">
                <th className="text-left px-4 py-2.5 font-medium text-(--color-muted)">Description</th>
                <th className="text-right px-4 py-2.5 font-medium text-(--color-muted)">Qty</th>
                <th className="text-right px-4 py-2.5 font-medium text-(--color-muted)">Rate</th>
                <th className="text-right px-4 py-2.5 font-medium text-(--color-muted)">Amount</th>
              </tr>
            </thead>
            <tbody>
              {order.orderLineItems.map((item) => (
                <tr key={item.id} className="border-b border-(--color-border) last:border-0">
                  <td className="px-4 py-3">
                    <p className="font-medium text-(--color-foreground)">{item.description}</p>
                    {item.notes ? <p className="text-xs text-(--color-muted) mt-0.5">{item.notes}</p> : null}
                  </td>
                  <td className="px-4 py-3 text-right text-(--color-muted)">{item.qty}</td>
                  <td className="px-4 py-3 text-right text-(--color-muted)">${Number(item.unitPrice).toFixed(2)}</td>
                  <td className="px-4 py-3 text-right font-semibold text-(--color-foreground)">${Number(item.lineTotal).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {/* Setup costs */}
      {order.setUpCosts.length > 0 ? (
        <div className="border border-(--color-border) rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-(--color-border) bg-(--color-surface)">
                <th className="text-left px-4 py-2.5 font-medium text-(--color-muted)">Setup</th>
                <th className="text-right px-4 py-2.5 font-medium text-(--color-muted)">Qty</th>
                <th className="text-right px-4 py-2.5 font-medium text-(--color-muted)">Rate</th>
                <th className="text-right px-4 py-2.5 font-medium text-(--color-muted)">Amount</th>
              </tr>
            </thead>
            <tbody>
              {order.setUpCosts.map((sc) => {
                const items = sc.customSetupItems as { label: string; qty: number; rate: number }[] | null
                const item = items?.[0]
                return (
                  <tr key={sc.id} className="border-b border-(--color-border) last:border-0">
                    <td className="px-4 py-3 text-(--color-foreground)">{item?.label ?? "Setup"}</td>
                    <td className="px-4 py-3 text-right text-(--color-muted)">{item?.qty ?? 1}</td>
                    <td className="px-4 py-3 text-right text-(--color-muted)">${(item?.rate ?? Number(sc.userTotal)).toFixed(2)}</td>
                    <td className="px-4 py-3 text-right font-semibold text-(--color-foreground)">${Number(sc.userTotal).toFixed(2)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      ) : null}

      {/* Totals */}
      <div className="border border-(--color-border) rounded-lg p-4 space-y-1.5 text-sm bg-(--color-background)">
        <div className="flex justify-between">
          <span className="text-(--color-muted)">Subtotal</span>
          <span>${Number(order.subTotal).toFixed(2)}</span>
        </div>
        {discountManual > 0 ? (
          <div className="flex justify-between text-(--color-danger)">
            <span>Discount</span>
            <span>-${discountManual.toFixed(2)}</span>
          </div>
        ) : null}
        <div className="flex justify-between">
          <span className="text-(--color-muted)">Tax</span>
          <span>${Number(order.salesTax).toFixed(2)}</span>
        </div>
        <div className="flex justify-between font-semibold text-base border-t border-(--color-border) pt-2">
          <span>Total</span>
          <span>${Number(order.totalPrice).toFixed(2)}</span>
        </div>
      </div>

      {/* Due date */}
      {order.dueDate ? (
        <p className="text-sm text-(--color-muted)">
          Due {format(new Date(order.dueDate), "MMMM d, yyyy")}
        </p>
      ) : null}

      {/* Make Changes link for states 1–2, non-admin */}
      {!isReadOnly && !isAdmin ? (
        <div className="text-center pt-2">
          <Link
            href={`/quote-builder?token=${token}`}
            className="text-sm text-(--color-accent) underline underline-offset-2 hover:opacity-80"
          >
            Make Changes
          </Link>
        </div>
      ) : null}
    </div>
  )
}
