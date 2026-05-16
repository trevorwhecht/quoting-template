# Plan 4 — Auth/Guest Capture, Account Page & Settings Additions

**Date:** 2026-05-15
**Status:** DRAFT — ⚠️ NEEDS FULL REVIEW SESSION BEFORE PLANNING OR IMPLEMENTATION

> This spec was split out from the original Plan 3 spec to keep Plan 3 focused. All content
> below was written as part of the original Plan 3 brainstorm and has NOT been reviewed in
> isolation. Trevor and Claude must go over this together before writing an implementation plan.

---

## 1. Purpose

This plan completes the customer-facing flows that were deferred from Plan 3:

- **Auth/Guest Capture Modal** — shared modal for claim, guest, and Due Now flows. Required by 4 different triggers across the app.
- **Due Now flow wiring** — connects the placeholder button on `/orders/[token]` to auth capture and a payment placeholder.
- **Account Page** (`/account`) — authenticated customer view of their orders.
- **Navbar Guest Entry** — "Continue as Guest" option added to sign-in dropdown.
- **Settings View Additions** — admin management tables for Setup Fee Presets and Line Item Presets.

---

## 2. Auth/Guest Capture Modal (`QuoteBuilder-ClaimModal.tsx`)

Shared across: quote builder save (when anonymous), Due Now button (when unauthenticated), Get Quote submit (when unauthenticated), Navbar guest entry.

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

## 3. Due Now Flow (wired)

Updates to `/orders/[token]` page once auth capture is available:

1. Click Due Now → if unauthenticated: auth/guest capture modal fires first
2. After auth → payment placeholder Dialog: "Thanks — our team will confirm your payment details and reach out shortly."
3. State stays at 2. Full Stripe integration is a later plan.

---

## 4. `/account` — Customer Account Page

Requires auth (role: `user` or `guest`).

**Layout:**
- Header: "My Orders" + user name
- **Guest upgrade banner** (guest only): "You're browsing as a guest — set a password to secure your account." → "Set Password" button opens a Dialog: new password + confirm → `PATCH /api/users/[id]` to set `password`
- Orders list: ordered by `createdAt` desc. Each row: nickname/id · state badge · total · due date · link
  - State 1–2 → links to `/quote-builder?orderId=X`
  - State 3+ → links to `/orders/[token]`
- No cost/profit fields anywhere on this page

---

## 5. Get Quote — Auth Capture on Submit

Updates to `/get-quote` once auth capture is available:

- Auth/guest capture modal fires on submit if unauthenticated
- After auth: `POST /api/orders` with `userId` from session
- Redirect to `/orders/[token]?name={encodeURIComponent(label)}`
- All admin users receive a `Notification` on submission

---

## 6. Quote Builder — Anonymous Save (wired)

Updates to `/quote-builder` for anonymous users on no-userId orders:

- Save button triggers the ClaimModal instead of linking to `/login`
- After guest/auth capture: save proceeds normally, order is linked to user
- Guest credentials flow in NextAuth must be active for this to work

---

## 7. Settings View Additions

`Dashboard-SettingsView.tsx` gains three new sections (alongside existing Order States and Business Settings):

**Setup Fee Presets** — table of all `SetupFeePreset` rows:
- Add new · Edit name/description/unitLabel/defaultRate/defaultCost · Toggle active · Reorder (sortOrder)

**Line Item Presets** — table of all `LineItemPreset` rows:
- Add new · Edit name/description/defaultPrice/defaultCost · Toggle active · Reorder
- Clearly labeled: *"Stub catalog — replace with your project's inventory system."*

**Employee Permissions** — three dropdowns controlling what employees can see and do in the quote builder. Values are stored as `UniversalSettings` rows (key → `"none" | "view" | "edit"`).

| Setting key | Label | Default | Description |
|---|---|---|---|
| `employeeLineItemPriceAccess` | Line Item Price | `none` | Whether employees can see and/or edit the unit price on order line items |
| `employeeLineItemCostAccess` | Line Item Cost | `none` | Whether employees can see and/or edit the unit cost on order line items |
| `employeeSetupCostAccess` | Setup Cost (Cost Column) | `edit` | Whether employees can see and/or edit the internal cost field on setup cost rows |

Access levels:
- **none** — column hidden entirely; field stripped from API response for employees
- **view** — column visible but input is read-only
- **edit** — column visible and editable (full access)

**Implementation notes:**
- `page.tsx` for the quote builder (server component) fetches these three settings and passes them as `employeePermissions` props to the container
- `getQuoteBuilderPermissions()` accepts an optional `employeePermissions` input and uses it to override the hardcoded employee defaults
- Server-side enforcement: `stripAdminFields()` in `orderService.ts` becomes conditional — if `employeeLineItemCostAccess !== "none"`, employee responses retain `unitCost` on line items; if `employeeSetupCostAccess !== "none"`, employees retain `adminTotal` on setup costs
- The by-token and `orders/[id]` GET routes pass the settings into the strip decision
- Seeded defaults: `employeeLineItemPriceAccess = "none"`, `employeeLineItemCostAccess = "none"`, `employeeSetupCostAccess = "edit"`

---

## 8. New API Routes

| Route | Method | Auth | Purpose |
|---|---|---|---|
| `/api/users/guest` | POST | Public | Create guest user (role='guest', password=null) |
| `/api/orders/[id]/claim` | POST | Auth | Link authenticated user to unclaimed order |

---

## 9. Files

| File | Action | Purpose |
|---|---|---|
| `src/app/quote-builder/components/QuoteBuilder-ClaimModal.tsx` | Create | Shared auth/guest capture modal (3 tabs: Sign In, Register, Continue as Guest) |
| `src/app/account/page.tsx` | Create | Thin server component |
| `src/app/account/Account.tsx` | Create | Customer orders container |
| `src/app/account/components/Account-OrderList.tsx` | Create | Order rows with state-aware links |
| `src/app/orders/[token]/page.tsx` | Modify | Wire Due Now button to auth capture modal |
| `src/app/get-quote/GetQuote.tsx` | Modify | Wire submit to auth capture modal when unauthenticated |
| `src/app/quote-builder/QuoteBuilder.tsx` | Modify | Wire anonymous Save to auth capture modal instead of /login |
| `src/app/api/users/guest/route.ts` | Create | POST — create guest user |
| `src/app/api/orders/[id]/claim/route.ts` | Create | POST — link userId to order |
| `src/components/shared/layout/Navbar-Links.tsx` | Modify | Unauthenticated Sign In → DropdownMenu with guest option |
| `src/app/dashboard/components/views/Dashboard-SettingsView.tsx` | Modify | Add setup fee + line item preset management sections + employee permissions dropdowns |
| `src/lib/auth.ts` | Modify | Add guest credentials provider (email-only sign in for role='guest') |

---

## 10. Key Decisions (to revisit in review session)

| Decision | Rationale |
|---|---|
| Guest users get a real `User` row with `role='guest'` | Enables order history, account upgrade, and session persistence — cleaner than storing contact info on the order |
| Guest sign-in via email only (no password) | Guest `password` is null; auth guard checks `role === 'guest'` to allow passwordless sign-in for this role only |
| Auth capture modal is shared | Same component fires from quote builder save, Due Now, Get Quote submit, and navbar — one implementation, zero duplication |
| "Continue as Guest" in navbar | Lets customers establish identity before starting the Get Quote form, reducing friction on submission |
| Guest upgrade via password set | Converts a guest to a full user without creating a new account; preserves order history |
| Employee permissions use `"none"\|"view"\|"edit"` strings | Single value encodes both visibility and editability — cleaner than two booleans per field, and self-documenting as a dropdown label in Settings |
| Employee permission settings stored in `UniversalSettings` | Reuses the existing generic key/value settings table; no schema migration needed |

---

## 11. Open Questions (for review session)

- Is the three-tab modal (Sign In / Register / Continue as Guest) still the right UX, or should it be simplified?
- Should the guest credentials flow modify `src/lib/auth.ts` or use a separate NextAuth provider?
- Does the account page need pagination for users with many orders?
- Should the Settings preset management tables support drag-to-reorder (same pattern as Order States) or just arrow buttons?
