# Plan 3 — Quote Builder, Get Quote & Public Order Page

**Date:** 2026-05-15
**Status:** Approved
**Reference:** OWA (`/Developer/repos/onewitharts`) — behavioral blueprint for quote builder layout and Due Now flow

---

## 1. Purpose

Plan 3 builds the core customer-facing quoting flow:

- **Quote Builder** (`/quote-builder`) — the primary tool for building, editing, and reviewing orders. Used by admins, employees, and customers alike with role-based permission scoping.
- **Get Quote** (`/get-quote`) — public form for customers to initiate a new quote request. Submits without auth capture (Plan 4 adds guest/auth capture).
- **Public Order Page** (`/orders/[token]`) — enhanced read-only view with Due Now placeholder button and view-only banner.

**Deferred to Spec 4:** Auth/Guest Capture Modal, Account page, Navbar "Continue as Guest" dropdown, Settings view preset management tables, Due Now auth wiring.

---

## 2. Schema Changes

### 2.1 New: `SetupFeePreset`

Preset setup cost types. Admin manages these in Settings (Spec 4). Quote builder "Add ▼" dropdown pulls active presets ordered by `sortOrder`.

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

Seeded with generic JSON test data for development only.

### 2.3 `User` role — `guest` documented

No schema change. `role` is already a `String`. Valid values: `'admin' | 'employee' | 'user' | 'guest'`. Guest users have `password: null`. Documented here for completeness; the guest auth flow is implemented in Spec 4.

### 2.4 `SetUpCost` — usage clarification (no schema change)

`SetUpCost` stores individual setup fee line items via the `customSetupItems: Json?` field. Each entry: `{label, qty, rate, cost}`. Multiple `SetUpCost` records per order are supported. `userTotal` = `rate × qty`, `adminTotal` = `cost × qty` for each record. The quote builder reads and writes the full item array; `userTotal`/`adminTotal` are always recomputed from the items on save.

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

All routes return `{ data, error }` tuples. Money fields from Prisma pass through `serializeOrder()` before JSON serialization.

---

## 4. Route Architecture

### 4.1 `/quote-builder`

Query params:
- `?orderId=X` — load existing order by ID
- `?token=X` — load order by public token (customer link)

Access matrix:

| Visitor | Order has userId | Order has no userId | Redirect |
|---|---|---|---|
| Admin (any) | Full edit access | Full edit access | — |
| Employee | Can edit: qty, add/remove line items, setup cost rate/cost | Same | — |
| Logged-in user (userId matches) | Edit qty/add/remove items, states 1–2 only | — | — |
| Logged-in user (userId mismatch) | → `/orders/[token]` | — | — |
| Anonymous | → `/orders/[token]` | View only — Save button links to `/login` | — |

Permission matrix by field:

| Field | Admin | Employee | User/Guest (their order) | Anonymous (no-userId order) |
|---|---|---|---|---|
| Line item price/cost | ✅ | ✗ | ✗ | ✗ |
| Line item qty/add/remove | ✅ | ✅ | ✅ states 1–2 | ✗ |
| Setup cost add/remove/rate/cost | ✅ | ✅ | ✗ | ✗ |
| Discount | ✅ | ✗ | ✗ | ✗ |
| Select User / Order Name | ✅ | ✗ | ✗ | ✗ |

**Save behavior by context:**

| Context | State 1 | State 2 | State 3+ |
|---|---|---|---|
| Admin | Saves, stays state 1 | Saves, stays state 2 | Saves with price-change confirmation |
| Employee | Saves, stays state 1 | Saves, stays state 2 | Read-only (no save button) |
| Customer (authed) | Saves, stays state 1 | Saves → reverts to state 1 | Read-only, no save button |
| Anonymous | Save button → `/login` redirect | — | Read-only |

**Price-change confirmation dialog (admin only):**
When admin saves and `newTotalPrice !== originalTotalPrice`, a Dialog fires before committing:
- Shows: Previous total · New total · Difference (signed, colored red/green)
- Cancel aborts the save. Confirm proceeds.

### 4.2 `/orders/[token]` — Enhanced Public Page

Fully public, no auth required.

**Header:**
- Order title: `nickname ?? "Order #id"` + date + status
- Top-right: **Due Now `$X.XX`** button (state 2 only, `paymentPlan` is `deposit` or `full_upfront` — hidden for `pay_at_pickup`) + **Share** button
- Below Due Now: "Already Paid: `$X.XX`" if any payments exist

**Due Now (Plan 3 skeleton):**
Clicking the button opens a simple placeholder Dialog: "Thanks — our team will confirm your payment details and reach out shortly." No auth capture, no state change. Full wiring (auth capture, Stripe) is Spec 4.

**View Only banner** (state 3+):
- Lock icon + "View Only — this order is in progress and can no longer be edited."
- Admin only: "Edit Order" button → `/quote-builder?orderId=X`

**Body:**
- ORDER ITEMS table: Description · Qty · Rate · Amount (no cost/profit shown publicly)
- Setup costs (if any): name · qty · rate · subtotal
- Order totals: sub total · discount · tax · total

**"Make Changes" link** (states 1–2 only, shown to non-admin visitors):
- Links to `/quote-builder?token=X`

### 4.3 `/get-quote` — Public Quote Request Form

No auth required. No auth capture on submit in Plan 3 — if unauthenticated, the form still submits and creates the order with `userId = null`, then redirects to `/orders/[token]`. Auth/guest capture on this flow is Spec 4.

**Fields:**
- `customerNotes` textarea (required) — job description / what they need
- **Line Items** — select from active `LineItemPreset` catalog + set qty
  - Each row: Name · Description · Qty (editable) · Price (read-only, preset) · Line Total (Price × Qty)
  - "Add Custom Item" row: Description only + qty (admin sets price later in quote builder)
- Due Date (optional) + Hard Deadline toggle

**On submit:**
- If logged in: `POST /api/orders` with `userId` from session
- If not logged in: `POST /api/orders` with `userId = null`
- Redirect to `/orders/[token]?name={encodeURIComponent(label)}`
- All admin users receive a `Notification` on submission

---

## 5. Quote Builder Page — Layout & Components

### 5.1 Page structure

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
    QuoteBuilder-PriceChangeDialog.tsx ← admin price-change confirmation
    QuoteBuilder-DueNowDialog.tsx    ← Due Now placeholder dialog
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
- Profit = (Price - Cost) × Qty (admin only, highlighted green)
- × button removes the row
- TOTALS row at the bottom: total qty · — · — · total cost* · total amount · total profit*

### 5.4 Setup Costs section

- "Add ▼" button opens a dropdown of active `SetupFeePreset` items with name + description subtitle
- Selecting a preset appends a new `SetUpCost` item: name · Qty (editable) · Rate (editable, admin/employee) · Cost (editable, admin/employee) · ×
- "+ Add Custom" appends a blank row with all fields editable
- Customer cannot see cost column; cannot add/remove setup cost rows
- On save, each row becomes a `SetUpCost` record with `customSetupItems = [{label, qty, rate, cost}]`, `userTotal = rate × qty`, `adminTotal = cost × qty`

### 5.5 Order Totals panel

Live-computed as user edits (no save needed for display):
- Sub Total = line items amount + setup cost user total
- Discount (admin-only editable input, applied as a flat deduction)
- Sales Tax = (Sub Total - Discount) × taxRate (from UniversalSettings)
- **Total**
- Profit (admin only, green — Total minus all costs)

### 5.6 Admin-only bottom section

- **Select User** — search input + dropdown: type to filter users by name/email. Special option: "No Account Yet" (sets userId=null).
- **Order Name** — nickname input
- **Save Changes** button (full width, primary)

---

## 6. File Map

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
| `src/app/quote-builder/components/QuoteBuilder-PriceChangeDialog.tsx` | Create | Admin price-change confirmation |
| `src/app/quote-builder/components/QuoteBuilder-DueNowDialog.tsx` | Create | Due Now placeholder dialog |
| `src/app/get-quote/page.tsx` | Create | Thin server component |
| `src/app/get-quote/GetQuote.tsx` | Create | Quote request form container |
| `src/app/get-quote/components/GetQuote-Form.tsx` | Create | Form with line item catalog picker |
| `src/app/orders/[token]/page.tsx` | Modify | Enhance with Due Now placeholder, View Only banner, Make Changes link |
| `src/app/orders/[token]/layout.tsx` | Modify | OG metadata includes payment status |
| `src/app/api/setup-fee-presets/route.ts` | Create | GET + POST |
| `src/app/api/setup-fee-presets/[id]/route.ts` | Create | PATCH + DELETE |
| `src/app/api/line-item-presets/route.ts` | Create | GET + POST |
| `src/app/api/line-item-presets/[id]/route.ts` | Create | PATCH + DELETE |

---

## 7. Key Decisions

| Decision | Rationale |
|---|---|
| `LineItemPreset` is a stub | Real inventory (variants, images, tiered pricing) is domain-specific — designed per project, not templated |
| Anonymous users on no-userId orders see "Sign in to save" | Auth/guest capture is Spec 4; Plan 3 keeps the quote builder functional without it |
| Get Quote submits without auth capture | Same reason — order is created with userId=null, guest/claim flow is Spec 4 |
| Due Now = skeleton dialog only | Full auth capture + payment wiring is Spec 4. Button and dialog are correct; auth/Stripe are deferred. |
| Price-change confirmation dialog (admin only) | Prevents accidental repricing in active orders. |
| Save in state 2 (non-admin) → reverts to state 1 | Any customer change invalidates the approved quote — admin must re-review before payment proceeds |
| SetUpCost rows use customSetupItems JSON | Each SetUpCost record stores one line item's data; label/qty/rate/cost in JSON, userTotal/adminTotal derived. No schema change needed. |

---

## 8. Out of Scope (Spec 4)

- Auth/Guest Capture Modal + NextAuth guest sign-in credentials flow
- `POST /api/users/guest` and `POST /api/orders/[id]/claim` routes
- Account page (`/account`)
- Navbar "Continue as Guest" DropdownMenu
- Settings view preset management tables (Setup Fee Presets + Line Item Presets)
- Due Now auth wiring and full payment processing (Stripe)
- Cloudinary file upload on Get Quote form
- Email/SMS notifications
- Order duplication (`?reorderId=X`)
- `LineItemPreset` replacement with real inventory catalog
