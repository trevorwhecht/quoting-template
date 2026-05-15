"use client"

import { useSearchParams } from "next/navigation"
import { cn } from "@/lib/utils"
import Link from "next/link"
import DashboardKanban from "../kanban/Dashboard-Kanban"
import type { OrderSummary, OrderDetail } from "@/models/order"
import type { OrderStateModel } from "@/models/orderState"

type Props = {
  orders: OrderSummary[]
  loading: boolean
  orderStates: OrderStateModel[]
  statesLoading: boolean
  onOpenOrder: (order: OrderDetail) => void
  role: string
}

const SUB_TABS = [
  { key: "default", label: "Kanban" },
  { key: "calendar", label: "Calendar" },
  { key: "complete", label: "Complete" },
  { key: "archive", label: "Archive" },
]

export default function DashboardOrdersView({ orders, loading, orderStates, statesLoading, onOpenOrder, role }: Props) {
  const searchParams = useSearchParams()
  const sub = searchParams.get("sub") ?? "default"

  return (
    <div className="flex flex-col">
      {/* Sub-nav tabs */}
      <div className="border-b border-(--color-border) px-4 flex gap-1 pt-2">
        {SUB_TABS.map((tab) => (
          <Link
            key={tab.key}
            href={`?view=orders&sub=${tab.key}`}
            className={cn(
              "px-3 py-2 text-sm font-medium rounded-t-md border-b-2 transition-colors motion-reduce:transition-none",
              sub === tab.key
                ? "border-(--color-primary) text-(--color-primary)"
                : "border-transparent text-(--color-muted) hover:text-(--color-foreground)"
            )}
          >
            {tab.label}
          </Link>
        ))}
      </div>

      {/* Default: kanban */}
      <DashboardKanban
        orders={orders}
        loading={loading}
        orderStates={orderStates}
        statesLoading={statesLoading}
        onOpenOrder={onOpenOrder}
        role={role}
      />
    </div>
  )
}
