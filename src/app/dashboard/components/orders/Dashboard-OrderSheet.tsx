"use client"

import { useTransition, useState } from "react"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "sonner"
import { format } from "date-fns"
import DashboardOrderSheetLineItems from "./Dashboard-OrderSheet-LineItems"
import DashboardOrderSheetSetupCosts from "./Dashboard-OrderSheet-SetupCosts"
import DashboardOrderSheetPayment from "./Dashboard-OrderSheet-Payment"
import type { OrderDetail } from "@/models/order"
import type { OrderStateModel } from "@/models/orderState"

type Props = {
  order: OrderDetail | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onOrderUpdated: (order: OrderDetail) => void
  onOrderDeleted: (id: number) => void
  role: string
  orderStates: OrderStateModel[]
}

export default function DashboardOrderSheet({ order, open, onOpenChange, onOrderUpdated, onOrderDeleted, role, orderStates }: Props) {
  const [isPending, startTransition] = useTransition()
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

  function handleStateChange(stateId: string | null) {
    if (!stateId) return
    startTransition(() => patchOrder({ stateId: Number(stateId) }))
  }

  async function handleDelete() {
    if (!order) return
    if (!confirm(`Delete order #${order.id}? This cannot be undone.`)) return
    const res = await fetch(`/api/orders/${order.id}`, { method: "DELETE" })
    const json = await res.json()
    if (json.error) { toast.error(json.error); return }
    onOrderDeleted(order.id)
    toast.success("Order deleted")
  }

  if (!order) return null

  const tabs = isAdmin
    ? ["details", "line-items", "setup-costs", "payment"]
    : ["details", "line-items"]

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-[600px] h-dvh overflow-y-auto flex flex-col p-0 bg-(--color-background)">
        <SheetHeader className="px-6 pt-6 pb-4 border-b border-(--color-border) shrink-0">
          <div className="flex items-start justify-between gap-2">
            <div>
              <SheetTitle className="text-(--color-foreground)">
                {order.nickname ? order.nickname : `Order #${order.id}`}
              </SheetTitle>
              {order.user ? (
                <p className="text-sm text-(--color-muted) mt-0.5">
                  {order.user.firstName} {order.user.lastName} · {order.user.email}
                </p>
              ) : null}
            </div>
            <Badge variant="outline" style={{ borderColor: order.state.color ?? undefined }}>
              {order.state.name}
            </Badge>
          </div>
        </SheetHeader>

        <Tabs defaultValue="details" className="flex-1 flex flex-col min-h-0">
          <TabsList className="mx-6 mt-4 shrink-0">
            {tabs.map((tab) => (
              <TabsTrigger key={tab} value={tab} className="capitalize">
                {tab.replace("-", " ")}
              </TabsTrigger>
            ))}
          </TabsList>

          {/* Details Tab */}
          <TabsContent value="details" className="flex-1 overflow-y-auto px-6 pb-6 space-y-4 mt-4">
            <div className="space-y-2">
              <Label>State</Label>
              <Select
                value={String(order.stateId)}
                onValueChange={handleStateChange}
                disabled={isPending}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {orderStates.map((s) => (
                    <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Nickname</Label>
              <Input
                defaultValue={order.nickname ?? ""}
                onBlur={(e) => { if (e.target.value !== (order.nickname ?? "")) patchOrder({ nickname: e.target.value || null }) }}
                className="text-base"
              />
            </div>

            <div className="space-y-2">
              <Label>Internal Notes</Label>
              <Textarea
                defaultValue={order.notes ?? ""}
                rows={3}
                onBlur={(e) => { if (e.target.value !== (order.notes ?? "")) patchOrder({ notes: e.target.value || null }) }}
              />
            </div>

            {order.customerNotes ? (
              <div className="space-y-2">
                <Label className="text-(--color-muted)">Customer Notes (read-only)</Label>
                <p className="text-sm text-(--color-foreground) bg-(--color-surface) rounded-md p-3 border border-(--color-border)">{order.customerNotes}</p>
              </div>
            ) : null}

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Due Date</Label>
                <Input
                  type="date"
                  defaultValue={order.dueDate ? format(new Date(order.dueDate), "yyyy-MM-dd") : ""}
                  onBlur={(e) => patchOrder({ dueDate: e.target.value || null })}
                  className="text-base"
                />
              </div>
              <div className="space-y-2">
                <Label>Due Date End</Label>
                <Input
                  type="date"
                  defaultValue={order.dueDateEnd ? format(new Date(order.dueDateEnd), "yyyy-MM-dd") : ""}
                  onBlur={(e) => patchOrder({ dueDateEnd: e.target.value || null })}
                  className="text-base"
                />
              </div>
            </div>

            {isAdmin ? (
              <>
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-2">
                    <Label>Rush Fee $</Label>
                    <Input type="number" inputMode="decimal" defaultValue={order.rushFeeAmount ?? ""} onBlur={(e) => patchOrder({ rushFeeAmount: e.target.value ? Number(e.target.value) : null })} className="text-base" />
                  </div>
                  <div className="space-y-2">
                    <Label>Rush %</Label>
                    <Input type="number" inputMode="decimal" defaultValue={order.rushFeePercent ?? ""} onBlur={(e) => patchOrder({ rushFeePercent: e.target.value ? Number(e.target.value) : null })} className="text-base" />
                  </div>
                  <div className="space-y-2">
                    <Label>Rush Days</Label>
                    <Input type="number" inputMode="numeric" defaultValue={order.rushFeeDays ?? ""} onBlur={(e) => patchOrder({ rushFeeDays: e.target.value ? Number(e.target.value) : null })} className="text-base" />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Discount (manual) $</Label>
                    <Input type="number" inputMode="decimal" defaultValue={order.discountManual ?? ""} onBlur={(e) => patchOrder({ discountManual: e.target.value ? Number(e.target.value) : null })} className="text-base" />
                  </div>
                  <div className="space-y-2">
                    <Label>Payment Plan</Label>
                    <Select defaultValue={order.paymentPlan ?? ""} onValueChange={(v) => patchOrder({ paymentPlan: v || null })}>
                      <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">None</SelectItem>
                        <SelectItem value="deposit">Deposit</SelectItem>
                        <SelectItem value="full_upfront">Full Upfront</SelectItem>
                        <SelectItem value="pay_at_pickup">Pay at Pickup</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Tax deferral + reseller license */}
                <div className="rounded-md border border-(--color-border) p-3 space-y-2 text-sm bg-(--color-surface)">
                  <div className="flex justify-between items-center">
                    <span className="text-(--color-muted)">Tax Deferral Requested</span>
                    <span className={order.taxDeferralRequested ? "font-medium text-(--color-foreground)" : "text-(--color-muted)"}>
                      {order.taxDeferralRequested ? "Yes" : "No"}
                    </span>
                  </div>
                  {order.user ? (
                    <div className="flex justify-between items-center">
                      <span className="text-(--color-muted)">Reseller License</span>
                      {order.user.resellerLicenseUrl ? (
                        <a
                          href={order.user.resellerLicenseUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-(--color-primary) hover:underline text-xs"
                        >
                          View License
                        </a>
                      ) : (
                        <span className="text-(--color-muted)">None on file</span>
                      )}
                    </div>
                  ) : null}
                </div>

                {/* Totals summary */}
                <div className="rounded-md border border-(--color-border) p-4 space-y-1.5 text-sm">
                  <div className="flex justify-between"><span className="text-(--color-muted)">Items</span><span>${order.totalAmount.toFixed(2)}</span></div>
                  <div className="flex justify-between"><span className="text-(--color-muted)">Setup</span><span>${order.totalSetUpPrice.toFixed(2)}</span></div>
                  {order.discountManual ? <div className="flex justify-between text-(--color-danger)"><span>Discount</span><span>-${order.discountManual.toFixed(2)}</span></div> : null}
                  {order.rushFeeAmount ? <div className="flex justify-between"><span className="text-(--color-muted)">Rush Fee</span><span>${order.rushFeeAmount.toFixed(2)}</span></div> : null}
                  <div className="flex justify-between border-t border-(--color-border) pt-1.5"><span className="text-(--color-muted)">Subtotal</span><span>${order.subTotal.toFixed(2)}</span></div>
                  <div className="flex justify-between"><span className="text-(--color-muted)">Tax</span><span>${order.salesTax.toFixed(2)}</span></div>
                  <div className="flex justify-between font-semibold text-base"><span>Total</span><span>${order.totalPrice.toFixed(2)}</span></div>
                  <div className="flex justify-between text-(--color-success)"><span>Profit</span><span>${order.profit.toFixed(2)}</span></div>
                </div>
              </>
            ) : null}

            {isAdmin ? (
              <div className="pt-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
                <Button variant="destructive" size="sm" onClick={handleDelete}>Delete Order</Button>
              </div>
            ) : null}
          </TabsContent>

          {/* Line Items Tab */}
          <TabsContent value="line-items" className="flex-1 overflow-y-auto px-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] mt-4">
            <DashboardOrderSheetLineItems order={order} onOrderUpdated={onOrderUpdated} role={role} />
          </TabsContent>

          {/* Setup Costs Tab (admin only) */}
          {isAdmin ? (
            <TabsContent value="setup-costs" className="flex-1 overflow-y-auto px-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] mt-4">
              <DashboardOrderSheetSetupCosts order={order} onOrderUpdated={onOrderUpdated} />
            </TabsContent>
          ) : null}

          {/* Payment Tab (admin only) */}
          {isAdmin ? (
            <TabsContent value="payment" className="flex-1 overflow-y-auto px-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] mt-4">
              <DashboardOrderSheetPayment order={order} onOrderUpdated={onOrderUpdated} />
            </TabsContent>
          ) : null}
        </Tabs>
      </SheetContent>
    </Sheet>
  )
}
