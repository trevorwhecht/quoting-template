"use client"

import { useRef } from "react"
import { useDroppable } from "@dnd-kit/core"
import { useVirtualizer } from "@tanstack/react-virtual"
import { cn } from "@/lib/utils"
import { OrderCard } from "./Dashboard-OrderCard"
import type { OrderSummary, OrderDetail } from "@/models/order"
import type { OrderStateModel } from "@/models/orderState"

type Props = {
  state: Pick<OrderStateModel, "id" | "name" | "color">
  orders: OrderSummary[]
  role: string
  onOpenOrder: (order: OrderDetail) => void
}

export default function DashboardKanbanColumn({ state, orders, role, onOpenOrder }: Props) {
  const parentRef = useRef<HTMLDivElement>(null)
  const { setNodeRef, isOver } = useDroppable({ id: state.id })

  const sortedOrders = [...orders].sort((a, b) => {
    if (state.id === 1) {
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    }
    if (!a.dueDate && !b.dueDate) return 0
    if (!a.dueDate) return 1
    if (!b.dueDate) return -1
    return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()
  })

  const virtualizer = useVirtualizer({
    count: sortedOrders.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 130,
    overscan: 5,
  })

  const totalValue = orders.reduce((s, o) => s + o.totalPrice, 0)

  async function handleOpenOrder(order: OrderSummary) {
    const res = await fetch(`/api/orders/${order.id}`)
    const json = await res.json()
    if (!json.error) onOpenOrder(json.data)
  }

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex flex-col flex-1 min-w-0 bg-(--color-surface) rounded-lg border border-(--color-border) overflow-hidden transition-shadow",
        isOver && "ring-2 ring-(--color-primary)/40"
      )}
    >
      {/* Column header */}
      <div
        className="px-3 py-2.5 border-b-2"
        style={{ borderBottomColor: state.color ?? "var(--color-border)" }}
      >
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold text-(--color-foreground)">{state.name}</span>
          <span className="text-xs text-(--color-muted) bg-(--color-background) rounded-full px-2 py-0.5">
            {orders.length}
          </span>
        </div>
        {orders.length > 0 ? (
          <p className="text-xs text-(--color-muted) mt-0.5">${totalValue.toFixed(2)}</p>
        ) : null}
      </div>

      {/* Scrollable card list — virtualized */}
      <div ref={parentRef} className="md:overflow-y-auto md:flex-1 md:max-h-[calc(100dvh-12rem)] p-2">
        <div style={{ height: virtualizer.getTotalSize(), position: "relative" }}>
          {virtualizer.getVirtualItems().map((virtualRow) => {
            const order = sortedOrders[virtualRow.index]
            return (
              <div
                key={order.id}
                style={{
                  position: "absolute",
                  top: virtualRow.start,
                  left: 0,
                  right: 0,
                  paddingBottom: 8,
                }}
              >
                <OrderCard order={order} role={role} onOpen={() => handleOpenOrder(order)}>
                  <OrderCard.Header />
                  <OrderCard.Badges />
                  <OrderCard.Footer />
                </OrderCard>
              </div>
            )
          })}
        </div>
        {sortedOrders.length === 0 ? (
          <p className="text-xs text-(--color-muted) text-center py-6">No orders</p>
        ) : null}
      </div>
    </div>
  )
}
