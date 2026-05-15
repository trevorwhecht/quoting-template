"use client"

import { useState } from "react"
import { format, startOfMonth, endOfMonth, eachDayOfInterval, startOfWeek, endOfWeek, isSameMonth, isPast, isToday, addMonths, subMonths } from "date-fns"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { ChevronLeft, ChevronRight } from "lucide-react"
import type { OrderSummary, OrderDetail } from "@/models/order"

type Props = {
  orders: OrderSummary[]
  loading: boolean
  onOpenOrder: (order: OrderDetail) => void
}

export default function DashboardCalendarView({ orders, loading, onOpenOrder }: Props) {
  const [currentMonth, setCurrentMonth] = useState(new Date())

  const monthStart = startOfMonth(currentMonth)
  const monthEnd = endOfMonth(currentMonth)
  const calStart = startOfWeek(monthStart, { weekStartsOn: 0 })
  const calEnd = endOfWeek(monthEnd, { weekStartsOn: 0 })
  const days = eachDayOfInterval({ start: calStart, end: calEnd })

  const ordersWithDue = orders.filter((o) => o.dueDate)

  async function handleOpen(order: OrderSummary) {
    const res = await fetch(`/api/orders/${order.id}`)
    const json = await res.json()
    if (!json.error) onOpenOrder(json.data)
  }

  return (
    <div className="p-4">
      {/* Month navigation */}
      <div className="flex items-center justify-between mb-4">
        <Button variant="outline" size="sm" onClick={() => setCurrentMonth((m) => subMonths(m, 1))} aria-label="Previous month">
          <ChevronLeft size={16} />
        </Button>
        <h2 className="text-lg font-semibold text-(--color-foreground)">{format(currentMonth, "MMMM yyyy")}</h2>
        <Button variant="outline" size="sm" onClick={() => setCurrentMonth((m) => addMonths(m, 1))} aria-label="Next month">
          <ChevronRight size={16} />
        </Button>
      </div>

      {/* Day-of-week headers */}
      <div className="grid grid-cols-7 mb-1">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
          <div key={d} className="text-center text-xs font-medium text-(--color-muted) py-1">{d}</div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 border-l border-t border-(--color-border)">
        {days.map((day) => {
          const dayOrders = ordersWithDue.filter((o) => {
            const start = new Date(o.dueDate!)
            const end = o.dueDateEnd ? new Date(o.dueDateEnd) : start
            return day >= start && day <= end
          })
          const isCurrentMonth = isSameMonth(day, currentMonth)
          const overdue = isPast(day) && !isToday(day) && dayOrders.some((o) => !o.completedDate)

          return (
            <div
              key={day.toISOString()}
              className={cn(
                "border-r border-b border-(--color-border) min-h-[80px] p-1",
                !isCurrentMonth && "bg-(--color-surface) opacity-60",
                isToday(day) && "bg-(--color-today-bg)"
              )}
            >
              <p className={cn(
                "text-xs font-medium mb-1",
                isToday(day) ? "text-(--color-today)" : isCurrentMonth ? "text-(--color-foreground)" : "text-(--color-muted)",
                overdue && "text-(--color-danger)"
              )}>
                {format(day, "d")}
              </p>
              <div className="space-y-0.5">
                {dayOrders.slice(0, 3).map((order) => (
                  <button
                    key={order.id}
                    onClick={() => handleOpen(order)}
                    className={cn(
                      "w-full text-left text-xs px-1 py-0.5 rounded truncate block touch-manipulation",
                      order.completedDate
                        ? "bg-(--color-success) bg-opacity-20 text-(--color-success)"
                        : isPast(new Date(order.dueDate!)) ? "bg-(--color-danger) bg-opacity-20 text-(--color-danger)" : "bg-(--color-primary) bg-opacity-10 text-(--color-primary)"
                    )}
                    style={{ borderLeft: `2px solid ${order.state.color ?? "var(--color-border)"}` }}
                  >
                    {order.nickname ?? `#${order.id}`}
                  </button>
                ))}
                {dayOrders.length > 3 ? (
                  <p className="text-xs text-(--color-muted) px-1">+{dayOrders.length - 3} more</p>
                ) : null}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
