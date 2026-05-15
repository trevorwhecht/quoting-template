"use client"

import { useState } from "react"
import { format } from "date-fns"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { toast } from "sonner"
import { Trash2 } from "lucide-react"
import type { OrderDetail } from "@/models/order"

type Props = {
  order: OrderDetail
  onOrderUpdated: (order: OrderDetail) => void
}

const CHANNELS = ["zelle", "stripe", "cash", "check", "other"]

export default function DashboardOrderSheetPayment({ order, onOrderUpdated }: Props) {
  const [amount, setAmount] = useState("")
  const [channel, setChannel] = useState("cash")
  const [note, setNote] = useState("")
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState<number | null>(null)

  const totalPaid = order.payments.reduce((s, p) => s + p.amount, 0)
  const balance = order.totalPrice - totalPaid

  async function addPayment() {
    if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
      toast.error("Enter a valid amount"); return
    }
    setSaving(true)
    const res = await fetch("/api/payments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderId: order.id, amount: Number(amount), channel, note: note || null }),
    })
    const json = await res.json()
    setSaving(false)
    if (json.error) { toast.error(json.error); return }
    const orderRes = await fetch(`/api/orders/${order.id}`)
    const orderJson = await orderRes.json()
    if (!orderJson.error) onOrderUpdated(orderJson.data)
    setAmount("")
    setNote("")
    toast.success("Payment recorded")
  }

  async function deletePayment(paymentId: number) {
    setDeleting(paymentId)
    const res = await fetch(`/api/payments/${paymentId}`, { method: "DELETE" })
    const json = await res.json()
    setDeleting(null)
    if (json.error) { toast.error(json.error); return }
    const orderRes = await fetch(`/api/orders/${order.id}`)
    const orderJson = await orderRes.json()
    if (!orderJson.error) onOrderUpdated(orderJson.data)
    toast.success("Payment removed")
  }

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="rounded-md border border-(--color-border) p-4 space-y-2 text-sm">
        <div className="flex justify-between"><span className="text-(--color-muted)">Order Total</span><span className="font-medium">${order.totalPrice.toFixed(2)}</span></div>
        <div className="flex justify-between text-(--color-success)"><span>Paid</span><span>${totalPaid.toFixed(2)}</span></div>
        <div className="flex justify-between font-semibold"><span>Balance</span><span className={balance > 0 ? "text-(--color-danger)" : "text-(--color-success)"}>${balance.toFixed(2)}</span></div>
      </div>

      {/* Payment history */}
      {order.payments.length > 0 ? (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-(--color-foreground)">Payment History</h3>
          {order.payments.map((p) => (
            <div key={p.id} className="flex items-center justify-between text-sm border-b border-(--color-border) py-2">
              <div>
                <p className="font-medium">${p.amount.toFixed(2)} <span className="text-(--color-muted) capitalize">· {p.channel}</span></p>
                {p.note ? <p className="text-xs text-(--color-muted)">{p.note}</p> : null}
                <p className="text-xs text-(--color-muted)">{format(new Date(p.paidAt), "MMM d, yyyy")}</p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0 text-(--color-danger)"
                onClick={() => deletePayment(p.id)}
                disabled={deleting === p.id}
                aria-label="Delete payment"
              >
                <Trash2 size={14} />
              </Button>
            </div>
          ))}
        </div>
      ) : null}

      <Separator />

      {/* Add payment form */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-(--color-foreground)">Record Payment</h3>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>Amount ($)</Label>
            <Input type="number" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} step="0.01" placeholder="0.00" className="text-base" />
          </div>
          <div className="space-y-1.5">
            <Label>Channel</Label>
            <Select value={channel} onValueChange={(v) => v && setChannel(v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {CHANNELS.map((c) => <SelectItem key={c} value={c} className="capitalize">{c}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="space-y-1.5">
          <Label>Note (optional)</Label>
          <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Zelle confirmation #" className="text-base" />
        </div>
        <Button onClick={addPayment} disabled={saving} className="w-full pb-[max(1rem,env(safe-area-inset-bottom))]">
          {saving ? "Recording…" : "Record Payment"}
        </Button>
      </div>
    </div>
  )
}
