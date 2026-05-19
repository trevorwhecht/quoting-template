# Plan 4 — Auth/Guest Capture, Account Page & Settings Additions

**Date:** 2026-05-15
**Finalized:** 2026-05-19
**Status:** FINALIZED ✅ — Ready for implementation plan

---

## Already Built (exclude from plan)

| Feature | File | Notes |
|---|---|---|
| Setup Fee Presets management | `Dashboard-SettingsView-SetupFeePresets.tsx` | Full CRUD table done |
| Switch component | `src/components/ui/switch.tsx` | Base UI switch, used in GetQuote form |
| `needsShipping` toggle | `GetQuote-Form.tsx` | UI + boolean persisted; address fields deferred |
| `taxDeferralRequested` toggle | `GetQuote-Form.tsx` | UI exists but NOT yet persisted (bug — fix in Plan 4) |

---

## Bugs to Fix in Plan 4

| Bug | Location | Fix |
|---|---|---|
| `/api/users/guest` requires admin session | `src/app/api/users/guest/route.ts` | Rewrite as public route (no auth required — called by unauthenticated users in ClaimModal) |
| `taxDeferralRequested` not persisted | `GetQuote-Form.tsx` + `POST /api/orders` | Add schema field + include in POST body |

---

## 1. Purpose

This plan completes the customer-facing flows deferred from Plan 3:

- **Auth/Guest Capture Modal** — shared modal for claim, guest, and Due Now flows. Required by 4 different triggers across the app.
- **Due Now flow wiring** — connects the placeholder button on `/orders/[token]` to auth capture.
- **Account Page** (`/account`) — authenticated customer view of their orders + reseller license upload.
- **Navbar Guest Entry** — "Continue as Guest" option added to unauthenticated account dropdown.
- **Settings View Additions** — Line Item Preset management table + Employee Permissions dropdowns.
- **Get Quote fix** — persist `taxDeferralRequested` (schema + API), remove shipping address input fields (deferred to later spec).

**Out of scope (deferred):**
- Shipping address management (multi-address on user accounts → its own spec)
- Order duplication feature → later plan
- Full Stripe payment integration → later plan

---

## 2. Auth/Guest Capture Modal (`QuoteBuilder-ClaimModal.tsx`)

Shared across: quote builder save (anonymous), Due Now button (unauthenticated), Get Quote submit (unauthenticated), Navbar guest entry.

Three tabs:
1. **Sign In** — links to `/login?redirect={currentPath}`
2. **Register** — links to `/register?claimToken={token}` (register page pre-fills token, links order on success)
3. **Continue as Guest** — inline form: First Name · Last Name · Email · Phone (all required) · Company (optional)

Guest submit flow:
1. `POST /api/users/guest` — creates `User { role: 'guest', password: null }` (public route, no auth)
2. `POST /api/orders/[id]/claim` — links userId to order (only fires when there is an order context)
3. NextAuth `signIn` with guest credentials provider (email-only, no password check when `role === 'guest'`)
4. Session established, modal closes, original action (save/Due Now/submit) proceeds

**Navbar "Continue as Guest"**: The unauthenticated account icon dropdown (currently links to `/login`) becomes a `DropdownMenu` with: Sign In · Register · Continue as Guest. "Continue as Guest" opens the ClaimModal without an order context — creates the guest user and establishes their session.

---

## 3. Due Now Flow (wired)

Updates to `/orders/[token]` once auth capture is available:

1. Click Due Now → if unauthenticated: ClaimModal fires first
2. After auth → payment placeholder Dialog: "Thanks — our team will confirm your payment details and reach out shortly."
3. Order state does NOT change. Full Stripe integration is a later plan.

---

## 4. `/account` — Customer Account Page

Requires auth (`role: 'user'` or `'guest'`).

**Layout:**
- Header: "My Orders" + user name
- **Guest upgrade banner** (guest only): "You're browsing as a guest — set a password to secure your account." → "Set Password" button opens a Dialog: new password + confirm → `PATCH /api/users/[id]` to set `password`
- Orders list: ordered by `createdAt` desc. Each row: nickname/id · state badge · total · due date · link
  - State 1–2 → links to `/quote-builder?orderId=X`
  - State 3+ → links to `/orders/[token]`
- No cost/profit fields anywhere on this page

**Reseller License Upload:**
- Below the orders list, a "Tax Exemption / Reseller License" section
- If no license on file: prompt with a brief explanation and an upload button
- If license on file: show filename + upload date + "Replace" button
- Upload sends file to Cloudinary using `resource_type: 'auto'` (handles PDF + PNG + JPG)
- Endpoint: `POST /api/users/[id]/reseller-license/upload` — receives `FormData`, uploads to Cloudinary folder `reseller-licenses/${userId}`, saves `resellerLicenseUrl` + `resellerLicenseUploadedAt` on user
- Accepted formats: PDF, PNG, JPG (max 10 MB)
- Requires `CLOUDINARY_URL` env var (already used by OWA; add to `.env.example`)

**Admin visibility of reseller licenses** (future dashboard enhancement, not Plan 4):
- Not in scope for Plan 4 — admin views will be extended in a later plan

---

## 5. Get Quote — Fixes + Auth Capture on Submit

**Fix: `taxDeferralRequested` persistence:**
- Add `taxDeferralRequested Boolean @default(false)` to `Order` schema (requires migration)
- Update `POST /api/orders` to read and persist `taxDeferralRequested` from the request body
- Update `GetQuote-Form.tsx` to include `taxDeferralRequested` in the POST body

**Remove shipping address inputs:**
- The form currently shows street/city/state/zip fields when `needsShipping` is toggled — these are never saved
- Remove these address fields from the form; keep only the `needsShipping` toggle
- Multi-address management tied to user accounts is a separate spec

**Auth capture on submit:**
- If unauthenticated when submitting: ClaimModal fires, order is created with the resulting session userId
- After auth: `POST /api/orders` with `userId` from session
- Redirect to `/orders/[token]?name={encodeURIComponent(label)}`

---

## 6. Quote Builder — Anonymous Save (wired)

Updates to `/quote-builder` for anonymous users on no-userId orders:

- Save button triggers ClaimModal instead of linking to `/login`
- After guest/auth capture: `POST /api/orders/[id]/claim` links order to user, save proceeds normally

---

## 7. Settings View Additions

`Dashboard-SettingsView.tsx` gains two new sections (Setup Fee Presets already done):

**Line Item Presets** — table of all `LineItemPreset` rows (same layout as Setup Fee Presets):
- Add new · Edit name/description/defaultPrice/defaultCost · Toggle active · Sort (manual sort number input, same as Setup Fee Presets)
- Clearly labeled: *"Stub catalog — replace with your project's inventory system."*
- Add `POST /api/line-item-presets` and `PATCH /api/line-item-presets/[id]` routes if not already present (GET routes exist)

**Employee Permissions** — three dropdowns controlling what employees see in the quote builder. Stored as `UniversalSettings` rows.

| Setting key | Label | Default | Description |
|---|---|---|---|
| `employeeLineItemPriceAccess` | Line Item Price | `none` | Whether employees can see/edit unit price on order line items |
| `employeeLineItemCostAccess` | Line Item Cost | `none` | Whether employees can see/edit unit cost on order line items |
| `employeeSetupCostAccess` | Setup Cost (Cost Column) | `edit` | Whether employees can see/edit the internal cost field on setup costs |

Access levels:
- **none** — column hidden entirely; field stripped from API response for employees
- **view** — column visible but read-only
- **edit** — column visible and editable

**Implementation notes:**
- `page.tsx` for the quote builder fetches these three settings and passes them as `employeePermissions` props to the container
- `getQuoteBuilderPermissions()` accepts an optional `employeePermissions` input to override hardcoded defaults
- Server-side enforcement: `stripAdminFields()` in `orderService.ts` becomes conditional based on these settings
- Seeded defaults: `employeeLineItemPriceAccess = "none"`, `employeeLineItemCostAccess = "none"`, `employeeSetupCostAccess = "edit"`

---

## 8. New API Routes

| Route | Method | Auth | Purpose |
|---|---|---|---|
| `/api/users/guest` | POST | **Public** | Create guest user (role='guest', password=null) — fix existing bug |
| `/api/orders/[id]/claim` | POST | Auth | Link authenticated user to unclaimed order |
| `/api/users/[id]/reseller-license/upload` | POST | Auth (self or admin) | Upload to Cloudinary, save URL to user |

---

## 9. Files

| File | Action | Purpose |
|---|---|---|
| `src/app/api/users/guest/route.ts` | **Fix** | Remove auth requirement — must be public |
| `src/app/api/orders/[id]/claim/route.ts` | Create | POST — link userId to order |
| `src/app/api/users/[id]/reseller-license/upload/route.ts` | Create | POST — upload to Cloudinary, save URL |
| `src/app/api/orders/route.ts` | Modify | Add `taxDeferralRequested` to POST handler |
| `src/app/quote-builder/components/QuoteBuilder-ClaimModal.tsx` | Create | Shared auth/guest capture modal (3 tabs) |
| `src/app/account/page.tsx` | **Rebuild** | Currently a placeholder — full implementation |
| `src/app/account/Account.tsx` | Create | Customer orders container |
| `src/app/account/components/Account-OrderList.tsx` | Create | Order rows with state-aware links |
| `src/app/account/components/Account-ResellerLicense.tsx` | Create | License upload section |
| `src/app/orders/[token]/page.tsx` | Modify | Wire Due Now button to ClaimModal |
| `src/app/get-quote/GetQuote.tsx` | Modify | Wire submit to ClaimModal when unauthenticated |
| `src/app/get-quote/components/GetQuote-Form.tsx` | Modify | Remove shipping address inputs, add `taxDeferralRequested` to POST body |
| `src/app/quote-builder/QuoteBuilder.tsx` | Modify | Wire anonymous Save to ClaimModal |
| `src/components/shared/layout/Navbar-AccountPanel.tsx` | Modify | Add "Continue as Guest" option for unauthenticated users |
| `src/app/dashboard/components/views/Dashboard-SettingsView.tsx` | Modify | Add Line Item Presets + Employee Permissions sections |
| `src/app/dashboard/components/views/Dashboard-SettingsView-LineItemPresets.tsx` | Create | Line Item Presets CRUD table |
| `src/lib/auth.ts` | Modify | Add guest credentials provider (email-only sign in for role='guest') |
| `prisma/schema.prisma` | Modify | Add `Order.taxDeferralRequested` + `User.resellerLicenseUrl` + `User.resellerLicenseUploadedAt` |
| `prisma/seed.ts` | Modify | Seed employee permission defaults in `UniversalSettings` |
| `.env.example` | Modify | Add `CLOUDINARY_URL` |

---

## 10. Key Decisions

| Decision | Rationale |
|---|---|
| Guest users get a real `User` row with `role='guest'` | Enables order history, account upgrade, and session persistence |
| Guest sign-in via email only (no password) | Guest `password` is null; auth guard checks `role === 'guest'` to allow passwordless sign-in |
| Auth capture modal is shared | Same component fires from 4 triggers — one implementation, zero duplication |
| "Continue as Guest" in account dropdown | Lets customers establish identity before the Get Quote form |
| Guest upgrade via password set | Converts guest to full user, preserves order history |
| Employee permissions use `"none"\|"view"\|"edit"` strings | Single value encodes visibility + editability — self-documenting as a dropdown label |
| Employee permission settings stored in `UniversalSettings` | Reuses existing generic key/value table; no schema migration needed |
| Reseller license: Cloudinary | `resource_type: 'auto'` handles PDF + PNG + JPG in one call; proven pattern from OWA; one env var (`CLOUDINARY_URL`) |
| Shipping address fields removed from Get Quote | Multi-address management on user accounts is its own spec; address inputs were built but never persisted |
| Order duplication deferred | Complex feature; Plan 4 already large |

---

## 11. Required Schema Changes

### `Order` additions

| Field | Type | Default | Notes |
|---|---|---|---|
| `taxDeferralRequested` | `Boolean` | `false` | UI toggle already in GetQuote form; was not persisted — fix in Plan 4 |

### `User` additions

| Field | Type | Notes |
|---|---|---|
| `resellerLicenseUrl` | `String?` | Cloudinary secure_url; null means no license on file |
| `resellerLicenseUploadedAt` | `DateTime?` | Timestamp of most recent upload |

---

## 12. Environment Variables

Add to `.env.example` and provision before Plan 4 implementation:

```
CLOUDINARY_URL=           # Required for reseller license uploads
```

---

## 13. Resolved Decisions (from review session)

| Question | Decision |
|---|---|
| Three-tab modal UX | Keep — Sign In / Register / Continue as Guest |
| File storage | Cloudinary (`resource_type: 'auto'`, same as OWA) |
| Shipping address | Defer to separate spec; remove address inputs from Get Quote form |
| Order duplication | Later plan |
| Line Item Presets sort UI | Manual sort number input — same as existing Setup Fee Presets table |
| Reseller license upload size limit | 10 MB (matching OWA) |
| Account page pagination | No pagination in Plan 4 |
