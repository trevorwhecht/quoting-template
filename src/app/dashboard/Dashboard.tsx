"use client"

import { Suspense, useState, useEffect } from "react"
import { useSearchParams, usePathname, useRouter } from "next/navigation"
import DashboardSidebar from "./components/Dashboard-Sidebar"
import DashboardKanban from "./components/kanban/Dashboard-Kanban"
import DashboardCalendarView from "./components/views/Dashboard-CalendarView"
import DashboardCompleteView from "./components/views/Dashboard-CompleteView"
import DashboardArchiveView from "./components/views/Dashboard-ArchiveView"
import DashboardInsightsView from "./components/views/Dashboard-InsightsView"
import DashboardUsersView from "./components/views/Dashboard-UsersView"
import DashboardSettingsView from "./components/views/Dashboard-SettingsView"
import DashboardOrderDetailDialog from "./components/order-detail/Dashboard-OrderDetailDialog"
import { useOrders } from "@/hooks/useOrders"
import { useOrderStates } from "@/hooks/useOrderStates"
import type { OrderDetail } from "@/models/order"

type Props = { role: string; firstName: string; lastName: string }

function DashboardInner({ role, firstName, lastName }: Props) {
  const searchParams = useSearchParams()
  const pathname = usePathname()
  const router = useRouter()
  const view = searchParams.get("view") ?? "orders"

  const { orders, loading: ordersLoading, refetch: refetchOrders } = useOrders()
  const { orderStates, loading: statesLoading, refetch: refetchStates, updateState } = useOrderStates()

  const [selectedOrder, setSelectedOrder] = useState<OrderDetail | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)

  // Auto-open order from URL param on mount
  useEffect(() => {
    const orderId = searchParams.get("orderId")
    if (orderId) {
      fetch(`/api/orders/${orderId}`).then((r) => r.json()).then((json) => {
        if (!json.error) {
          setSelectedOrder(json.data)
          setDialogOpen(true)
        }
      })
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  function handleOpenOrder(order: OrderDetail) {
    setSelectedOrder(order)
    setDialogOpen(true)
    const params = new URLSearchParams(window.location.search)
    params.set("orderId", String(order.id))
    router.replace(`${pathname}?${params}`, { scroll: false })
  }

  function handleDialogOpenChange(open: boolean) {
    setDialogOpen(open)
    if (!open) {
      const params = new URLSearchParams(window.location.search)
      params.delete("orderId")
      const newUrl = params.toString() ? `${pathname}?${params}` : pathname
      router.replace(newUrl, { scroll: false })
    }
  }

  function handleOrderUpdated(updated: OrderDetail) {
    setSelectedOrder(updated)
    refetchOrders()
  }

  function handleOrderDeleted() {
    setDialogOpen(false)
    refetchOrders()
  }

  const activeStates = orderStates.filter((s) => s.isActive || s.isRequired)

  function renderView() {
    if (view === "calendar") return <DashboardCalendarView orders={orders} loading={ordersLoading} onOpenOrder={handleOpenOrder} />
    if (view === "complete") return <DashboardCompleteView orders={orders} loading={ordersLoading} onOpenOrder={handleOpenOrder} />
    if (view === "archive") return <DashboardArchiveView orders={orders} loading={ordersLoading} onOpenOrder={handleOpenOrder} />
    if (view === "insights" && role === "admin") return <DashboardInsightsView />
    if (view === "users" && role === "admin") return <DashboardUsersView />
    if (view === "settings" && role === "admin") return <DashboardSettingsView orderStates={orderStates} onStateUpdated={updateState} onStatesRefetch={refetchStates} />
    return <DashboardKanban orders={orders} loading={ordersLoading} orderStates={activeStates} statesLoading={statesLoading} onOpenOrder={handleOpenOrder} role={role} />
  }

  return (
    <div className="flex min-h-[calc(100dvh-3.5rem)]">
      <DashboardSidebar role={role} firstName={firstName} lastName={lastName} />
      <div className="flex-1 flex flex-col min-w-0">
        <main className="flex-1">{renderView()}</main>
      </div>
      <DashboardOrderDetailDialog
        order={selectedOrder}
        open={dialogOpen}
        onOpenChange={handleDialogOpenChange}
        onOrderUpdated={handleOrderUpdated}
        onOrderDeleted={handleOrderDeleted}
        role={role}
        orderStates={orderStates}
      />
    </div>
  )
}

export default function Dashboard(props: Props) {
  return (
    <Suspense>
      <DashboardInner {...props} />
    </Suspense>
  )
}
