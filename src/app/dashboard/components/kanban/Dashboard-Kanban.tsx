"use client"

import { useState } from "react"
import DashboardKanbanColumn from "./Dashboard-KanbanColumn"
import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
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

export default function DashboardKanban({ orders, loading, orderStates, statesLoading, onOpenOrder, role }: Props) {
  const activeStates = orderStates.filter((s) => s.isActive || s.isRequired).sort((a, b) => a.sortOrder - b.sortOrder)
  const kanbanStates = activeStates.filter((s) => s.id !== 0 && s.id !== 6)

  const [selectedStateId, setSelectedStateId] = useState<number | null>(null)
  const activeId = selectedStateId ?? kanbanStates[0]?.id ?? null

  if (statesLoading || loading) {
    return (
      <>
        <div className="block md:hidden p-4 space-y-3">
          <Skeleton className="h-8 w-full rounded-lg" />
          <Skeleton className="h-28 rounded-lg" />
          <Skeleton className="h-28 rounded-lg" />
        </div>
        <div className="hidden md:flex gap-3 p-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="flex-1 min-w-0 space-y-2">
              <Skeleton className="h-12 rounded-lg" />
              <Skeleton className="h-28 rounded-lg" />
              <Skeleton className="h-28 rounded-lg" />
            </div>
          ))}
        </div>
      </>
    )
  }

  const selectedState = kanbanStates.find((s) => s.id === activeId)

  return (
    <>
      {/* Mobile: dropdown + single column */}
      <div className="block md:hidden p-4 space-y-3">
        <Select value={String(activeId ?? "")} onValueChange={(val) => setSelectedStateId(Number(val))}>
          <SelectTrigger className="w-full">
            <span className="flex-1 text-left text-sm truncate">
              {selectedState
                ? `${selectedState.name} (${orders.filter((o) => o.stateId === selectedState.id).length})`
                : "Select column"}
            </span>
          </SelectTrigger>
          <SelectContent>
            {kanbanStates.map((state) => {
              const count = orders.filter((o) => o.stateId === state.id).length
              return (
                <SelectItem key={state.id} value={String(state.id)}>
                  {state.name} ({count})
                </SelectItem>
              )
            })}
          </SelectContent>
        </Select>
        {selectedState ? (
          <DashboardKanbanColumn
            state={selectedState}
            orders={orders.filter((o) => o.stateId === selectedState.id)}
            role={role}
            onOpenOrder={onOpenOrder}
          />
        ) : null}
      </div>

      {/* Desktop: all columns side by side */}
      <div className="hidden md:flex gap-3 p-4 min-h-[calc(100dvh-10rem)]">
        {kanbanStates.map((state) => (
          <DashboardKanbanColumn
            key={state.id}
            state={state}
            orders={orders.filter((o) => o.stateId === state.id)}
            role={role}
            onOpenOrder={onOpenOrder}
          />
        ))}
      </div>
    </>
  )
}
