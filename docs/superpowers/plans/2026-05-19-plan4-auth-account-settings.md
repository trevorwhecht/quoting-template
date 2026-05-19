# Plan 4 — Auth/Guest Capture, Account Page & Settings Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire up guest auth capture across the app, build the /account page with reseller license upload, and add employee permissions management to Settings.

**Architecture:** A shared `ClaimModal` component handles all auth/guest capture triggers (quote builder save, Due Now, Get Quote submit, navbar). A guest NextAuth credentials provider enables passwordless guest sessions. Employee permissions are stored in `UniversalSettings`, enforced server-side in `stripAdminFields()`, and configurable in the Settings view.

**Tech Stack:** Next.js App Router · Prisma · NextAuth v4 · Tailwind 4 · shadcn/ui · Cloudinary · next-auth/react

**Deferred from this plan:** Line Item Presets management UI (stub table — admins edit via DB or future plan), Stripe payment integration, multi-address user accounts, order duplication.

---

## File Map

| File | Action | Task |
|---|---|---|
| `prisma/schema.prisma` | Modify — add 3 fields | 1 |
| `prisma/seed.ts` | Modify — seed employee permission defaults | 2 |
| `src/app/api/users/guest/route.ts` | Fix — remove auth requirement | 2 |
| `src/lib/auth.ts` | Modify — add guest credentials provider | 3 |
| `src/app/(auth)/register/Register.tsx` | Modify — handle `?claimToken=` param | 3 |
| `src/app/api/orders/[id]/claim/route.ts` | Create — POST claim route | 4 |
| `src/components/shared/modals/ClaimModal.tsx` | Create — shared auth/guest modal | 5 |
| `src/components/shared/layout/Navbar-AccountPanel.tsx` | Modify — add Continue as Guest | 6 |
| `src/app/orders/[token]/Orders-ActionButtons.tsx` | Modify — wire Due Now to ClaimModal | 7 |
| `src/app/orders/[token]/page.tsx` | Modify — pass orderId to ActionButtons | 7 |
| `src/app/get-quote/components/GetQuote-Form.tsx` | Modify — fixes + ClaimModal wiring | 8 |
| `src/app/quote-builder/QuoteBuilder.tsx` | Modify — wire anonymous save to ClaimModal | 9 |
| `src/app/account/page.tsx` | Rebuild — full implementation | 10 |
| `src/app/account/Account.tsx` | Create — container | 10 |
| `src/app/account/components/Account-OrderList.tsx` | Create — order rows | 10 |
| `src/app/api/users/[id]/reseller-license/upload/route.ts` | Create — Cloudinary upload | 11 |
| `src/app/account/components/Account-ResellerLicense.tsx` | Create — upload section | 11 |
| `src/app/dashboard/components/views/Dashboard-SettingsView.tsx` | Modify — add employee permissions section | 12 |
| `src/services/orderService.ts` | Modify — make `stripAdminFields` settings-aware | 13 |
| `src/app/quote-builder/quoteBuilderPermissions.ts` | Modify — accept `employeePermissions` | 13 |
| `src/app/quote-builder/quoteBuilderPermissions.test.ts` | Modify — cover new permission paths | 13 |
| `src/app/quote-builder/page.tsx` | Modify — fetch + pass employee permissions | 13 |
| `src/app/quote-builder/QuoteBuilder.tsx` | Modify — accept + thread `employeePermissions` | 13 |
| `src/app/api/orders/[id]/route.ts` | Modify — pass settings to stripAdminFields | 13 |
| `src/app/api/orders/by-token/[token]/route.ts` | Modify — pass settings to stripAdminFields | 13 |
| `.env.example` | Modify — add CLOUDINARY_URL | 11 |

---

## Task 1: Schema Migration

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Add three new fields to schema**

Find the `Order` model and add `taxDeferralRequested`. Find the `User` model and add two reseller license fields.

In `prisma/schema.prisma`, add to the `Order` model (after `needsShipping`):
```prisma
taxDeferralRequested Boolean  @default(false)
```

Add to the `User` model (after `companyName` or any existing optional field):
```prisma
resellerLicenseUrl        String?
resellerLicenseUploadedAt DateTime?
```

- [ ] **Step 2: Run migration**

```bash
npx prisma migrate dev --name plan4-auth-account
```

Expected: migration file created, DB updated, no errors.

- [ ] **Step 3: TypeScript check**

```bash
npx tsc --noEmit
```

Expected: zero errors.

---

## Task 2: Seed Employee Permissions + Fix Guest Route

**Files:**
- Modify: `prisma/seed.ts`
- Modify: `src/app/api/users/guest/route.ts`

- [ ] **Step 1: Add employee permission seed defaults to seed.ts**

In `prisma/seed.ts`, add after the existing `UniversalSettings` upserts (taxRate, businessName, etc.):

```ts
const employeePermissionDefaults = [
  { setting: "employeeLineItemPriceAccess", value: "view" },
  { setting: "employeeLineItemCostAccess", value: "none" },
  { setting: "employeeSetupCostAccess", value: "edit" },
]

for (const p of employeePermissionDefaults) {
  await prisma.universalSettings.upsert({
    where: { setting: p.setting },
    update: {},
    create: p,
  })
}
```

- [ ] **Step 2: Fix /api/users/guest — remove auth requirement**

Replace the entire contents of `src/app/api/users/guest/route.ts` with:

```ts
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function POST(req: Request) {
  const body = await req.json()
  const { firstName, lastName, email, phone, company } = body

  if (!firstName?.trim() || !lastName?.trim()) {
    return NextResponse.json({ data: null, error: "First and last name are required" }, { status: 400 })
  }
  if (!phone?.trim()) {
    return NextResponse.json({ data: null, error: "Phone is required" }, { status: 400 })
  }

  const resolvedEmail = email?.trim() || `guest-${crypto.randomUUID()}@guest.local`

  try {
    const user = await prisma.user.create({
      data: {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: resolvedEmail,
        phone: phone.trim(),
        companyName: company?.trim() || null,
        role: "guest",
      },
      select: { id: true, firstName: true, lastName: true, email: true, role: true },
    })
    return NextResponse.json({ data: user, error: null }, { status: 201 })
  } catch (e: any) {
    if (e?.code === "P2002") {
      return NextResponse.json({ data: null, error: "Email already in use" }, { status: 409 })
    }
    return NextResponse.json({ data: null, error: "Failed to create guest user" }, { status: 500 })
  }
}
```

- [ ] **Step 3: Run seed to verify**

```bash
npx prisma db seed
```

Expected: seed runs without errors, three new UniversalSettings rows present.

---

## Task 3: Guest Auth Provider + Register claimToken

**Files:**
- Modify: `src/lib/auth.ts`
- Modify: `src/app/(auth)/register/Register.tsx`

- [ ] **Step 1: Add guest credentials provider to auth.ts**

In `src/lib/auth.ts`, add a second provider inside the `providers` array, after the existing `CredentialsProvider`:

```ts
CredentialsProvider({
  id: "guest",
  name: "guest",
  credentials: {
    email: { label: "Email", type: "email" },
  },
  async authorize(credentials) {
    if (!credentials?.email) return null
    try {
      const user = await prisma.user.findUnique({
        where: { email: credentials.email },
        select: { id: true, email: true, firstName: true, lastName: true, role: true },
      })
      if (!user || user.role !== "guest") return null
      return {
        id: user.id,
        email: user.email,
        name: `${user.firstName} ${user.lastName}`,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
      }
    } catch {
      return null
    }
  },
}),
```

- [ ] **Step 2: Handle claimToken in Register.tsx**

In `src/app/(auth)/register/Register.tsx`, update the import line to add `useSearchParams`:

```ts
import { useRouter, useSearchParams } from "next/navigation"
```

Inside the `Register` component body, after the existing state declarations, add:

```ts
const searchParams = useSearchParams()
const claimToken = searchParams.get("claimToken")
```

Inside `handleSubmit`, after the successful `signIn("credentials", ...)` call (just before `router.push("/account")`), add:

```ts
if (claimToken) {
  await fetch(`/api/orders/${claimToken}/claim`, { method: "POST" })
}
```

The final block of `handleSubmit` becomes:

```ts
const result = await signIn("credentials", {
  email: form.get("email") as string,
  password: form.get("password") as string,
  redirect: false,
})

if (result?.error) {
  setError("Account created but sign-in failed — please sign in manually.")
  router.push("/login")
  return
}

if (claimToken) {
  await fetch(`/api/orders/${claimToken}/claim`, { method: "POST" })
}

router.push("/account")
router.refresh()
```

- [ ] **Step 3: TypeScript check**

```bash
npx tsc --noEmit
```

Expected: zero errors.

---

## Task 4: POST /api/orders/[id]/claim Route

**Files:**
- Create: `src/app/api/orders/[id]/claim/route.ts`

- [ ] **Step 1: Create the claim route**

Create `src/app/api/orders/[id]/claim/route.ts`:

```ts
import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ data: null, error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  const orderId = parseInt(id, 10)
  if (isNaN(orderId)) return NextResponse.json({ data: null, error: "Invalid order ID" }, { status: 400 })

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: { id: true, userId: true },
  })

  if (!order) return NextResponse.json({ data: null, error: "Order not found" }, { status: 404 })
  if (order.userId) return NextResponse.json({ data: null, error: "Order already claimed" }, { status: 409 })

  await prisma.order.update({
    where: { id: orderId },
    data: { userId: session.user.id },
  })

  return NextResponse.json({ data: { claimed: true }, error: null })
}
```

- [ ] **Step 2: TypeScript check**

```bash
npx tsc --noEmit
```

Expected: zero errors.

---

## Task 5: ClaimModal Shared Component

**Files:**
- Create: `src/components/shared/modals/ClaimModal.tsx`

- [ ] **Step 1: Create the modals directory and ClaimModal**

Create `src/components/shared/modals/ClaimModal.tsx`:

```tsx
"use client"

import { useState, useTransition } from "react"
import { signIn } from "next-auth/react"
import { useRouter } from "next/navigation"
import { Loader2 } from "lucide-react"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"

type Tab = "signin" | "register" | "guest"

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  orderId?: number
  redirectPath?: string
  onSuccess?: () => void
}

const EMPTY_GUEST = { firstName: "", lastName: "", email: "", phone: "", company: "" }

export default function ClaimModal({ open, onOpenChange, orderId, redirectPath, onSuccess }: Props) {
  const router = useRouter()
  const [tab, setTab] = useState<Tab>("signin")
  const [isPending, startTransition] = useTransition()
  const [guest, setGuest] = useState(EMPTY_GUEST)

  function handleOpenChange(next: boolean) {
    if (!next) setGuest(EMPTY_GUEST)
    onOpenChange(next)
  }

  function handleGuestSubmit(e: React.FormEvent) {
    e.preventDefault()
    startTransition(async () => {
      const createRes = await fetch("/api/users/guest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(guest),
      })
      const createJson = await createRes.json()
      if (createJson.error) { toast.error(createJson.error); return }

      const signInResult = await signIn("guest", { email: guest.email, redirect: false })
      if (signInResult?.error) { toast.error("Sign-in failed — try again."); return }

      if (orderId) {
        await fetch(`/api/orders/${orderId}/claim`, { method: "POST" })
      }

      handleOpenChange(false)
      router.refresh()
      onSuccess?.()
    })
  }

  const signInHref = `/login?redirect=${encodeURIComponent(redirectPath ?? "/")}`
  const registerHref = `/register${orderId ? `?claimToken=${orderId}` : ""}`

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="bg-(--color-background) sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Sign in to continue</DialogTitle>
        </DialogHeader>

        {/* Tab bar */}
        <div className="flex gap-1 rounded-lg border border-(--color-border) p-1">
          {(["signin", "register", "guest"] as Tab[]).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={`flex-1 rounded-md py-1.5 text-sm transition-colors ${
                tab === t
                  ? "bg-(--color-primary) text-(--color-primary-foreground)"
                  : "text-(--color-muted) hover:text-(--color-foreground)"
              }`}
            >
              {t === "signin" ? "Sign In" : t === "register" ? "Register" : "Guest"}
            </button>
          ))}
        </div>

        {tab === "signin" ? (
          <div className="space-y-3 py-2 text-center">
            <p className="text-sm text-(--color-muted)">Sign in to your existing account to continue.</p>
            <Button asChild className="w-full">
              <a href={signInHref}>Go to Sign In</a>
            </Button>
          </div>
        ) : tab === "register" ? (
          <div className="space-y-3 py-2 text-center">
            <p className="text-sm text-(--color-muted)">Create a new account to save your order and access it later.</p>
            <Button asChild className="w-full">
              <a href={registerHref}>Create Account</a>
            </Button>
          </div>
        ) : (
          <form onSubmit={handleGuestSubmit} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>First Name *</Label>
                <Input
                  value={guest.firstName}
                  onChange={(e) => setGuest((g) => ({ ...g, firstName: e.target.value }))}
                  className="text-base"
                  autoComplete="given-name"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label>Last Name *</Label>
                <Input
                  value={guest.lastName}
                  onChange={(e) => setGuest((g) => ({ ...g, lastName: e.target.value }))}
                  className="text-base"
                  autoComplete="family-name"
                  required
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Email *</Label>
              <Input
                type="email"
                inputMode="email"
                autoComplete="email"
                value={guest.email}
                onChange={(e) => setGuest((g) => ({ ...g, email: e.target.value }))}
                className="text-base"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label>Phone *</Label>
              <Input
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                value={guest.phone}
                onChange={(e) => setGuest((g) => ({ ...g, phone: e.target.value }))}
                className="text-base"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label>
                Company{" "}
                <span className="font-normal text-(--color-muted)">(optional)</span>
              </Label>
              <Input
                autoComplete="organization"
                value={guest.company}
                onChange={(e) => setGuest((g) => ({ ...g, company: e.target.value }))}
                className="text-base"
              />
            </div>
            <Button type="submit" disabled={isPending} className="w-full gap-2">
              {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {isPending ? "Continuing…" : "Continue as Guest"}
            </Button>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}
```

- [ ] **Step 2: Use dynamic import in every consumer of ClaimModal**

`ClaimModal` is a heavy dialog (~5 imports, `signIn`, router) that is only ever shown on user interaction, never on initial paint. Load it lazily so it stays out of the initial JS bundle (bundle-dynamic-imports).

In every file that imports `ClaimModal` (Tasks 6–9), use `next/dynamic` instead of a static import:

```ts
// Replace:
//   import ClaimModal from "@/components/shared/modals/ClaimModal"
// With:
import dynamic from "next/dynamic"
const ClaimModal = dynamic(() => import("@/components/shared/modals/ClaimModal"))
```

Files that need this change:
- `src/components/shared/layout/Navbar-AccountPanel.tsx` (Task 6)
- `src/app/orders/[token]/Orders-ActionButtons.tsx` (Task 7)
- `src/app/get-quote/components/GetQuote-Form.tsx` (Task 8)
- `src/app/quote-builder/QuoteBuilder.tsx` (Task 9)

Add the `dynamic` import and remove the static `import ClaimModal` line in each of those tasks below.

- [ ] **Step 3: TypeScript check**

```bash
npx tsc --noEmit
```

Expected: zero errors.

---

## Task 6: Navbar "Continue as Guest"

**Files:**
- Modify: `src/components/shared/layout/Navbar-AccountPanel.tsx`

- [ ] **Step 1: Add ClaimModal dynamic import and state**

In `Navbar-AccountPanel.tsx`, add to imports (use dynamic import per Task 5 Step 2):
```ts
import dynamic from "next/dynamic"
const ClaimModal = dynamic(() => import("@/components/shared/modals/ClaimModal"))
```

Add to the component's state declarations (after `isPending`):
```ts
const [showGuestModal, setShowGuestModal] = useState(false)
```

- [ ] **Step 2: Add Continue as Guest button to the sign-in view**

In the sign-in view (the `else` branch at the bottom, inside `<div className="p-4">`), add a "Continue as Guest" button after the existing `<div className="flex justify-between items-center">` block:

```tsx
<div className="pt-1 border-t border-(--color-border) mt-3">
  <button
    type="button"
    onClick={() => { onClose(); setShowGuestModal(true) }}
    className="w-full py-2 text-sm text-(--color-muted) hover:text-(--color-foreground) transition-colors motion-reduce:transition-none touch-manipulation"
  >
    Continue as Guest
  </button>
</div>
```

- [ ] **Step 3: Render ClaimModal at the bottom of the component**

Add just before the closing `</div>` of the entire return:
```tsx
<ClaimModal
  open={showGuestModal}
  onOpenChange={setShowGuestModal}
  redirectPath="/"
/>
```

- [ ] **Step 4: TypeScript check**

```bash
npx tsc --noEmit
```

Expected: zero errors.

---

## Task 7: Wire Due Now to ClaimModal

**Files:**
- Modify: `src/app/orders/[token]/Orders-ActionButtons.tsx`
- Modify: `src/app/orders/[token]/page.tsx`

- [ ] **Step 1: Pass orderId from page.tsx to OrdersActionButtons**

In `src/app/orders/[token]/page.tsx`, update the `<OrdersActionButtons>` call:

```tsx
<OrdersActionButtons
  orderId={order.id}
  totalDueNow={Number(order.totalPrice)}
  showDueNow={showDueNow}
  shareUrl={shareUrl}
/>
```

- [ ] **Step 2: Rewrite Orders-ActionButtons to check auth before Due Now**

Replace the full contents of `src/app/orders/[token]/Orders-ActionButtons.tsx` with:

```tsx
"use client"

import { useState } from "react"
import dynamic from "next/dynamic"
import { Share2 } from "lucide-react"
import { useSession } from "next-auth/react"
import { Button } from "@/components/ui/button"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog"
import { toast } from "sonner"
const ClaimModal = dynamic(() => import("@/components/shared/modals/ClaimModal"))

type Props = {
  orderId: number
  totalDueNow: number
  showDueNow: boolean
  shareUrl: string
}

export default function OrdersActionButtons({ orderId, totalDueNow, showDueNow, shareUrl }: Props) {
  const { data: session } = useSession()
  const [dueNowOpen, setDueNowOpen] = useState(false)
  const [claimOpen, setClaimOpen] = useState(false)

  function handleDueNowClick() {
    if (!session) {
      setClaimOpen(true)
    } else {
      setDueNowOpen(true)
    }
  }

  function handleShare() {
    navigator.clipboard.writeText(shareUrl)
    toast.success("Link copied to clipboard")
  }

  return (
    <div className="flex items-center gap-2 shrink-0">
      {showDueNow ? (
        <>
          <Button onClick={handleDueNowClick}>
            Due Now ${totalDueNow.toFixed(2)}
          </Button>
          <Dialog open={dueNowOpen} onOpenChange={setDueNowOpen}>
            <DialogContent className="bg-(--color-background)">
              <DialogHeader>
                <DialogTitle>Payment Request Received</DialogTitle>
                <DialogDescription>
                  Thanks — our team will confirm your payment details and reach out shortly.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter className="pb-[max(1rem,env(safe-area-inset-bottom))]">
                <Button autoFocus onClick={() => setDueNowOpen(false)}>Got it</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          <ClaimModal
            open={claimOpen}
            onOpenChange={setClaimOpen}
            orderId={orderId}
            onSuccess={() => setDueNowOpen(true)}
          />
        </>
      ) : null}

      <Button variant="outline" size="icon" onClick={handleShare} aria-label="Share order link">
        <Share2 size={16} />
      </Button>
    </div>
  )
}
```

- [ ] **Step 3: TypeScript check**

```bash
npx tsc --noEmit
```

Expected: zero errors.

---

## Task 8: GetQuote-Form Fixes + ClaimModal Wiring

**Files:**
- Modify: `src/app/get-quote/components/GetQuote-Form.tsx`

Changes: (a) remove shipping address inputs, (b) add `taxDeferralRequested` to POST body, (c) add ClaimModal wiring for unauthenticated submit.

- [ ] **Step 1: Add session check and ClaimModal state**

In `GetQuote-Form.tsx`, add to imports (dynamic import per Task 5 Step 2):
```ts
import dynamic from "next/dynamic"
import { useSession } from "next-auth/react"
const ClaimModal = dynamic(() => import("@/components/shared/modals/ClaimModal"))
```

Inside the component body, after the `useTransition` line, add:
```ts
const { data: session } = useSession()
const [showClaimModal, setShowClaimModal] = useState(false)
```

- [ ] **Step 2: Remove shipping address state and inputs**

Remove these state declarations:
```ts
const [shippingAddress, setShippingAddress] = useState({ street: "", city: "", state: "", zip: "" })
```

Remove the entire shipping address reveal block inside the `needsShipping` toggle section — the block that renders `<Input>` fields for street/city/state/zip. Keep only the outer switch toggle and label:
```tsx
{/* Needs Shipping → reveal removed until multi-address spec */}
<div className="flex items-center gap-2">
  <Switch checked={needsShipping} onCheckedChange={(c) => setNeedsShipping(c)} id="needsShipping" />
  <Label htmlFor="needsShipping" className="cursor-pointer text-sm">Needs Shipping</Label>
</div>
```

- [ ] **Step 3: Extract submit logic into a callable function**

Replace the `handleSubmit` function with two functions:

```ts
async function doSubmit() {
  const res = await fetch("/api/orders", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      customerNotes: customerNotes || null,
      dueDate: dueDate || null,
      isHardDeadline,
      needsShipping,
      taxDeferralRequested,
      nickname: orderNickname || null,
      userId: isAdmin ? assignedUserId : undefined,
      lineItems: lineItems.map(({ description, qty, unitPrice, unitCost }) => ({ description, qty, unitPrice, unitCost })),
      setUpCosts: isStaff ? setupCosts.map(({ label, qty, rate, cost }) => ({ label, qty, rate, cost })) : undefined,
    }),
  })
  const json = await res.json()
  if (json.error) { toast.error(json.error); return }
  const order = json.data
  const label = order.nickname ?? `Order #${order.id}`
  router.push(`/orders/${order.token}?name=${encodeURIComponent(label)}`)
}

function handleSubmit(e: React.SyntheticEvent<HTMLFormElement>) {
  e.preventDefault()
  if (lineItems.length === 0) { toast.error("Please add at least one item."); return }
  if (isAdmin && lineItems.some((li) => li.isCustom && li.unitPrice <= 0)) {
    toast.error("Please enter a price for all custom items before saving.")
    return
  }
  if (!session) {
    setShowClaimModal(true)
    return
  }
  startTransition(doSubmit)
}
```

- [ ] **Step 4: Add ClaimModal to the form's JSX**

Just before the closing `</div>` of the form container (`className="px-4 md:px-6 py-8 space-y-6"`), add:

```tsx
<ClaimModal
  open={showClaimModal}
  onOpenChange={setShowClaimModal}
  redirectPath="/get-quote"
  onSuccess={() => startTransition(doSubmit)}
/>
```

- [ ] **Step 5: Update POST /api/orders to persist taxDeferralRequested**

In `src/app/api/orders/route.ts`, in the `POST` handler, destructure `taxDeferralRequested` from body:

```ts
const { customerNotes, notes, dueDate, isHardDeadline, needsShipping, taxDeferralRequested, lineItems = [] } = body
```

Add `taxDeferralRequested` to the `prisma.order.create` data object:
```ts
taxDeferralRequested: taxDeferralRequested ?? false,
```

- [ ] **Step 6: TypeScript check**

```bash
npx tsc --noEmit
```

Expected: zero errors.

---

## Task 9: Quote Builder Anonymous Save Wiring

**Files:**
- Modify: `src/app/quote-builder/QuoteBuilder.tsx`

- [ ] **Step 1: Add ClaimModal dynamic import and state**

In `QuoteBuilder.tsx`, add to imports (dynamic import per Task 5 Step 2):
```ts
import dynamic from "next/dynamic"
const ClaimModal = dynamic(() => import("@/components/shared/modals/ClaimModal"))
```

Add after the existing `useState` declarations:
```ts
const [showClaimModal, setShowClaimModal] = useState(false)
```

- [ ] **Step 2: Replace the "Sign In to Save" button with ClaimModal**

Find this block in the render:
```tsx
{permissions.saveAction === "login" ? (
  <Button className="w-full" onClick={() => router.push("/login")}>
    Sign In to Save
  </Button>
) : (
```

Replace with:
```tsx
{permissions.saveAction === "login" ? (
  <>
    <Button className="w-full" onClick={() => setShowClaimModal(true)}>
      Sign In to Save
    </Button>
    <ClaimModal
      open={showClaimModal}
      onOpenChange={setShowClaimModal}
      orderId={order?.id}
      redirectPath={token ? `/quote-builder?token=${token}` : "/quote-builder"}
      onSuccess={() => startTransition(executeSave)}
    />
  </>
) : (
```

- [ ] **Step 3: TypeScript check**

```bash
npx tsc --noEmit
```

Expected: zero errors.

---

## Task 10: Account Page

**Files:**
- Rebuild: `src/app/account/page.tsx`
- Create: `src/app/account/Account.tsx`
- Create: `src/app/account/components/Account-OrderList.tsx`

- [ ] **Step 1: Rebuild account/page.tsx as a server component**

Replace the entire contents of `src/app/account/page.tsx` with:

```tsx
import { redirect } from "next/navigation"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import Account from "./Account"

export default async function AccountPage() {
  const session = await getServerSession(authOptions)
  if (!session) redirect("/login?redirect=/account")

  // Parallel fetch — orders and user are independent queries (async-parallel)
  const [orders, user] = await Promise.all([
    prisma.order.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        token: true,
        nickname: true,
        totalPrice: true,
        dueDate: true,
        stateId: true,
        state: { select: { name: true, color: true } },
      },
    }),
    prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        role: true,
        resellerLicenseUrl: true,
        resellerLicenseUploadedAt: true,
      },
    }),
  ])

  if (!user) redirect("/login")

  return <Account user={user} orders={orders} />
}
```

- [ ] **Step 2: Create Account.tsx container**

Create `src/app/account/Account.tsx`:

```tsx
"use client"

import { useState, useTransition } from "react"
import { Loader2 } from "lucide-react"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"
import AccountOrderList from "./components/Account-OrderList"
import AccountResellerLicense from "./components/Account-ResellerLicense"

type Order = {
  id: number
  token: string
  nickname: string | null
  totalPrice: any
  dueDate: Date | null
  stateId: number
  state: { name: string; color: string | null }
}

type User = {
  id: string
  firstName: string
  lastName: string
  role: string
  resellerLicenseUrl: string | null
  resellerLicenseUploadedAt: Date | null
}

type Props = { user: User; orders: Order[] }

export default function Account({ user, orders }: Props) {
  const isGuest = user.role === "guest"
  const [showPasswordDialog, setShowPasswordDialog] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [pwError, setPwError] = useState<string | null>(null)

  function handleSetPassword(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setPwError(null)
    const form = new FormData(e.currentTarget)
    const password = form.get("password") as string
    const confirm = form.get("confirm") as string
    if (password !== confirm) { setPwError("Passwords do not match."); return }
    if (password.length < 8) { setPwError("Password must be at least 8 characters."); return }

    startTransition(async () => {
      const res = await fetch(`/api/users/${user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      })
      const json = await res.json()
      if (json.error) { setPwError(json.error); return }
      toast.success("Password set — you now have a full account.")
      setShowPasswordDialog(false)
    })
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-(--color-foreground)">My Orders</h1>
        <p className="text-sm text-(--color-muted) mt-0.5">{user.firstName} {user.lastName}</p>
      </div>

      {isGuest ? (
        <div className="rounded-lg border border-(--color-border) bg-(--color-surface) px-4 py-3 flex items-center justify-between gap-3">
          <p className="text-sm text-(--color-muted)">
            You&rsquo;re browsing as a guest — set a password to secure your account.
          </p>
          <Button size="sm" variant="outline" onClick={() => setShowPasswordDialog(true)}>
            Set Password
          </Button>
        </div>
      ) : null}

      <AccountOrderList orders={orders} />

      <AccountResellerLicense
        userId={user.id}
        licenseUrl={user.resellerLicenseUrl}
        uploadedAt={user.resellerLicenseUploadedAt}
      />

      <Dialog open={showPasswordDialog} onOpenChange={setShowPasswordDialog}>
        <DialogContent className="bg-(--color-background)">
          <DialogHeader>
            <DialogTitle>Set a Password</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSetPassword} className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="account-pw">New Password</Label>
              <Input id="account-pw" name="password" type="password" autoComplete="new-password" required minLength={8} className="text-base" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="account-pw-confirm">Confirm Password</Label>
              <Input id="account-pw-confirm" name="confirm" type="password" autoComplete="new-password" required className="text-base" />
            </div>
            {pwError ? <p className="text-sm text-(--color-danger)" role="alert">{pwError}</p> : null}
            <DialogFooter className="pb-[max(1rem,env(safe-area-inset-bottom))]">
              <Button variant="outline" type="button" onClick={() => setShowPasswordDialog(false)}>Cancel</Button>
              <Button autoFocus type="submit" disabled={isPending} className="gap-2">
                {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {isPending ? "Saving…" : "Set Password"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
```

- [ ] **Step 3: Create Account-OrderList.tsx**

Create `src/app/account/components/Account-OrderList.tsx`:

```tsx
import Link from "next/link"
import { Badge } from "@/components/ui/badge"
import { format } from "date-fns"

type Order = {
  id: number
  token: string
  nickname: string | null
  totalPrice: any
  dueDate: Date | null
  stateId: number
  state: { name: string; color: string | null }
}

export default function AccountOrderList({ orders }: { orders: Order[] }) {
  if (orders.length === 0) {
    return (
      <div className="rounded-lg border border-(--color-border) px-4 py-10 text-center text-sm text-(--color-muted)">
        No orders yet.
      </div>
    )
  }

  return (
    <div className="rounded-lg border border-(--color-border) overflow-hidden">
      <table className="w-full text-sm min-w-[500px]">
        <thead>
          <tr className="border-b border-(--color-border) bg-(--color-surface)">
            <th className="text-left px-4 py-2.5 font-medium text-(--color-muted)">Order</th>
            <th className="text-left px-4 py-2.5 font-medium text-(--color-muted)">Status</th>
            <th className="text-right px-4 py-2.5 font-medium text-(--color-muted)">Total</th>
            <th className="text-right px-4 py-2.5 font-medium text-(--color-muted)">Due</th>
          </tr>
        </thead>
        <tbody>
          {orders.map((order) => {
            const label = order.nickname ?? `Order #${order.id}`
            const href = order.stateId <= 2
              ? `/quote-builder?orderId=${order.id}`
              : `/orders/${order.token}`
            return (
              <tr key={order.id} className="border-b border-(--color-border) last:border-0 hover:bg-(--color-surface) transition-colors">
                <td className="px-4 py-3">
                  <Link href={href} className="font-medium text-(--color-foreground) hover:text-(--color-primary) transition-colors">
                    {label}
                  </Link>
                </td>
                <td className="px-4 py-3">
                  <Badge
                    variant="outline"
                    style={{ borderColor: order.state.color ?? undefined, color: order.state.color ?? undefined }}
                  >
                    {order.state.name}
                  </Badge>
                </td>
                <td className="px-4 py-3 text-right font-medium">${Number(order.totalPrice).toFixed(2)}</td>
                <td className="px-4 py-3 text-right text-(--color-muted)">
                  {order.dueDate ? format(new Date(order.dueDate), "MMM d") : "—"}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
```

- [ ] **Step 4: TypeScript check**

```bash
npx tsc --noEmit
```

Expected: zero errors.

---

## Task 11: Reseller License Upload

**Files:**
- Create: `src/app/api/users/[id]/reseller-license/upload/route.ts`
- Create: `src/app/account/components/Account-ResellerLicense.tsx`
- Modify: `.env.example`

- [ ] **Step 1: Install Cloudinary if not present**

```bash
npm list cloudinary 2>/dev/null | grep cloudinary || npm install cloudinary
```

Expected: cloudinary is installed.

- [ ] **Step 2: Add CLOUDINARY_URL to .env.example**

In `.env.example`, add:
```
CLOUDINARY_URL=           # Required for reseller license uploads (cloudinary://api_key:api_secret@cloud_name)
```

- [ ] **Step 3: Create the upload API route**

Create `src/app/api/users/[id]/reseller-license/upload/route.ts`:

```ts
import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"

const ALLOWED_TYPES = ["application/pdf", "image/png", "image/jpeg"]
const MAX_BYTES = 10 * 1024 * 1024

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ data: null, error: "Unauthorized" }, { status: 401 })

  const { id: userId } = await params
  const isAdmin = session.user.role === "admin"
  if (userId !== session.user.id && !isAdmin) {
    return NextResponse.json({ data: null, error: "Forbidden" }, { status: 403 })
  }

  const formData = await req.formData()
  const file = formData.get("file") as File | null
  if (!file) return NextResponse.json({ data: null, error: "No file provided" }, { status: 400 })
  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json({ data: null, error: "Invalid file type. Upload PDF, PNG, or JPG." }, { status: 400 })
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ data: null, error: "File too large (max 10 MB)." }, { status: 400 })
  }

  if (!process.env.CLOUDINARY_URL) {
    return NextResponse.json({ data: null, error: "File storage not configured." }, { status: 500 })
  }

  const cloudinary = (await import("cloudinary")).v2
  const buffer = Buffer.from(await file.arrayBuffer())

  const uploadResult = await new Promise<any>((resolve, reject) => {
    cloudinary.uploader.upload_stream(
      { resource_type: "auto", folder: "reseller-licenses", public_id: `${userId}-${Date.now()}` },
      (err, result) => { if (err) reject(err); else resolve(result) }
    ).end(buffer)
  })

  const user = await prisma.user.update({
    where: { id: userId },
    data: {
      resellerLicenseUrl: uploadResult.secure_url,
      resellerLicenseUploadedAt: new Date(),
    },
    select: { resellerLicenseUrl: true, resellerLicenseUploadedAt: true },
  })

  return NextResponse.json({ data: user, error: null })
}
```

- [ ] **Step 4: Create Account-ResellerLicense.tsx**

Create `src/app/account/components/Account-ResellerLicense.tsx`:

```tsx
"use client"

import { useRef, useTransition } from "react"
import { Loader2, FileText } from "lucide-react"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import { useRouter } from "next/navigation"
import { format } from "date-fns"

type Props = {
  userId: string
  licenseUrl: string | null
  uploadedAt: Date | null
}

export default function AccountResellerLicense({ userId, licenseUrl, uploadedAt }: Props) {
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const [isPending, startTransition] = useTransition()

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    startTransition(async () => {
      const formData = new FormData()
      formData.append("file", file)

      const res = await fetch(`/api/users/${userId}/reseller-license/upload`, {
        method: "POST",
        body: formData,
      })
      const json = await res.json()
      if (json.error) { toast.error(json.error); return }
      toast.success("License uploaded.")
      router.refresh()
    })
  }

  return (
    <div className="space-y-3">
      <h2 className="text-base font-semibold text-(--color-foreground)">Tax Exemption / Reseller License</h2>
      <div className="rounded-lg border border-(--color-border) p-4 flex items-center justify-between gap-4 bg-(--color-background)">
        {licenseUrl ? (
          <div className="flex items-center gap-2 text-sm">
            <FileText size={16} className="text-(--color-muted)" />
            <a
              href={licenseUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-(--color-primary) hover:underline"
            >
              View License
            </a>
            {uploadedAt ? (
              <span className="text-(--color-muted)">
                (uploaded {format(new Date(uploadedAt), "MMM d, yyyy")})
              </span>
            ) : null}
          </div>
        ) : (
          <p className="text-sm text-(--color-muted)">
            Upload a reseller license or tax exemption certificate to apply for tax deferral.
          </p>
        )}
        <div>
          <input
            ref={inputRef}
            type="file"
            accept=".pdf,.png,.jpg,.jpeg"
            className="hidden"
            onChange={handleFile}
          />
          <Button
            variant="outline"
            size="sm"
            disabled={isPending}
            onClick={() => inputRef.current?.click()}
            className="gap-2 shrink-0"
          >
            {isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
            {licenseUrl ? "Replace" : "Upload"}
          </Button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 5: TypeScript check**

```bash
npx tsc --noEmit
```

Expected: zero errors.

---

## Task 12: Employee Permissions — Settings UI

**Files:**
- Modify: `src/app/dashboard/components/views/Dashboard-SettingsView.tsx`

- [ ] **Step 1: Add employee permissions section to Dashboard-SettingsView.tsx**

Replace the full contents of `src/app/dashboard/components/views/Dashboard-SettingsView.tsx` with:

```tsx
"use client"

import { useEffect, useState, useTransition } from "react"
import { toast } from "sonner"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import DashboardSettingsViewSetupFeePresets from "./Dashboard-SettingsView-SetupFeePresets"

type Access = "none" | "view" | "edit"

const ACCESS_KEYS = [
  { key: "employeeLineItemPriceAccess", label: "Line Item Price", description: "Whether employees can see / edit the unit price on order line items" },
  { key: "employeeLineItemCostAccess", label: "Line Item Cost", description: "Whether employees can see / edit the unit cost on order line items" },
  { key: "employeeSetupCostAccess", label: "Setup Cost (Cost Column)", description: "Whether employees can see / edit the internal cost on setup cost rows" },
] as const

export default function DashboardSettingsView() {
  const [permissions, setPermissions] = useState<Record<string, Access>>({
    employeeLineItemPriceAccess: "view",
    employeeLineItemCostAccess: "none",
    employeeSetupCostAccess: "edit",
  })
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then(({ data }) => {
        if (!data) return
        // Functional update avoids stale closure on `permissions` (rerender-functional-setstate)
        setPermissions((prev) => {
          const next = { ...prev }
          for (const item of data) {
            if (item.setting in next) next[item.setting] = item.value as Access
          }
          return next
        })
      })
  }, [])

  function handleAccessChange(key: string, value: Access) {
    setPermissions((prev) => ({ ...prev, [key]: value }))
    startTransition(async () => {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ setting: key, value }),
      })
      const json = await res.json()
      if (json.error) toast.error(json.error)
    })
  }

  return (
    <div className="p-6 max-w-4xl space-y-10">
      <h2 className="text-xl font-semibold text-(--color-foreground)">Settings</h2>
      <DashboardSettingsViewSetupFeePresets />

      <div className="space-y-4">
        <div>
          <h3 className="text-base font-semibold text-(--color-foreground)">Employee Permissions</h3>
          <p className="text-sm text-(--color-muted) mt-0.5">Control what employees can see and edit in the quote builder.</p>
        </div>
        <div className="rounded-lg border border-(--color-border) overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-(--color-border) bg-(--color-surface)">
                <th className="text-left px-4 py-2.5 font-medium text-(--color-muted)">Field</th>
                <th className="text-left px-4 py-2.5 font-medium text-(--color-muted)">Description</th>
                <th className="text-left px-4 py-2.5 font-medium text-(--color-muted) w-36">Access</th>
              </tr>
            </thead>
            <tbody>
              {ACCESS_KEYS.map(({ key, label, description }) => (
                <tr key={key} className="border-b border-(--color-border) last:border-0">
                  <td className="px-4 py-3 font-medium text-(--color-foreground) whitespace-nowrap">{label}</td>
                  <td className="px-4 py-3 text-(--color-muted) text-xs">{description}</td>
                  <td className="px-4 py-3">
                    <Select
                      value={permissions[key] ?? "none"}
                      onValueChange={(v) => handleAccessChange(key, v as Access)}
                      disabled={isPending}
                    >
                      <SelectTrigger className="w-28 text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-(--color-background)">
                        <SelectItem value="none">Hidden</SelectItem>
                        <SelectItem value="view">View Only</SelectItem>
                        <SelectItem value="edit">Editable</SelectItem>
                      </SelectContent>
                    </Select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-(--color-muted)">
          <strong>Hidden</strong> — field stripped from API response and not shown in UI. &nbsp;
          <strong>View Only</strong> — visible but read-only. &nbsp;
          <strong>Editable</strong> — fully editable.
        </p>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify /api/settings supports POST for upsert**

Check that `src/app/api/settings/route.ts` has a POST handler that upserts a single key/value pair. If it only has GET, add:

```bash
grep -n "POST\|export async" src/app/api/settings/route.ts
```

If POST is missing, add to `src/app/api/settings/route.ts`:

```ts
export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== "admin") {
    return NextResponse.json({ data: null, error: "Forbidden" }, { status: 403 })
  }
  const { setting, value } = await req.json()
  if (!setting || value === undefined) {
    return NextResponse.json({ data: null, error: "setting and value are required" }, { status: 400 })
  }
  const result = await prisma.universalSettings.upsert({
    where: { setting },
    update: { value: String(value) },
    create: { setting, value: String(value) },
  })
  return NextResponse.json({ data: result, error: null })
}
```

- [ ] **Step 3: TypeScript check**

```bash
npx tsc --noEmit
```

Expected: zero errors.

---

## Task 13: Employee Permissions — Server + QB Enforcement

**Files:**
- Modify: `src/services/orderService.ts`
- Modify: `src/app/quote-builder/quoteBuilderPermissions.ts`
- Modify: `src/app/quote-builder/quoteBuilderPermissions.test.ts`
- Modify: `src/app/quote-builder/page.tsx`
- Modify: `src/app/quote-builder/QuoteBuilder.tsx`
- Modify: `src/app/api/orders/[id]/route.ts`
- Modify: `src/app/api/orders/by-token/[token]/route.ts`

- [ ] **Step 1: Add EmployeeFieldPermissions type and update stripAdminFields in orderService.ts**

In `src/services/orderService.ts`, add the new type and update `stripAdminFields`:

```ts
export type EmployeeFieldPermissions = {
  lineItemPriceAccess: "none" | "view" | "edit"
  lineItemCostAccess: "none" | "view" | "edit"
  setupCostAccess: "none" | "view" | "edit"
}

export function stripAdminFields(order: any, perms?: EmployeeFieldPermissions): any {
  const hideCost = !perms || perms.lineItemCostAccess === "none"
  const hideSetupCost = !perms || perms.setupCostAccess === "none"
  const { cost, profit, totalSetUpCost, ...rest } = order
  return {
    ...rest,
    orderLineItems: rest.orderLineItems?.map((li: any) => {
      const { unitCost, ...liRest } = li
      return {
        ...liRest,
        ...(hideCost ? {} : { unitCost }),
        variants: li.variants?.map(({ cost: _c, ...v }: any) => v) ?? [],
      }
    }) ?? [],
    setUpCosts: rest.setUpCosts?.map((s: any) => {
      const { adminTotal, ...sRest } = s
      return hideSetupCost ? sRest : { ...sRest, adminTotal }
    }) ?? [],
  }
}
```

- [ ] **Step 2: Add a helper to fetch employee permissions from DB**

Add to `src/services/orderService.ts`:

```ts
import { prisma } from "@/lib/prisma"

export async function getEmployeeFieldPermissions(): Promise<EmployeeFieldPermissions> {
  const rows = await prisma.universalSettings.findMany({
    where: {
      setting: { in: ["employeeLineItemPriceAccess", "employeeLineItemCostAccess", "employeeSetupCostAccess"] },
    },
    select: { setting: true, value: true },
  })
  const map = Object.fromEntries(rows.map((r) => [r.setting, r.value]))
  return {
    lineItemPriceAccess: (map.employeeLineItemPriceAccess ?? "view") as EmployeeFieldPermissions["lineItemPriceAccess"],
    lineItemCostAccess: (map.employeeLineItemCostAccess ?? "none") as EmployeeFieldPermissions["lineItemCostAccess"],
    setupCostAccess: (map.employeeSetupCostAccess ?? "edit") as EmployeeFieldPermissions["setupCostAccess"],
  }
}
```

- [ ] **Step 3: Update /api/orders/[id]/route.ts to use settings-aware stripping**

In `src/app/api/orders/[id]/route.ts`, add to imports:
```ts
import { serializeOrder, stripAdminFields, computeOrderTotals, getEmployeeFieldPermissions } from "@/services/orderService"
```

For each place that calls `stripAdminFields(serialized)` for employees, replace with:
```ts
// GET handler (line ~29):
const perms = role === "employee" ? await getEmployeeFieldPermissions() : undefined
return NextResponse.json({ data: role === "employee" ? stripAdminFields(serialized, perms) : serialized, error: null })

// PATCH handler (line ~185):
const perms2 = role === "employee" ? await getEmployeeFieldPermissions() : undefined
return NextResponse.json({ data: role === "employee" ? stripAdminFields(serialized, perms2) : serialized, error: null })
```

- [ ] **Step 4: Update /api/orders/by-token/[token]/route.ts**

In `src/app/api/orders/by-token/[token]/route.ts`, add to imports:
```ts
import { serializeOrder, stripAdminFields, getEmployeeFieldPermissions } from "@/services/orderService"
```

Replace the stripAdminFields call (line ~26):
```ts
const perms = role === "employee" ? await getEmployeeFieldPermissions() : undefined
let data = role === "admin" ? serialized : stripAdminFields(serialized, perms)
```

- [ ] **Step 5: Add EmployeePermissions to quoteBuilderPermissions.ts**

Replace the full contents of `src/app/quote-builder/quoteBuilderPermissions.ts` with:

```ts
export type EmployeeFieldPermissions = {
  lineItemPriceAccess: "none" | "view" | "edit"
  lineItemCostAccess: "none" | "view" | "edit"
  setupCostAccess: "none" | "view" | "edit"
}

export type PermissionInput = {
  role: string
  stateId: number
  orderUserId: string | null
  sessionUserId: string | null
  employeePermissions?: EmployeeFieldPermissions
}

export type QuoteBuilderPermissions = {
  canEditLineItemPrices: boolean
  canViewLineItemPrices: boolean
  canEditLineItemQty: boolean
  canAddRemoveLineItems: boolean
  canEditSetupCosts: boolean
  canViewSetupCosts: boolean
  canEditDiscount: boolean
  canSelectUser: boolean
  isReadOnly: boolean
  saveAction: "save" | "revert_state" | "login" | "none"
}

export function getQuoteBuilderPermissions(input: PermissionInput): QuoteBuilderPermissions {
  const { role, stateId, orderUserId, sessionUserId, employeePermissions } = input

  const isAdmin = role === "admin"
  const isEmployee = role === "employee"
  const isOwner = (role === "user" || role === "guest") && sessionUserId === orderUserId && orderUserId != null
  const isAnonOnPublicOrder = role === "anonymous" && orderUserId == null

  const canEdit = isAdmin || (isEmployee && stateId <= 2) || ((isOwner || isAnonOnPublicOrder) && stateId <= 2)
  const isReadOnly = !canEdit

  const saveAction = ((): QuoteBuilderPermissions["saveAction"] => {
    if (isAdmin) return "save"
    if (isEmployee) return stateId <= 2 ? "save" : "none"
    if (isOwner) {
      if (stateId >= 3) return "none"
      return stateId === 2 ? "revert_state" : "save"
    }
    if (isAnonOnPublicOrder && stateId <= 2) return "login"
    return "none"
  })()

  const empPrice = employeePermissions?.lineItemPriceAccess ?? "view"
  const empSetup = employeePermissions?.setupCostAccess ?? "edit"

  return {
    canEditLineItemPrices: isAdmin || (isEmployee && empPrice === "edit"),
    canViewLineItemPrices: isAdmin || !isEmployee || empPrice !== "none",
    canEditLineItemQty: canEdit,
    canAddRemoveLineItems: canEdit,
    canEditSetupCosts: isAdmin || (isEmployee && stateId <= 2 && empSetup === "edit"),
    canViewSetupCosts: isAdmin || !isEmployee || empSetup !== "none",
    canEditDiscount: isAdmin,
    canSelectUser: isAdmin,
    isReadOnly,
    saveAction,
  }
}
```

- [ ] **Step 6: Update quoteBuilderPermissions.test.ts**

In `src/app/quote-builder/quoteBuilderPermissions.test.ts`, add tests for the two new permission properties. Find the existing employee test case and extend it, then add new cases:

```ts
it("employee with default permissions: can view prices, cannot edit prices, can edit setup costs", () => {
  const perms = getQuoteBuilderPermissions({
    role: "employee",
    stateId: 1,
    orderUserId: "u1",
    sessionUserId: "e1",
    employeePermissions: { lineItemPriceAccess: "view", lineItemCostAccess: "none", setupCostAccess: "edit" },
  })
  expect(perms.canViewLineItemPrices).toBe(true)
  expect(perms.canEditLineItemPrices).toBe(false)
  expect(perms.canEditSetupCosts).toBe(true)
  expect(perms.canViewSetupCosts).toBe(true)
})

it("employee with price hidden: canViewLineItemPrices is false", () => {
  const perms = getQuoteBuilderPermissions({
    role: "employee",
    stateId: 1,
    orderUserId: null,
    sessionUserId: "e1",
    employeePermissions: { lineItemPriceAccess: "none", lineItemCostAccess: "none", setupCostAccess: "none" },
  })
  expect(perms.canViewLineItemPrices).toBe(false)
  expect(perms.canViewSetupCosts).toBe(false)
})

it("employee with edit access: can edit prices and setup costs", () => {
  const perms = getQuoteBuilderPermissions({
    role: "employee",
    stateId: 1,
    orderUserId: null,
    sessionUserId: "e1",
    employeePermissions: { lineItemPriceAccess: "edit", lineItemCostAccess: "edit", setupCostAccess: "edit" },
  })
  expect(perms.canEditLineItemPrices).toBe(true)
  expect(perms.canEditSetupCosts).toBe(true)
})
```

Run the tests:
```bash
npx jest quoteBuilderPermissions --no-coverage
```

Expected: all tests pass.

- [ ] **Step 7: Thread employeePermissions through QB page.tsx and QuoteBuilder.tsx**

In `src/app/quote-builder/page.tsx`, add to imports:
```ts
import type { EmployeeFieldPermissions } from "./quoteBuilderPermissions"
```

**Replace** the existing `taxRate` fetch (the `findUnique` for `"taxRate"`) with a single combined `findMany` that fetches all needed settings in one query — avoiding a second round-trip when role is `"employee"` (async-parallel + DRY):

```ts
// Replace this:
//   const taxSetting = await prisma.universalSettings.findUnique({ where: { setting: "taxRate" } })
//   const taxRate = taxSetting ? Number(taxSetting.value) : 0
// With:
const settingKeys = role === "employee"
  ? ["taxRate", "employeeLineItemPriceAccess", "employeeLineItemCostAccess", "employeeSetupCostAccess"]
  : ["taxRate"]
const settingRows = await prisma.universalSettings.findMany({
  where: { setting: { in: settingKeys } },
  select: { setting: true, value: true },
})
const settingsMap = Object.fromEntries(settingRows.map((r) => [r.setting, r.value]))
const taxRate = Number(settingsMap.taxRate ?? 0)
const employeePermissions: EmployeeFieldPermissions | undefined = role === "employee"
  ? {
      lineItemPriceAccess: (settingsMap.employeeLineItemPriceAccess ?? "view") as EmployeeFieldPermissions["lineItemPriceAccess"],
      lineItemCostAccess: (settingsMap.employeeLineItemCostAccess ?? "none") as EmployeeFieldPermissions["lineItemCostAccess"],
      setupCostAccess: (settingsMap.employeeSetupCostAccess ?? "edit") as EmployeeFieldPermissions["setupCostAccess"],
    }
  : undefined
```
```

Pass it to QuoteBuilder:
```tsx
return (
  <QuoteBuilder
    orderId={orderIdStr ? Number(orderIdStr) : undefined}
    token={token}
    role={role}
    taxRate={taxRate}
    sessionUserId={session?.user?.id ?? null}
    employeePermissions={employeePermissions}
  />
)
```

In `src/app/quote-builder/QuoteBuilder.tsx`, add `employeePermissions` to the `Props` type:
```ts
type Props = {
  orderId?: number
  token?: string
  role: string
  taxRate: number
  sessionUserId: string | null
  employeePermissions?: import("./quoteBuilderPermissions").EmployeeFieldPermissions
}
```

Pass it to `getQuoteBuilderPermissions`:
```ts
const permissions = getQuoteBuilderPermissions({
  role,
  stateId: order?.stateId ?? 1,
  orderUserId: order?.user?.id ?? null,
  sessionUserId,
  employeePermissions,
})
```

- [ ] **Step 8: Final TypeScript check and test run**

```bash
npx tsc --noEmit && npx jest quoteBuilderPermissions --no-coverage
```

Expected: zero TS errors, all tests pass.

---

## Final: Smoke Test Checklist

- [ ] Start dev server: `npm run dev`
- [ ] As anonymous user: visit `/quote-builder?token=<any-unclaimed-order-token>` → click Save button → ClaimModal opens with three tabs
- [ ] In ClaimModal Guest tab: fill form, submit → session created, order claimed, save proceeds
- [ ] As anonymous user: visit `/orders/<token>` for a state-2 order → click Due Now → ClaimModal opens → complete guest flow → payment dialog appears
- [ ] Visit `/get-quote` as anonymous → add items → click Submit → ClaimModal opens → complete → order created
- [ ] Visit navbar account icon when not signed in → "Continue as Guest" button is visible → clicks open ClaimModal without order context
- [ ] Visit `/register?claimToken=<orderId>` → register → order is claimed
- [ ] Visit `/account` while signed in → orders list renders, reseller license section visible
- [ ] Visit `/account` as guest user → upgrade banner appears, Set Password dialog works
- [ ] Upload a license file (PDF or PNG) → success toast → page refreshes → "View License" link appears
- [ ] In dashboard Settings → Employee Permissions section shows three dropdowns → changing a value saves immediately
- [ ] As employee role: visit quote builder → prices/costs respect the permission settings

