"use client"

import { useEffect, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Loader2 } from "lucide-react"
import { computeOrderTotals } from "@/services/orderService"
import { getQuoteBuilderPermissions } from "./quoteBuilderPermissions"
import type { OrderDetail, SetupCostItem } from "@/models/order"
import QuoteBuilderBanner from "./components/QuoteBuilder-Banner"
import QuoteBuilderOrderItems from "./components/QuoteBuilder-OrderItems"
import QuoteBuilderSetupCosts from "./components/QuoteBuilder-SetupCosts"
import QuoteBuilderOrderTotals from "./components/QuoteBuilder-OrderTotals"
import QuoteBuilderUserSelect from "./components/QuoteBuilder-UserSelect"
import QuoteBuilderPriceChangeDialog from "./components/QuoteBuilder-PriceChangeDialog"
import { Button } from "@/components/ui/button"

export type DraftLineItem = {
  localId: string
  description: string
  qty: number
  unitPrice: number
  unitCost: number
}

export type DraftSetupCost = {
  localId: string
  label: string
  description: string | null
  qty: number
  rate: number
  cost: number
}

type Props = {
  orderId?: number
  token?: string
  role: string
  taxRate: number
  sessionUserId: string | null
}

function toDraftLineItem(li: OrderDetail["orderLineItems"][0]): DraftLineItem {
  return { localId: String(li.id), description: li.description, qty: li.qty, unitPrice: li.unitPrice, unitCost: li.unitCost }
}

function toDraftSetupCost(sc: OrderDetail["setUpCosts"][0]): DraftSetupCost {
  const items = sc.customSetupItems as SetupCostItem[] | null
  const item = items?.[0]
  return {
    localId: String(sc.id),
    label: item?.label ?? "",
    description: item?.description ?? null,
    qty: item?.qty ?? 1,
    rate: item?.rate ?? sc.userTotal,
    cost: item?.cost ?? sc.adminTotal,
  }
}

export default function QuoteBuilder({ orderId, token, role, taxRate, sessionUserId }: Props) {
  const router = useRouter()
  const [order, setOrder] = useState<OrderDetail | null>(null)
  const [loading, setLoading] = useState(!!(orderId || token))
  const [draftLineItems, setDraftLineItems] = useState<DraftLineItem[]>([])
  const [draftSetupCosts, setDraftSetupCosts] = useState<DraftSetupCost[]>([])
  const [draftNickname, setDraftNickname] = useState("")
  const [draftUserId, setDraftUserId] = useState<string | null>(null)
  const [draftDiscount, setDraftDiscount] = useState<number | null>(null)
  // Non-editable in quote builder but needed for accurate live totals
  const [fixedDiscounts, setFixedDiscounts] = useState<{
    discountReferral: number | null
    discountMistake: number | null
    rushFeeAmount: number | null
  }>({ discountReferral: null, discountMistake: null, rushFeeAmount: null })
  const [showPriceChangeDialog, setShowPriceChangeDialog] = useState(false)
  const [priceChangeDiff, setPriceChangeDiff] = useState<{ prev: number; next: number } | null>(null)
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    if (!orderId && !token) { setLoading(false); return }
    const url = orderId ? `/api/orders/${orderId}` : `/api/orders/by-token/${token}`
    fetch(url)
      .then((r) => r.json())
      .then(({ data, error }) => {
        if (error) { toast.error(error); return }
        setOrder(data)
        setDraftLineItems(data.orderLineItems.map(toDraftLineItem))
        setDraftSetupCosts(data.setUpCosts.map(toDraftSetupCost))
        setDraftNickname(data.nickname ?? "")
        setDraftUserId(data.user?.id ?? null)
        setDraftDiscount(data.discountManual)
        setFixedDiscounts({
          discountReferral: data.discountReferral,
          discountMistake: data.discountMistake,
          rushFeeAmount: data.rushFeeAmount,
        })
      })
      .finally(() => setLoading(false))
  }, [orderId, token])

  const permissions = getQuoteBuilderPermissions({
    role,
    stateId: order?.stateId ?? 1,
    orderUserId: order?.user?.id ?? null,
    sessionUserId,
  })

  const liveLineItems = draftLineItems.map((li) => ({ qty: li.qty, unitPrice: li.unitPrice, unitCost: li.unitCost }))
  const liveSetupCosts = draftSetupCosts.map((sc) => ({ userTotal: sc.rate * sc.qty, adminTotal: sc.cost * sc.qty }))
  const liveTotals = computeOrderTotals({
    lineItems: liveLineItems,
    setUpCosts: liveSetupCosts,
    taxRate,
    discountManual: draftDiscount,
    discountReferral: fixedDiscounts.discountReferral,
    discountMistake: fixedDiscounts.discountMistake,
    rushFeeAmount: fixedDiscounts.rushFeeAmount,
  })

  async function executeSave() {
    // CREATE mode — no existing order, admin building from scratch
    if (!order) {
      if (draftLineItems.length === 0) { toast.error("Add at least one line item before saving."); return }
      startTransition(async () => {
        const res = await fetch("/api/orders", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            nickname: draftNickname || null,
            userId: draftUserId,
            lineItems: draftLineItems.map(({ description, qty, unitPrice, unitCost }) => ({ description, qty, unitPrice, unitCost })),
          }),
        })
        const json = await res.json()
        if (json.error) { toast.error(json.error); return }
        toast.success("Order created")
        router.replace(`/quote-builder?orderId=${json.data.id}`)
      })
      return
    }

    // EDIT mode — patch existing order
    const body: Record<string, any> = {
      nickname: draftNickname || null,
      lineItems: draftLineItems.map(({ description, qty, unitPrice, unitCost }) => ({ description, qty, unitPrice, unitCost })),
      setUpCosts: draftSetupCosts.map(({ label, description, qty, rate, cost }) => ({ label, description, qty, rate, cost })),
    }
    if (role === "admin") {
      body.discountManual = draftDiscount
      body.userId = draftUserId
    }
    if (permissions.saveAction === "revert_state") {
      body.stateId = 1
    }

    startTransition(async () => {
      const res = await fetch(`/api/orders/${order.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      const json = await res.json()
      if (json.error) { toast.error(json.error); return }
      const updated: OrderDetail = json.data
      setOrder(updated)
      setDraftLineItems(updated.orderLineItems.map(toDraftLineItem))
      setDraftSetupCosts(updated.setUpCosts.map(toDraftSetupCost))
      setDraftNickname(updated.nickname ?? "")
      setDraftUserId(updated.user?.id ?? null)
      setDraftDiscount(updated.discountManual)
      setFixedDiscounts({
        discountReferral: updated.discountReferral,
        discountMistake: updated.discountMistake,
        rushFeeAmount: updated.rushFeeAmount,
      })
      toast.success("Saved")
      if (permissions.saveAction === "revert_state") toast.info("Sent back for review — admin will re-approve.")
    })
  }

  function handleSaveClick() {
    if (!order) return
    if (role === "admin" && liveTotals.totalPrice !== order.totalPrice) {
      setPriceChangeDiff({ prev: order.totalPrice, next: liveTotals.totalPrice })
      setShowPriceChangeDialog(true)
      return
    }
    executeSave()
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="animate-spin text-(--color-muted)" size={32} />
      </div>
    )
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
      <QuoteBuilderBanner order={order} role={role} />

      <QuoteBuilderOrderItems
        items={draftLineItems}
        onChange={setDraftLineItems}
        permissions={permissions}
      />

      <div className="grid grid-cols-1 sm:grid-cols-[1fr_320px] gap-6 items-start">
        <QuoteBuilderSetupCosts
          costs={draftSetupCosts}
          onChange={setDraftSetupCosts}
          permissions={permissions}
        />
        <QuoteBuilderOrderTotals
          totals={liveTotals}
          discount={draftDiscount}
          onDiscountChange={role === "admin" ? setDraftDiscount : undefined}
          role={role}
        />
      </div>

      {role === "admin" ? (
        <QuoteBuilderUserSelect
          selectedUserId={draftUserId}
          nickname={draftNickname}
          onUserChange={setDraftUserId}
          onNicknameChange={setDraftNickname}
        />
      ) : null}

      {permissions.saveAction !== "none" ? (
        <div className="pb-[max(1.5rem,env(safe-area-inset-bottom))]">
          {permissions.saveAction === "login" ? (
            <Button className="w-full" onClick={() => router.push("/login")}>
              Sign In to Save
            </Button>
          ) : (
            <Button className="w-full gap-2" onClick={handleSaveClick} disabled={isPending}>
              {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {isPending ? "Saving…" : permissions.saveAction === "revert_state" ? "Submit Changes" : "Save Changes"}
            </Button>
          )}
        </div>
      ) : null}

      <QuoteBuilderPriceChangeDialog
        open={showPriceChangeDialog}
        diff={priceChangeDiff}
        onCancel={() => setShowPriceChangeDialog(false)}
        onConfirm={() => { setShowPriceChangeDialog(false); executeSave() }}
      />
    </div>
  )
}
