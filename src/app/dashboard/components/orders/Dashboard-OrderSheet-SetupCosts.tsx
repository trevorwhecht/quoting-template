"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"
import type { OrderDetail, SetUpCost } from "@/models/order"

type Props = {
  order: OrderDetail
  onOrderUpdated: (order: OrderDetail) => void
}

export default function DashboardOrderSheetSetupCosts({ order, onOrderUpdated }: Props) {
  const [saving, setSaving] = useState<number | null>(null)
  const [userTotal, setUserTotal] = useState<Record<number, string>>(
    Object.fromEntries(order.setUpCosts.map((s) => [s.id, String(s.userTotal)]))
  )
  const [adminTotal, setAdminTotal] = useState<Record<number, string>>(
    Object.fromEntries(order.setUpCosts.map((s) => [s.id, String(s.adminTotal)]))
  )

  async function saveSetupCost(setupCost: SetUpCost) {
    setSaving(setupCost.id)
    const res = await fetch(`/api/setup-costs/${setupCost.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userTotal: Number(userTotal[setupCost.id] ?? setupCost.userTotal),
        adminTotal: Number(adminTotal[setupCost.id] ?? setupCost.adminTotal),
      }),
    })
    const json = await res.json()
    setSaving(null)
    if (json.error) { toast.error(json.error); return }
    const orderRes = await fetch(`/api/orders/${order.id}`)
    const orderJson = await orderRes.json()
    if (!orderJson.error) onOrderUpdated(orderJson.data)
    toast.success("Setup cost saved")
  }

  if (order.setUpCosts.length === 0) {
    return <p className="text-sm text-(--color-muted)">No setup costs on this order.</p>
  }

  return (
    <div className="space-y-6">
      {order.setUpCosts.map((sc) => (
        <div key={sc.id} className="border border-(--color-border) rounded-lg p-4 space-y-3">
          <h3 className="text-sm font-semibold text-(--color-foreground)">Setup Cost #{sc.id}</h3>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Customer Price ($)</Label>
              <Input
                type="number"
                inputMode="decimal"
                value={userTotal[sc.id] ?? sc.userTotal}
                onChange={(e) => setUserTotal((prev) => ({ ...prev, [sc.id]: e.target.value }))}
                step="0.01"
                className="text-base"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Actual Cost ($)</Label>
              <Input
                type="number"
                inputMode="decimal"
                value={adminTotal[sc.id] ?? sc.adminTotal}
                onChange={(e) => setAdminTotal((prev) => ({ ...prev, [sc.id]: e.target.value }))}
                step="0.01"
                className="text-base"
              />
            </div>
          </div>
          <Button size="sm" onClick={() => saveSetupCost(sc)} disabled={saving === sc.id}>
            {saving === sc.id ? "Saving…" : "Save"}
          </Button>
        </div>
      ))}
    </div>
  )
}
