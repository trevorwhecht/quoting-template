"use client"

import { useState, useEffect, useTransition } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"
import { ChevronUp, ChevronDown, Lock, Plus } from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"
import type { OrderStateModel } from "@/models/orderState"

type Props = {
  orderStates: OrderStateModel[]
  onStateUpdated: (state: OrderStateModel) => void
  onStatesRefetch: () => void
}

export default function DashboardSettingsView({ orderStates, onStateUpdated, onStatesRefetch }: Props) {
  const [isPending, startTransition] = useTransition()
  const [taxRate, setTaxRate] = useState("")
  const [businessName, setBusinessName] = useState("")
  const [loadingSettings, setLoadingSettings] = useState(true)
  const [newStateName, setNewStateName] = useState("")
  const [newStateColor, setNewStateColor] = useState("#6b7280")

  useEffect(() => {
    fetch("/api/settings").then((r) => r.json()).then((json) => {
      setLoadingSettings(false)
      if (!json.data) return
      const tax = json.data.find((s: any) => s.setting === "taxRate")
      const biz = json.data.find((s: any) => s.setting === "businessName")
      if (tax) setTaxRate(tax.value)
      if (biz) setBusinessName(biz.value)
    })
  }, [])

  async function toggleActive(state: OrderStateModel) {
    if (state.isRequired) return
    startTransition(async () => {
      const res = await fetch(`/api/order-states/${state.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !state.isActive }),
      })
      const json = await res.json()
      if (json.error) { toast.error(json.error); return }
      onStateUpdated(json.data)
      toast.success(state.isActive ? "State deactivated" : "State activated")
    })
  }

  async function moveState(state: OrderStateModel, direction: "up" | "down") {
    const sorted = [...orderStates].sort((a, b) => a.sortOrder - b.sortOrder)
    const idx = sorted.findIndex((s) => s.id === state.id)
    const swapIdx = direction === "up" ? idx - 1 : idx + 1
    if (swapIdx < 0 || swapIdx >= sorted.length) return

    const swapState = sorted[swapIdx]
    startTransition(async () => {
      await Promise.all([
        fetch(`/api/order-states/${state.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sortOrder: swapState.sortOrder }) }),
        fetch(`/api/order-states/${swapState.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sortOrder: state.sortOrder }) }),
      ])
      onStatesRefetch()
    })
  }

  async function addState() {
    if (!newStateName.trim()) { toast.error("Name is required"); return }
    startTransition(async () => {
      const res = await fetch("/api/order-states", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newStateName.trim(), color: newStateColor }),
      })
      const json = await res.json()
      if (json.error) { toast.error(json.error); return }
      setNewStateName("")
      onStatesRefetch()
      toast.success("State added")
    })
  }

  async function saveBusinessSettings() {
    startTransition(async () => {
      const updates: { setting: string; value: string }[] = []
      if (taxRate) updates.push({ setting: "taxRate", value: taxRate })
      if (businessName) updates.push({ setting: "businessName", value: businessName })

      await Promise.all(
        updates.map((u) =>
          fetch("/api/settings", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(u),
          })
        )
      )
      toast.success("Settings saved")
    })
  }

  const sortedStates = [...orderStates].sort((a, b) => a.sortOrder - b.sortOrder)

  return (
    <div className="p-6 max-w-2xl space-y-8">
      <h2 className="text-xl font-semibold text-(--color-foreground)">Settings</h2>

      {/* Order States */}
      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-(--color-muted) uppercase tracking-wider">Order States</h3>
        <div className="rounded-lg border border-(--color-border) divide-y divide-(--color-border)">
          {sortedStates.map((state) => (
            <div key={state.id} className="flex items-center justify-between px-4 py-3">
              <div className="flex items-center gap-3">
                <div
                  className="w-3 h-3 rounded-full shrink-0"
                  style={{ backgroundColor: state.color ?? "var(--color-border)" }}
                />
                <span className="text-sm font-medium text-(--color-foreground)">{state.name}</span>
                {state.isRequired ? (
                  <Lock size={12} className="text-(--color-muted)" />
                ) : null}
                {!state.isActive ? (
                  <Badge variant="outline" className="text-xs">Inactive</Badge>
                ) : null}
              </div>
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => moveState(state, "up")} disabled={isPending} aria-label="Move state up">
                  <ChevronUp size={14} />
                </Button>
                <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => moveState(state, "down")} disabled={isPending} aria-label="Move state down">
                  <ChevronDown size={14} />
                </Button>
                {!state.isRequired ? (
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs ml-1"
                    onClick={() => toggleActive(state)}
                    disabled={isPending}
                  >
                    {state.isActive ? "Deactivate" : "Activate"}
                  </Button>
                ) : null}
              </div>
            </div>
          ))}
        </div>

        {/* Add new state */}
        <div className="flex gap-2">
          <input
            type="color"
            value={newStateColor}
            onChange={(e) => setNewStateColor(e.target.value)}
            className="h-9 w-9 rounded-md border border-(--color-border) cursor-pointer p-0.5"
            title="Pick state color"
          />
          <Input
            value={newStateName}
            onChange={(e) => setNewStateName(e.target.value)}
            placeholder="New state name…"
            className="text-base"
            onKeyDown={(e) => { if (e.key === "Enter") addState() }}
          />
          <Button onClick={addState} disabled={isPending}>
            <Plus size={14} className="mr-1" /> Add
          </Button>
        </div>
      </div>

      <Separator />

      {/* Business settings */}
      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-(--color-muted) uppercase tracking-wider">Business Settings</h3>
        {loadingSettings ? (
          <Skeleton className="h-24 rounded-lg" />
        ) : null}
        <div className="space-y-3" style={{ display: loadingSettings ? "none" : undefined }}>
          <div className="space-y-1.5">
            <Label>Business Name</Label>
            <Input
              value={businessName}
              onChange={(e) => setBusinessName(e.target.value)}
              placeholder="My Business"
              className="text-base max-w-sm"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Tax Rate (decimal, e.g. 0.0775 for 7.75%)</Label>
            <Input
              type="number"
              inputMode="decimal"
              value={taxRate}
              onChange={(e) => setTaxRate(e.target.value)}
              placeholder="0.0775"
              step="0.001"
              className="text-base max-w-xs"
            />
          </div>
        </div>
        <Button onClick={saveBusinessSettings} disabled={isPending}>
          {isPending ? "Saving…" : "Save Settings"}
        </Button>
        <p className="text-xs text-(--color-muted)">Note: tax rate changes apply to new total calculations only — existing orders are not retroactively updated.</p>
      </div>
    </div>
  )
}
