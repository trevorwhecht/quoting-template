"use client"

import { OrderCard } from "./Dashboard-OrderCard"
import type { OrderSummary } from "@/models/order"

type Props = { order: OrderSummary; role: string }

export default function DashboardKanbanDragOverlay({ order, role }: Props) {
  return (
    <OrderCard.Overlay order={order} role={role}>
      <OrderCard.Header />
      <OrderCard.Badges />
      <OrderCard.Footer />
    </OrderCard.Overlay>
  )
}
