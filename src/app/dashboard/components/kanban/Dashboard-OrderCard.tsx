"use client"

import { createContext, useContext } from "react"
import { useDraggable } from "@dnd-kit/core"
import { format, isPast } from "date-fns"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Link2 } from "lucide-react"
import { toast } from "sonner"
import type { OrderSummary } from "@/models/order"

type Ctx = { order: OrderSummary; role: string; onOpen: () => void }
const CardCtx = createContext<Ctx | null>(null)

function useCard(): Ctx {
  const ctx = useContext(CardCtx)
  if (!ctx) throw new Error("Must be inside OrderCard")
  return ctx
}

function CardShell({ className, children, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "group relative bg-(--color-background) border border-(--color-border) rounded-lg p-3 hover:shadow-sm transition-shadow motion-reduce:transition-none",
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
}

function Root({ order, role, onOpen, children }: Ctx & { children: React.ReactNode }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: order.id,
    data: { order },
  })

  return (
    <CardCtx.Provider value={{ order, role, onOpen }}>
      <CardShell
        ref={setNodeRef}
        className={cn("cursor-grab active:cursor-grabbing", isDragging && "opacity-40")}
        onClick={onOpen}
        {...attributes}
        {...listeners}
      >
        {children}
      </CardShell>
    </CardCtx.Provider>
  )
}

function Overlay({ order, role, children }: Omit<Ctx, "onOpen"> & { children: React.ReactNode }) {
  return (
    <CardCtx.Provider value={{ order, role, onOpen: () => {} }}>
      <CardShell className="rotate-1 shadow-lg opacity-95 cursor-grabbing">{children}</CardShell>
    </CardCtx.Provider>
  )
}

function Header() {
  const { order } = useCard()
  return (
    <div className="mb-2">
      <p className="font-medium text-sm text-(--color-foreground) whitespace-nowrap truncate">
        {order.nickname ? order.nickname : `Order #${order.id}`}
      </p>
      {order.user ? (
        <p className="text-xs text-(--color-muted) truncate">
          {order.user.firstName} {order.user.lastName}
        </p>
      ) : (
        <p className="text-xs text-(--color-muted)">No account</p>
      )}
    </div>
  )
}

function Badges() {
  const { order } = useCard()
  return (
    <div className="flex flex-wrap gap-1 mb-2">
      <Badge
        variant="outline"
        className="text-xs whitespace-nowrap"
        style={{ borderColor: order.state.color ?? undefined }}
      >
        {order.state.name}
      </Badge>
      {order.isPaid ? (
        <Badge className="text-xs bg-(--color-success) text-white border-0">Paid</Badge>
      ) : null}
    </div>
  )
}

function Footer() {
  const { order, role } = useCard()
  const isAdmin = role === "admin"
  const isOverdue =
    order.dueDate && !order.completedDate && isPast(new Date(order.dueDate))

  function handleCopyLink(e: React.MouseEvent) {
    e.stopPropagation()
    if (!order.token) { toast.error("No share link for this order"); return }
    const base = process.env.NEXT_PUBLIC_BASE_URL ?? window.location.origin
    const label = order.nickname ?? `Order #${order.id}`
    navigator.clipboard.writeText(`${base}/orders/${order.token}?name=${encodeURIComponent(label)}`)
    toast.success("Link copied")
  }

  return (
    <div className="flex items-end justify-between mt-3">
      <div className="text-xs text-(--color-muted) space-y-0.5">
        {order._count.orderLineItems > 0 ? (
          <p>{order._count.orderLineItems} item{order._count.orderLineItems !== 1 ? "s" : ""}</p>
        ) : null}
        {order.dueDate ? (
          <p className={cn(isOverdue && "text-(--color-danger) font-medium")}>
            Due {format(new Date(order.dueDate), "MMM d")}
            {order.isHardDeadline ? " ⚑" : ""}
          </p>
        ) : null}
      </div>
      <div className="flex items-end gap-2">
        <div className="text-right">
          <p className="text-sm font-semibold text-(--color-foreground)">${order.totalPrice.toFixed(2)}</p>
          {isAdmin && order.profit > 0 ? (
            <p className="text-xs text-(--color-success)">${order.profit.toFixed(2)} profit</p>
          ) : null}
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 w-7 p-0 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity"
          onClick={handleCopyLink}
          aria-label="Copy public share link"
        >
          <Link2 size={14} />
        </Button>
      </div>
    </div>
  )
}

export const OrderCard = Object.assign(Root, { Header, Badges, Footer, Overlay })
