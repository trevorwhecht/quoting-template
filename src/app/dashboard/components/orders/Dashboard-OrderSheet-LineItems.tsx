"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { toast } from "sonner"
import { Trash2, Plus } from "lucide-react"
import type { OrderDetail, OrderLineItem } from "@/models/order"

type Props = {
  order: OrderDetail
  onOrderUpdated: (order: OrderDetail) => void
  role: string
}

type DraftLineItem = {
  id?: number
  description: string
  qty: number
  unitPrice: number
  unitCost: number
  notes: string
}

function toLineItem(li: OrderLineItem): DraftLineItem {
  return { id: li.id, description: li.description, qty: li.qty, unitPrice: li.unitPrice, unitCost: li.unitCost, notes: li.notes ?? "" }
}

export default function DashboardOrderSheetLineItems({ order, onOrderUpdated, role }: Props) {
  const isAdmin = role === "admin"
  const [items, setItems] = useState<DraftLineItem[]>(order.orderLineItems.map(toLineItem))
  const [saving, setSaving] = useState(false)

  function updateItem(idx: number, field: keyof DraftLineItem, value: string | number) {
    setItems((prev) => prev.map((item, i) => i === idx ? { ...item, [field]: value } : item))
  }

  function addItem() {
    setItems((prev) => [...prev, { description: "", qty: 1, unitPrice: 0, unitCost: 0, notes: "" }])
  }

  function removeItem(idx: number) {
    setItems((prev) => prev.filter((_, i) => i !== idx))
  }

  async function save() {
    setSaving(true)
    const res = await fetch(`/api/orders/${order.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lineItems: items }),
    })
    const json = await res.json()
    setSaving(false)
    if (json.error) { toast.error(json.error); return }
    onOrderUpdated(json.data)
    setItems(json.data.orderLineItems.map(toLineItem))
    toast.success("Line items saved")
  }

  const subtotalItems = items.reduce((s, li) => s + li.qty * li.unitPrice, 0)

  return (
    <div className="space-y-4">
      <div className="w-full overflow-x-auto">
        <table className="min-w-[480px] w-full text-sm">
          <thead>
            <tr className="border-b border-(--color-border) text-left">
              <th className="pb-2 font-medium text-(--color-muted) pr-2">Description</th>
              <th className="pb-2 font-medium text-(--color-muted) w-16 pr-2">Qty</th>
              <th className="pb-2 font-medium text-(--color-muted) w-24 pr-2">Price</th>
              {isAdmin ? <th className="pb-2 font-medium text-(--color-muted) w-24 pr-2">Cost</th> : null}
              <th className="pb-2 font-medium text-(--color-muted) w-20 pr-2">Total</th>
              <th className="pb-2 w-8"></th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, idx) => (
              <tr key={idx} className="border-b border-(--color-border)">
                <td className="py-2 pr-2">
                  <Input
                    value={item.description}
                    onChange={(e) => updateItem(idx, "description", e.target.value)}
                    placeholder="Description"
                    className="text-base h-8"
                  />
                </td>
                <td className="py-2 pr-2">
                  <Input
                    type="number"
                    inputMode="numeric"
                    value={item.qty}
                    onChange={(e) => updateItem(idx, "qty", Math.max(1, Number(e.target.value)))}
                    className="text-base h-8 w-16"
                    min={1}
                  />
                </td>
                <td className="py-2 pr-2">
                  <Input
                    type="number"
                    inputMode="decimal"
                    value={item.unitPrice}
                    onChange={(e) => updateItem(idx, "unitPrice", Number(e.target.value))}
                    className="text-base h-8 w-24"
                    step="0.01"
                  />
                </td>
                {isAdmin ? (
                  <td className="py-2 pr-2">
                    <Input
                      type="number"
                      inputMode="decimal"
                      value={item.unitCost}
                      onChange={(e) => updateItem(idx, "unitCost", Number(e.target.value))}
                      className="text-base h-8 w-24"
                      step="0.01"
                    />
                  </td>
                ) : null}
                <td className="py-2 pr-2 whitespace-nowrap text-(--color-muted)">
                  ${(item.qty * item.unitPrice).toFixed(2)}
                </td>
                <td className="py-2">
                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-(--color-danger)" onClick={() => removeItem(idx)} aria-label="Remove line item">
                    <Trash2 size={14} />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between">
        <Button variant="outline" size="sm" onClick={addItem}>
          <Plus size={14} className="mr-1" /> Add Item
        </Button>
        <p className="text-sm font-medium text-(--color-foreground)">Items total: ${subtotalItems.toFixed(2)}</p>
      </div>

      <Button onClick={save} disabled={saving} className="w-full">
        {saving ? "Saving…" : "Save Line Items"}
      </Button>
    </div>
  )
}
