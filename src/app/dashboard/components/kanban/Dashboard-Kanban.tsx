"use client"

import { useState } from "react"
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
} from "@dnd-kit/core"
import DashboardKanbanColumn from "./Dashboard-KanbanColumn"
import DashboardKanbanDragOverlay from "./Dashboard-KanbanDragOverlay"
import DashboardKanbanMoveConfirmDialog, { type MovePayload } from "./Dashboard-KanbanMoveConfirmDialog"
import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { toast } from "sonner"
import type { OrderSummary, OrderDetail } from "@/models/order"
import type { OrderStateModel } from "@/models/orderState"

type PendingMove = {
  order: OrderSummary
  fromStateId: number
  toStateId: number
  targetStateName: string
}

type Props = {
  orders: OrderSummary[]
  loading: boolean
  orderStates: OrderStateModel[]
  statesLoading: boolean
  onOpenOrder: (order: OrderDetail) => void
  onOrderMoved: () => void
  role: string
}

export default function DashboardKanban({ orders, loading, orderStates, statesLoading, onOpenOrder, onOrderMoved, role }: Props) {
  const activeStates = orderStates.filter((s) => s.isActive || s.isRequired).sort((a, b) => a.sortOrder - b.sortOrder)
  const kanbanStates = activeStates.filter((s) => s.id !== 0 && s.id !== 6)

  const [selectedStateId, setSelectedStateId] = useState<number | null>(null)
  const [activeCard, setActiveCard] = useState<OrderSummary | null>(null)
  const [pendingMove, setPendingMove] = useState<PendingMove | null>(null)

  const activeId = selectedStateId ?? kanbanStates[0]?.id ?? null

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  )

  function handleDragStart(event: DragStartEvent) {
    const order = event.active.data.current?.order as OrderSummary | undefined
    if (order) setActiveCard(order)
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveCard(null)
    const { active, over } = event
    if (!over) return

    const order = active.data.current?.order as OrderSummary | undefined
    if (!order) return

    const fromStateId = order.stateId
    const toStateId = over.id as number
    if (toStateId === fromStateId) return

    // Backward move — immediate, no modal
    if (toStateId < fromStateId) {
      fetch(`/api/orders/${order.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stateId: toStateId }),
      })
        .then((r) => r.json())
        .then((json) => {
          if (json.error) { toast.error(json.error); return }
          onOrderMoved()
        })
        .catch(() => toast.error("Failed to move order"))
      return
    }

    // Forward move — open confirmation modal
    const targetState = kanbanStates.find((s) => s.id === toStateId)
    setPendingMove({
      order,
      fromStateId,
      toStateId,
      targetStateName: targetState?.name ?? String(toStateId),
    })
  }

  async function handleMoveConfirm(payload: MovePayload) {
    if (!pendingMove) return

    // Create guest user if new info provided
    let userId: string | undefined = payload.existingGuestUserId
    if (payload.guestUser) {
      const guestRes = await fetch("/api/users/guest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload.guestUser),
      })
      const guestJson = await guestRes.json()
      if (guestJson.error) { toast.error(guestJson.error); return }
      userId = guestJson.data.id
    }

    const patchBody: Record<string, any> = { stateId: payload.stateId }
    if (payload.paymentPlan) patchBody.paymentPlan = payload.paymentPlan
    if (userId) patchBody.userId = userId

    const res = await fetch(`/api/orders/${pendingMove.order.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patchBody),
    })
    const json = await res.json()
    if (json.error) { toast.error(json.error); return }

    setPendingMove(null)
    onOrderMoved()
    toast.success("Order moved")
  }

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
      {/* Mobile: dropdown + single column (no DnD) */}
      <div className="block md:hidden p-4 space-y-3">
        <h2 className="text-lg font-semibold text-(--color-foreground)">Orders</h2>
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

      {/* Desktop: DnD-enabled columns */}
      <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
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
        <DragOverlay dropAnimation={null}>
          {activeCard ? (
            <DashboardKanbanDragOverlay order={activeCard} role={role} />
          ) : null}
        </DragOverlay>
      </DndContext>

      {pendingMove ? (
        <DashboardKanbanMoveConfirmDialog
          order={pendingMove.order}
          fromStateId={pendingMove.fromStateId}
          toStateId={pendingMove.toStateId}
          targetStateName={pendingMove.targetStateName}
          open={true}
          onConfirm={handleMoveConfirm}
          onCancel={() => setPendingMove(null)}
        />
      ) : null}
    </>
  )
}
