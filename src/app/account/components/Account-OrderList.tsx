import Link from "next/link"
import { Badge } from "@/components/ui/badge"
import { format } from "date-fns"

type Order = {
  id: number
  token: string | null
  nickname: string | null
  totalPrice: any
  dueDate: Date | null
  stateId: number
  state: { name: string; color: string | null }
}

export default function AccountOrderList({ orders }: { orders: Order[] }) {
  if (orders.length === 0) {
    return (
      <div className="rounded-lg border border-(--color-border) px-4 py-10 text-center text-sm text-(--color-muted)">
        No orders yet.
      </div>
    )
  }

  return (
    <div className="rounded-lg border border-(--color-border) overflow-hidden">
      <div className="w-full overflow-x-auto">
        <table className="w-full text-sm min-w-125">
          <thead>
            <tr className="border-b border-(--color-border) bg-(--color-surface)">
              <th className="text-left px-4 py-2.5 font-medium text-(--color-muted)">Order</th>
              <th className="text-left px-4 py-2.5 font-medium text-(--color-muted)">Status</th>
              <th className="text-right px-4 py-2.5 font-medium text-(--color-muted)">Total</th>
              <th className="text-right px-4 py-2.5 font-medium text-(--color-muted)">Due</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((order) => {
              const label = order.nickname ?? `Order #${order.id}`
              const href = order.stateId <= 2 || !order.token
                ? `/quote-builder?orderId=${order.id}`
                : `/orders/${order.token}`
              return (
                <tr key={order.id} className="border-b border-(--color-border) last:border-0 hover:bg-(--color-surface) transition-colors motion-reduce:transition-none">
                  <td className="px-4 py-3">
                    <Link href={href} className="font-medium text-(--color-foreground) hover:text-(--color-primary) transition-colors motion-reduce:transition-none">
                      {label}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <Badge
                      variant="outline"
                      style={{ borderColor: order.state.color ?? undefined, color: order.state.color ?? undefined }}
                    >
                      {order.state.name}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-right font-medium">${Number(order.totalPrice).toFixed(2)}</td>
                  <td className="px-4 py-3 text-right text-(--color-muted)">
                    {order.dueDate ? format(new Date(order.dueDate), "MMM d") : "—"}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
