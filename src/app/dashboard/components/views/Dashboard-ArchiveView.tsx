"use client"

import { format } from "date-fns"
import { Skeleton } from "@/components/ui/skeleton"
import type { OrderSummary, OrderDetail } from "@/models/order"

type Props = {
  orders: OrderSummary[]
  loading: boolean
  onOpenOrder: (order: OrderDetail) => void
}

export default function DashboardArchiveView({ orders, loading, onOpenOrder }: Props) {
  const archived = orders.filter((o) => o.stateId === 0).sort((a, b) =>
    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  )

  async function handleOpen(order: OrderSummary) {
    const res = await fetch(`/api/orders/${order.id}`)
    const json = await res.json()
    if (!json.error) onOpenOrder(json.data)
  }

  if (loading) return <div className="p-4 space-y-2">{[1,2,3].map(i => <Skeleton key={i} className="h-16 rounded-lg" />)}</div>

  return (
    <div className="p-4">
      <h2 className="text-lg font-semibold text-(--color-foreground) mb-4">Archive ({archived.length})</h2>
      {archived.length === 0 ? (
        <p className="text-(--color-muted) text-sm">No archived orders.</p>
      ) : (
        <div className="w-full overflow-x-auto">
          <table className="min-w-[640px] w-full text-sm">
            <thead>
              <tr className="border-b border-(--color-border) text-left">
                <th className="pb-2 font-medium text-(--color-muted) whitespace-nowrap pr-4">Order</th>
                <th className="pb-2 font-medium text-(--color-muted) whitespace-nowrap pr-4">Customer</th>
                <th className="pb-2 font-medium text-(--color-muted) whitespace-nowrap pr-4">Total</th>
                <th className="pb-2 font-medium text-(--color-muted) whitespace-nowrap">Created</th>
              </tr>
            </thead>
            <tbody>
              {archived.map((order) => (
                <tr
                  key={order.id}
                  onClick={() => handleOpen(order)}
                  className="border-b border-(--color-border) hover:bg-(--color-surface) cursor-pointer transition-colors"
                >
                  <td className="py-3 pr-4 whitespace-nowrap font-medium">
                    {order.nickname ?? `#${order.id}`}
                  </td>
                  <td className="py-3 pr-4 whitespace-nowrap text-(--color-muted)">
                    {order.user ? `${order.user.firstName} ${order.user.lastName}` : "—"}
                  </td>
                  <td className="py-3 pr-4 whitespace-nowrap">${order.totalPrice.toFixed(2)}</td>
                  <td className="py-3 whitespace-nowrap text-(--color-muted)">
                    {format(new Date(order.createdAt), "MMM d, yyyy")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
