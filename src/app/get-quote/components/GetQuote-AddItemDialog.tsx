"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { toast } from "sonner"
import type { LineItemPreset } from "@/models/preset"

export type AddItemResult = {
  presetId: number | null
  description: string
  qty: number
  unitPrice: number
  unitCost: number
  isCustom: boolean
}

type Props = {
  open: boolean
  onOpenChange: (v: boolean) => void
  presets: LineItemPreset[]
  isAdmin: boolean
  onAdd: (item: AddItemResult) => void
}

export default function GetQuoteAddItemDialog({ open, onOpenChange, presets, isAdmin, onAdd }: Props) {
  const [selection, setSelection] = useState("")
  const [qty, setQty] = useState(1)
  const [description, setDescription] = useState("")
  const [price, setPrice] = useState(0)
  const [cost, setCost] = useState(0)

  function reset() {
    setSelection("")
    setQty(1)
    setDescription("")
    setPrice(0)
    setCost(0)
  }

  function handleOpenChange(v: boolean) {
    if (!v) reset()
    onOpenChange(v)
  }

  function handleAdd() {
    if (!selection) return
    const isCustom = selection === "custom"
    const preset = presets.find((p) => String(p.id) === selection)

    if (isCustom && !description.trim()) {
      toast.error("Please enter a description.")
      return
    }
    if (isCustom && isAdmin && price <= 0) {
      toast.error("Please enter a price for this custom item.")
      return
    }

    onAdd({
      presetId: preset?.id ?? null,
      description: isCustom ? description : (preset?.name ?? ""),
      qty,
      unitPrice: isCustom ? price : Number(preset?.defaultPrice ?? 0),
      unitCost: isCustom ? cost : Number(preset?.defaultCost ?? 0),
      isCustom,
    })
    reset()
    onOpenChange(false)
  }

  const selectedPreset = presets.find((p) => String(p.id) === selection)

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="bg-(--color-background)">
        <DialogHeader>
          <DialogTitle>Add Item</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Item</Label>
            <Select value={selection} onValueChange={(v) => setSelection(v ?? "")}>
              <SelectTrigger className="text-base">
                <SelectValue placeholder="Select an item…" />
              </SelectTrigger>
              <SelectContent className="bg-(--color-background)">
                {presets.map((p) => (
                  <SelectItem key={p.id} value={String(p.id)}>
                    <div>
                      <p className="font-medium">{p.name}</p>
                      {p.description ? <p className="text-xs text-(--color-muted)">{p.description}</p> : null}
                    </div>
                  </SelectItem>
                ))}
                <SelectItem value="custom">Custom Item</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {selection === "custom" ? (
            <div className="space-y-1.5">
              <Label>Description</Label>
              <Input value={description} onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe this item" className="text-base" />
            </div>
          ) : null}

          {selection === "custom" && isAdmin ? (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Price *</Label>
                <Input type="number" inputMode="decimal" step="0.01" min={0} value={price}
                  onChange={(e) => setPrice(Number(e.target.value))} className="text-base" />
              </div>
              <div className="space-y-1.5">
                <Label>Cost</Label>
                <Input type="number" inputMode="decimal" step="0.01" min={0} value={cost}
                  onChange={(e) => setCost(Number(e.target.value))} className="text-base" />
              </div>
            </div>
          ) : null}

          {selection && selection !== "custom" && selectedPreset ? (
            <p className="text-sm text-(--color-muted)">
              Price: <span className="font-medium text-(--color-foreground)">${Number(selectedPreset.defaultPrice).toFixed(2)}</span> each
              {selectedPreset.description ? ` — ${selectedPreset.description}` : ""}
            </p>
          ) : null}

          {selection ? (
            <div className="space-y-1.5">
              <Label>Qty</Label>
              <Input type="number" inputMode="numeric" min={1} value={qty}
                onChange={(e) => setQty(Math.max(1, Number(e.target.value)))} className="text-base" />
            </div>
          ) : null}
        </div>
        <DialogFooter className="pb-[max(1rem,env(safe-area-inset-bottom))]">
          <Button variant="outline" onClick={() => handleOpenChange(false)}>Cancel</Button>
          <Button autoFocus onClick={handleAdd} disabled={!selection}>Add Item</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
