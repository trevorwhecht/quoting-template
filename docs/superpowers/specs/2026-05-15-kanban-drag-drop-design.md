# Kanban Drag-and-Drop with Contextual Confirmation Modals

**Date:** 2026-05-15
**Status:** Approved

---

## Overview

Add drag-and-drop to the admin Kanban board (desktop only) so admins can move order cards between state columns. Every forward move (increasing state ID) requires a confirmation modal. Backward moves are frictionless and immediate. The modal content is context-aware: it may include a payment plan selector, a warning about unconfirmed payments, and optional guest customer info capture.

---

## Scope

- **Desktop only.** Mobile layout (single-column dropdown view) is unchanged. DnD context only wraps the `hidden md:flex` desktop grid.
- **No schema changes.** `paymentPlan` already exists on `Order`.
- **New npm dependency:** `@dnd-kit/core`.

---

## Data Model Fix

`paymentPlan: string | null` is missing from the `OrderSummary` TypeScript type even though:
- The Prisma schema has the column
- The list API (`GET /api/orders`) uses `include` (not `select`), so the field is already returned

**Fix:** Add `paymentPlan: string | null` to `OrderSummary` in `src/models/order.ts`. No API or schema change needed.

---

## Architecture

### Files modified

| File | Change |
|---|---|
| `src/models/order.ts` | Add `paymentPlan: string \| null` to `OrderSummary` |
| `src/app/dashboard/components/kanban/Dashboard-Kanban.tsx` | Add `DndContext`, drag state, `onDragStart`/`onDragEnd`, `DragOverlay` |
| `src/app/dashboard/components/kanban/Dashboard-KanbanColumn.tsx` | Add `useDroppable`, drop-target highlight |
| `src/app/dashboard/components/kanban/Dashboard-OrderCard.tsx` | Add `useDraggable`, drag opacity, transform style |

### Files created

| File | Purpose |
|---|---|
| `src/app/dashboard/components/kanban/Dashboard-KanbanDragOverlay.tsx` | Floating card clone rendered inside `<DragOverlay>` during drag |
| `src/app/dashboard/components/kanban/Dashboard-KanbanMoveConfirmDialog.tsx` | Context-aware confirmation modal for forward moves |

---

## DnD Wiring

### `Dashboard-Kanban.tsx`

- Wrap desktop grid (`hidden md:flex`) in `<DndContext>` with a `PointerSensor`
- Track `activeCard: OrderSummary | null` state
- `onDragStart`: set `activeCard`
- `onDragEnd`: clear `activeCard`, then:
  - No target column → no-op
  - `toStateId === fromStateId` → no-op
  - `toStateId < fromStateId` (backward) → immediately `PATCH /api/orders/:id { stateId }`, optimistic update
  - `toStateId > fromStateId` (forward) → store `pendingMove: { order, fromStateId, toStateId }`, open confirmation modal
- Render `<DragOverlay>` containing `<DashboardKanbanDragOverlay order={activeCard} />` when `activeCard` is set

### `Dashboard-KanbanColumn.tsx`

- Add `useDroppable({ id: state.id })` on the outer container div
- Apply a subtle ring (`ring-2 ring-(--color-primary)/40`) when `isOver` is true

### `Dashboard-OrderCard.tsx`

- Add `useDraggable({ id: order.id, data: { order } })` on the root div
- Apply `transform: CSS.Transform.toString(transform)` from dnd-kit during drag
- Set `opacity-40` on the source card while it is being dragged (its clone is in the overlay)

### `Dashboard-KanbanDragOverlay.tsx`

- Renders the same card markup as `OrderCard` but without any dnd-kit hooks
- Appears at the pointer during drag; `DragOverlay` handles positioning
- Slight drop shadow to indicate it is floating

---

## Confirmation Modal — `Dashboard-KanbanMoveConfirmDialog.tsx`

### Props

```ts
type Props = {
  order: OrderSummary
  fromStateId: number
  toStateId: number
  targetStateName: string
  onConfirm: (payload: MovePayload) => Promise<void>
  onCancel: () => void
}

type MovePayload = {
  stateId: number
  paymentPlan?: string       // set when fromStateId === 1
  guestUser?: {
    firstName: string
    lastName: string
    email?: string
    phone?: string
  }
}
```

### Payment plan section (only when `fromStateId === 1`)

| Destination | Behavior |
|---|---|
| `toStateId === 2` | Show dropdown: Full Upfront (default), Deposit, Pay at Pickup. Required. |
| `toStateId >= 3` | No dropdown. Auto-set `pay_at_pickup`. Show info notice: *"Skipping User Review — payment plan will be set to Pay at Pickup."* |

### Warning banner (when `fromStateId >= 2` and `toStateId >= 3`)

| `paymentPlan` value | Warning message |
|---|---|
| `full_upfront` or `deposit` | *"Payment not yet confirmed via Stripe. Only continue if you've received payment via Zelle or another method."* |
| `pay_at_pickup` | *"Customer agreed to pay at pickup."* (informational, not a warning) |
| `null` | No banner |

### Guest info section (when `toStateId >= 3` and `order.user === null`)

- Label: *"Guest customer info (optional)"*
- Fields: First Name, Last Name, Email, Phone
- All fields optional to fill — if admin leaves them all blank, no guest user is created
- If any field is filled, First Name and Last Name become required (validated on submit)
- If `order.user` is already set (guest was previously created): show read-only summary of who is attached; admin just clicks Continue

### Submit flow

1. Validate: if filling guest info, require first + last name
2. If guest info provided: `POST /api/users` with `{ firstName, lastName, email, phone, role: "guest" }`
3. `PATCH /api/orders/:id` with `{ stateId, paymentPlan?, userId? }` (userId from step 2 if guest created)
4. Call `onOrderUpdated` with response, refetch orders, close modal

---

## State Transition Summary

| From → To | Payment plan | Warning | Guest info |
|---|---|---|---|
| 1 → 2 | Required selector (default: full upfront) | None | None |
| 1 → 3+ | Auto pay_at_pickup, info notice | None | If no user |
| 2 → 3+ (full/deposit plan) | None | Stripe warning | If no user |
| 2 → 3+ (pay_at_pickup plan) | None | Pay at pickup notice | If no user |
| 3+ → higher | None | None | If no user |
| Any → lower | No modal — immediate | — | — |

---

## API

### `POST /api/users/guest` — create guest user (new admin-only endpoint)

The existing `POST /api/users` is a public registration endpoint: requires email + password, hardcodes `role: "user"`. It cannot be reused.

A new route at `src/app/api/users/guest/route.ts` handles admin-initiated guest creation:
- **Auth:** admin session required
- **Body:** `{ firstName, lastName, email?, phone? }`
- **Validation:** firstName + lastName required; email optional (but unique if provided)
- **Creates:** `User` with `role: "guest"`, no password, optional email/phone
- **Returns:** `{ data: { id, firstName, lastName, email, role }, error }`

### `PATCH /api/orders/:id` — move state

Already handles `stateId`, `paymentPlan`, and `userId`. No changes needed.

---

## Error Handling

- Guest user creation failure → toast error, do not advance state
- Order PATCH failure → toast error, revert optimistic update if applied
- Escape during drag or drop outside any column → no-op (dnd-kit handles this via `onDragCancel`)
