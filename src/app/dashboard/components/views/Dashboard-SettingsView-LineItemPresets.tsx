"use client"

import { useEffect, useState, useTransition } from "react"
import { Pencil, Trash2, Plus, Check, X, Eye, EyeOff } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog"
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"
import type { LineItemPreset } from "@/models/preset"

type DraftPreset = Omit<LineItemPreset, "id" | "isActive">

const EMPTY_DRAFT: DraftPreset = { name: "", description: null, defaultPrice: 0, defaultCost: 0, sortOrder: 0 }

export default function DashboardSettingsViewLineItemPresets() {
  const [presets, setPresets] = useState<LineItemPreset[]>([])
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editDraft, setEditDraft] = useState<DraftPreset>(EMPTY_DRAFT)
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [createDraft, setCreateDraft] = useState<DraftPreset>(EMPTY_DRAFT)
  const [deleteTarget, setDeleteTarget] = useState<LineItemPreset | null>(null)
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    fetch("/api/line-item-presets?all=1")
      .then((r) => r.json())
      .then(({ data }) => { if (data) setPresets(data) })
  }, [])

  function startEdit(preset: LineItemPreset) {
    setEditingId(preset.id)
    setEditDraft({
      name: preset.name,
      description: preset.description,
      defaultPrice: preset.defaultPrice,
      defaultCost: preset.defaultCost,
      sortOrder: preset.sortOrder,
    })
  }

  function saveEdit(id: number) {
    if (!editDraft.name.trim()) { toast.error("Name is required."); return }
    startTransition(async () => {
      const res = await fetch(`/api/line-item-presets/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...editDraft, description: editDraft.description || null }),
      })
      const json = await res.json()
      if (json.error) { toast.error(json.error); return }
      setPresets((prev) => prev.map((p) => p.id === id ? json.data : p))
      setEditingId(null)
      toast.success("Saved")
    })
  }

  function toggleActive(preset: LineItemPreset) {
    startTransition(async () => {
      const res = await fetch(`/api/line-item-presets/${preset.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !preset.isActive }),
      })
      const json = await res.json()
      if (json.error) { toast.error(json.error); return }
      setPresets((prev) => prev.map((p) => p.id === preset.id ? json.data : p))
    })
  }

  function handleCreate() {
    if (!createDraft.name.trim()) { toast.error("Name is required."); return }
    startTransition(async () => {
      const res = await fetch("/api/line-item-presets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...createDraft, description: createDraft.description || null }),
      })
      const json = await res.json()
      if (json.error) { toast.error(json.error); return }
      setPresets((prev) => [...prev, json.data])
      setCreateDraft(EMPTY_DRAFT)
      setShowCreateDialog(false)
      toast.success("Preset created")
    })
  }

  function handleDelete(preset: LineItemPreset) {
    startTransition(async () => {
      const res = await fetch(`/api/line-item-presets/${preset.id}`, { method: "DELETE" })
      const json = await res.json()
      if (json.error) { toast.error(json.error); return }
      setPresets((prev) => prev.filter((p) => p.id !== preset.id))
      setDeleteTarget(null)
      toast.success("Deleted")
    })
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold text-(--color-foreground)">Line Item Presets</h3>
          <p className="text-sm text-(--color-muted) mt-0.5">
            Presets that appear in the &ldquo;Add Item&rdquo; picker on orders.{" "}
            <span className="italic">Stub catalog — replace with your inventory system when ready.</span>
          </p>
        </div>
        <Button
          variant="outline" size="sm"
          onClick={() => { setCreateDraft(EMPTY_DRAFT); setShowCreateDialog(true) }}
          className="gap-1"
        >
          <Plus size={14} /> New Preset
        </Button>
      </div>

      <div className="w-full overflow-x-auto border border-(--color-border) rounded-lg">
        <table className="w-full text-sm min-w-160">
          <thead>
            <tr className="border-b border-(--color-border) bg-(--color-surface)">
              <th className="text-left px-3 py-2.5 font-medium text-(--color-muted)">Name</th>
              <th className="text-left px-3 py-2.5 font-medium text-(--color-muted)">Description</th>
              <th className="text-right px-3 py-2.5 font-medium text-(--color-muted) w-28">Default Price</th>
              <th className="text-right px-3 py-2.5 font-medium text-(--color-muted) w-28">Default Cost</th>
              <th className="text-right px-3 py-2.5 font-medium text-(--color-muted) w-20">Sort</th>
              <th className="text-center px-3 py-2.5 font-medium text-(--color-muted) w-20">Active</th>
              <th className="w-24" />
            </tr>
          </thead>
          <tbody>
            {presets.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-3 py-8 text-center text-sm text-(--color-muted)">
                  No presets yet — click &ldquo;New Preset&rdquo; to add one.
                </td>
              </tr>
            ) : null}
            {presets.map((preset) => {
              const isEditing = editingId === preset.id
              return (
                <tr key={preset.id} className={`border-b border-(--color-border) last:border-0 ${!preset.isActive ? "opacity-50" : ""}`}>
                  <td className="px-3 py-2">
                    {isEditing ? (
                      <Input value={editDraft.name}
                        onChange={(e) => setEditDraft((d) => ({ ...d, name: e.target.value }))}
                        className="text-base h-8" placeholder="Name" />
                    ) : (
                      <span className="font-medium text-(--color-foreground)">{preset.name}</span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    {isEditing ? (
                      <Input value={editDraft.description ?? ""}
                        onChange={(e) => setEditDraft((d) => ({ ...d, description: e.target.value || null }))}
                        className="text-base h-8" placeholder="Optional subtitle" />
                    ) : (
                      <span className="text-(--color-muted)">{preset.description ?? "—"}</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {isEditing ? (
                      <Input type="number" inputMode="decimal" step="0.01" value={editDraft.defaultPrice}
                        onChange={(e) => setEditDraft((d) => ({ ...d, defaultPrice: Number(e.target.value) }))}
                        className="text-base h-8 w-24 text-right ml-auto" />
                    ) : (
                      <span>${preset.defaultPrice.toFixed(2)}</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {isEditing ? (
                      <Input type="number" inputMode="decimal" step="0.01" value={editDraft.defaultCost}
                        onChange={(e) => setEditDraft((d) => ({ ...d, defaultCost: Number(e.target.value) }))}
                        className="text-base h-8 w-24 text-right ml-auto" />
                    ) : (
                      <span>${preset.defaultCost.toFixed(2)}</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {isEditing ? (
                      <Input type="number" inputMode="numeric" value={editDraft.sortOrder}
                        onChange={(e) => setEditDraft((d) => ({ ...d, sortOrder: Number(e.target.value) }))}
                        className="text-base h-8 w-16 text-right ml-auto" />
                    ) : (
                      <span className="text-(--color-muted)">{preset.sortOrder}</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-center">
                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0" disabled={isPending}
                      onClick={() => toggleActive(preset)}
                      title={preset.isActive ? "Deactivate" : "Activate"}
                    >
                      {preset.isActive
                        ? <Eye size={14} className="text-(--color-success)" />
                        : <EyeOff size={14} className="text-(--color-muted)" />}
                    </Button>
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex items-center justify-end gap-1">
                      {isEditing ? (
                        <>
                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-(--color-success)"
                            disabled={isPending} onClick={() => saveEdit(preset.id)}>
                            <Check size={14} />
                          </Button>
                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-(--color-muted)"
                            onClick={() => setEditingId(null)}>
                            <X size={14} />
                          </Button>
                        </>
                      ) : (
                        <>
                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0"
                            onClick={() => startEdit(preset)}>
                            <Pencil size={14} />
                          </Button>
                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-(--color-danger)"
                            onClick={() => setDeleteTarget(preset)}>
                            <Trash2 size={14} />
                          </Button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Create Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={(v) => { if (!isPending) setShowCreateDialog(v) }}>
        <DialogContent className="bg-(--color-background)">
          <DialogHeader><DialogTitle>New Line Item Preset</DialogTitle></DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); handleCreate() }} className="space-y-4">
            <div className="space-y-1.5">
              <Label>Name *</Label>
              <Input autoFocus value={createDraft.name}
                onChange={(e) => setCreateDraft((d) => ({ ...d, name: e.target.value }))}
                className="text-base" placeholder="e.g. Premium Hoodie" />
            </div>
            <div className="space-y-1.5">
              <Label>Description</Label>
              <Input value={createDraft.description ?? ""}
                onChange={(e) => setCreateDraft((d) => ({ ...d, description: e.target.value || null }))}
                className="text-base" placeholder="e.g. Gildan 18500" />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label>Default Price</Label>
                <Input type="number" inputMode="decimal" step="0.01" value={createDraft.defaultPrice}
                  onChange={(e) => setCreateDraft((d) => ({ ...d, defaultPrice: Number(e.target.value) }))}
                  className="text-base" />
              </div>
              <div className="space-y-1.5">
                <Label>Default Cost</Label>
                <Input type="number" inputMode="decimal" step="0.01" value={createDraft.defaultCost}
                  onChange={(e) => setCreateDraft((d) => ({ ...d, defaultCost: Number(e.target.value) }))}
                  className="text-base" />
              </div>
              <div className="space-y-1.5">
                <Label>Sort Order</Label>
                <Input type="number" inputMode="numeric" value={createDraft.sortOrder}
                  onChange={(e) => setCreateDraft((d) => ({ ...d, sortOrder: Number(e.target.value) }))}
                  className="text-base" />
              </div>
            </div>
          <DialogFooter className="pb-[max(1rem,env(safe-area-inset-bottom))]">
            <Button type="button" variant="outline" onClick={() => setShowCreateDialog(false)} disabled={isPending}>Cancel</Button>
            <Button type="submit" disabled={isPending}>Create Preset</Button>
          </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(v) => { if (!v) setDeleteTarget(null) }}>
        <AlertDialogContent className="bg-(--color-background)">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete &ldquo;{deleteTarget?.name}&rdquo;?</AlertDialogTitle>
            <AlertDialogDescription>
              This preset will be permanently removed. Orders using it already are not affected.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="pb-[max(1rem,env(safe-area-inset-bottom))]">
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              autoFocus
              onClick={() => deleteTarget && handleDelete(deleteTarget)}
              className="bg-(--color-danger) text-white hover:bg-(--color-danger)/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
