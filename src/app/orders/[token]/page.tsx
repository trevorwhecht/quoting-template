import { notFound } from "next/navigation"
import Image from "next/image"
import { prisma } from "@/lib/prisma"
import { Badge } from "@/components/ui/badge"
import { format } from "date-fns"

export const dynamic = "force-dynamic"

export default async function OrderPublicPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const order = await prisma.order.findUnique({
    where: { token },
    select: {
      id: true,
      nickname: true,
      mainImage: true,
      totalPrice: true,
      dueDate: true,
      customerNotes: true,
      state: { select: { name: true, color: true } },
      orderLineItems: {
        orderBy: { sortOrder: "asc" },
        select: {
          id: true,
          description: true,
          qty: true,
          lineTotal: true,
          notes: true,
          variants: { select: { variant: true, qty: true } },
        },
      },
    },
  })

  if (!order) notFound()

  const title = order.nickname ?? `Order #${order.id}`

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
      {/* Hero image */}
      {order.mainImage ? (
        <div className="relative w-full aspect-video rounded-xl overflow-hidden bg-(--color-surface)">
          <Image
            src={order.mainImage}
            alt={title}
            fill
            className="object-cover object-center"
            unoptimized
          />
        </div>
      ) : null}

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-(--color-foreground)">{title}</h1>
          <p className="text-sm text-(--color-muted) mt-0.5">Order #{order.id}</p>
        </div>
        <Badge
          variant="outline"
          className="shrink-0 mt-1"
          style={{ borderColor: order.state.color ?? undefined, color: order.state.color ?? undefined }}
        >
          {order.state.name}
        </Badge>
      </div>

      {/* Meta row */}
      <div className="flex flex-wrap gap-4 text-sm text-(--color-muted)">
        {order.dueDate ? (
          <span>Due {format(new Date(order.dueDate), "MMM d, yyyy")}</span>
        ) : null}
        <span className="font-semibold text-(--color-foreground)">
          ${Number(order.totalPrice).toFixed(2)}
        </span>
      </div>

      {/* Customer notes */}
      {order.customerNotes ? (
        <p className="text-sm text-(--color-foreground) bg-(--color-surface) rounded-lg p-4 border border-(--color-border)">
          {order.customerNotes}
        </p>
      ) : null}

      {/* Line items */}
      {order.orderLineItems.length > 0 ? (
        <div className="border border-(--color-border) rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-(--color-border) bg-(--color-surface)">
                <th className="text-left px-4 py-2.5 font-medium text-(--color-muted)">Item</th>
                <th className="text-right px-4 py-2.5 font-medium text-(--color-muted)">Qty</th>
                <th className="text-right px-4 py-2.5 font-medium text-(--color-muted)">Total</th>
              </tr>
            </thead>
            <tbody>
              {order.orderLineItems.map((item) => (
                <tr key={item.id} className="border-b border-(--color-border) last:border-0">
                  <td className="px-4 py-3">
                    <p className="font-medium text-(--color-foreground)">{item.description}</p>
                    {item.notes ? (
                      <p className="text-xs text-(--color-muted) mt-0.5">{item.notes}</p>
                    ) : null}
                    {item.variants.length > 0 ? (
                      <div className="mt-1 space-y-0.5">
                        {item.variants.map((v, i) => (
                          <p key={i} className="text-xs text-(--color-muted)">
                            {v.variant}: {v.qty}
                          </p>
                        ))}
                      </div>
                    ) : null}
                  </td>
                  <td className="px-4 py-3 text-right text-(--color-muted)">{item.qty}</td>
                  <td className="px-4 py-3 text-right font-semibold text-(--color-foreground)">
                    ${Number(item.lineTotal).toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  )
}
