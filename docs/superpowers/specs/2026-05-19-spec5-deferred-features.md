# Spec 5 — Deferred Features

**Date:** 2026-05-19
**Status:** DRAFT — not yet ready for implementation plan

---

## Context

These features were explicitly deferred from Plans 1–4. All are validated requirements from the master spec or from decisions made during Plan 4 design. Plan 4 was too large to absorb them; they land here.

---

## Already Built (exclude from this spec)

| Feature | Plan |
|---|---|
| Employee permissions — settings UI + server enforcement | Plan 4 |
| Reseller license upload (customer side) | Plan 4 |
| `taxDeferralRequested` schema + persistence | Plan 4 |
| `needsShipping` toggle (boolean persisted, no address yet) | Plan 4 |
| Line Item Presets — GET endpoints, data model, seeding | Plan 1/2 |
| Setup Fee Presets — full CRUD management UI | Plan 3 |
| Payment table schema | Plan 1 |

---

## Out of Scope for This Spec

- Full multi-installment payment history charts (Insights view enhancement — later)
- Inventory/SKU system integration (the Line Item Presets table is intentionally a stub catalog)
- Email notifications (order state changes currently create in-app notifications only)

---

## 1. Line Item Presets — Management UI

**Priority: High** — was supposed to ship in Plan 4 but was cut to keep that plan manageable.

A CRUD management table in `Dashboard-SettingsView.tsx`, identical in layout and UX to the existing `Dashboard-SettingsView-SetupFeePresets.tsx`.

### Table columns

| Column | Notes |
|---|---|
| Name | Editable inline |
| Description | Editable inline (optional) |
| Default Price | Editable inline (decimal, required) |
| Default Cost | Editable inline (decimal, required) |
| Active toggle | Switch — inactive presets don't appear in the QB line item picker |
| Sort | Manual number input — same pattern as Setup Fee Presets |
| Delete | Soft-delete or hard-delete (follow Setup Fee Presets pattern) |

Labeled with a note: *"Stub catalog — replace with your inventory system when ready."*

### API routes needed

Check whether these already exist; create if missing:

| Route | Method | Purpose |
|---|---|---|
| `/api/line-item-presets` | GET | Already exists — list all |
| `/api/line-item-presets` | POST | Create new preset |
| `/api/line-item-presets/[id]` | PATCH | Update name/description/price/cost/active/sort |
| `/api/line-item-presets/[id]` | DELETE | Delete preset |

### Files

| File | Action |
|---|---|
| `src/app/dashboard/components/views/Dashboard-SettingsView.tsx` | Add import + render `<DashboardSettingsViewLineItemPresets />` |
| `src/app/dashboard/components/views/Dashboard-SettingsView-LineItemPresets.tsx` | Create — full CRUD table |
| `src/app/api/line-item-presets/route.ts` | Modify or create — add POST handler |
| `src/app/api/line-item-presets/[id]/route.ts` | Create — PATCH + DELETE |

---

## 2. Admin Reseller License Visibility

**Priority: High** — completes the reseller license feature started in Plan 4. Currently admins have no way to view submitted licenses in the dashboard.

### Where it lives

`Dashboard-OrderSheet.tsx` Details tab — add a "Reseller License" row if the order's user has a license on file.

Also: a filterable indicator on the `Dashboard-OrderCard.tsx` or the orders list — a small badge or icon when the customer has a license on file.

### Behavior

- If `order.user.resellerLicenseUrl` is set: show a "View License" link (opens in new tab) + upload date
- If not set: show "No license on file"
- Admin can see both states
- No upload/replace from the admin side (customer manages their own license)

### `taxDeferralRequested` visibility

While here, surface `order.taxDeferralRequested` in the order sheet Details tab for admins. Currently the field is persisted but never displayed in the dashboard.

### Files

| File | Action |
|---|---|
| `src/app/dashboard/components/Dashboard-OrderSheet.tsx` | Add reseller license row + taxDeferralRequested display to Details tab |
| `src/app/dashboard/components/Dashboard-OrderCard.tsx` | Optional: badge/icon if customer has license on file |
| `src/app/api/orders/[id]/route.ts` | Include `user.resellerLicenseUrl` + `user.resellerLicenseUploadedAt` in `ORDER_DETAIL_INCLUDE` user select |

---

## 3. Order Duplication

**Priority: Medium** — convenience feature; no schema changes needed.

### Behavior

- Admin-only action (employees cannot duplicate)
- Available from `Dashboard-OrderSheet.tsx` (button in the footer actions row)
- Creates a new order in state 1 with all line items and setup costs copied
- Clears: userId, dueDate, notes, payments, token (generates fresh token), all financial fields recomputed from line items
- Copies: nickname (appended with " (copy)"), customerNotes, lineItems (description/qty/unitPrice/unitCost), setUpCosts, needsShipping, taxDeferralRequested
- After creation: redirects admin to `/quote-builder?orderId={newId}`

### API

| Route | Method | Purpose |
|---|---|---|
| `/api/orders/[id]/duplicate` | POST | Create a copy of an order, return new order id |

### Files

| File | Action |
|---|---|
| `src/app/api/orders/[id]/duplicate/route.ts` | Create — POST, admin-only |
| `src/app/dashboard/components/Dashboard-OrderSheet.tsx` | Add "Duplicate Order" button to footer actions |

---

## 4. Shipping Address Management

**Priority: Medium** — required before `needsShipping` is genuinely useful end-to-end.

Currently: the `needsShipping` boolean is persisted on the order but no address is collected or stored anywhere.

### Model

The `Address` model already exists in the schema (from Plan 1) and `Order` has a `shippingAddress` relation. This spec uses that existing structure.

### Customer side (`/account`)

- Below the orders list: a "Saved Addresses" section
- Add / edit / delete saved addresses (street, city, state, zip, optional label e.g. "Home")
- On quote builder or get quote, if `needsShipping` is checked and the customer is logged in: a dropdown to select a saved address or enter a new one
- Selected address links to `Order.shippingAddress`

### Admin side (`Dashboard-OrderSheet.tsx`)

- When `order.needsShipping` is true, show the linked shipping address in the Details tab
- If no address: "No address on file — follow up with customer"

### Get Quote form

When `needsShipping` is toggled and user is authenticated: show a shipping address selector (saved addresses dropdown + "Add new" option). When unauthenticated: show the address fields inline (collected at submit time, saved to the created guest user's profile).

### API routes

| Route | Method | Purpose |
|---|---|---|
| `/api/users/[id]/addresses` | GET | List saved addresses for a user |
| `/api/users/[id]/addresses` | POST | Create new saved address |
| `/api/users/[id]/addresses/[addressId]` | PATCH | Update address |
| `/api/users/[id]/addresses/[addressId]` | DELETE | Delete address |
| `/api/orders/[id]` | PATCH (extend) | Accept `shippingAddressId` to link existing address |

### Files

| File | Action |
|---|---|
| `src/app/account/components/Account-Addresses.tsx` | Create — address management UI |
| `src/app/account/Account.tsx` | Add `<AccountAddresses>` section |
| `src/app/api/users/[id]/addresses/route.ts` | Create — GET + POST |
| `src/app/api/users/[id]/addresses/[addressId]/route.ts` | Create — PATCH + DELETE |
| `src/app/get-quote/components/GetQuote-Form.tsx` | Add address selector when `needsShipping` is checked + user is auth'd |
| `src/app/dashboard/components/Dashboard-OrderSheet.tsx` | Show shipping address in Details tab |

---

## 5. Stripe Payment Integration

**Priority: Low (later)** — largest feature in this list; requires external account setup and webhook infrastructure.

The Due Now button currently shows a placeholder dialog: *"Thanks — our team will confirm your payment details."* Full Stripe integration replaces that placeholder with an actual payment flow.

### Address architecture decision

The app's shipping address (Feature 4) and Stripe's billing address are **independent systems**:

- **App shipping address** = logistics/delivery address. Admin uses it to know where to ship the order. Managed by the customer in their account, linked to `Order.shippingAddress`.
- **Stripe billing address** = payment verification. Stripe collects it at checkout for fraud detection. Not stored in our DB.

These often differ (office billing vs home delivery, company card vs personal address). Do NOT force-link them.

When launching a Stripe Checkout session, optionally pre-fill Stripe's `customer_update.shipping` with the order's saved shipping address as a convenience — but the customer can override it at Stripe's hosted page. Stripe's submitted address is theirs; our app's shipping address stays as its own field.

### Scope

- Stripe Checkout (hosted payment page — simplest integration, no PCI complexity)
- Customer clicks "Pay Now" → redirected to Stripe Checkout session → on success redirected back to `/orders/[token]?payment=success`
- Payment recorded to `Payment` table on success (via webhook)
- `Order.isPaid` updated automatically by webhook handler
- Admin dashboard `Payment` tab in Order Sheet shows payment history
- Optionally pre-fill Stripe's shipping address from `Order.shippingAddress` if one is saved

### What is NOT in scope

- Subscriptions, recurring billing, installment plans
- Manual payment recording (check/cash/zelle) — already exists via admin PATCH
- Partial payments / deposits via Stripe (full amount only in first version)
- Storing Stripe's billing address back into the app

### API routes

| Route | Method | Purpose |
|---|---|---|
| `/api/orders/[id]/checkout` | POST | Create Stripe Checkout session, return URL |
| `/api/webhooks/stripe` | POST | Handle `checkout.session.completed`, record payment |

### Environment variables needed

```
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=
```

### Files

| File | Action |
|---|---|
| `src/app/api/orders/[id]/checkout/route.ts` | Create — POST, creates Checkout session |
| `src/app/api/webhooks/stripe/route.ts` | Create — handles `checkout.session.completed` |
| `src/app/orders/[token]/Orders-ActionButtons.tsx` | Replace placeholder dialog with Stripe redirect |
| `.env.example` | Add 3 Stripe vars |

### Key decision

Stripe Checkout (hosted) vs Stripe Elements (embedded). **Hosted** for first version — no card UI to build, no PCI scope, fastest path to working payments. Can migrate to embedded later if custom branding is needed.

---

## Schema Changes

No new schema migrations needed for features 1–3 (all models already exist). Feature 4 (shipping addresses) uses the existing `Address` model. Feature 5 (Stripe) creates no new tables — payments are recorded in the existing `Payment` table.

---

## Suggested Plan Groupings

These five features don't need to ship together. Suggested split:

| Plan | Features | Rationale |
|---|---|---|
| Plan 5 | Line Item Presets UI + Admin Reseller License + taxDeferralRequested visibility | Small wins, no schema changes, rounds out Plan 4 |
| Plan 6 | Shipping Address Management + Order Duplication | Both have no external dependencies; shipping address can ship independently of Stripe |
| Plan 7 | Stripe Payment Integration | Large, external dependency; optionally pre-fills from saved shipping address but architecturally independent |
