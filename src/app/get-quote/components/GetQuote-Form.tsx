"use client"

import { useState, useTransition, useEffect } from "react"
import { useRouter } from "next/navigation"
import dynamic from "next/dynamic"
import { useSession } from "next-auth/react"
const ClaimModal = dynamic(() => import("@/components/shared/modals/ClaimModal"))
import { Loader2, Trash2, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { toast } from "sonner"
import { computeOrderTotals } from "@/services/orderService"
import { Switch } from "@/components/ui/switch"
import SectionShell from "@/components/shared/layout/SectionShell"
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
  const { data: session } = useSession()
  const [showClaimModal, setShowClaimModal] = useState(false)
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

  const [needsShipping, setNeedsShipping] = useState(false)
  const [taxDeferralRequested, setTaxDeferralRequested] = useState(false)
  const [showNotes, setShowNotes] = useState(false)

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

  function updateLineField(localId: string, field: keyof FormLineItem, value: number) {
    setLineItems((prev) => prev.map((li) => li.localId === localId ? { ...li, [field]: value } : li))
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

  async function doSubmit() {
    const res = await fetch("/api/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        customerNotes: customerNotes || null,
        dueDate: dueDate || null,
        isHardDeadline,
        needsShipping,
        taxDeferralRequested,
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
  }

  function handleSubmit(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault()
    if (lineItems.length === 0) { toast.error("Please add at least one item."); return }
    if (isAdmin && lineItems.some((li) => li.isCustom && li.unitPrice <= 0)) {
      toast.error("Please enter a price for all custom items before saving.")
      return
    }

    if (!session) {
      setShowClaimModal(true)
      return
    }

    startTransition(doSubmit)
  }

  return (
    <div className="px-4 md:px-6 py-8 space-y-6">
      <h1 className="text-2xl font-bold text-(--color-foreground)">Build Your Quote</h1>

      <form onSubmit={handleSubmit} className="space-y-6">

        {/* Order Items */}
        <SectionShell
          title="Order Items"
          action={
            <Button type="button" variant="outline" size="sm" onClick={() => setShowAddItem(true)} className="gap-1">
              <Plus size={14} /> Add Item
            </Button>
          }
        >
          <div className="w-full overflow-x-auto border border-(--color-border) rounded-lg">
            <table className={`w-full text-sm ${isAdmin ? "min-w-180" : "min-w-100"}`}>
              <thead>
                <tr className="border-b border-(--color-border) bg-(--color-surface)">
                  <th className="text-left px-3 py-2.5 font-medium text-(--color-muted)">Item</th>
                  <th className="text-right px-3 py-2.5 font-medium text-(--color-muted) w-16 whitespace-nowrap">Qty</th>
                  {isAdmin ? <th className="text-right px-3 py-2.5 font-medium text-(--color-muted) w-24 whitespace-nowrap">Cost</th> : null}
                  <th className="text-right px-3 py-2.5 font-medium text-(--color-muted) w-24 whitespace-nowrap">Rate</th>
                  <th className="text-right px-3 py-2.5 font-medium text-(--color-muted) w-24 whitespace-nowrap">Amount</th>
                  {isAdmin ? <th className="text-right px-3 py-2.5 font-medium text-(--color-success) w-24 whitespace-nowrap">Profit</th> : null}
                  <th className="w-8" />
                </tr>
              </thead>
              <tbody>
                {lineItems.length === 0 ? (
                  <tr>
                    <td colSpan={isAdmin ? 7 : 5} className="px-3 py-6 text-center text-sm text-(--color-muted)">
                      No items added — click &ldquo;Add Item&rdquo; to get started.
                    </td>
                  </tr>
                ) : null}
                {lineItems.map((item) => (
                  <tr key={item.localId} className="border-b border-(--color-border) last:border-0">
                    <td className="px-3 py-2.5 text-(--color-foreground) font-medium">{item.description}</td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      <Input type="number" inputMode="numeric" min={1} autoComplete="off"
                        value={item.qty} onChange={(e) => updateLineField(item.localId, "qty", Math.max(1, Number(e.target.value)))}
                        className="text-base h-8 w-16 text-right" />
                    </td>
                    {isAdmin ? (
                      <td className="px-3 py-2 whitespace-nowrap">
                        <Input type="number" inputMode="decimal" step="0.01" min={0} autoComplete="off"
                          value={item.unitCost}
                          onChange={(e) => updateLineField(item.localId, "unitCost", Number(e.target.value))}
                          className="text-base h-8 w-24 text-right" />
                      </td>
                    ) : null}
                    <td className="px-3 py-2 whitespace-nowrap">
                      {isAdmin ? (
                        <Input type="number" inputMode="decimal" step="0.01" min={0} autoComplete="off"
                          value={item.unitPrice}
                          onChange={(e) => updateLineField(item.localId, "unitPrice", Number(e.target.value))}
                          className="text-base h-8 w-24 text-right" />
                      ) : (
                        <span className="text-(--color-muted) block text-right">
                          {item.isCustom && item.unitPrice === 0 ? "TBD" : `$${item.unitPrice.toFixed(2)}`}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-right font-medium text-(--color-foreground) whitespace-nowrap">
                      {item.isCustom && item.unitPrice === 0 ? "TBD" : `$${(item.qty * item.unitPrice).toFixed(2)}`}
                    </td>
                    {isAdmin ? (
                      <td className="px-3 py-2.5 text-right text-(--color-success) whitespace-nowrap">
                        ${((item.qty * item.unitPrice) - (item.qty * item.unitCost)).toFixed(2)}
                      </td>
                    ) : null}
                    <td className="px-3 py-2">
                      <Button type="button" variant="ghost" size="sm" className="h-8 w-8 p-0 text-(--color-danger)"
                        onClick={() => setLineItems((prev) => prev.filter((li) => li.localId !== item.localId))}
                        aria-label="Remove item">
                        <Trash2 size={14} />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SectionShell>

        {/* Setup Costs + Order Totals — 50/50, all roles, equal height */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          {/* Setup Costs */}
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-(--color-foreground)">Setup Costs</h2>
              {isStaff ? (
                <Button type="button" variant="outline" size="sm" onClick={() => setShowAddSetup(true)} className="gap-1">
                  <Plus size={14} /> Add Setup Cost
                </Button>
              ) : null}
            </div>
            <div className="flex-1 w-full overflow-x-auto border border-(--color-border) rounded-lg">
              <table className={`w-full text-sm ${isAdmin ? "min-w-120" : "min-w-80"}`}>
                <thead>
                  <tr className="border-b border-(--color-border) bg-(--color-surface)">
                    <th className="text-left px-3 py-2.5 font-medium text-(--color-muted)">Name</th>
                    <th className="text-right px-3 py-2.5 font-medium text-(--color-muted) w-16 whitespace-nowrap">Qty</th>
                    <th className="text-right px-3 py-2.5 font-medium text-(--color-muted) w-24 whitespace-nowrap">Rate</th>
                    {isAdmin ? <th className="text-right px-3 py-2.5 font-medium text-(--color-muted) w-24 whitespace-nowrap">Cost</th> : null}
                    <th className="text-right px-3 py-2.5 font-medium text-(--color-muted) w-24 whitespace-nowrap">Subtotal</th>
                    {isStaff ? <th className="w-8" /> : null}
                  </tr>
                </thead>
                <tbody>
                  {setupCosts.length === 0 ? (
                    <tr>
                      <td colSpan={isAdmin ? 6 : isStaff ? 5 : 4} className="px-3 py-6 text-center text-sm text-(--color-muted)">
                        No setup costs added.
                      </td>
                    </tr>
                  ) : null}
                  {setupCosts.map((sc) => (
                    <tr key={sc.localId} className="border-b border-(--color-border) last:border-0">
                      <td className="px-3 py-2.5 text-(--color-foreground)">{sc.label}</td>
                      <td className="px-3 py-2.5 text-right whitespace-nowrap">{sc.qty}</td>
                      <td className="px-3 py-2.5 text-right whitespace-nowrap">${sc.rate.toFixed(2)}</td>
                      {isAdmin ? <td className="px-3 py-2.5 text-right whitespace-nowrap text-(--color-muted)">${sc.cost.toFixed(2)}</td> : null}
                      <td className="px-3 py-2.5 text-right font-medium whitespace-nowrap">${(sc.rate * sc.qty).toFixed(2)}</td>
                      {isStaff ? (
                        <td className="px-3 py-2">
                          <Button type="button" variant="ghost" size="sm" className="h-8 w-8 p-0 text-(--color-danger)"
                            onClick={() => setSetupCosts((prev) => prev.filter((c) => c.localId !== sc.localId))}
                            aria-label="Remove setup cost">
                            <Trash2 size={14} />
                          </Button>
                        </td>
                      ) : null}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Order Totals */}
          <div className="flex flex-col gap-3">
            <h2 className="text-base font-semibold text-(--color-foreground)">Order Totals</h2>
            <div className="flex-1 w-full overflow-x-auto border border-(--color-border) rounded-lg">
              <table className="w-full text-sm min-w-60">
                <thead>
                  <tr className="border-b border-(--color-border) bg-(--color-surface)">
                    <th className="text-left px-3 py-2.5 font-medium text-(--color-muted)">Description</th>
                    <th className="text-right px-3 py-2.5 font-medium text-(--color-muted)">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {lineItems.length === 0 ? (
                    <tr>
                      <td colSpan={2} className="px-3 py-6 text-center text-sm text-(--color-muted)">
                        No items added yet.
                      </td>
                    </tr>
                  ) : (
                    <>
                      <tr className="border-b border-(--color-border)">
                        <td className="px-3 py-2.5 text-(--color-foreground)">Sub Total</td>
                        <td className="px-3 py-2.5 text-right font-medium whitespace-nowrap">
                          {hasCustomTbd ? <span className="text-(--color-muted)">${totals.subTotal.toFixed(2)} + TBD</span> : `$${totals.subTotal.toFixed(2)}`}
                        </td>
                      </tr>
                      {taxRate > 0 ? (
                        <tr className="border-b border-(--color-border)">
                          <td className="px-3 py-2.5 text-(--color-foreground)">
                            Sales Tax <span className="text-xs text-(--color-muted) ml-1">({(taxRate * 100).toFixed(2)}%)</span>
                          </td>
                          <td className="px-3 py-2.5 text-right font-medium whitespace-nowrap">
                            {hasCustomTbd ? <span className="text-(--color-muted)">TBD</span> : `$${totals.salesTax.toFixed(2)}`}
                          </td>
                        </tr>
                      ) : null}
                      <tr className={isAdmin ? "border-b border-(--color-border)" : ""}>
                        <td className="px-3 py-2.5 font-semibold text-(--color-foreground)">
                          {hasCustomTbd ? "Est. Total" : "Total"}
                        </td>
                        <td className="px-3 py-2.5 text-right font-bold text-base whitespace-nowrap">
                          {hasCustomTbd ? <span className="text-(--color-muted)">TBD</span> : `$${totals.totalPrice.toFixed(2)}`}
                        </td>
                      </tr>
                      {isAdmin ? (
                        <tr>
                          <td className="px-3 py-2.5 text-(--color-success)">Profit</td>
                          <td className="px-3 py-2.5 text-right font-semibold text-(--color-success) whitespace-nowrap">${totals.profit.toFixed(2)}</td>
                        </tr>
                      ) : null}
                    </>
                  )}
                </tbody>
              </table>
            </div>
            {hasCustomTbd && !isAdmin && lineItems.length > 0 ? (
              <p className="text-xs text-(--color-muted)">* Custom items are priced by our team after review.</p>
            ) : null}
          </div>
        </div>

        {/* Bottom: card + submit stacked, button matches card width */}
        <div className="flex flex-col gap-3 w-fit max-w-full pb-[max(1.5rem,env(safe-area-inset-bottom))]">
        <div className="w-full flex gap-8 flex-wrap items-start border border-(--color-border) rounded-lg p-4 bg-(--color-background)">

          {/* Left: toggles with conditional reveals */}
          <div className="flex flex-col gap-3 shrink-0">
            {/* Hard Deadline → Due Date reveals below */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Switch checked={isHardDeadline} onCheckedChange={(c) => { setIsHardDeadline(c); if (!c) setDueDate("") }} id="isHardDeadline" />
                <Label htmlFor="isHardDeadline" className="cursor-pointer text-sm">Hard Deadline</Label>
              </div>
              {isHardDeadline ? (
                <div className="pl-10">
                  <Input id="dueDate" type="date" autoComplete="off" value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)} className="text-base w-38" />
                </div>
              ) : null}
            </div>

            {/* Needs Shipping → reveal removed until multi-address spec */}
            <div className="flex items-center gap-2">
              <Switch checked={needsShipping} onCheckedChange={(c) => setNeedsShipping(c)} id="needsShipping" />
              <Label htmlFor="needsShipping" className="cursor-pointer text-sm">Needs Shipping</Label>
            </div>

            {/* Tax Deferral */}
            <div className="flex items-center gap-2">
              <Switch checked={taxDeferralRequested} onCheckedChange={(c) => setTaxDeferralRequested(c)} id="taxDeferralRequested" />
              <Label htmlFor="taxDeferralRequested" className="cursor-pointer text-sm">Tax Deferral Requested</Label>
            </div>
          </div>

          {/* Right: Nickname, [Assign to admin], Notes */}
          <div className="flex flex-col gap-3 flex-1 sm:min-w-44 sm:flex-none">
            <div className="space-y-1">
              <Label htmlFor="orderNickname" className="text-xs font-medium text-(--color-muted)">Nickname</Label>
              <Input id="orderNickname" value={orderNickname} onChange={(e) => setOrderNickname(e.target.value)}
                className="text-base" placeholder="Reference Name" />
            </div>

            {isAdmin ? (
              <div className="space-y-1 relative">
                <Label className="text-xs font-medium text-(--color-muted)">Assign to</Label>
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
            ) : null}

            {/* Notes — optional, expandable */}
            <div>
              {showNotes ? (
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="customerNotes" className="text-xs font-medium text-(--color-muted)">Notes</Label>
                    <button type="button" onClick={() => { setShowNotes(false); setCustomerNotes("") }}
                      className="text-xs text-(--color-muted) hover:text-(--color-foreground) transition-colors motion-reduce:transition-none">
                      Remove
                    </button>
                  </div>
                  <Textarea id="customerNotes" value={customerNotes} onChange={(e) => setCustomerNotes(e.target.value)}
                    rows={2} placeholder="Any additional notes…" className="resize-none" />
                </div>
              ) : (
                <button type="button" onClick={() => setShowNotes(true)}
                  className="text-sm text-(--color-muted) hover:text-(--color-foreground) transition-colors motion-reduce:transition-none">
                  + Add notes
                </button>
              )}
            </div>
          </div>
        </div>

          <Button type="submit" disabled={isPending} className="gap-2 w-full">
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

      <ClaimModal
        open={showClaimModal}
        onOpenChange={setShowClaimModal}
        redirectPath="/get-quote"
        onSuccess={() => startTransition(doSubmit)}
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
