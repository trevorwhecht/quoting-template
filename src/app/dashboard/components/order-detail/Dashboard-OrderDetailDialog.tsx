"use client"

import { useTransition, useState } from "react"
import { Dialog } from "@/components/ui/dialog"
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog"
import { DialogPortal, DialogOverlay } from "@/components/ui/dialog"
import { Button, buttonVariants } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { toast } from "sonner"
import { format } from "date-fns"
import Link from "next/link"
import DashboardOrderSheetLineItems from "../orders/Dashboard-OrderSheet-LineItems"
import DashboardOrderSheetSetupCosts from "../orders/Dashboard-OrderSheet-SetupCosts"
import DashboardOrderSheetPayment from "../orders/Dashboard-OrderSheet-Payment"
import type { OrderDetail } from "@/models/order"
import type { OrderStateModel } from "@/models/orderState"

type Props = {
  order: OrderDetail | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onOrderUpdated: (order: OrderDetail) => void
  onOrderDeleted: () => void
  role: string
  orderStates: OrderStateModel[]
}

const ADVANCE_LABELS: Record<number, string> = {
  1: "Send To Customer",
  2: "Approve For Customer",
  3: "Mark Ready for Pickup",
  4: "Request Final Payment",
  5: "Mark Complete",
}

export default function DashboardOrderDetailDialog({ order, open, onOpenChange, onOrderUpdated, onOrderDeleted, role, orderStates }: Props) {
  const [isPending, startTransition] = useTransition()
  const [paymentMethod, setPaymentMethod] = useState("")
  const isAdmin = role === "admin"

  async function patchOrder(updates: Record<string, any>) {
    if (!order) return
    const res = await fetch(`/api/orders/${order.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates),
    })
    const json = await res.json()
    if (json.error) { toast.error(json.error); return }
    onOrderUpdated(json.data)
    toast.success("Saved")
  }

  async function handleDelete() {
    if (!order) return
    if (!confirm(`Delete order #${order.id}? This cannot be undone.`)) return
    const res = await fetch(`/api/orders/${order.id}`, { method: "DELETE" })
    const json = await res.json()
    if (json.error) { toast.error(json.error); return }
    onOrderDeleted()
    toast.success("Order deleted")
  }

  function renderActionButtons() {
    if (!order) return null
    const stateId = order.stateId

    if (stateId === 0) {
      return (
        <div className="flex justify-end gap-2 flex-wrap">
          <Link href={`/quote-builder?reorderId=${order.id}`} className={buttonVariants({ size: "sm", variant: "outline" })}>Create Duplicate</Link>
          <Link href={`/quote-builder?orderId=${order.id}`} className={buttonVariants({ size: "sm", variant: "outline" })}>Edit</Link>
          <Button size="sm" disabled={isPending} onClick={() => startTransition(() => patchOrder({ stateId: 1 }))}>Restore</Button>
          {isAdmin ? <Button size="sm" variant="destructive" onClick={handleDelete}>Delete</Button> : null}
        </div>
      )
    }

    if (stateId === 6) {
      return (
        <div className="flex justify-end gap-2 flex-wrap">
          <Link href={`/quote-builder?reorderId=${order.id}`} className={buttonVariants({ size: "sm", variant: "outline" })}>Create Duplicate</Link>
          <Button size="sm" variant="destructive" disabled={isPending} onClick={() => startTransition(() => patchOrder({ stateId: 0 }))}>Archive</Button>
        </div>
      )
    }

    if (stateId === 1) {
      return (
        <div className="space-y-3">
          <div className="max-w-xs">
            <Label className="text-xs">Payment Type (required to advance)</Label>
            <Select value={paymentMethod} onValueChange={(v) => v && setPaymentMethod(v)}>
              <SelectTrigger className="mt-1"><SelectValue placeholder="Select…" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="pay_at_pickup">Pay at Pickup</SelectItem>
                <SelectItem value="deposit">Deposit</SelectItem>
                <SelectItem value="full_upfront">Full Upfront</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex justify-end gap-2 flex-wrap">
            {isAdmin ? <Button size="sm" variant="destructive" disabled={isPending} onClick={() => startTransition(() => patchOrder({ stateId: 0 }))}>Revert</Button> : null}
            <Link href={`/quote-builder?reorderId=${order.id}`} className={buttonVariants({ size: "sm", variant: "outline" })}>Create Duplicate</Link>
            <Link href={`/quote-builder?orderId=${order.id}`} className={buttonVariants({ size: "sm", variant: "outline" })}>Edit</Link>
            <Button size="sm" disabled={!paymentMethod || isPending} onClick={() => startTransition(() => patchOrder({ stateId: 2, paymentPlan: paymentMethod }))}>
              {ADVANCE_LABELS[1]}
            </Button>
          </div>
        </div>
      )
    }

    return (
      <div className="flex justify-end gap-2 flex-wrap">
        {isAdmin ? <Button size="sm" variant="destructive" disabled={isPending} onClick={() => startTransition(() => patchOrder({ stateId: stateId - 1 }))}>Revert</Button> : null}
        <Link href={`/quote-builder?reorderId=${order.id}`} className={buttonVariants({ size: "sm", variant: "outline" })}>Create Duplicate</Link>
        <Link href={`/quote-builder?orderId=${order.id}`} className={buttonVariants({ size: "sm", variant: "outline" })}>Edit</Link>
        {stateId <= 5 ? (
          <Button size="sm" disabled={isPending} onClick={() => startTransition(() => patchOrder({ stateId: stateId + 1 }))}>
            {ADVANCE_LABELS[stateId] ?? "Advance"}
          </Button>
        ) : null}
      </div>
    )
  }

  if (!order) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPortal>
        <DialogOverlay />
        <DialogPrimitive.Popup className="fixed top-1/2 left-1/2 z-50 w-[calc(100%-2rem)] sm:max-w-4xl max-h-[90dvh] -translate-x-1/2 -translate-y-1/2 rounded-xl bg-(--color-background) text-sm text-(--color-foreground) ring-1 ring-(--color-border) outline-none flex flex-col duration-100 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95">
          {/* Header */}
          <div className="px-6 py-4 border-b border-(--color-border) flex items-start justify-between gap-4 shrink-0">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs text-(--color-muted)">Order #{order.id}</span>
                {order.dueDate ? (
                  <span className="text-xs text-(--color-muted)">· Due {format(new Date(order.dueDate), "MMM d, yyyy")}</span>
                ) : null}
              </div>
              <Input
                defaultValue={order.nickname ?? ""}
                onBlur={(e) => { if (e.target.value !== (order.nickname ?? "")) patchOrder({ nickname: e.target.value || null }) }}
                placeholder="Add nickname…"
                className="text-base font-medium border-0 px-0 h-auto focus-visible:ring-0 bg-transparent shadow-none"
              />
              {order.user ? (
                <p className="text-xs text-(--color-muted) mt-1">{order.user.firstName} {order.user.lastName} · {order.user.email}</p>
              ) : null}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Badge variant="outline" style={{ borderColor: order.state.color ?? undefined }}>{order.state.name}</Badge>
              <DialogPrimitive.Close
                render={<button className="rounded-md p-1.5 hover:bg-(--color-surface) text-(--color-muted) hover:text-(--color-foreground)" aria-label="Close" />}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6L6 18M6 6l12 12" /></svg>
              </DialogPrimitive.Close>
            </div>
          </div>

          {/* Scrollable body */}
          <div className="flex-1 overflow-y-auto px-6 py-4 space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label>State</Label>
                <Select value={String(order.stateId)} onValueChange={(v) => v && startTransition(() => patchOrder({ stateId: Number(v) }))} disabled={isPending}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {orderStates.map((s) => <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Due Date</Label>
                <Input type="date" defaultValue={order.dueDate ? format(new Date(order.dueDate), "yyyy-MM-dd") : ""} onBlur={(e) => patchOrder({ dueDate: e.target.value || null })} className="text-base" />
              </div>
              <div className="space-y-1.5">
                <Label>Due Date End</Label>
                <Input type="date" defaultValue={order.dueDateEnd ? format(new Date(order.dueDateEnd), "yyyy-MM-dd") : ""} onBlur={(e) => patchOrder({ dueDateEnd: e.target.value || null })} className="text-base" />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Internal Notes</Label>
              <Textarea defaultValue={order.notes ?? ""} rows={2} onBlur={(e) => { if (e.target.value !== (order.notes ?? "")) patchOrder({ notes: e.target.value || null }) }} />
            </div>
            {order.customerNotes ? (
              <div className="space-y-1.5">
                <Label className="text-(--color-muted)">Customer Notes (read-only)</Label>
                <p className="text-sm bg-(--color-surface) rounded-md p-3 border border-(--color-border)">{order.customerNotes}</p>
              </div>
            ) : null}

            <Separator />

            <div>
              <h3 className="text-sm font-semibold text-(--color-foreground) mb-3">Order Items</h3>
              <DashboardOrderSheetLineItems order={order} onOrderUpdated={onOrderUpdated} role={role} />
            </div>

            {isAdmin ? (
              <>
                <Separator />
                <div className={order.setUpCosts.length > 0 ? "grid sm:grid-cols-2 gap-6" : ""}>
                  {order.setUpCosts.length > 0 ? (
                    <div>
                      <h3 className="text-sm font-semibold text-(--color-foreground) mb-3">Setup Costs</h3>
                      <DashboardOrderSheetSetupCosts order={order} onOrderUpdated={onOrderUpdated} />
                    </div>
                  ) : null}
                  <div>
                    <h3 className="text-sm font-semibold text-(--color-foreground) mb-3">Order Totals</h3>
                    <div className="rounded-md border border-(--color-border) p-4 space-y-1.5 text-sm">
                      <div className="flex justify-between"><span className="text-(--color-muted)">Items</span><span>${order.totalAmount.toFixed(2)}</span></div>
                      {order.totalSetUpPrice > 0 ? <div className="flex justify-between"><span className="text-(--color-muted)">Setup</span><span>${order.totalSetUpPrice.toFixed(2)}</span></div> : null}
                      {order.discountManual ? <div className="flex justify-between text-(--color-danger)"><span>Discount</span><span>-${order.discountManual.toFixed(2)}</span></div> : null}
                      {order.rushFeeAmount ? <div className="flex justify-between"><span className="text-(--color-muted)">Rush Fee</span><span>${order.rushFeeAmount.toFixed(2)}</span></div> : null}
                      <div className="flex justify-between border-t border-(--color-border) pt-1.5"><span className="text-(--color-muted)">Subtotal</span><span>${order.subTotal.toFixed(2)}</span></div>
                      <div className="flex justify-between"><span className="text-(--color-muted)">Tax</span><span>${order.salesTax.toFixed(2)}</span></div>
                      <div className="flex justify-between font-semibold"><span>Total</span><span>${order.totalPrice.toFixed(2)}</span></div>
                      <div className="flex justify-between text-(--color-success)"><span>Profit</span><span>${order.profit.toFixed(2)}</span></div>
                    </div>
                  </div>
                </div>
                <Separator />
                <div>
                  <h3 className="text-sm font-semibold text-(--color-foreground) mb-3">Payments</h3>
                  <DashboardOrderSheetPayment order={order} onOrderUpdated={onOrderUpdated} />
                </div>
              </>
            ) : null}
          </div>

          {/* Footer: state-dependent action buttons */}
          <div className="px-6 py-4 border-t border-(--color-border) shrink-0 pb-[max(1rem,env(safe-area-inset-bottom))]">
            {renderActionButtons()}
          </div>
        </DialogPrimitive.Popup>
      </DialogPortal>
    </Dialog>
  )
}
