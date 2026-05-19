# Plan 5 — Line Item Presets UI + Admin Reseller/Tax Deferral Visibility

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Line Item Preset management CRUD to the Settings view, and surface `taxDeferralRequested` + reseller license in the admin Order Sheet.

**Architecture:** Line Item Presets follows the identical UI pattern of the existing `Dashboard-SettingsView-SetupFeePresets.tsx` — same table layout, same inline-edit row, same create/delete dialogs. Two small API gaps (GET `?all=1` and DELETE) are filled first. The Order Sheet changes are purely display-only: add two read-only fields to the admin Details tab by extending the `ORDER_DETAIL_INCLUDE` user select and the `OrderDetail` model type.

**Tech Stack:** Next.js App Router · Prisma · Tailwind 4 · shadcn/ui · TypeScript · Vitest

---

## File Map

| File | Action | Task |
|---|---|---|
| `src/app/api/line-item-presets/route.ts` | Modify — add `?all=1` support to GET | 1 |
| `src/app/api/line-item-presets/[id]/route.ts` | Modify — add DELETE handler | 1 |
| `src/app/dashboard/components/views/Dashboard-SettingsView-LineItemPresets.tsx` | Create — CRUD table | 2 |
| `src/app/dashboard/components/views/Dashboard-SettingsView.tsx` | Modify — import + render LineItemPresets | 2 |
| `src/models/user.ts` | Modify — add reseller license fields to `UserSummary` | 3 |
| `src/models/order.ts` | Modify — add `taxDeferralRequested` to `OrderDetail`; expand user Pick | 3 |
| `src/app/api/orders/[id]/route.ts` | Modify — expand `ORDER_DETAIL_INCLUDE` user select | 3 |
| `src/app/dashboard/components/orders/Dashboard-OrderSheet.tsx` | Modify — add tax deferral + reseller license to Details tab | 4 |

---

## Task 1: Line Item Presets API — Fill Gaps

**Files:**
- Modify: `src/app/api/line-item-presets/route.ts`
- Modify: `src/app/api/line-item-presets/[id]/route.ts`

The GET endpoint currently only returns active presets. The admin management UI needs all presets (active + inactive) via `?all=1`. The `[id]` route is also missing a DELETE handler.

- [ ] **Step 1: Add `?all=1` support to the GET handler**

In `src/app/api/line-item-presets/route.ts`, replace the `GET` function:

```ts
export async function GET(req: Request) {
  const session = await getServerSession(authOptions)
  const isAdmin = session?.user?.role === "admin"
  const showAll = isAdmin && new URL(req.url).searchParams.get("all") === "1"

  const presets = await prisma.lineItemPreset.findMany({
    where: showAll ? undefined : { isActive: true },
    orderBy: { sortOrder: "asc" },
  })
  return NextResponse.json({ data: presets.map(serializePreset), error: null })
}
```

- [ ] **Step 2: Add DELETE handler to `[id]/route.ts`**

In `src/app/api/line-item-presets/[id]/route.ts`, add after the existing `PATCH` export:

```ts
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== "admin") {
    return NextResponse.json({ data: null, error: "Forbidden" }, { status: 403 })
  }
  const { id } = await params
  await prisma.lineItemPreset.delete({ where: { id: Number(id) } })
  return NextResponse.json({ data: { id: Number(id) }, error: null })
}
```

- [ ] **Step 3: TypeScript check**

```bash
npx tsc --noEmit
```

Expected: zero errors.

---

## Task 2: Line Item Presets Management UI

**Files:**
- Create: `src/app/dashboard/components/views/Dashboard-SettingsView-LineItemPresets.tsx`
- Modify: `src/app/dashboard/components/views/Dashboard-SettingsView.tsx`

Mirrors `Dashboard-SettingsView-SetupFeePresets.tsx` exactly in structure. Key differences: uses `defaultPrice` instead of `defaultRate`, no `unitLabel` field, uses `useTransition` (not boolean `saving` state).

- [ ] **Step 1: Create `Dashboard-SettingsView-LineItemPresets.tsx`**

Create `src/app/dashboard/components/views/Dashboard-SettingsView-LineItemPresets.tsx`:

```tsx
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
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="bg-(--color-background)">
          <DialogHeader><DialogTitle>New Line Item Preset</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Name *</Label>
              <Input value={createDraft.name}
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
          </div>
          <DialogFooter className="pb-[max(1rem,env(safe-area-inset-bottom))]">
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>Cancel</Button>
            <Button autoFocus onClick={handleCreate} disabled={isPending}>Create Preset</Button>
          </DialogFooter>
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
```

- [ ] **Step 2: Wire into `Dashboard-SettingsView.tsx`**

In `src/app/dashboard/components/views/Dashboard-SettingsView.tsx`, add the import and render the component. Add the import after the existing `DashboardSettingsViewSetupFeePresets` import:

```ts
import DashboardSettingsViewLineItemPresets from "./Dashboard-SettingsView-LineItemPresets"
```

Add `<DashboardSettingsViewLineItemPresets />` to the return, **before** `<DashboardSettingsViewSetupFeePresets />` (line item presets are more commonly used and belong above setup fee presets):

```tsx
return (
  <div className="p-6 max-w-4xl space-y-10">
    <h2 className="text-xl font-semibold text-(--color-foreground)">Settings</h2>
    <DashboardSettingsViewLineItemPresets />
    <DashboardSettingsViewSetupFeePresets />

    <div className="space-y-4">
      {/* ... employee permissions section unchanged ... */}
    </div>
  </div>
)
```

- [ ] **Step 3: TypeScript check**

```bash
npx tsc --noEmit
```

Expected: zero errors.

---

## Task 3: Extend OrderDetail Type + API Include

**Files:**
- Modify: `src/models/user.ts`
- Modify: `src/models/order.ts`
- Modify: `src/app/api/orders/[id]/route.ts`

The admin Order Sheet needs to display the customer's reseller license and whether they requested tax deferral. These fields exist in the DB but aren't included in `ORDER_DETAIL_INCLUDE` or the `OrderDetail` type.

- [ ] **Step 1: Add reseller license fields to `UserSummary`**

In `src/models/user.ts`, add two optional fields to `UserSummary`:

```ts
export type UserSummary = {
  id: string
  email: string
  firstName: string
  lastName: string
  companyName: string | null
  phone: string | null
  role: string
  resellerLicenseUrl: string | null
  resellerLicenseUploadedAt: string | null
  createdAt: string
}
```

- [ ] **Step 2: Update `OrderDetail` in `src/models/order.ts`**

Add `taxDeferralRequested: boolean` to the `OrderDetail` type (after `needsShipping`):

```ts
needsShipping: boolean
taxDeferralRequested: boolean
mainImage: string | null
```

Expand the `user` Pick to include the reseller fields:

```ts
user: Pick<UserSummary, "id" | "firstName" | "lastName" | "email" | "phone" | "companyName" | "resellerLicenseUrl" | "resellerLicenseUploadedAt"> | null
```

- [ ] **Step 3: Update `ORDER_DETAIL_INCLUDE` in `src/app/api/orders/[id]/route.ts`**

Find `ORDER_DETAIL_INCLUDE` at the top of the file and update the `user` select to include the reseller license fields:

```ts
const ORDER_DETAIL_INCLUDE = {
  state: true,
  user: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      phone: true,
      companyName: true,
      resellerLicenseUrl: true,
      resellerLicenseUploadedAt: true,
    },
  },
  orderLineItems: { include: { variants: true }, orderBy: { sortOrder: "asc" as const } },
  setUpCosts: true,
  payments: { orderBy: { paidAt: "desc" as const } },
}
```

- [ ] **Step 4: TypeScript check**

```bash
npx tsc --noEmit
```

Expected: zero errors. Any new type errors here indicate a consumer that needs updating — fix them before proceeding.

---

## Task 4: OrderSheet — Tax Deferral + Reseller License

**Files:**
- Modify: `src/app/dashboard/components/orders/Dashboard-OrderSheet.tsx`

Add a compact info card to the admin Details tab showing whether the customer requested tax deferral and whether they have a reseller license on file.

- [ ] **Step 1: Add the info card to the Details tab**

In `src/app/dashboard/components/orders/Dashboard-OrderSheet.tsx`, inside the `{isAdmin ? (<>...</>) : null}` block at line 164, insert the following **after the `grid grid-cols-2 gap-3` div** (which contains Discount + Payment Plan) and **before the totals summary div**:

```tsx
{/* Tax deferral + reseller license */}
<div className="rounded-md border border-(--color-border) p-3 space-y-2 text-sm bg-(--color-surface)">
  <div className="flex justify-between items-center">
    <span className="text-(--color-muted)">Tax Deferral Requested</span>
    <span className={order.taxDeferralRequested ? "font-medium text-(--color-foreground)" : "text-(--color-muted)"}>
      {order.taxDeferralRequested ? "Yes" : "No"}
    </span>
  </div>
  {order.user ? (
    <div className="flex justify-between items-center">
      <span className="text-(--color-muted)">Reseller License</span>
      {order.user.resellerLicenseUrl ? (
        <a
          href={order.user.resellerLicenseUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-(--color-primary) hover:underline text-xs"
        >
          View License
        </a>
      ) : (
        <span className="text-(--color-muted)">None on file</span>
      )}
    </div>
  ) : null}
</div>
```

- [ ] **Step 2: TypeScript check**

```bash
npx tsc --noEmit
```

Expected: zero errors.

- [ ] **Step 3: Run test suite**

```bash
npx vitest run
```

Expected: all tests pass (no regressions — none of these changes touch tested logic).
