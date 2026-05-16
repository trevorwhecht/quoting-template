"use client"

import { useState, useTransition, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Loader2, Trash2, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { toast } from "sonner"
import { computeOrderTotals } from "@/services/orderService"
import GetQuoteAddItemDialog, { type AddItemResult } from "./GetQuote-AddItemDialog"
import type { LineItemPreset, SetupFeePreset } from "@/models/preset"
import type { UserSummary } from "@/models/user"

type FormLineItem = AddItemResult & { localId: string }

type DraftSetupCost = {
  localId: string
  label: string
  qty: number
  rate: number
  cost: number
}

type Props = { role: string; taxRate: number }

function newId() { return `${Date.now()}-${Math.random()}` }

export default function GetQuoteForm({ role, taxRate }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const isAdmin = role === "admin"
  const isStaff = role === "admin" || role === "employee"

  const [lineItemPresets, setLineItemPresets] = useState<LineItemPreset[]>([])
  const [setupFeePresets, setSetupFeePresets] = useState<SetupFeePreset[]>([])
  const [users, setUsers] = useState<UserSummary[]>([])

  const [lineItems, setLineItems] = useState<FormLineItem[]>([])
  const [setupCosts, setSetupCosts] = useState<DraftSetupCost[]>([])
  const [customerNotes, setCustomerNotes] = useState("")
  const [dueDate, setDueDate] = useState("")
  const [isHardDeadline, setIsHardDeadline] = useState(false)

  const [showAddItem, setShowAddItem] = useState(false)
  const [showAddSetup, setShowAddSetup] = useState(false)
  const [setupSelection, setSetupSelection] = useState("")
  const [setupQty, setSetupQty] = useState(1)
  const [setupRate, setSetupRate] = useState(0)
  const [setupCost, setSetupCostVal] = useState(0)
  const [setupLabel, setSetupLabel] = useState("")

  const [assignedUserId, setAssignedUserId] = useState<string | null>(null)
  const [userQuery, setUserQuery] = useState("")
  const [userSearchOpen, setUserSearchOpen] = useState(false)
  const [orderNickname, setOrderNickname] = useState("")

  useEffect(() => {
    fetch("/api/line-item-presets").then((r) => r.json()).then(({ data }) => { if (data) setLineItemPresets(data) })
    fetch("/api/setup-fee-presets").then((r) => r.json()).then(({ data }) => { if (data) setSetupFeePresets(data) })
    if (isAdmin) {
      fetch("/api/users").then((r) => r.json()).then(({ data }) => { if (data) setUsers(data) })
    }
  }, [isAdmin])

  function handleAddItem(item: AddItemResult) {
    setLineItems((prev) => [...prev, { ...item, localId: newId() }])
  }

  function updateLineQty(localId: string, qty: number) {
    setLineItems((prev) => prev.map((li) => li.localId === localId ? { ...li, qty } : li))
  }

  function handleAddSetupCost() {
    const isCustom = setupSelection === "custom"
    const preset = setupFeePresets.find((p) => String(p.id) === setupSelection)
    const label = isCustom ? setupLabel : (preset?.name ?? "")
    if (!label.trim()) { toast.error("Please enter a name."); return }
    setSetupCosts((prev) => [...prev, {
      localId: newId(),
      label,
      qty: setupQty,
      rate: isCustom ? setupRate : preset?.defaultRate ?? 0,
      cost: isCustom ? setupCost : preset?.defaultCost ?? 0,
    }])
    setSetupSelection(""); setSetupQty(1); setSetupRate(0); setSetupCostVal(0); setSetupLabel("")
    setShowAddSetup(false)
  }

  const selectedUser = users.find((u) => u.id === assignedUserId)
  const filteredUsers = userQuery.trim()
    ? users.filter((u) => `${u.firstName} ${u.lastName} ${u.email}`.toLowerCase().includes(userQuery.toLowerCase()))
    : users.slice(0, 10)

  const liveLineItems = lineItems.map((li) => ({ qty: li.qty, unitPrice: li.unitPrice, unitCost: li.unitCost }))
  const liveSetupCosts = setupCosts.map((sc) => ({ userTotal: sc.rate * sc.qty, adminTotal: sc.cost * sc.qty }))
  const totals = computeOrderTotals({ lineItems: liveLineItems, setUpCosts: liveSetupCosts, taxRate })
  const hasCustomTbd = lineItems.some((li) => li.isCustom && li.unitPrice === 0)

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!customerNotes.trim()) { toast.error("Please describe what you need."); return }
    if (lineItems.length === 0) { toast.error("Please add at least one item."); return }
    if (isAdmin && lineItems.some((li) => li.isCustom && li.unitPrice <= 0)) {
      toast.error("Please enter a price for all custom items before saving.")
      return
    }

    startTransition(async () => {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerNotes,
          dueDate: dueDate || null,
          isHardDeadline,
          nickname: orderNickname || null,
          userId: isAdmin ? assignedUserId : undefined,
          lineItems: lineItems.map(({ description, qty, unitPrice, unitCost }) => ({ description, qty, unitPrice, unitCost })),
          setUpCosts: isStaff ? setupCosts.map(({ label, qty, rate, cost }) => ({ label, qty, rate, cost })) : undefined,
        }),
      })
      const json = await res.json()
      if (json.error) { toast.error(json.error); return }
      const order = json.data
      const label = order.nickname ?? `Order #${order.id}`
      router.push(`/orders/${order.token}?name=${encodeURIComponent(label)}`)
    })
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-(--color-foreground)">Request a Quote</h1>
        <p className="text-sm text-(--color-muted) mt-1">Tell us what you need. We&apos;ll review and send you a detailed quote shortly.</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Order Items */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-(--color-foreground)">Order Items</h2>
            <Button type="button" variant="outline" size="sm" onClick={() => setShowAddItem(true)} className="gap-1">
              <Plus size={14} /> Add Item
            </Button>
          </div>
          {lineItems.length > 0 ? (
            <div className="w-full overflow-x-auto border border-(--color-border) rounded-lg">
              <table className={`w-full text-sm ${isAdmin ? "min-w-160" : "min-w-100"}`}>
                <thead>
                  <tr className="border-b border-(--color-border) bg-(--color-surface)">
                    <th className="text-left px-3 py-2.5 font-medium text-(--color-muted)">Item</th>
                    <th className="text-right px-3 py-2.5 font-medium text-(--color-muted) w-16">Qty</th>
                    {isAdmin ? <th className="text-right px-3 py-2.5 font-medium text-(--color-muted) w-24">Cost</th> : null}
                    <th className="text-right px-3 py-2.5 font-medium text-(--color-muted) w-24">Rate</th>
                    <th className="text-right px-3 py-2.5 font-medium text-(--color-muted) w-24">Amount</th>
                    {isAdmin ? <th className="text-right px-3 py-2.5 font-medium text-(--color-success) w-24">Profit</th> : null}
                    <th className="w-8" />
                  </tr>
                </thead>
                <tbody>
                  {lineItems.map((item) => (
                    <tr key={item.localId} className="border-b border-(--color-border) last:border-0">
                      <td className="px-3 py-2.5 text-(--color-foreground) font-medium">{item.description}</td>
                      <td className="px-3 py-2 text-right">
                        <Input type="number" inputMode="numeric" min={1} autoComplete="off"
                          value={item.qty} onChange={(e) => updateLineQty(item.localId, Math.max(1, Number(e.target.value)))}
                          className="text-base h-8 w-16 text-right" />
                      </td>
                      {isAdmin ? (
                        <td className="px-3 py-2.5 text-right text-(--color-muted)">${item.unitCost.toFixed(2)}</td>
                      ) : null}
                      <td className="px-3 py-2.5 text-right text-(--color-muted)">
                        {item.isCustom && item.unitPrice === 0 ? "TBD" : `$${item.unitPrice.toFixed(2)}`}
                      </td>
                      <td className="px-3 py-2.5 text-right font-medium text-(--color-foreground)">
                        {item.isCustom && item.unitPrice === 0 ? "TBD" : `$${(item.qty * item.unitPrice).toFixed(2)}`}
                      </td>
                      {isAdmin ? (
                        <td className="px-3 py-2.5 text-right text-(--color-success)">
                          ${((item.qty * item.unitPrice) - (item.qty * item.unitCost)).toFixed(2)}
                        </td>
                      ) : null}
                      <td className="px-3 py-2">
                        <Button type="button" variant="ghost" size="sm" className="h-8 w-8 p-0 text-(--color-danger)"
                          onClick={() => setLineItems((prev) => prev.filter((li) => li.localId !== item.localId))}>
                          <Trash2 size={14} />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="border border-dashed border-(--color-border) rounded-lg py-8 text-center text-sm text-(--color-muted)">
              No items added yet — click &ldquo;Add Item&rdquo; to get started.
            </div>
          )}
        </div>

        {/* Setup Costs (admin/employee only) */}
        {isStaff ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-(--color-foreground)">Setup Costs</h2>
              <Button type="button" variant="outline" size="sm" onClick={() => setShowAddSetup(true)} className="gap-1">
                <Plus size={14} /> Add Setup Cost
              </Button>
            </div>
            {setupCosts.length > 0 ? (
              <div className="w-full overflow-x-auto border border-(--color-border) rounded-lg">
                <table className={`w-full text-sm ${isAdmin ? "min-w-120" : "min-w-100"}`}>
                  <thead>
                    <tr className="border-b border-(--color-border) bg-(--color-surface)">
                      <th className="text-left px-3 py-2.5 font-medium text-(--color-muted)">Name</th>
                      <th className="text-right px-3 py-2.5 font-medium text-(--color-muted) w-16">Qty</th>
                      <th className="text-right px-3 py-2.5 font-medium text-(--color-muted) w-24">Rate</th>
                      {isAdmin ? <th className="text-right px-3 py-2.5 font-medium text-(--color-muted) w-24">Cost</th> : null}
                      <th className="text-right px-3 py-2.5 font-medium text-(--color-muted) w-24">Subtotal</th>
                      <th className="w-8" />
                    </tr>
                  </thead>
                  <tbody>
                    {setupCosts.map((sc) => (
                      <tr key={sc.localId} className="border-b border-(--color-border) last:border-0">
                        <td className="px-3 py-2.5 text-(--color-foreground)">{sc.label}</td>
                        <td className="px-3 py-2.5 text-right">{sc.qty}</td>
                        <td className="px-3 py-2.5 text-right">${sc.rate.toFixed(2)}</td>
                        {isAdmin ? <td className="px-3 py-2.5 text-right text-(--color-muted)">${sc.cost.toFixed(2)}</td> : null}
                        <td className="px-3 py-2.5 text-right font-medium">${(sc.rate * sc.qty).toFixed(2)}</td>
                        <td className="px-3 py-2">
                          <Button type="button" variant="ghost" size="sm" className="h-8 w-8 p-0 text-(--color-danger)"
                            onClick={() => setSetupCosts((prev) => prev.filter((c) => c.localId !== sc.localId))}>
                            <Trash2 size={14} />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-sm text-(--color-muted)">No setup costs added.</p>
            )}
          </div>
        ) : null}

        {/* Order Totals */}
        {lineItems.length > 0 ? (
          <div className="space-y-3">
            <h2 className="text-base font-semibold text-(--color-foreground)">Order Totals</h2>
            <div className="w-full overflow-x-auto border border-(--color-border) rounded-lg sm:max-w-xs">
              <table className="w-full text-sm min-w-70">
                <thead>
                  <tr className="border-b border-(--color-border) bg-(--color-surface)">
                    <th className="text-left px-3 py-2.5 font-medium text-(--color-muted)">Description</th>
                    <th className="text-right px-3 py-2.5 font-medium text-(--color-muted)">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-(--color-border)">
                    <td className="px-3 py-2.5 text-(--color-foreground)">Sub Total</td>
                    <td className="px-3 py-2.5 text-right font-medium">
                      {hasCustomTbd ? <span className="text-(--color-muted)">${totals.subTotal.toFixed(2)} + TBD</span> : `$${totals.subTotal.toFixed(2)}`}
                    </td>
                  </tr>
                  {taxRate > 0 ? (
                    <tr className="border-b border-(--color-border)">
                      <td className="px-3 py-2.5 text-(--color-foreground)">
                        Sales Tax <span className="text-xs text-(--color-muted) ml-1">({(taxRate * 100).toFixed(2)}%)</span>
                      </td>
                      <td className="px-3 py-2.5 text-right font-medium">
                        {hasCustomTbd ? <span className="text-(--color-muted)">TBD</span> : `$${totals.salesTax.toFixed(2)}`}
                      </td>
                    </tr>
                  ) : null}
                  <tr className={isAdmin ? "border-b border-(--color-border)" : ""}>
                    <td className="px-3 py-2.5 font-semibold text-(--color-foreground)">
                      {hasCustomTbd ? "Est. Total" : "Total"}
                    </td>
                    <td className="px-3 py-2.5 text-right font-bold text-base">
                      {hasCustomTbd ? <span className="text-(--color-muted)">TBD</span> : `$${totals.totalPrice.toFixed(2)}`}
                    </td>
                  </tr>
                  {isAdmin ? (
                    <tr>
                      <td className="px-3 py-2.5 text-(--color-success)">Profit</td>
                      <td className="px-3 py-2.5 text-right font-semibold text-(--color-success)">${totals.profit.toFixed(2)}</td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
            {hasCustomTbd && !isAdmin ? (
              <p className="text-xs text-(--color-muted)">* Custom items are priced by our team after review.</p>
            ) : null}
          </div>
        ) : null}

        {/* Job Details — small, at the bottom */}
        <div className="space-y-3">
          <h2 className="text-base font-semibold text-(--color-foreground)">Job Details</h2>
          <div className="border border-(--color-border) rounded-lg p-4 space-y-4 bg-(--color-background)">
            <div className="space-y-1.5">
              <Label htmlFor="customerNotes">What do you need? *</Label>
              <Textarea id="customerNotes" value={customerNotes} onChange={(e) => setCustomerNotes(e.target.value)}
                rows={3} placeholder="Describe your project — quantities, colors, style, any special requirements…" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="dueDate">Due Date (optional)</Label>
                <Input id="dueDate" type="date" autoComplete="off" value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)} className="text-base" />
              </div>
              <div className="flex items-end pb-1 gap-2">
                <input type="checkbox" id="isHardDeadline" checked={isHardDeadline}
                  onChange={(e) => setIsHardDeadline(e.target.checked)} className="h-4 w-4 mt-0.5" />
                <Label htmlFor="isHardDeadline" className="cursor-pointer">Hard deadline</Label>
              </div>
            </div>
          </div>
        </div>

        {/* Admin Settings */}
        {isAdmin ? (
          <div className="space-y-3">
            <h2 className="text-base font-semibold text-(--color-foreground)">Admin Settings</h2>
            <div className="border border-(--color-border) rounded-lg p-4 space-y-4 bg-(--color-background)">
              <div className="space-y-1.5">
                <Label>Assign to User</Label>
                <div className="relative">
                  <Input
                    value={userSearchOpen ? userQuery : (selectedUser ? `${selectedUser.firstName} ${selectedUser.lastName} (${selectedUser.email})` : "No Account Yet")}
                    onChange={(e) => { setUserQuery(e.target.value); setUserSearchOpen(true) }}
                    onFocus={() => setUserSearchOpen(true)}
                    onBlur={() => setTimeout(() => setUserSearchOpen(false), 150)}
                    className="text-base"
                    placeholder="Search by name or email…"
                  />
                  {userSearchOpen ? (
                    <div className="absolute z-20 top-full left-0 right-0 mt-1 border border-(--color-border) rounded-md bg-(--color-background) shadow-md max-h-52 overflow-y-auto">
                      <button type="button" className="w-full text-left px-3 py-2 text-sm hover:bg-(--color-surface) text-(--color-muted)"
                        onMouseDown={() => { setAssignedUserId(null); setUserQuery(""); setUserSearchOpen(false) }}>
                        No Account Yet
                      </button>
                      {filteredUsers.map((u) => (
                        <button key={u.id} type="button" className="w-full text-left px-3 py-2 text-sm hover:bg-(--color-surface)"
                          onMouseDown={() => { setAssignedUserId(u.id); setUserQuery(""); setUserSearchOpen(false) }}>
                          <span className="font-medium">{u.firstName} {u.lastName}</span>
                          <span className="text-(--color-muted) ml-2 text-xs">{u.email}</span>
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Order Name / Nickname</Label>
                <Input value={orderNickname} onChange={(e) => setOrderNickname(e.target.value)}
                  className="text-base" placeholder="e.g. Spring Merch Drop" />
              </div>
            </div>
          </div>
        ) : null}

        <div className="pb-[max(1.5rem,env(safe-area-inset-bottom))]">
          <Button type="submit" disabled={isPending} className="w-full gap-2">
            {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {isPending ? "Submitting…" : "Submit Quote Request"}
          </Button>
        </div>
      </form>

      <GetQuoteAddItemDialog
        open={showAddItem}
        onOpenChange={setShowAddItem}
        presets={lineItemPresets}
        isAdmin={isAdmin}
        onAdd={handleAddItem}
      />

      {/* Add Setup Cost Dialog */}
      <Dialog open={showAddSetup} onOpenChange={(v) => { if (!v) { setSetupSelection(""); setSetupQty(1); setSetupRate(0); setSetupCostVal(0); setSetupLabel("") } setShowAddSetup(v) }}>
        <DialogContent className="bg-(--color-background)">
          <DialogHeader><DialogTitle>Add Setup Cost</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Preset</Label>
              <Select value={setupSelection} onValueChange={(v) => setSetupSelection(v ?? "")}>
                <SelectTrigger className="text-base"><SelectValue placeholder="Select a preset…" /></SelectTrigger>
                <SelectContent className="bg-(--color-background)">
                  {setupFeePresets.map((p) => (
                    <SelectItem key={p.id} value={String(p.id)}>
                      <div>
                        <p className="font-medium">{p.name}</p>
                        {p.description ? <p className="text-xs text-(--color-muted)">{p.description}</p> : null}
                      </div>
                    </SelectItem>
                  ))}
                  <SelectItem value="custom">Custom</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {setupSelection === "custom" ? (
              <div className="space-y-1.5">
                <Label>Name</Label>
                <Input value={setupLabel} onChange={(e) => setSetupLabel(e.target.value)} className="text-base" placeholder="e.g. Rush Fee" />
              </div>
            ) : null}
            {setupSelection ? (
              <>
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1.5">
                    <Label>Qty</Label>
                    <Input type="number" inputMode="numeric" min={1} value={setupQty}
                      onChange={(e) => setSetupQty(Math.max(1, Number(e.target.value)))} className="text-base" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Rate</Label>
                    <Input type="number" inputMode="decimal" step="0.01" value={setupRate}
                      onChange={(e) => setSetupRate(Number(e.target.value))} className="text-base" />
                  </div>
                  {isAdmin ? (
                    <div className="space-y-1.5">
                      <Label>Cost</Label>
                      <Input type="number" inputMode="decimal" step="0.01" value={setupCost}
                        onChange={(e) => setSetupCostVal(Number(e.target.value))} className="text-base" />
                    </div>
                  ) : null}
                </div>
              </>
            ) : null}
          </div>
          <DialogFooter className="pb-[max(1rem,env(safe-area-inset-bottom))]">
            <Button variant="outline" onClick={() => setShowAddSetup(false)}>Cancel</Button>
            <Button autoFocus onClick={handleAddSetupCost} disabled={!setupSelection}>Add</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
