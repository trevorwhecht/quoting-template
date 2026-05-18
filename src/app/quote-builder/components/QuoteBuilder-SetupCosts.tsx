"use client"

import { useEffect, useState } from "react"
import { Trash2, ChevronDown } from "lucide-react"
import { Button, buttonVariants } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { newLocalId } from "../quoteBuilderUtils"
import SectionShell from "@/components/shared/layout/SectionShell"
import type { SetupFeePreset } from "@/models/preset"
import type { DraftSetupCost } from "../QuoteBuilder"
import type { QuoteBuilderPermissions } from "../quoteBuilderPermissions"

type Props = {
  costs: DraftSetupCost[]
  onChange: (costs: DraftSetupCost[]) => void
  permissions: QuoteBuilderPermissions
}

export default function QuoteBuilderSetupCosts({ costs, onChange, permissions }: Props) {
  const [presets, setPresets] = useState<SetupFeePreset[]>([])
  const canEdit = permissions.canEditSetupCosts

  useEffect(() => {
    fetch("/api/setup-fee-presets")
      .then((r) => r.json())
      .then(({ data }) => { if (data) setPresets(data) })
  }, [])

  function updateCost(localId: string, field: keyof DraftSetupCost, value: string | number | null) {
    onChange(costs.map((c) => c.localId === localId ? { ...c, [field]: value } : c))
  }

  function removeCost(localId: string) {
    onChange(costs.filter((c) => c.localId !== localId))
  }

  function addFromPreset(preset: SetupFeePreset) {
    onChange([...costs, {
      localId: newLocalId(),
      label: preset.name,
      description: preset.description ?? null,
      qty: 1,
      rate: preset.defaultRate,
      cost: preset.defaultCost,
    }])
  }

  function addBlankRow() {
    onChange([...costs, { localId: newLocalId(), label: "", description: null, qty: 1, rate: 0, cost: 0 }])
  }

  // Hide entire section for non-editors when there is nothing to show
  if (costs.length === 0 && !canEdit) return null

  // colspan: Name + Description + Qty + Rate + [Cost] + Subtotal + [Delete]
  const colSpan = canEdit ? 7 : 5

  return (
    <SectionShell
      title="Setup Costs"
      action={canEdit ? (
        <DropdownMenu>
          <DropdownMenuTrigger className={buttonVariants({ variant: "outline", size: "sm" }) + " gap-1"}>
            Add <ChevronDown size={14} />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56 bg-(--color-background)">
            {presets.map((p) => (
              <DropdownMenuItem key={p.id} onClick={() => addFromPreset(p)}>
                <div>
                  <p className="font-medium">{p.name}</p>
                  {p.description ? <p className="text-xs text-(--color-muted)">{p.description}</p> : null}
                </div>
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={addBlankRow}>+ Add Custom</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ) : null}
    >

      <div className="w-full overflow-x-auto border border-(--color-border) rounded-lg">
        <table className={`w-full text-sm ${canEdit ? "min-w-160" : "min-w-120"}`}>
          <thead>
            <tr className="border-b border-(--color-border) bg-(--color-surface)">
              <th className="text-left px-3 py-2.5 font-medium text-(--color-muted)">Name</th>
              <th className="text-left px-3 py-2.5 font-medium text-(--color-muted)">Description</th>
              <th className="text-right px-3 py-2.5 font-medium text-(--color-muted) w-16">Qty</th>
              <th className="text-right px-3 py-2.5 font-medium text-(--color-muted) w-24">Rate</th>
              {canEdit ? <th className="text-right px-3 py-2.5 font-medium text-(--color-muted) w-24">Cost</th> : null}
              <th className="text-right px-3 py-2.5 font-medium text-(--color-muted) w-24">Subtotal</th>
              {canEdit ? <th className="w-8" /> : null}
            </tr>
          </thead>
          <tbody>
            {costs.length === 0 ? (
              <tr>
                <td colSpan={colSpan} className="px-3 py-6 text-center text-sm text-(--color-muted)">
                  No setup costs added.
                </td>
              </tr>
            ) : null}
            {costs.map((cost) => (
              <tr key={cost.localId} className="border-b border-(--color-border) last:border-0">
                <td className="px-3 py-2">
                  {canEdit ? (
                    <Input value={cost.label} onChange={(e) => updateCost(cost.localId, "label", e.target.value)}
                      className="text-base h-8" placeholder="Name" />
                  ) : (
                    <span className="text-(--color-foreground)">{cost.label}</span>
                  )}
                </td>
                <td className="px-3 py-2">
                  {canEdit ? (
                    <Input value={cost.description ?? ""} onChange={(e) => updateCost(cost.localId, "description", e.target.value || null)}
                      className="text-base h-8" placeholder="e.g. Per Color/Design" />
                  ) : (
                    <span className="text-(--color-muted)">{cost.description ?? "—"}</span>
                  )}
                </td>
                <td className="px-3 py-2 text-right">
                  {canEdit ? (
                    <Input type="number" inputMode="numeric" min={1} value={cost.qty}
                      onChange={(e) => updateCost(cost.localId, "qty", Math.max(1, Number(e.target.value)))}
                      className="text-base h-8 w-16 text-right" />
                  ) : (
                    <span>{cost.qty}</span>
                  )}
                </td>
                <td className="px-3 py-2 text-right">
                  {canEdit ? (
                    <Input type="number" inputMode="decimal" step="0.01" value={cost.rate}
                      onChange={(e) => updateCost(cost.localId, "rate", Number(e.target.value))}
                      className="text-base h-8 w-24 text-right" />
                  ) : (
                    <span className="text-(--color-muted)">${cost.rate.toFixed(2)}</span>
                  )}
                </td>
                {canEdit ? (
                  <td className="px-3 py-2 text-right">
                    <Input type="number" inputMode="decimal" step="0.01" value={cost.cost}
                      onChange={(e) => updateCost(cost.localId, "cost", Number(e.target.value))}
                      className="text-base h-8 w-24 text-right" />
                  </td>
                ) : null}
                <td className="px-3 py-2 text-right font-medium text-(--color-foreground)">
                  ${(cost.rate * cost.qty).toFixed(2)}
                </td>
                {canEdit ? (
                  <td className="px-3 py-2">
                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-(--color-danger)"
                      onClick={() => removeCost(cost.localId)} aria-label="Remove">
                      <Trash2 size={14} />
                    </Button>
                  </td>
                ) : null}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </SectionShell>
  )
}
