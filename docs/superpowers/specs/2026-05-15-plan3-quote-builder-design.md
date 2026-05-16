# Plan 3 — Quote Builder, Get Quote & Account Pages

**Date:** 2026-05-15
**Status:** Approved
**Reference:** OWA (`/Developer/repos/onewitharts`) — behavioral blueprint for quote builder layout and Due Now flow

---

## 1. Purpose

Plan 3 completes the customer-facing side of the template:

- **Quote Builder** (`/quote-builder`) — the primary tool for building, editing, and reviewing orders. Used by admins, employees, and customers alike with role-based permission scoping.
- **Get Quote** (`/get-quote`) — public form for customers to initiate a new quote request.
- **Public Order Page** (`/orders/[token]`) — enhanced read-only view with Due Now button and customer actions.
- **Account Page** (`/account`) — authenticated customer view of their orders.
- **Auth/Guest Capture Flow** — shared modal for claim, guest, and Due Now flows.
- **Navbar Guest Entry** — "Continue as Guest" option added to sign-in dropdown.

---

## 2. Schema Changes

### 2.1 New: `SetupFeePreset`

Preset setup cost types. Admin manages these in Settings view. Quote builder "Add ▼" dropdown pulls active presets ordered by `sortOrder`.

```prisma
model SetupFeePreset {
  id          Int      @id @default(autoincrement())
  name        String                      // e.g. "Artwork Fee", "Screen Setup"
  description String?                     // subtitle in dropdown e.g. "Per Color/Design"
  unitLabel   String   @default("Per Item")
  defaultRate Float    @default(0)        // customer-facing price per unit
  defaultCost Float    @default(0)        // admin COGS per unit
  sortOrder   Int      @default(0)
  isActive    Boolean  @default(true)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@map("setup_fee_presets")
}
```

Seeded defaults: Artwork Fee · Setup Fee · Rush Fee · Shipping · Custom Item

### 2.2 New: `LineItemPreset`

> **⚠ STUB — This is a placeholder for the project-specific inventory/catalog system.**
> When forking this template, replace this table and its seed data with your real product
> catalog schema in the early setup phase. See README.md § "Early Setup: Inventory / Catalog".
>
> A real implementation will typically need: variants (size/color/SKU), images, tiered pricing,
> category grouping, stock tracking, and supplier/vendor fields. Design it for your domain
> from scratch — do not extend this stub.

```prisma
model LineItemPreset {
  id           Int      @id @default(autoincrement())
  name         String
  description  String?
  defaultPrice Decimal  @db.Decimal(10,2)
  defaultCost  Decimal  @db.Decimal(10,2)
  sortOrder    Int      @default(0)
  isActive     Boolean  @default(true)
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  @@map("line_item_presets")
}
```

Seeded with generic JSON test data for development only. Admins manage active presets in the Settings view.

### 2.3 `User` role — `guest` documented

No schema change. `role` is already a `String`. Valid values: `'admin' | 'employee' | 'user' | 'guest'`. Guest users have `password: null`. The `guest` role is explicitly handled in all auth guards and the account page.

### 2.4 No other schema changes

`Order`, `OrderLineItem`, `OrderLineItemVariant`, `SetUpCost`, `Payment` — all unchanged.

---

## 3. New API Routes

| Route | Method | Auth | Purpose |
|---|---|---|---|
| `/api/setup-fee-presets` | GET | Any | List active presets (quote builder dropdown) |
| `/api/setup-fee-presets` | POST | Admin | Create preset |
| `/api/setup-fee-presets/[id]` | PATCH | Admin | Update preset |
| `/api/setup-fee-presets/[id]` | DELETE | Admin | Delete preset |
| `/api/line-item-presets` | GET | Any | List active presets (get-quote form + quote builder) |
| `/api/line-item-presets` | POST | Admin | Create preset |
| `/api/line-item-presets/[id]` | PATCH | Admin | Update/toggle |
| `/api/users/guest` | POST | Public | Create guest user (role='guest', password=null) |
| `/api/orders/[id]/claim` | POST | Auth | Link authenticated user to unclaimed order |

All routes return `{ data, error }` tuples. Money fields from Prisma pass through `serializeOrder()` before JSON serialization.

---

## 4. Route Architecture

### 4.1 `/quote-builder`

Query params:
- `?orderId=X` — load existing order by ID
- `?token=X` — load order by public token (customer link)
- `?reorderId=X` — admin duplicates existing order into new draft at stateId=1

Access matrix:

| Visitor | Order has userId | Order has no userId | Redirect |
|---|---|---|---|
| Admin (any) | Full edit access | Full edit access | — |
| Employee | Can edit: qty, add/remove line items, setup cost rate/cost | Same | — |
| Logged-in user (userId matches) | Edit qty/add/remove items, states 1–2 only | — | — |
| Logged-in user (userId mismatch) | → `/orders/[token]` | — | — |
| Anonymous | → `/orders/[token]` | Edit qty/add/remove, claim modal on save | — |

Permission matrix by field:

| Field | Admin | Employee | User/Guest (their order) | Anonymous (no-userId order) |
|---|---|---|---|---|
| Line item price/cost | ✅ | ✗ | ✗ | ✗ |
| Line item qty/add/remove | ✅ | ✅ | ✅ states 1–2 | ✅ states 1–2 |
| Setup cost add/remove/rate/cost | ✅ | ✅ | ✗ | ✗ |
| Discount | ✅ | ✗ | ✗ | ✗ |
| Select User / Order Name | ✅ | ✗ | ✗ | ✗ |

**Save behavior by context:**

| Context | State 1 | State 2 | State 3+ |
|---|---|---|---|
| Admin | Saves, stays state 1 | Saves, stays state 2 | Saves with price-change confirmation |
| Employee | Saves, stays state 1 | Saves, stays state 2 | Read-only (no save button) |
| Customer (authed/guest) | Saves, stays state 1 | Saves → reverts to state 1 | Read-only, no save button |
| Anonymous (no-userId order) | Claim modal → saves | Claim modal → saves → state 1 | Read-only |

**Price-change confirmation dialog (admin only):**
When admin saves and `newTotalPrice !== originalTotalPrice`, a Dialog fires before committing:
- Shows: Previous total · New total · Difference (signed, colored red/green)
- Cancel aborts the save. Confirm proceeds.
- Reference OWA implementation for the diff calculation logic.

### 4.2 `/orders/[token]` — Enhanced Public Page

Fully public, no auth required. Anyone with the link can view.

**Header:**
- Order title: `nickname ?? "Order #id"` + date + status
- Top-right: **Due Now `$X.XX`** button (state 2 only, `paymentPlan` is `deposit` or `full_upfront` — hidden for `pay_at_pickup`) + **Share** button
- Below Due Now: "Already Paid: `$X.XX`" if any payments exist

**View Only banner** (state 3+):
- Lock icon + "View Only — this order is in progress and can no longer be edited."
- Admin only: "Edit Order" button → `/quote-builder?orderId=X`

**Body:**
- ORDER ITEMS table: Description · Qty · Rate · Amount (no cost/profit shown publicly)
- Setup costs (if any): name · qty · rate · subtotal
- Order totals: sub total · discount · tax · total

**"Make Changes" link** (states 1–2 only, shown to non-admin visitors):
- Links to `/quote-builder?orderId=X` (anonymous visitors go through claim modal once they try to save)

**Due Now flow (Plan 3 skeleton):**
1. Click → if unauthenticated: auth/guest capture modal fires first
2. After auth → payment placeholder Dialog: "Thanks — our team will confirm your payment details and reach out shortly."
3. State stays at 2. Full Stripe integration is Plan 4.

### 4.3 `/get-quote` — Public Quote Request Form

No auth required. Auth/guest capture fires on submit.

**Fields:**
- `customerNotes` textarea (required) — job description / what they need
- **Line Items** — select from active `LineItemPreset` catalog + set qty
  - Each row: Name · Description · Qty (editable) · Price (read-only, preset) · Line Total (Price × Qty)
  - "Add Custom Item" row: Description only + qty (admin sets price later in quote builder)
- Due Date (optional) + Hard Deadline toggle

**On submit:**
- Auth/guest capture modal fires
- After auth: `POST /api/orders` with `stateId=1`, `userId` from session (or null on edge cases), `customerNotes`, `orderLineItems`
- Redirect to `/orders/[token]?name={encodeURIComponent(label)}`
- All admin users receive a `Notification` on submission

### 4.4 `/account` — Customer Account Page

Requires auth (role: `user` or `guest`).

**Layout:**
- Header: "My Orders" + user name
- **Guest upgrade banner** (guest only): "You're browsing as a guest — set a password to secure your account." → "Set Password" button opens a Dialog: new password + confirm → `PATCH /api/users/[id]` to set `password`
- Orders list: ordered by `createdAt` desc. Each row: nickname/id · state badge · total · due date · link
  - State 1–2 → links to `/quote-builder?orderId=X`
  - State 3+ → links to `/orders/[token]`
- No cost/profit fields anywhere on this page

---

## 5. Quote Builder Page — Layout & Components

### 5.1 Page structure (matches OWA visual orientation)

```
src/app/quote-builder/
  page.tsx                           ← thin server component
  QuoteBuilder.tsx                   ← main container (client, loads order)
  components/
    QuoteBuilder-Banner.tsx          ← edit mode / view-only / state banner
    QuoteBuilder-OrderItems.tsx      ← order items table with inline editing
    QuoteBuilder-SetupCosts.tsx      ← setup costs section with Add dropdown
    QuoteBuilder-OrderTotals.tsx     ← right-side totals panel
    QuoteBuilder-UserSelect.tsx      ← admin-only user picker + order name
    QuoteBuilder-ClaimModal.tsx      ← auth/guest capture (shared modal)
    QuoteBuilder-PriceChangeDialog.tsx ← admin price-change confirmation
    QuoteBuilder-DueNowDialog.tsx    ← due now placeholder dialog
```

### 5.2 Banner

| State | Visitor | Banner content |
|---|---|---|
| 1 | Customer | "Your quote is being reviewed. You can still make changes." |
| 2 | Customer | "Your quote is approved. Making changes will send it back for review." (warning color) |
| 3+ | Customer | "This order is in progress and can no longer be edited." (lock icon) |
| Any | Admin | "Edit Mode — Order #X. Changes save when you click Save Changes." (yellow, matches OWA) |

### 5.3 Order Items table

**Admin columns:** Description · Qty · Rate · Cost · Amount · Profit · ×
**Customer/employee columns:** Description · Qty · Rate · Amount · ×

- Inline editing — all cells are `<Input>` elements directly in the table row
- "Add Line Item ▼" opens a dropdown of active `LineItemPreset` items; selecting one appends a row pre-filled with `defaultPrice`/`defaultCost`, qty=1
- "Add Custom" option in the same dropdown opens a small inline Dialog: Name · Description · Qty · Price · Cost
- Line total = Price × Qty (always)
- Profit = (Price - Cost) × Qty (admin only, highlighted green — matches OWA)
- × button removes the row
- TOTALS row at the bottom: total qty · — · — · total cost* · total amount · total profit*

### 5.4 Setup Costs section

- "Add ▼" button opens a dropdown of active `SetupFeePreset` items with name + description subtitle (identical to OWA screenshot pattern)
- Selecting a preset appends a row: Item name · Qty (editable) · Rate (editable, admin/employee) · Cost (editable, admin/employee) · ×
- "+ Add Custom" appends a blank row with all fields editable
- Customer cannot see cost column; cannot add/remove setup cost rows

### 5.5 Order Totals panel

Live-computed as user edits (no save needed for display):
- Sub Total = line items amount + setup cost user total
- Discount (admin-only editable input, applied as a flat deduction)
- Sales Tax = (Sub Total - Discount) × taxRate (from UniversalSettings)
- **Total**
- Profit (admin only, green — Total minus all costs)

### 5.6 Admin-only bottom section

- **Select User** — search input + dropdown: type to filter users by name/email. Special option: "No Account Yet" (sets userId=null). Matches OWA's user picker pattern.
- **Order Name** — nickname input
- **Save Changes** button (full width, primary)

---

## 6. Auth/Guest Capture Modal (`QuoteBuilder-ClaimModal.tsx`)

Shared across: quote builder save, Due Now button, Get Quote submit, Navbar guest entry.

Three tabs:
1. **Sign In** — links to `/login?redirect={currentPath}`
2. **Register** — links to `/register?claimToken={token}` (register page pre-fills token, links order on success)
3. **Continue as Guest** — inline form: First Name · Last Name · Email · Phone (all required) · Company (optional)

Guest submit flow:
1. `POST /api/users/guest` — creates `User { role: 'guest', password: null }`
2. `POST /api/orders/[id]/claim` — links userId to order
3. NextAuth `signIn` with a special guest credentials flow (guest users can sign in with email only — no password check since `password` is null and role is `guest`)
4. Session established, modal closes, original action (save/Due Now) proceeds

**Navbar "Continue as Guest"**: The unauthenticated Sign In button becomes a `DropdownMenu` with: Sign In · Register · Continue as Guest. "Continue as Guest" opens the same ClaimModal but without an order context — creates the guest user and establishes their session for the current browsing session (useful before filling out the Get Quote form).

---

## 7. Settings View Additions

`Dashboard-SettingsView.tsx` gains two new sections (alongside the existing Order States and Business Settings):

**Setup Fee Presets** — table of all `SetupFeePreset` rows:
- Add new · Edit name/description/unitLabel/defaultRate/defaultCost · Toggle active · Reorder (sortOrder)

**Line Item Presets** — table of all `LineItemPreset` rows:
- Add new · Edit name/description/defaultPrice/defaultCost · Toggle active · Reorder
- Clearly labeled: *"Stub catalog — replace with your project's inventory system."*

---

## 8. File Map

| File | Action | Purpose |
|---|---|---|
| `prisma/schema.prisma` | Modify | Add SetupFeePreset + LineItemPreset models |
| `prisma/seed.ts` | Modify | Seed setup fee presets + line item presets |
| `src/app/quote-builder/page.tsx` | Create | Thin server component |
| `src/app/quote-builder/QuoteBuilder.tsx` | Create | Main container — loads order, resolves role/permissions |
| `src/app/quote-builder/components/QuoteBuilder-Banner.tsx` | Create | State/role-aware banner |
| `src/app/quote-builder/components/QuoteBuilder-OrderItems.tsx` | Create | Inline-edit order items table |
| `src/app/quote-builder/components/QuoteBuilder-SetupCosts.tsx` | Create | Setup costs with preset dropdown |
| `src/app/quote-builder/components/QuoteBuilder-OrderTotals.tsx` | Create | Live totals panel |
| `src/app/quote-builder/components/QuoteBuilder-UserSelect.tsx` | Create | Admin user picker + order name |
| `src/app/quote-builder/components/QuoteBuilder-ClaimModal.tsx` | Create | Shared auth/guest capture modal |
| `src/app/quote-builder/components/QuoteBuilder-PriceChangeDialog.tsx` | Create | Admin price-change confirmation |
| `src/app/quote-builder/components/QuoteBuilder-DueNowDialog.tsx` | Create | Due Now placeholder dialog |
| `src/app/get-quote/page.tsx` | Create | Thin server component |
| `src/app/get-quote/GetQuote.tsx` | Create | Quote request form container |
| `src/app/get-quote/components/GetQuote-Form.tsx` | Create | Form with line item catalog picker |
| `src/app/account/page.tsx` | Create | Thin server component |
| `src/app/account/Account.tsx` | Create | Customer orders container |
| `src/app/account/components/Account-OrderList.tsx` | Create | Order rows with state-aware links |
| `src/app/orders/[token]/page.tsx` | Modify | Enhance with Due Now, View Only banner, Make Changes link |
| `src/app/orders/[token]/layout.tsx` | Modify | OG metadata includes payment status |
| `src/app/api/setup-fee-presets/route.ts` | Create | GET + POST |
| `src/app/api/setup-fee-presets/[id]/route.ts` | Create | PATCH + DELETE |
| `src/app/api/line-item-presets/route.ts` | Create | GET + POST |
| `src/app/api/line-item-presets/[id]/route.ts` | Create | PATCH + DELETE |
| `src/app/api/users/guest/route.ts` | Create | POST — create guest user |
| `src/app/api/orders/[id]/claim/route.ts` | Create | POST — link userId to order |
| `src/components/shared/layout/Navbar-Links.tsx` | Modify | Unauthenticated Sign In → DropdownMenu with guest option |
| `src/app/dashboard/components/views/Dashboard-SettingsView.tsx` | Modify | Add setup fee + line item preset management sections |

---

## 9. Key Decisions

| Decision | Rationale |
|---|---|
| `LineItemPreset` is a stub | Real inventory (variants, images, tiered pricing) is domain-specific — designed per project, not templated |
| Anonymous access via orderId only when userId=null | Security: orders with a linked user redirect to the token URL; guessing IDs doesn't expose other users' orders |
| Guest users get a real `User` row with `role='guest'` | Enables order history, account upgrade, and session persistence — cleaner than storing contact info on the order |
| Guest sign-in via email only (no password) | Guest `password` is null; auth guard checks `role === 'guest'` to allow passwordless sign-in for this role only |
| Due Now = skeleton in Plan 3 | Payment processing (Stripe, manual recording) is complex — Plan 4 owns it. The button, auth capture, and state logic are correct; only the payment step is deferred. |
| Price-change confirmation dialog (admin only) | Prevents accidental repricing in active orders. Reference OWA implementation for diff logic. |
| Save in state 2 (non-admin) → reverts to state 1 | Any customer change invalidates the approved quote — admin must re-review before payment proceeds |
| "Continue as Guest" in navbar | Lets customers establish identity before starting the Get Quote form, reducing friction on submission |
| Auth capture modal is shared | Same component fires from quote builder save, Due Now, Get Quote submit, and navbar — one implementation, zero duplication |

---

## 10. Out of Scope (Plan 4)

- Full payment processing (Stripe / manual payment recording)
- Cloudinary file upload on Get Quote form
- Email notifications (order submitted, state changed)
- SMS notifications
- Order duplication (`?reorderId=X`) full implementation
- `LineItemPreset` replacement with real inventory catalog
