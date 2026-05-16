"use client"

import { useState, useTransition } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { AlertCircle, Info, Loader2 } from "lucide-react"
import { toast } from "sonner"
import type { OrderSummary } from "@/models/order"

export type MovePayload = {
  stateId: number
  paymentPlan?: string
  /** Set when creating a new guest user */
  guestUser?: { firstName: string; lastName: string; email?: string; phone?: string }
  /** Set when the order already has a guest user — just advance state, no new user needed */
  existingGuestUserId?: string
}

type GuestInfo = { firstName: string; lastName: string; email: string; phone: string }

type Props = {
  order: OrderSummary
  fromStateId: number
  toStateId: number
  targetStateName: string
  open: boolean
  onConfirm: (payload: MovePayload) => Promise<void>
  onCancel: () => void
}

// Deposit % is encoded in paymentPlan as "deposit_50" (50%) or "deposit" (defaults to 50).
function parseDepositPercent(plan: string | null | undefined): number {
  if (!plan?.startsWith("deposit")) return 50
  const suffix = plan.split("_")[1]
  const parsed = suffix ? parseInt(suffix, 10) : NaN
  return isNaN(parsed) ? 50 : Math.min(100, Math.max(1, parsed))
}

function fmt(n: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n)
}

export default function DashboardKanbanMoveConfirmDialog({
  order,
  fromStateId,
  toStateId,
  targetStateName,
  open,
  onConfirm,
  onCancel,
}: Props) {
  const [isPending, startTransition] = useTransition()
  const [paymentPlan, setPaymentPlan] = useState("full_upfront")
  const [overridePlan, setOverridePlan] = useState<string | null>(null)
  const [depositPercent, setDepositPercent] = useState(
    parseDepositPercent(order.paymentPlan)
  )

  const isGuestUser = order.user?.role === "guest"
  const [guest, setGuest] = useState<GuestInfo>({
    firstName: isGuestUser ? order.user!.firstName : "",
    lastName: isGuestUser ? order.user!.lastName : "",
    email: isGuestUser ? order.user!.email : "",
    phone: "",
  })

  const showPaymentSelector = fromStateId === 1 && toStateId === 2
  const autoPayAtPickup = fromStateId === 1 && toStateId >= 3
  const showDepositInput = showPaymentSelector && paymentPlan === "deposit"
  // Show editable guest fields when: no user, or existing guest user (admin-inputted)
  const showGuestInfo = toStateId >= 3 && (!order.user || isGuestUser)
  const hasGuestData = !!(guest.firstName || guest.lastName || guest.email || guest.phone)

  const effectivePlan = overridePlan ?? (fromStateId === 1 ? (autoPayAtPickup ? "pay_at_pickup" : paymentPlan) : order.paymentPlan)

  // For 2→3+ warnings, resolve the deposit % and dollar amounts from the stored plan.
  const storedDepositPercent = parseDepositPercent(order.paymentPlan)
  const depositAmount = order.totalPrice * (storedDepositPercent / 100)

  const stripeWarningMessage =
    fromStateId >= 2 && toStateId >= 3
      ? effectivePlan?.startsWith("deposit")
        ? `Deposit of ${fmt(depositAmount)} not confirmed yet.`
        : effectivePlan === "full_upfront"
          ? `Full payment of ${fmt(order.totalPrice)} not confirmed yet.`
          : null
      : null

  function validate() {
    if (showPaymentSelector && !paymentPlan) {
      toast.error("Please select a payment plan")
      return false
    }
    if (showGuestInfo && hasGuestData && (!guest.firstName || !guest.lastName)) {
      toast.error("First and last name are required when entering guest info")
      return false
    }
    return true
  }

  function handleConfirm() {
    if (!validate()) return
    startTransition(async () => {
      const payload: MovePayload = { stateId: toStateId }
      if (overridePlan) {
        payload.paymentPlan = overridePlan
      } else if (fromStateId === 1) {
        if (autoPayAtPickup) {
          payload.paymentPlan = "pay_at_pickup"
        } else if (paymentPlan === "deposit") {
          payload.paymentPlan = `deposit_${depositPercent}`
        } else {
          payload.paymentPlan = paymentPlan
        }
      }
      if (showGuestInfo && hasGuestData) {
        if (isGuestUser && order.user) {
          payload.existingGuestUserId = order.user.id
        } else {
          payload.guestUser = {
            firstName: guest.firstName,
            lastName: guest.lastName,
            email: guest.email || undefined,
            phone: guest.phone || undefined,
          }
        }
      }
      await onConfirm(payload)
    })
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o && !isPending) onCancel() }}>
      <DialogContent className="sm:max-w-md bg-(--color-background)">
        <DialogHeader>
          <DialogTitle>
            {order.nickname ? `${order.nickname} · #${order.id}` : `Order #${order.id}`}
          </DialogTitle>
          <p className="text-xs text-(--color-muted)">State {fromStateId} → State {toStateId}</p>
        </DialogHeader>

        <div className="space-y-4 py-1">
          {/* Auto pay-at-pickup notice when skipping User Review */}
          {autoPayAtPickup ? (
            <div className="flex gap-2 rounded-md bg-(--color-surface) border border-(--color-border) p-3 text-sm">
              <Info size={16} className="text-(--color-muted) shrink-0 mt-0.5" />
              <span className="text-(--color-muted)">
                Skipping User Review — payment plan will be set to Pay at Pickup.
              </span>
            </div>
          ) : null}

          {/* Payment plan selector (1 → 2 only) */}
          {showPaymentSelector ? (
            <div className="space-y-1.5">
              <Label>Payment Plan</Label>
              <Select value={paymentPlan} onValueChange={(v) => v && setPaymentPlan(v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="full_upfront">Full Upfront</SelectItem>
                  <SelectItem value="deposit">Deposit</SelectItem>
                  <SelectItem value="pay_at_pickup">Pay at Pickup</SelectItem>
                </SelectContent>
              </Select>
            </div>
          ) : null}

          {/* Deposit % input (shown only when deposit plan is selected) */}
          {showDepositInput ? (
            <div className="space-y-1.5">
              <Label>Deposit Amount</Label>
              <div className="flex items-center gap-2">
                <div className="relative flex items-center w-24">
                  <Input
                    type="number"
                    min="1"
                    max="100"
                    value={depositPercent}
                    onChange={(e) => {
                      const v = parseInt(e.target.value, 10)
                      if (!isNaN(v)) setDepositPercent(Math.min(100, Math.max(1, v)))
                    }}
                    className="text-base pr-7"
                    inputMode="numeric"
                  />
                  <span className="absolute right-2.5 text-sm text-(--color-muted) pointer-events-none">%</span>
                </div>
                <span className="text-sm text-(--color-muted)">
                  = {fmt(order.totalPrice * (depositPercent / 100))}
                </span>
              </div>
              <p className="text-xs text-(--color-muted)">{fmt(order.totalPrice)} order total</p>
            </div>
          ) : null}

          {/* Unconfirmed payment warning */}
          {stripeWarningMessage ? (
            <div className="rounded-md bg-(--color-danger)/10 border border-(--color-danger)/20 p-3 text-sm space-y-2">
              <div className="flex gap-2">
                <AlertCircle size={16} className="text-(--color-danger) shrink-0 mt-0.5" />
                <span className="text-(--color-danger) font-medium">{stripeWarningMessage}</span>
              </div>
              <p className="text-(--color-danger)/70 text-xs pl-6">
                Only continue if you've received payment via Zelle or another method, or switch to Pay at Pickup.
              </p>
              <div className="pl-6">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs border-(--color-border) text-(--color-foreground) hover:bg-(--color-surface)"
                  onClick={() => setOverridePlan("pay_at_pickup")}
                >
                  Switch to Pay at Pickup
                </Button>
              </div>
            </div>
          ) : null}

          {/* Pay at pickup confirmation (shown after switching from warning) */}
          {overridePlan === "pay_at_pickup" ? (
            <div className="flex gap-2 rounded-md bg-(--color-surface) border border-(--color-border) p-3 text-sm">
              <Info size={16} className="text-(--color-muted) shrink-0 mt-0.5" />
              <span className="text-(--color-muted)">
                Payment method: <span className="font-medium text-(--color-foreground)">Pay at Pickup</span>
              </span>
            </div>
          ) : null}

          {/* Optional / pre-filled guest info fields */}
          {showGuestInfo ? (
            <div className="space-y-3 border-t border-(--color-border) pt-3">
              <p className="text-sm font-medium text-(--color-foreground)">
                Guest customer info{" "}
                <span className="text-(--color-muted) font-normal">(optional)</span>
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">
                    First Name{hasGuestData ? " *" : ""}
                  </Label>
                  <Input
                    value={guest.firstName}
                    onChange={(e) => setGuest((p) => ({ ...p, firstName: e.target.value }))}
                    placeholder="Jane"
                    className="text-base"
                    inputMode="text"
                    autoComplete="given-name"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">
                    Last Name{hasGuestData ? " *" : ""}
                  </Label>
                  <Input
                    value={guest.lastName}
                    onChange={(e) => setGuest((p) => ({ ...p, lastName: e.target.value }))}
                    placeholder="Doe"
                    className="text-base"
                    inputMode="text"
                    autoComplete="family-name"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Email</Label>
                <Input
                  value={guest.email}
                  onChange={(e) => setGuest((p) => ({ ...p, email: e.target.value }))}
                  type="email"
                  placeholder="jane@example.com"
                  className="text-base"
                  inputMode="email"
                  autoComplete="email"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Phone</Label>
                <Input
                  value={guest.phone}
                  onChange={(e) => setGuest((p) => ({ ...p, phone: e.target.value }))}
                  type="tel"
                  placeholder="(555) 000-0000"
                  className="text-base"
                  inputMode="tel"
                  autoComplete="tel"
                />
              </div>
            </div>
          ) : null}
        </div>

        <DialogFooter className="bg-(--color-surface) pb-[max(1rem,env(safe-area-inset-bottom))]">
          <Button variant="outline" onClick={onCancel} disabled={isPending}>
            Cancel
          </Button>
          <Button autoFocus onClick={handleConfirm} disabled={isPending} className="gap-2">
            {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {isPending ? "Moving…" : "Confirm"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
