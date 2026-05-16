# Plan 3 — Quote Builder, Get Quote & Public Order Page

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the core customer-facing quoting flow: the Quote Builder (`/quote-builder`), Get Quote form (`/get-quote`), and enhanced Public Order page (`/orders/[token]`).

**Architecture:** The Quote Builder is a client-side container (`QuoteBuilder.tsx`) that holds all draft state and passes it to child components. `page.tsx` is a server component that handles redirects and passes `taxRate` + initial route params. A new `GET /api/orders/by-token/[token]` public endpoint serves the client container. All save operations go through the existing `PATCH /api/orders/[id]` which is extended to accept `setUpCosts` and `userId`.

**Tech Stack:** Next.js App Router, React 19, Prisma, NextAuth v4, shadcn/ui, Tailwind 4, TypeScript

---

## File Map

| File | Action | Purpose |
|---|---|---|
| `prisma/schema.prisma` | Modify | Add `SetupFeePreset` + `LineItemPreset` models |
| `prisma/seed.ts` | Modify | Seed 5 setup fee presets + 3 generic line item presets |
| `src/models/preset.ts` | Create | TS types for `SetupFeePreset` + `LineItemPreset` |
| `src/models/order.ts` | Modify | Add `SetupCostItem` type |
| `src/app/api/setup-fee-presets/route.ts` | Create | GET (any) + POST (admin) |
| `src/app/api/setup-fee-presets/[id]/route.ts` | Create | PATCH + DELETE (admin) |
| `src/app/api/line-item-presets/route.ts` | Create | GET (any) + POST (admin) |
| `src/app/api/line-item-presets/[id]/route.ts` | Create | PATCH (admin) |
| `src/app/api/orders/route.ts` | Modify | Allow anonymous POST + generate token on creation + admin notifications |
| `src/app/api/orders/[id]/route.ts` | Modify | PATCH: add `setUpCosts` replacement + `userId` admin update |
| `src/app/api/orders/by-token/[token]/route.ts` | Create | Public GET by token (role-aware stripping) |
| `src/app/quote-builder/quoteBuilderPermissions.ts` | Create | Pure permission logic |
| `src/app/quote-builder/quoteBuilderPermissions.test.ts` | Create | Unit tests for permission logic |
| `src/app/quote-builder/quoteBuilderUtils.ts` | Create | Shared `newLocalId()` helper for draft rows |
| `src/app/quote-builder/page.tsx` | Create | Server component: redirect logic + taxRate prop |
| `src/app/quote-builder/QuoteBuilder.tsx` | Create | Client container: all draft state + save orchestration |
| `src/app/quote-builder/components/QuoteBuilder-Banner.tsx` | Create | State/role-aware banner |
| `src/app/quote-builder/components/QuoteBuilder-OrderItems.tsx` | Create | Inline-edit line items table + preset dropdown |
| `src/app/quote-builder/components/QuoteBuilder-SetupCosts.tsx` | Create | Setup costs section + preset dropdown |
| `src/app/quote-builder/components/QuoteBuilder-OrderTotals.tsx` | Create | Live-computed totals panel |
| `src/app/quote-builder/components/QuoteBuilder-UserSelect.tsx` | Create | Admin user search + order name |
| `src/app/quote-builder/components/QuoteBuilder-PriceChangeDialog.tsx` | Create | Admin price-change confirmation |
| `src/app/get-quote/page.tsx` | Create | Thin server component — imports GetQuote-Form directly |
| `src/app/get-quote/components/GetQuote-Form.tsx` | Create | Form with page heading, layout, and catalog line item picker |
| `src/app/orders/[token]/Orders-ActionButtons.tsx` | Create | Client: Due Now dialog + Share button |
| `src/app/orders/[token]/page.tsx` | Modify | Full enhanced layout: totals, setup costs, Due Now, View Only |
| `src/app/orders/[token]/layout.tsx` | Modify | OG metadata: add payment status |

---

## Task 1: Schema — Add SetupFeePreset + LineItemPreset

**Files:**
- Modify: `prisma/schema.prisma`
- Modify: `prisma/seed.ts`

- [ ] **Step 1: Add models to schema.prisma**

Open `prisma/schema.prisma`. Add these two models at the end, before the NextAuth tables:

```prisma
model SetupFeePreset {
  id          Int      @id @default(autoincrement())
  name        String
  description String?
  unitLabel   String   @default("Per Item")
  defaultRate Float    @default(0)
  defaultCost Float    @default(0)
  sortOrder   Int      @default(0)
  isActive    Boolean  @default(true)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@map("setup_fee_presets")
}

// STUB — replace this table with your real inventory catalog when forking.
// See README § "Early Setup: Inventory / Catalog".
model LineItemPreset {
  id           Int      @id @default(autoincrement())
  name         String
  description  String?
  defaultPrice Decimal  @db.Decimal(10, 2)
  defaultCost  Decimal  @db.Decimal(10, 2)
  sortOrder    Int      @default(0)
  isActive     Boolean  @default(true)
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  @@map("line_item_presets")
}
```

- [ ] **Step 2: Run migration**

```bash
npx prisma migrate dev --name add-preset-tables
```

Expected: two new tables created, migration file written to `prisma/migrations/`.

- [ ] **Step 3: Add seed data to seed.ts**

In `prisma/seed.ts`, add these constants after the `SETTINGS` array and before `async function main()`:

```ts
const SETUP_FEE_PRESETS = [
  { name: "Artwork Fee",    description: "Per color / design",  unitLabel: "Per Design", defaultRate: 25,  defaultCost: 0,   sortOrder: 0 },
  { name: "Screen Setup",   description: "Per screen",          unitLabel: "Per Screen", defaultRate: 15,  defaultCost: 8,   sortOrder: 1 },
  { name: "Rush Fee",       description: "Expedited turnaround",unitLabel: "Flat",       defaultRate: 50,  defaultCost: 0,   sortOrder: 2 },
  { name: "Shipping",       description: "Ground shipping",     unitLabel: "Flat",       defaultRate: 20,  defaultCost: 12,  sortOrder: 3 },
  { name: "Custom Item",    description: "Misc setup charge",   unitLabel: "Per Item",   defaultRate: 0,   defaultCost: 0,   sortOrder: 4 },
]

const LINE_ITEM_PRESETS = [
  { name: "Standard T-Shirt",  description: "100% cotton, unisex",    defaultPrice: new Prisma.Decimal(12.00), defaultCost: new Prisma.Decimal(5.00),  sortOrder: 0 },
  { name: "Premium Hoodie",    description: "Fleece pullover",         defaultPrice: new Prisma.Decimal(28.00), defaultCost: new Prisma.Decimal(14.00), sortOrder: 1 },
  { name: "Custom Item",       description: "Price set by admin",      defaultPrice: new Prisma.Decimal(0),     defaultCost: new Prisma.Decimal(0),     sortOrder: 2 },
]
```

- [ ] **Step 4: Add upsert loops in main()**

Inside `main()`, add these blocks after the settings loop:

```ts
  console.log("Seeding setup fee presets...")
  for (const p of SETUP_FEE_PRESETS) {
    await prisma.setupFeePreset.upsert({
      where: { id: SETUP_FEE_PRESETS.indexOf(p) + 1 },
      update: { name: p.name, description: p.description, unitLabel: p.unitLabel, defaultRate: p.defaultRate, defaultCost: p.defaultCost, sortOrder: p.sortOrder },
      create: p,
    })
  }

  console.log("Seeding line item presets...")
  for (const p of LINE_ITEM_PRESETS) {
    await prisma.lineItemPreset.upsert({
      where: { id: LINE_ITEM_PRESETS.indexOf(p) + 1 },
      update: { name: p.name, description: p.description, defaultPrice: p.defaultPrice, defaultCost: p.defaultCost, sortOrder: p.sortOrder },
      create: p,
    })
  }
```

- [ ] **Step 5: Run the seed**

```bash
npx prisma db seed
```

Expected output includes:
```
Seeding setup fee presets...
Seeding line item presets...
```

- [ ] **Step 6: Commit**

```bash
git add prisma/schema.prisma prisma/seed.ts prisma/migrations/
git commit -m "feat: add SetupFeePreset and LineItemPreset schema + seed data"
```

---

## Task 2: TypeScript Model Types

**Files:**
- Create: `src/models/preset.ts`
- Modify: `src/models/order.ts`

- [ ] **Step 1: Create src/models/preset.ts**

```ts
export type SetupFeePreset = {
  id: number
  name: string
  description: string | null
  unitLabel: string
  defaultRate: number
  defaultCost: number
  sortOrder: number
  isActive: boolean
}

export type LineItemPreset = {
  id: number
  name: string
  description: string | null
  defaultPrice: number
  defaultCost: number
  sortOrder: number
  isActive: boolean
}
```

- [ ] **Step 2: Add SetupCostItem type to src/models/order.ts**

Add at the top of the file, before the existing types:

```ts
// One row in the quote builder setup costs table.
// Stored as customSetupItems: [SetupCostItem] on a SetUpCost record.
export type SetupCostItem = {
  label: string
  qty: number
  rate: number
  cost: number
}
```

- [ ] **Step 3: Commit**

```bash
git add src/models/preset.ts src/models/order.ts
git commit -m "feat: add preset and SetupCostItem TypeScript types"
```

---

## Task 3: Setup Fee Presets API

**Files:**
- Create: `src/app/api/setup-fee-presets/route.ts`
- Create: `src/app/api/setup-fee-presets/[id]/route.ts`

- [ ] **Step 1: Create src/app/api/setup-fee-presets/route.ts**

```ts
import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET() {
  const presets = await prisma.setupFeePreset.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: "asc" },
  })
  return NextResponse.json({ data: presets, error: null })
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== "admin") {
    return NextResponse.json({ data: null, error: "Forbidden" }, { status: 403 })
  }
  const body = await req.json()
  const { name, description, unitLabel, defaultRate, defaultCost, sortOrder } = body
  if (!name) return NextResponse.json({ data: null, error: "name is required" }, { status: 400 })

  const preset = await prisma.setupFeePreset.create({
    data: {
      name,
      description: description || null,
      unitLabel: unitLabel || "Per Item",
      defaultRate: defaultRate ?? 0,
      defaultCost: defaultCost ?? 0,
      sortOrder: sortOrder ?? 0,
    },
  })
  return NextResponse.json({ data: preset, error: null }, { status: 201 })
}
```

- [ ] **Step 2: Create src/app/api/setup-fee-presets/[id]/route.ts**

```ts
import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== "admin") {
    return NextResponse.json({ data: null, error: "Forbidden" }, { status: 403 })
  }
  const { id } = await params
  const body = await req.json()
  const { name, description, unitLabel, defaultRate, defaultCost, sortOrder, isActive } = body

  const updated = await prisma.setupFeePreset.update({
    where: { id: Number(id) },
    data: {
      ...(name !== undefined && { name }),
      ...(description !== undefined && { description }),
      ...(unitLabel !== undefined && { unitLabel }),
      ...(defaultRate !== undefined && { defaultRate }),
      ...(defaultCost !== undefined && { defaultCost }),
      ...(sortOrder !== undefined && { sortOrder }),
      ...(isActive !== undefined && { isActive }),
    },
  })
  return NextResponse.json({ data: updated, error: null })
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== "admin") {
    return NextResponse.json({ data: null, error: "Forbidden" }, { status: 403 })
  }
  const { id } = await params
  await prisma.setupFeePreset.delete({ where: { id: Number(id) } })
  return NextResponse.json({ data: { id: Number(id) }, error: null })
}
```

- [ ] **Step 3: Smoke test**

Start dev server (`npm run dev`) and run:

```bash
curl http://localhost:3000/api/setup-fee-presets
```

Expected: `{"data":[{"id":1,"name":"Artwork Fee",...}],"error":null}`

- [ ] **Step 4: Commit**

```bash
git add src/app/api/setup-fee-presets/
git commit -m "feat: setup fee presets API (GET/POST/PATCH/DELETE)"
```

---

## Task 4: Line Item Presets API

**Files:**
- Create: `src/app/api/line-item-presets/route.ts`
- Create: `src/app/api/line-item-presets/[id]/route.ts`

- [ ] **Step 1: Create src/app/api/line-item-presets/route.ts**

```ts
import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

function serializePreset(p: any) {
  return { ...p, defaultPrice: Number(p.defaultPrice), defaultCost: Number(p.defaultCost) }
}

export async function GET() {
  const presets = await prisma.lineItemPreset.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: "asc" },
  })
  return NextResponse.json({ data: presets.map(serializePreset), error: null })
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== "admin") {
    return NextResponse.json({ data: null, error: "Forbidden" }, { status: 403 })
  }
  const body = await req.json()
  const { name, description, defaultPrice, defaultCost, sortOrder } = body
  if (!name) return NextResponse.json({ data: null, error: "name is required" }, { status: 400 })

  const preset = await prisma.lineItemPreset.create({
    data: {
      name,
      description: description || null,
      defaultPrice: defaultPrice ?? 0,
      defaultCost: defaultCost ?? 0,
      sortOrder: sortOrder ?? 0,
    },
  })
  return NextResponse.json({ data: serializePreset(preset), error: null }, { status: 201 })
}
```

- [ ] **Step 2: Create src/app/api/line-item-presets/[id]/route.ts**

```ts
import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== "admin") {
    return NextResponse.json({ data: null, error: "Forbidden" }, { status: 403 })
  }
  const { id } = await params
  const body = await req.json()
  const { name, description, defaultPrice, defaultCost, sortOrder, isActive } = body

  const updated = await prisma.lineItemPreset.update({
    where: { id: Number(id) },
    data: {
      ...(name !== undefined && { name }),
      ...(description !== undefined && { description }),
      ...(defaultPrice !== undefined && { defaultPrice }),
      ...(defaultCost !== undefined && { defaultCost }),
      ...(sortOrder !== undefined && { sortOrder }),
      ...(isActive !== undefined && { isActive }),
    },
  })
  return NextResponse.json({ data: { ...updated, defaultPrice: Number(updated.defaultPrice), defaultCost: Number(updated.defaultCost) }, error: null })
}
```

- [ ] **Step 3: Commit**

```bash
git add src/app/api/line-item-presets/
git commit -m "feat: line item presets API (GET/POST/PATCH)"
```

---

## Task 5: Quote Builder Permissions Utility + Tests

**Files:**
- Create: `src/app/quote-builder/quoteBuilderPermissions.ts`
- Create: `src/app/quote-builder/quoteBuilderPermissions.test.ts`
- Create: `src/app/quote-builder/quoteBuilderUtils.ts`

- [ ] **Step 1: Write the failing tests first**

Create `src/app/quote-builder/quoteBuilderPermissions.test.ts`:

```ts
import { getQuoteBuilderPermissions } from "./quoteBuilderPermissions"

describe("getQuoteBuilderPermissions", () => {
  describe("admin", () => {
    it("has full edit access regardless of state", () => {
      const p = getQuoteBuilderPermissions({ role: "admin", stateId: 5, orderUserId: "u1", sessionUserId: "u2" })
      expect(p.canEditLineItemPrices).toBe(true)
      expect(p.canEditLineItemQty).toBe(true)
      expect(p.canEditSetupCosts).toBe(true)
      expect(p.canEditDiscount).toBe(true)
      expect(p.canSelectUser).toBe(true)
      expect(p.isReadOnly).toBe(false)
      expect(p.saveAction).toBe("save")
    })
  })

  describe("employee", () => {
    it("can edit qty and setup costs but not prices, state 1", () => {
      const p = getQuoteBuilderPermissions({ role: "employee", stateId: 1, orderUserId: "u1", sessionUserId: "e1" })
      expect(p.canEditLineItemPrices).toBe(false)
      expect(p.canEditLineItemQty).toBe(true)
      expect(p.canEditSetupCosts).toBe(true)
      expect(p.canEditDiscount).toBe(false)
      expect(p.saveAction).toBe("save")
    })

    it("is read-only at state 3+", () => {
      const p = getQuoteBuilderPermissions({ role: "employee", stateId: 3, orderUserId: "u1", sessionUserId: "e1" })
      expect(p.isReadOnly).toBe(true)
      expect(p.saveAction).toBe("none")
    })
  })

  describe("user (owner)", () => {
    it("can edit qty at state 1, save action is save", () => {
      const p = getQuoteBuilderPermissions({ role: "user", stateId: 1, orderUserId: "u1", sessionUserId: "u1" })
      expect(p.canEditLineItemQty).toBe(true)
      expect(p.canEditLineItemPrices).toBe(false)
      expect(p.canEditSetupCosts).toBe(false)
      expect(p.saveAction).toBe("save")
    })

    it("can edit qty at state 2, save action reverts state", () => {
      const p = getQuoteBuilderPermissions({ role: "user", stateId: 2, orderUserId: "u1", sessionUserId: "u1" })
      expect(p.canEditLineItemQty).toBe(true)
      expect(p.saveAction).toBe("revert_state")
    })

    it("is read-only at state 3+", () => {
      const p = getQuoteBuilderPermissions({ role: "user", stateId: 3, orderUserId: "u1", sessionUserId: "u1" })
      expect(p.isReadOnly).toBe(true)
      expect(p.saveAction).toBe("none")
    })
  })

  describe("anonymous on no-userId order", () => {
    it("can edit qty at state 1, save action is login", () => {
      const p = getQuoteBuilderPermissions({ role: "anonymous", stateId: 1, orderUserId: null, sessionUserId: null })
      expect(p.canEditLineItemQty).toBe(true)
      expect(p.saveAction).toBe("login")
    })
  })

  describe("anonymous on userId order", () => {
    it("is fully read-only", () => {
      const p = getQuoteBuilderPermissions({ role: "anonymous", stateId: 1, orderUserId: "u1", sessionUserId: null })
      expect(p.canEditLineItemQty).toBe(false)
      expect(p.isReadOnly).toBe(true)
      expect(p.saveAction).toBe("none")
    })
  })
})
```

- [ ] **Step 2: Run tests, confirm they fail**

```bash
npx jest quoteBuilderPermissions.test.ts --no-coverage
```

Expected: FAIL — "Cannot find module './quoteBuilderPermissions'"

- [ ] **Step 3: Implement src/app/quote-builder/quoteBuilderPermissions.ts**

```ts
export type PermissionInput = {
  role: string          // 'admin' | 'employee' | 'user' | 'guest' | 'anonymous'
  stateId: number
  orderUserId: string | null
  sessionUserId: string | null
}

export type QuoteBuilderPermissions = {
  canEditLineItemPrices: boolean
  canEditLineItemQty: boolean
  canAddRemoveLineItems: boolean
  canEditSetupCosts: boolean
  canEditDiscount: boolean
  canSelectUser: boolean
  isReadOnly: boolean
  saveAction: "save" | "revert_state" | "login" | "none"
}

export function getQuoteBuilderPermissions(input: PermissionInput): QuoteBuilderPermissions {
  const { role, stateId, orderUserId, sessionUserId } = input

  const isAdmin = role === "admin"
  const isEmployee = role === "employee"
  const isOwner = (role === "user" || role === "guest") && sessionUserId === orderUserId && orderUserId != null
  const isAnonOnPublicOrder = role === "anonymous" && orderUserId == null

  const canEditInEarlyState = isAdmin || isEmployee || ((isOwner || isAnonOnPublicOrder) && stateId <= 2)
  const isReadOnly = !isAdmin && stateId >= 3

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

  return {
    canEditLineItemPrices: isAdmin,
    canEditLineItemQty: canEditInEarlyState,
    canAddRemoveLineItems: canEditInEarlyState,
    canEditSetupCosts: isAdmin || isEmployee,
    canEditDiscount: isAdmin,
    canSelectUser: isAdmin,
    isReadOnly,
    saveAction,
  }
}
```

- [ ] **Step 4: Run tests, confirm they pass**

```bash
npx jest quoteBuilderPermissions.test.ts --no-coverage
```

Expected: all 8 tests PASS

- [ ] **Step 5: Create src/app/quote-builder/quoteBuilderUtils.ts**

```ts
export function newLocalId(): string {
  return `local-${Date.now()}-${Math.random()}`
}
```

- [ ] **Step 6: Commit**

```bash
git add src/app/quote-builder/quoteBuilderPermissions.ts src/app/quote-builder/quoteBuilderPermissions.test.ts src/app/quote-builder/quoteBuilderUtils.ts
git commit -m "feat: quote builder permissions utility with tests + shared utils"
```

---

## Task 6: Extend POST /api/orders — Anonymous + Token Generation + Admin Notifications

**Files:**
- Modify: `src/app/api/orders/route.ts`

The current POST requires `admin | employee` auth. We need it to also work for unauthenticated users submitting the Get Quote form. When no session: force `stateId=1`, `userId=null`, only allow safe fields, generate a token, notify all admins.

- [ ] **Step 1: Replace src/app/api/orders/route.ts**

```ts
import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { serializeOrder, stripAdminFields, computeOrderTotals } from "@/services/orderService"

function generateToken(): string {
  return `ord-${crypto.randomUUID().replace(/-/g, "").slice(0, 16)}`
}

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ data: null, error: "Unauthorized" }, { status: 401 })

  const role = session.user.role
  if (role !== "admin" && role !== "employee") {
    return NextResponse.json({ data: null, error: "Forbidden" }, { status: 403 })
  }

  const orders = await prisma.order.findMany({
    include: {
      state: { select: { id: true, name: true, color: true } },
      user: { select: { id: true, firstName: true, lastName: true, email: true, role: true } },
      _count: { select: { orderLineItems: true } },
    },
    orderBy: { createdAt: "desc" },
  })

  const serialized = orders.map((o) => serializeOrder(o))
  const data = role === "employee" ? serialized.map(stripAdminFields) : serialized
  return NextResponse.json({ data, error: null })
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  const role = session?.user?.role ?? "anonymous"
  const isStaff = role === "admin" || role === "employee"
  const isPublic = !session

  // Staff-only fields — ignored for public submissions
  const body = await req.json()
  const { customerNotes, notes, dueDate, isHardDeadline, lineItems = [] } = body
  const userId = isStaff ? (body.userId || null) : null
  const nickname = isStaff ? (body.nickname || null) : null
  const stateId = isStaff ? (body.stateId ?? 1) : 1

  if (!Array.isArray(lineItems) || lineItems.length === 0) {
    return NextResponse.json({ data: null, error: "At least one line item is required" }, { status: 400 })
  }

  const taxSetting = await prisma.universalSettings.findUnique({ where: { setting: "taxRate" } })
  const taxRate = taxSetting ? Number(taxSetting.value) : 0
  const totals = computeOrderTotals({ lineItems, setUpCosts: [], taxRate })

  const order = await prisma.order.create({
    data: {
      userId,
      stateId,
      nickname,
      customerNotes: customerNotes || null,
      notes: isStaff ? (notes || null) : null,
      dueDate: dueDate ? new Date(dueDate) : null,
      isHardDeadline: isHardDeadline ?? false,
      token: generateToken(),
      ...totals,
      createdBy: session?.user?.email ?? "anonymous",
      orderLineItems: {
        create: lineItems.map((li: any, idx: number) => ({
          description: li.description,
          qty: li.qty,
          unitPrice: li.unitPrice ?? 0,
          lineTotal: li.qty * (li.unitPrice ?? 0),
          unitCost: isStaff ? (li.unitCost ?? 0) : 0,
          sortOrder: idx,
          notes: li.notes || null,
        })),
      },
    },
    include: {
      state: { select: { id: true, name: true, color: true } },
      user: { select: { id: true, firstName: true, lastName: true, email: true } },
      _count: { select: { orderLineItems: true } },
    },
  })

  // Notify all admins on public submission
  if (isPublic) {
    const admins = await prisma.user.findMany({ where: { role: "admin" }, select: { id: true } })
    await prisma.notification.createMany({
      data: admins.map((a) => ({
        userId: a.id,
        orderId: order.id,
        type: "order_submitted",
        title: "New Quote Request",
        message: `A new quote request (#${order.id}) was submitted via the Get Quote form.`,
        actionUrl: `/dashboard`,
      })),
    })
  }

  const serialized = serializeOrder(order)
  const data = role === "employee" ? stripAdminFields(serialized) : serialized
  return NextResponse.json({ data, error: null }, { status: 201 })
}
```

- [ ] **Step 2: Smoke test — anonymous POST**

```bash
curl -X POST http://localhost:3000/api/orders \
  -H "Content-Type: application/json" \
  -d '{"customerNotes":"Test","lineItems":[{"description":"T-Shirt","qty":5,"unitPrice":0}]}'
```

Expected: `{"data":{"id":...,"token":"ord-..."},"error":null}` with status 201

- [ ] **Step 3: Commit**

```bash
git add src/app/api/orders/route.ts
git commit -m "feat: allow anonymous order creation, add token generation, notify admins on submission"
```

---

## Task 7: Extend PATCH /api/orders/[id] — setUpCosts + userId

**Files:**
- Modify: `src/app/api/orders/[id]/route.ts`

The quote builder saves everything in one shot: line items, setup costs, scalar fields. We need `setUpCosts` to replace all existing records and `userId` as an admin-only scalar.

- [ ] **Step 1: Replace the PATCH handler in src/app/api/orders/[id]/route.ts**

Find the `export async function PATCH` block (lines 32–137) and replace the entire function:

```ts
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ data: null, error: "Unauthorized" }, { status: 401 })

  const role = session.user.role
  if (role !== "admin" && role !== "employee") {
    return NextResponse.json({ data: null, error: "Forbidden" }, { status: 403 })
  }

  const { id } = await params
  const orderId = Number(id)
  const body = await req.json()

  const {
    stateId, nickname, customerNotes, notes, dueDate, dueDateEnd, startDate,
    isHardDeadline, paymentPlan, isPaid, discountManual, discountReferral,
    discountMistake, rushFeeAmount, rushFeePercent, rushFeeDays,
    needsShipping, finalPrice, lineItems, setUpCosts, userId,
  } = body

  const scalarUpdate: Record<string, any> = { updatedBy: session.user.email ?? null }
  if (stateId !== undefined) scalarUpdate.stateId = stateId
  if (nickname !== undefined) scalarUpdate.nickname = nickname
  if (customerNotes !== undefined) scalarUpdate.customerNotes = customerNotes
  if (notes !== undefined) scalarUpdate.notes = notes
  if (dueDate !== undefined) scalarUpdate.dueDate = dueDate ? new Date(dueDate) : null
  if (dueDateEnd !== undefined) scalarUpdate.dueDateEnd = dueDateEnd ? new Date(dueDateEnd) : null
  if (startDate !== undefined) scalarUpdate.startDate = startDate ? new Date(startDate) : null
  if (isHardDeadline !== undefined) scalarUpdate.isHardDeadline = isHardDeadline
  if (paymentPlan !== undefined) scalarUpdate.paymentPlan = paymentPlan
  if (isPaid !== undefined) scalarUpdate.isPaid = isPaid
  if (needsShipping !== undefined) scalarUpdate.needsShipping = needsShipping
  if (finalPrice !== undefined) scalarUpdate.finalPrice = finalPrice
  if (discountManual !== undefined) scalarUpdate.discountManual = discountManual
  if (discountReferral !== undefined) scalarUpdate.discountReferral = discountReferral
  if (discountMistake !== undefined) scalarUpdate.discountMistake = discountMistake
  if (rushFeeAmount !== undefined) scalarUpdate.rushFeeAmount = rushFeeAmount
  if (rushFeePercent !== undefined) scalarUpdate.rushFeePercent = rushFeePercent
  if (rushFeeDays !== undefined) scalarUpdate.rushFeeDays = rushFeeDays
  if (userId !== undefined && role === "admin") scalarUpdate.userId = userId || null

  if (stateId === 6) scalarUpdate.completedDate = new Date()
  if (stateId !== undefined && stateId !== 6) scalarUpdate.completedDate = null

  // Ensure every order has a share token
  const currentOrder = await prisma.order.findUnique({
    where: { id: orderId },
    select: { token: true, discountManual: true, discountReferral: true, discountMistake: true, rushFeeAmount: true },
  })
  if (!currentOrder?.token) {
    scalarUpdate.token = `ord-${crypto.randomUUID().replace(/-/g, "").slice(0, 16)}`
  }

  const needsTotalsRecompute = lineItems !== undefined || setUpCosts !== undefined

  if (needsTotalsRecompute) {
    const taxSetting = await prisma.universalSettings.findUnique({ where: { setting: "taxRate" } })
    const taxRate = taxSetting ? Number(taxSetting.value) : 0

    // Determine line items for totals: new if provided, else fetch existing
    let liForTotals: { qty: number; unitPrice: number; unitCost: number }[]
    if (lineItems !== undefined) {
      liForTotals = lineItems
    } else {
      const existing = await prisma.orderLineItem.findMany({ where: { orderId } })
      liForTotals = existing.map((li) => ({ qty: li.qty, unitPrice: Number(li.unitPrice), unitCost: Number(li.unitCost) }))
    }

    // Determine setup costs for totals: new if provided, else fetch existing
    let scForTotals: { userTotal: number; adminTotal: number }[]
    if (setUpCosts !== undefined) {
      scForTotals = (setUpCosts as { qty: number; rate: number; cost: number }[]).map((sc) => ({
        userTotal: sc.rate * sc.qty,
        adminTotal: sc.cost * sc.qty,
      }))
    } else {
      const existing = await prisma.setUpCost.findMany({ where: { orderId } })
      scForTotals = existing.map((s) => ({ userTotal: Number(s.userTotal), adminTotal: Number(s.adminTotal) }))
    }

    const totals = computeOrderTotals({
      lineItems: liForTotals,
      setUpCosts: scForTotals,
      taxRate,
      discountManual: scalarUpdate.discountManual !== undefined ? scalarUpdate.discountManual : Number(currentOrder?.discountManual ?? 0),
      discountReferral: scalarUpdate.discountReferral !== undefined ? scalarUpdate.discountReferral : Number(currentOrder?.discountReferral ?? 0),
      discountMistake: scalarUpdate.discountMistake !== undefined ? scalarUpdate.discountMistake : Number(currentOrder?.discountMistake ?? 0),
      rushFeeAmount: scalarUpdate.rushFeeAmount !== undefined ? scalarUpdate.rushFeeAmount : Number(currentOrder?.rushFeeAmount ?? 0),
    })
    Object.assign(scalarUpdate, totals)
  }

  // Replace line items if provided
  if (lineItems !== undefined) {
    await prisma.orderLineItem.deleteMany({ where: { orderId } })
    await prisma.orderLineItem.createMany({
      data: lineItems.map((li: any, idx: number) => ({
        orderId,
        description: li.description,
        qty: li.qty,
        unitPrice: li.unitPrice,
        lineTotal: li.qty * li.unitPrice,
        unitCost: li.unitCost ?? 0,
        sortOrder: idx,
        notes: li.notes || null,
      })),
    })
  }

  // Replace setup costs if provided
  if (setUpCosts !== undefined) {
    await prisma.setUpCost.deleteMany({ where: { orderId } })
    const scData = setUpCosts as { label: string; qty: number; rate: number; cost: number }[]
    if (scData.length > 0) {
      await prisma.setUpCost.createMany({
        data: scData.map((sc) => ({
          orderId,
          userTotal: sc.rate * sc.qty,
          adminTotal: sc.cost * sc.qty,
          customSetupItems: [{ label: sc.label, qty: sc.qty, rate: sc.rate, cost: sc.cost }],
          createdBy: session.user.email ?? null,
        })),
      })
    }
  }

  const updated = await prisma.order.update({
    where: { id: orderId },
    data: scalarUpdate,
    include: ORDER_DETAIL_INCLUDE,
  })

  if (stateId !== undefined && updated.userId) {
    const STATE_NOTIFICATIONS: Record<number, { title: string; message: string }> = {
      2: { title: "Quote Ready to Review", message: `Your quote #${orderId} has been reviewed and is ready for your approval.` },
      3: { title: "Order In Progress", message: `We've started working on your order #${orderId}.` },
      4: { title: "Awaiting Pickup", message: `Your order #${orderId} is complete and ready for pickup!` },
      5: { title: "Awaiting Payment", message: `Your order #${orderId} is ready. Please arrange final payment before pickup.` },
      6: { title: "Order Complete", message: `Your order #${orderId} has been completed. Thank you for your business!` },
    }
    const notifData = STATE_NOTIFICATIONS[stateId as number]
    if (notifData) {
      await prisma.notification.create({
        data: { userId: updated.userId, orderId, type: "state_changed", title: notifData.title, message: notifData.message },
      }).catch(() => {})
    }
  }

  const serialized = serializeOrder(updated)
  return NextResponse.json({ data: role === "employee" ? stripAdminFields(serialized) : serialized, error: null })
}
```

- [ ] **Step 2: Verify build compiles**

```bash
npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add src/app/api/orders/[id]/route.ts
git commit -m "feat: extend PATCH /api/orders/[id] with setUpCosts replacement and userId admin update"
```

---

## Task 8: Public GET /api/orders/by-token/[token]

**Files:**
- Create: `src/app/api/orders/by-token/[token]/route.ts`

The quote builder client needs to fetch orders by token without requiring admin auth. This route returns full order detail, stripping admin fields for non-admin callers.

- [ ] **Step 1: Create src/app/api/orders/by-token/[token]/route.ts**

```ts
import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { serializeOrder, stripAdminFields } from "@/services/orderService"

export async function GET(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const session = await getServerSession(authOptions)
  const role = session?.user?.role ?? "anonymous"

  const order = await prisma.order.findUnique({
    where: { token },
    include: {
      state: true,
      user: { select: { id: true, firstName: true, lastName: true, email: true, phone: true, companyName: true } },
      orderLineItems: { include: { variants: true }, orderBy: { sortOrder: "asc" as const } },
      setUpCosts: true,
      payments: { orderBy: { paidAt: "desc" as const } },
    },
  })

  if (!order) return NextResponse.json({ data: null, error: "Not found" }, { status: 404 })

  const serialized = serializeOrder(order)
  const data = role === "admin" ? serialized : stripAdminFields(serialized)
  return NextResponse.json({ data, error: null })
}
```

- [ ] **Step 2: Smoke test**

```bash
# Tokens are random (format: ord-{16chars}). Find it first:
#   npx prisma studio → Orders table → copy the token column value
curl http://localhost:3000/api/orders/by-token/<your-token-here>
```

Expected: full order detail JSON without cost/profit fields

- [ ] **Step 3: Commit**

```bash
git add src/app/api/orders/by-token/
git commit -m "feat: public GET /api/orders/by-token/[token] endpoint"
```

---

## Task 9: Quote Builder page.tsx + QuoteBuilder.tsx Container

**Files:**
- Create: `src/app/quote-builder/page.tsx`
- Create: `src/app/quote-builder/QuoteBuilder.tsx`

`page.tsx` is a server component that handles redirects and passes `taxRate`. `QuoteBuilder.tsx` is the client container that holds all draft state and orchestrates every child component.

- [ ] **Step 1: Create src/app/quote-builder/page.tsx**

```tsx
import { redirect, notFound } from "next/navigation"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import QuoteBuilder from "./QuoteBuilder"

export default async function QuoteBuilderPage({
  searchParams,
}: {
  searchParams: Promise<{ orderId?: string; token?: string }>
}) {
  const { orderId: orderIdStr, token } = await searchParams
  const session = await getServerSession(authOptions)
  const role = session?.user?.role ?? "anonymous"
  const isStaff = role === "admin" || role === "employee"

  // Non-staff accessing by orderId is not allowed
  if (orderIdStr && !isStaff) redirect("/login")

  const taxSetting = await prisma.universalSettings.findUnique({ where: { setting: "taxRate" } })
  const taxRate = taxSetting ? Number(taxSetting.value) : 0

  // Redirect logic for token-based access
  if (token) {
    const order = await prisma.order.findUnique({
      where: { token },
      select: { userId: true, stateId: true },
    })
    if (!order) notFound()

    // Logged-in user accessing another user's order → public page
    if (role === "user" && order.userId && order.userId !== session?.user?.id) {
      redirect(`/orders/${token}`)
    }
    // Anonymous accessing an order that belongs to a user → public page
    if (role === "anonymous" && order.userId) {
      redirect(`/orders/${token}`)
    }
  }

  return (
    <QuoteBuilder
      orderId={orderIdStr ? Number(orderIdStr) : undefined}
      token={token}
      role={role}
      taxRate={taxRate}
      sessionUserId={session?.user?.id ?? null}
    />
  )
}
```

- [ ] **Step 2: Create src/app/quote-builder/QuoteBuilder.tsx**

```tsx
"use client"

import { useEffect, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Loader2 } from "lucide-react"
import { computeOrderTotals } from "@/services/orderService"
import { getQuoteBuilderPermissions } from "./quoteBuilderPermissions"
import type { OrderDetail, SetupCostItem } from "@/models/order"
import QuoteBuilderBanner from "./components/QuoteBuilder-Banner"
import QuoteBuilderOrderItems from "./components/QuoteBuilder-OrderItems"
import QuoteBuilderSetupCosts from "./components/QuoteBuilder-SetupCosts"
import QuoteBuilderOrderTotals from "./components/QuoteBuilder-OrderTotals"
import QuoteBuilderUserSelect from "./components/QuoteBuilder-UserSelect"
import QuoteBuilderPriceChangeDialog from "./components/QuoteBuilder-PriceChangeDialog"
import { Button } from "@/components/ui/button"

export type DraftLineItem = {
  localId: string
  description: string
  qty: number
  unitPrice: number
  unitCost: number
}

export type DraftSetupCost = {
  localId: string
  label: string
  qty: number
  rate: number
  cost: number
}

type Props = {
  orderId?: number
  token?: string
  role: string
  taxRate: number
  sessionUserId: string | null
}

function toDraftLineItem(li: OrderDetail["orderLineItems"][0]): DraftLineItem {
  return { localId: String(li.id), description: li.description, qty: li.qty, unitPrice: li.unitPrice, unitCost: li.unitCost }
}

function toDraftSetupCost(sc: OrderDetail["setUpCosts"][0]): DraftSetupCost {
  const items = sc.customSetupItems as SetupCostItem[] | null
  const item = items?.[0]
  return {
    localId: String(sc.id),
    label: item?.label ?? "",
    qty: item?.qty ?? 1,
    rate: item?.rate ?? sc.userTotal,
    cost: item?.cost ?? sc.adminTotal,
  }
}

export default function QuoteBuilder({ orderId, token, role, taxRate, sessionUserId }: Props) {
  const router = useRouter()
  const [order, setOrder] = useState<OrderDetail | null>(null)
  const [loading, setLoading] = useState(!!(orderId || token))
  const [draftLineItems, setDraftLineItems] = useState<DraftLineItem[]>([])
  const [draftSetupCosts, setDraftSetupCosts] = useState<DraftSetupCost[]>([])
  const [draftNickname, setDraftNickname] = useState("")
  const [draftUserId, setDraftUserId] = useState<string | null>(null)
  const [draftDiscount, setDraftDiscount] = useState<number | null>(null)
  const [showPriceChangeDialog, setShowPriceChangeDialog] = useState(false)
  const [priceChangeDiff, setPriceChangeDiff] = useState<{ prev: number; next: number } | null>(null)
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    if (!orderId && !token) { setLoading(false); return }
    const url = orderId ? `/api/orders/${orderId}` : `/api/orders/by-token/${token}`
    fetch(url)
      .then((r) => r.json())
      .then(({ data, error }) => {
        if (error) { toast.error(error); return }
        setOrder(data)
        setDraftLineItems(data.orderLineItems.map(toDraftLineItem))
        setDraftSetupCosts(data.setUpCosts.map(toDraftSetupCost))
        setDraftNickname(data.nickname ?? "")
        setDraftUserId(data.user?.id ?? null)
        setDraftDiscount(data.discountManual)
      })
      .finally(() => setLoading(false))
  }, [orderId, token])

  const permissions = getQuoteBuilderPermissions({
    role,
    stateId: order?.stateId ?? 1,
    orderUserId: order?.user?.id ?? null,
    sessionUserId,
  })

  const liveLineItems = draftLineItems.map((li) => ({ qty: li.qty, unitPrice: li.unitPrice, unitCost: li.unitCost }))
  const liveSetupCosts = draftSetupCosts.map((sc) => ({ userTotal: sc.rate * sc.qty, adminTotal: sc.cost * sc.qty }))
  const liveTotals = computeOrderTotals({ lineItems: liveLineItems, setUpCosts: liveSetupCosts, taxRate, discountManual: draftDiscount })

  async function executeSave() {
    if (!order) return
    const body: Record<string, any> = {
      nickname: draftNickname || null,
      lineItems: draftLineItems.map(({ description, qty, unitPrice, unitCost }) => ({ description, qty, unitPrice, unitCost })),
      setUpCosts: draftSetupCosts.map(({ label, qty, rate, cost }) => ({ label, qty, rate, cost })),
    }
    if (role === "admin") {
      body.discountManual = draftDiscount
      body.userId = draftUserId
    }
    if (permissions.saveAction === "revert_state") {
      body.stateId = 1
    }

    startTransition(async () => {
      const res = await fetch(`/api/orders/${order.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      const json = await res.json()
      if (json.error) { toast.error(json.error); return }
      const updated: OrderDetail = json.data
      setOrder(updated)
      setDraftLineItems(updated.orderLineItems.map(toDraftLineItem))
      setDraftSetupCosts(updated.setUpCosts.map(toDraftSetupCost))
      setDraftNickname(updated.nickname ?? "")
      setDraftUserId(updated.user?.id ?? null)
      setDraftDiscount(updated.discountManual)
      toast.success("Saved")
      if (permissions.saveAction === "revert_state") toast.info("Sent back for review — admin will re-approve.")
    })
  }

  function handleSaveClick() {
    if (!order) return
    if (role === "admin" && liveTotals.totalPrice !== order.totalPrice) {
      setPriceChangeDiff({ prev: order.totalPrice, next: liveTotals.totalPrice })
      setShowPriceChangeDialog(true)
      return
    }
    executeSave()
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="animate-spin text-(--color-muted)" size={32} />
      </div>
    )
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
      <QuoteBuilderBanner order={order} role={role} />

      <QuoteBuilderOrderItems
        items={draftLineItems}
        onChange={setDraftLineItems}
        permissions={permissions}
      />

      <QuoteBuilderSetupCosts
        costs={draftSetupCosts}
        onChange={setDraftSetupCosts}
        permissions={permissions}
        role={role}
      />

      <QuoteBuilderOrderTotals
        totals={liveTotals}
        discount={draftDiscount}
        onDiscountChange={role === "admin" ? setDraftDiscount : undefined}
        role={role}
      />

      {role === "admin" ? (
        <QuoteBuilderUserSelect
          selectedUserId={draftUserId}
          nickname={draftNickname}
          onUserChange={setDraftUserId}
          onNicknameChange={setDraftNickname}
        />
      ) : null}

      {permissions.saveAction !== "none" ? (
        <div className="pb-[max(1.5rem,env(safe-area-inset-bottom))]">
          {permissions.saveAction === "login" ? (
            <Button className="w-full" onClick={() => router.push("/login")}>
              Sign In to Save
            </Button>
          ) : (
            <Button className="w-full gap-2" onClick={handleSaveClick} disabled={isPending}>
              {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {isPending ? "Saving…" : permissions.saveAction === "revert_state" ? "Submit Changes" : "Save Changes"}
            </Button>
          )}
        </div>
      ) : null}

      <QuoteBuilderPriceChangeDialog
        open={showPriceChangeDialog}
        diff={priceChangeDiff}
        onCancel={() => setShowPriceChangeDialog(false)}
        onConfirm={() => { setShowPriceChangeDialog(false); executeSave() }}
      />
    </div>
  )
}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: errors about missing imported components (those are created in the next tasks — this is expected). There should be no errors in the files you just created themselves.

- [ ] **Step 4: Commit**

```bash
git add src/app/quote-builder/page.tsx src/app/quote-builder/QuoteBuilder.tsx
git commit -m "feat: quote builder page and container"
```

---

## Task 10: QuoteBuilder-Banner

**Files:**
- Create: `src/app/quote-builder/components/QuoteBuilder-Banner.tsx`

- [ ] **Step 1: Create the file**

```tsx
import { Lock } from "lucide-react"
import type { OrderDetail } from "@/models/order"

type Props = {
  order: OrderDetail | null
  role: string
}

export default function QuoteBuilderBanner({ order, role }: Props) {
  if (!order) return null

  const { stateId, id } = order

  if (role === "admin") {
    return (
      <div className="rounded-lg border border-(--color-warning) bg-(--color-warning)/10 px-4 py-3 text-sm text-(--color-warning)">
        Edit Mode — Order #{id}. Changes save when you click Save Changes.
      </div>
    )
  }

  if (stateId >= 3) {
    return (
      <div className="rounded-lg border border-(--color-border) bg-(--color-surface) px-4 py-3 text-sm text-(--color-muted) flex items-center gap-2">
        <Lock size={14} />
        This order is in progress and can no longer be edited.
      </div>
    )
  }

  if (stateId === 2) {
    return (
      <div className="rounded-lg border border-(--color-warning) bg-(--color-warning)/10 px-4 py-3 text-sm text-(--color-warning)">
        Your quote is approved. Making changes will send it back for review.
      </div>
    )
  }

  return (
    <div className="rounded-lg border border-(--color-border) bg-(--color-surface) px-4 py-3 text-sm text-(--color-muted)">
      Your quote is being reviewed. You can still make changes.
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/quote-builder/components/QuoteBuilder-Banner.tsx
git commit -m "feat: quote builder banner component"
```

---

## Task 11: QuoteBuilder-OrderItems

**Files:**
- Create: `src/app/quote-builder/components/QuoteBuilder-OrderItems.tsx`

Inline-edit table. "Add Line Item ▼" dropdown loads presets from API. "Add Custom" opens a small dialog.

- [ ] **Step 1: Create the file**

```tsx
"use client"

import { useEffect, useState } from "react"
import { Trash2, ChevronDown } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { newLocalId } from "../quoteBuilderUtils"
import type { LineItemPreset } from "@/models/preset"
import type { DraftLineItem } from "../QuoteBuilder"
import type { QuoteBuilderPermissions } from "../quoteBuilderPermissions"

type Props = {
  items: DraftLineItem[]
  onChange: (items: DraftLineItem[]) => void
  permissions: QuoteBuilderPermissions
}

export default function QuoteBuilderOrderItems({ items, onChange, permissions }: Props) {
  const [presets, setPresets] = useState<LineItemPreset[]>([])
  const [showCustomDialog, setShowCustomDialog] = useState(false)
  const [customDraft, setCustomDraft] = useState({ description: "", qty: 1, unitPrice: 0, unitCost: 0 })

  useEffect(() => {
    fetch("/api/line-item-presets")
      .then((r) => r.json())
      .then(({ data }) => { if (data) setPresets(data) })
  }, [])

  function updateItem(localId: string, field: keyof DraftLineItem, value: string | number) {
    onChange(items.map((item) => item.localId === localId ? { ...item, [field]: value } : item))
  }

  function removeItem(localId: string) {
    onChange(items.filter((item) => item.localId !== localId))
  }

  function addFromPreset(preset: LineItemPreset) {
    onChange([...items, {
      localId: newLocalId(),
      description: preset.name,
      qty: 1,
      unitPrice: preset.defaultPrice,
      unitCost: preset.defaultCost,
    }])
  }

  function addCustomItem() {
    onChange([...items, { localId: newLocalId(), ...customDraft }])
    setCustomDraft({ description: "", qty: 1, unitPrice: 0, unitCost: 0 })
    setShowCustomDialog(false)
  }

  const isAdmin = permissions.canEditLineItemPrices
  const canEdit = permissions.canEditLineItemQty

  const totalQty = items.reduce((s, li) => s + li.qty, 0)
  const totalAmount = items.reduce((s, li) => s + li.qty * li.unitPrice, 0)
  const totalCost = items.reduce((s, li) => s + li.qty * li.unitCost, 0)
  const totalProfit = totalAmount - totalCost

  return (
    <div className="space-y-3">
      <h2 className="text-base font-semibold text-(--color-foreground)">Order Items</h2>
      <div className="w-full overflow-x-auto border border-(--color-border) rounded-lg">
        <table className={`w-full text-sm ${isAdmin ? "min-w-[720px]" : "min-w-[480px]"}`}>
          <thead>
            <tr className="border-b border-(--color-border) bg-(--color-surface)">
              <th className="text-left px-3 py-2.5 font-medium text-(--color-muted)">Description</th>
              <th className="text-right px-3 py-2.5 font-medium text-(--color-muted) w-16">Qty</th>
              <th className="text-right px-3 py-2.5 font-medium text-(--color-muted) w-24">Rate</th>
              {isAdmin ? <th className="text-right px-3 py-2.5 font-medium text-(--color-muted) w-24">Cost</th> : null}
              <th className="text-right px-3 py-2.5 font-medium text-(--color-muted) w-24">Amount</th>
              {isAdmin ? <th className="text-right px-3 py-2.5 font-medium text-(--color-success) w-24">Profit</th> : null}
              {permissions.canAddRemoveLineItems ? <th className="w-8" /> : null}
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.localId} className="border-b border-(--color-border) last:border-0">
                <td className="px-3 py-2">
                  {canEdit ? (
                    <Input
                      value={item.description}
                      onChange={(e) => updateItem(item.localId, "description", e.target.value)}
                      className="text-base h-8"
                      placeholder="Description"
                    />
                  ) : (
                    <span className="text-(--color-foreground)">{item.description}</span>
                  )}
                </td>
                <td className="px-3 py-2 text-right">
                  {canEdit ? (
                    <Input
                      type="number" inputMode="numeric" min={1}
                      value={item.qty}
                      onChange={(e) => updateItem(item.localId, "qty", Math.max(1, Number(e.target.value)))}
                      className="text-base h-8 w-16 text-right"
                    />
                  ) : (
                    <span>{item.qty}</span>
                  )}
                </td>
                <td className="px-3 py-2 text-right">
                  {isAdmin ? (
                    <Input
                      type="number" inputMode="decimal" step="0.01"
                      value={item.unitPrice}
                      onChange={(e) => updateItem(item.localId, "unitPrice", Number(e.target.value))}
                      className="text-base h-8 w-24 text-right"
                    />
                  ) : (
                    <span className="text-(--color-muted)">${item.unitPrice.toFixed(2)}</span>
                  )}
                </td>
                {isAdmin ? (
                  <td className="px-3 py-2 text-right">
                    <Input
                      type="number" inputMode="decimal" step="0.01"
                      value={item.unitCost}
                      onChange={(e) => updateItem(item.localId, "unitCost", Number(e.target.value))}
                      className="text-base h-8 w-24 text-right"
                    />
                  </td>
                ) : null}
                <td className="px-3 py-2 text-right font-medium text-(--color-foreground)">
                  ${(item.qty * item.unitPrice).toFixed(2)}
                </td>
                {isAdmin ? (
                  <td className="px-3 py-2 text-right text-(--color-success)">
                    ${((item.qty * item.unitPrice) - (item.qty * item.unitCost)).toFixed(2)}
                  </td>
                ) : null}
                {permissions.canAddRemoveLineItems ? (
                  <td className="px-3 py-2">
                    <Button
                      variant="ghost" size="sm"
                      className="h-8 w-8 p-0 text-(--color-danger)"
                      onClick={() => removeItem(item.localId)}
                      aria-label="Remove item"
                    >
                      <Trash2 size={14} />
                    </Button>
                  </td>
                ) : null}
              </tr>
            ))}
            {/* Totals row */}
            <tr className="border-t-2 border-(--color-border) bg-(--color-surface) font-semibold">
              <td className="px-3 py-2 text-(--color-muted) text-xs uppercase">Totals</td>
              <td className="px-3 py-2 text-right">{totalQty}</td>
              <td />
              {isAdmin ? <td className="px-3 py-2 text-right text-xs text-(--color-muted)">${totalCost.toFixed(2)}</td> : null}
              <td className="px-3 py-2 text-right">${totalAmount.toFixed(2)}</td>
              {isAdmin ? <td className="px-3 py-2 text-right text-(--color-success)">${totalProfit.toFixed(2)}</td> : null}
              {permissions.canAddRemoveLineItems ? <td /> : null}
            </tr>
          </tbody>
        </table>
      </div>

      {permissions.canAddRemoveLineItems ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="gap-1">
              Add Line Item <ChevronDown size={14} />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-56 bg-(--color-background)">
            {presets.map((p) => (
              <DropdownMenuItem key={p.id} onClick={() => addFromPreset(p)}>
                <div>
                  <p className="font-medium">{p.name}</p>
                  {p.description ? <p className="text-xs text-(--color-muted)">{p.description}</p> : null}
                </div>
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => setShowCustomDialog(true)}>
              + Add Custom Item
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ) : null}

      <Dialog open={showCustomDialog} onOpenChange={setShowCustomDialog}>
        <DialogContent className="bg-(--color-background)">
          <DialogHeader>
            <DialogTitle>Add Custom Item</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Description</Label>
              <Input
                value={customDraft.description}
                onChange={(e) => setCustomDraft((d) => ({ ...d, description: e.target.value }))}
                className="text-base"
                placeholder="Item description"
              />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label>Qty</Label>
                <Input type="number" inputMode="numeric" min={1} value={customDraft.qty}
                  onChange={(e) => setCustomDraft((d) => ({ ...d, qty: Math.max(1, Number(e.target.value)) }))}
                  className="text-base" />
              </div>
              {isAdmin ? (
                <>
                  <div className="space-y-1.5">
                    <Label>Price</Label>
                    <Input type="number" inputMode="decimal" step="0.01" value={customDraft.unitPrice}
                      onChange={(e) => setCustomDraft((d) => ({ ...d, unitPrice: Number(e.target.value) }))}
                      className="text-base" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Cost</Label>
                    <Input type="number" inputMode="decimal" step="0.01" value={customDraft.unitCost}
                      onChange={(e) => setCustomDraft((d) => ({ ...d, unitCost: Number(e.target.value) }))}
                      className="text-base" />
                  </div>
                </>
              ) : null}
            </div>
          </div>
          <DialogFooter className="pb-[max(1rem,env(safe-area-inset-bottom))]">
            <Button variant="outline" onClick={() => setShowCustomDialog(false)}>Cancel</Button>
            <Button autoFocus onClick={addCustomItem} disabled={!customDraft.description}>Add Item</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/quote-builder/components/QuoteBuilder-OrderItems.tsx
git commit -m "feat: quote builder order items table with preset dropdown"
```

---

## Task 12: QuoteBuilder-SetupCosts

**Files:**
- Create: `src/app/quote-builder/components/QuoteBuilder-SetupCosts.tsx`

- [ ] **Step 1: Create the file**

```tsx
"use client"

import { useEffect, useState } from "react"
import { Trash2, ChevronDown } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { newLocalId } from "../quoteBuilderUtils"
import type { SetupFeePreset } from "@/models/preset"
import type { DraftSetupCost } from "../QuoteBuilder"
import type { QuoteBuilderPermissions } from "../quoteBuilderPermissions"

type Props = {
  costs: DraftSetupCost[]
  onChange: (costs: DraftSetupCost[]) => void
  permissions: QuoteBuilderPermissions
  role: string
}

export default function QuoteBuilderSetupCosts({ costs, onChange, permissions, role }: Props) {
  const [presets, setPresets] = useState<SetupFeePreset[]>([])
  const isAdmin = role === "admin"
  const canEdit = permissions.canEditSetupCosts  // true for admin + employee

  useEffect(() => {
    fetch("/api/setup-fee-presets")
      .then((r) => r.json())
      .then(({ data }) => { if (data) setPresets(data) })
  }, [])

  function updateCost(localId: string, field: keyof DraftSetupCost, value: string | number) {
    onChange(costs.map((c) => c.localId === localId ? { ...c, [field]: value } : c))
  }

  function removeCost(localId: string) {
    onChange(costs.filter((c) => c.localId !== localId))
  }

  function addFromPreset(preset: SetupFeePreset) {
    onChange([...costs, {
      localId: newLocalId(),
      label: preset.name,
      qty: 1,
      rate: preset.defaultRate,
      cost: preset.defaultCost,
    }])
  }

  function addBlankRow() {
    onChange([...costs, { localId: newLocalId(), label: "", qty: 1, rate: 0, cost: 0 }])
  }

  if (costs.length === 0 && !canEdit) return null

  return (
    <div className="space-y-3">
      <h2 className="text-base font-semibold text-(--color-foreground)">Setup Costs</h2>

      {costs.length > 0 ? (
        <div className="w-full overflow-x-auto border border-(--color-border) rounded-lg">
          <table className={`w-full text-sm ${canEdit ? "min-w-[560px]" : "min-w-[400px]"}`}>
            <thead>
              <tr className="border-b border-(--color-border) bg-(--color-surface)">
                <th className="text-left px-3 py-2.5 font-medium text-(--color-muted)">Name</th>
                <th className="text-right px-3 py-2.5 font-medium text-(--color-muted) w-16">Qty</th>
                <th className="text-right px-3 py-2.5 font-medium text-(--color-muted) w-24">Rate</th>
                {canEdit ? <th className="text-right px-3 py-2.5 font-medium text-(--color-muted) w-24">Cost</th> : null}
                <th className="text-right px-3 py-2.5 font-medium text-(--color-muted) w-24">Subtotal</th>
                {canEdit ? <th className="w-8" /> : null}
              </tr>
            </thead>
            <tbody>
              {costs.map((cost) => (
                <tr key={cost.localId} className="border-b border-(--color-border) last:border-0">
                  <td className="px-3 py-2">
                    {canEdit ? (
                      <Input value={cost.label} onChange={(e) => updateCost(cost.localId, "label", e.target.value)}
                        className="text-base h-8" placeholder="Name" />
                    ) : (
                      <span className="text-(--color-foreground)">{cost.label}</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {canEdit ? (
                      <Input type="number" inputMode="numeric" min={1} value={cost.qty}
                        onChange={(e) => updateCost(cost.localId, "qty", Math.max(1, Number(e.target.value)))}
                        className="text-base h-8 w-16 text-right" />
                    ) : (
                      <span>{cost.qty}</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {canEdit ? (
                      <Input type="number" inputMode="decimal" step="0.01" value={cost.rate}
                        onChange={(e) => updateCost(cost.localId, "rate", Number(e.target.value))}
                        className="text-base h-8 w-24 text-right" />
                    ) : (
                      <span className="text-(--color-muted)">${cost.rate.toFixed(2)}</span>
                    )}
                  </td>
                  {canEdit ? (
                    <td className="px-3 py-2 text-right">
                      <Input type="number" inputMode="decimal" step="0.01" value={cost.cost}
                        onChange={(e) => updateCost(cost.localId, "cost", Number(e.target.value))}
                        className="text-base h-8 w-24 text-right" />
                    </td>
                  ) : null}
                  <td className="px-3 py-2 text-right font-medium text-(--color-foreground)">
                    ${(cost.rate * cost.qty).toFixed(2)}
                  </td>
                  {canEdit ? (
                    <td className="px-3 py-2">
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-(--color-danger)"
                        onClick={() => removeCost(cost.localId)} aria-label="Remove">
                        <Trash2 size={14} />
                      </Button>
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {canEdit ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="gap-1">
              Add Setup Cost <ChevronDown size={14} />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-56 bg-(--color-background)">
            {presets.map((p) => (
              <DropdownMenuItem key={p.id} onClick={() => addFromPreset(p)}>
                <div>
                  <p className="font-medium">{p.name}</p>
                  {p.description ? <p className="text-xs text-(--color-muted)">{p.description}</p> : null}
                </div>
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={addBlankRow}>+ Add Custom</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ) : null}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/quote-builder/components/QuoteBuilder-SetupCosts.tsx
git commit -m "feat: quote builder setup costs section with preset dropdown"
```

---

## Task 13: QuoteBuilder-OrderTotals

**Files:**
- Create: `src/app/quote-builder/components/QuoteBuilder-OrderTotals.tsx`

Live-computed panel. No network calls — pure props. Admin sees discount input + profit.

- [ ] **Step 1: Create the file**

```tsx
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import type { TotalsResult } from "@/models/order"

type Props = {
  totals: TotalsResult
  discount: number | null
  onDiscountChange?: (v: number | null) => void
  role: string
}

export default function QuoteBuilderOrderTotals({ totals, discount, onDiscountChange, role }: Props) {
  const isAdmin = role === "admin"

  return (
    <div className="border border-(--color-border) rounded-lg p-4 space-y-2 text-sm bg-(--color-background)">
      <h2 className="text-base font-semibold text-(--color-foreground) mb-3">Order Totals</h2>

      <div className="flex justify-between">
        <span className="text-(--color-muted)">Items</span>
        <span>${totals.totalAmount.toFixed(2)}</span>
      </div>

      {totals.totalSetUpPrice > 0 ? (
        <div className="flex justify-between">
          <span className="text-(--color-muted)">Setup</span>
          <span>${totals.totalSetUpPrice.toFixed(2)}</span>
        </div>
      ) : null}

      {isAdmin ? (
        <div className="flex items-center justify-between gap-4 py-1">
          <Label className="text-(--color-muted) shrink-0">Discount ($)</Label>
          <Input
            type="number" inputMode="decimal" step="0.01"
            value={discount ?? ""}
            onChange={(e) => onDiscountChange?.(e.target.value ? Number(e.target.value) : null)}
            className="text-base h-8 w-28 text-right"
            placeholder="0.00"
          />
        </div>
      ) : discount ? (
        <div className="flex justify-between text-(--color-danger)">
          <span>Discount</span>
          <span>-${discount.toFixed(2)}</span>
        </div>
      ) : null}

      <div className="flex justify-between border-t border-(--color-border) pt-2">
        <span className="text-(--color-muted)">Subtotal</span>
        <span>${totals.subTotal.toFixed(2)}</span>
      </div>

      <div className="flex justify-between">
        <span className="text-(--color-muted)">Tax</span>
        <span>${totals.salesTax.toFixed(2)}</span>
      </div>

      <div className="flex justify-between font-semibold text-base border-t border-(--color-border) pt-2">
        <span>Total</span>
        <span>${totals.totalPrice.toFixed(2)}</span>
      </div>

      {isAdmin ? (
        <div className="flex justify-between text-(--color-success) pt-1">
          <span>Profit</span>
          <span>${totals.profit.toFixed(2)}</span>
        </div>
      ) : null}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/quote-builder/components/QuoteBuilder-OrderTotals.tsx
git commit -m "feat: quote builder order totals panel"
```

---

## Task 14: QuoteBuilder-UserSelect

**Files:**
- Create: `src/app/quote-builder/components/QuoteBuilder-UserSelect.tsx`

Admin-only. Fetches all users, search-filters the list, shows a dropdown.

- [ ] **Step 1: Create the file**

```tsx
"use client"

import { useEffect, useState } from "react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import type { UserSummary } from "@/models/user"  // defined in Plan 2; verify it exists before running

type Props = {
  selectedUserId: string | null
  nickname: string
  onUserChange: (id: string | null) => void
  onNicknameChange: (name: string) => void
}

export default function QuoteBuilderUserSelect({ selectedUserId, nickname, onUserChange, onNicknameChange }: Props) {
  const [users, setUsers] = useState<UserSummary[]>([])
  const [query, setQuery] = useState("")
  const [open, setOpen] = useState(false)

  useEffect(() => {
    fetch("/api/users")
      .then((r) => r.json())
      .then(({ data }) => { if (data) setUsers(data) })
  }, [])

  const selected = users.find((u) => u.id === selectedUserId)

  const filtered = query.trim()
    ? users.filter((u) =>
        `${u.firstName} ${u.lastName} ${u.email}`.toLowerCase().includes(query.toLowerCase())
      )
    : users.slice(0, 10)

  function selectUser(id: string | null) {
    onUserChange(id)
    setQuery("")
    setOpen(false)
  }

  return (
    <div className="border border-(--color-border) rounded-lg p-4 space-y-4 bg-(--color-background)">
      <h2 className="text-base font-semibold text-(--color-foreground)">Admin Settings</h2>

      <div className="space-y-1.5">
        <Label>Assign to User</Label>
        <div className="relative">
          <Input
            value={open ? query : (selected ? `${selected.firstName} ${selected.lastName} (${selected.email})` : "No Account Yet")}
            onChange={(e) => { setQuery(e.target.value); setOpen(true) }}
            onFocus={() => setOpen(true)}
            onBlur={() => setTimeout(() => setOpen(false), 150)}
            className="text-base"
            placeholder="Search by name or email…"
          />
          {open ? (
            <div className="absolute z-20 top-full left-0 right-0 mt-1 border border-(--color-border) rounded-md bg-(--color-background) shadow-md max-h-52 overflow-y-auto">
              <button
                type="button"
                className="w-full text-left px-3 py-2 text-sm hover:bg-(--color-surface) text-(--color-muted)"
                onMouseDown={() => selectUser(null)}
              >
                No Account Yet
              </button>
              {filtered.map((u) => (
                <button
                  key={u.id}
                  type="button"
                  className="w-full text-left px-3 py-2 text-sm hover:bg-(--color-surface)"
                  onMouseDown={() => selectUser(u.id)}
                >
                  <span className="font-medium">{u.firstName} {u.lastName}</span>
                  <span className="text-(--color-muted) ml-2 text-xs">{u.email}</span>
                </button>
              ))}
            </div>
          ) : null}
        </div>
      </div>

      <div className="space-y-1.5">
        <Label>Order Name / Nickname</Label>
        <Input
          value={nickname}
          onChange={(e) => onNicknameChange(e.target.value)}
          className="text-base"
          placeholder="e.g. Spring Merch Drop"
        />
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/quote-builder/components/QuoteBuilder-UserSelect.tsx
git commit -m "feat: quote builder user select component"
```

---

## Task 15: QuoteBuilder-PriceChangeDialog

**Files:**
- Create: `src/app/quote-builder/components/QuoteBuilder-PriceChangeDialog.tsx`

- [ ] **Step 1: Create the file**

```tsx
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle,
  AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction,
} from "@/components/ui/alert-dialog"

type Props = {
  open: boolean
  diff: { prev: number; next: number } | null
  onCancel: () => void
  onConfirm: () => void
}

export default function QuoteBuilderPriceChangeDialog({ open, diff, onCancel, onConfirm }: Props) {
  if (!diff) return null
  const delta = diff.next - diff.prev
  const isIncrease = delta > 0

  return (
    <AlertDialog open={open} onOpenChange={(v) => { if (!v) onCancel() }}>
      <AlertDialogContent className="bg-(--color-background)">
        <AlertDialogHeader>
          <AlertDialogTitle>Price Change Detected</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-(--color-muted)">Previous total</span>
                <span>${diff.prev.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-(--color-muted)">New total</span>
                <span>${diff.next.toFixed(2)}</span>
              </div>
              <div className={`flex justify-between font-semibold ${isIncrease ? "text-(--color-danger)" : "text-(--color-success)"}`}>
                <span>Difference</span>
                <span>{isIncrease ? "+" : ""}${delta.toFixed(2)}</span>
              </div>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="pb-[max(1rem,env(safe-area-inset-bottom))]">
          <AlertDialogCancel onClick={onCancel}>Cancel</AlertDialogCancel>
          <AlertDialogAction autoFocus onClick={onConfirm}>Confirm & Save</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
```

- [ ] **Step 2: Verify the quote builder compiles end-to-end**

```bash
npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 3: Smoke test the quote builder in the browser**

Open Prisma Studio (`npx prisma studio`), find the seed order in the Orders table, and copy its token (format: `ord-{16chars}`). Then navigate to `http://localhost:3000/quote-builder?token=<your-token>` while logged in as admin.

Expected:
- Yellow admin banner
- Order items table with 2 rows (T-Shirts + Hoodies), inline-editable
- Empty setup costs section with "Add Setup Cost ▼" dropdown
- Totals panel showing $258.60
- Admin Settings section (user search + nickname)
- "Save Changes" button at bottom

- [ ] **Step 4: Commit**

```bash
git add src/app/quote-builder/components/QuoteBuilder-PriceChangeDialog.tsx
git commit -m "feat: price change confirmation dialog — quote builder complete"
```

---

## Task 16: Get Quote Page + Form

**Files:**
- Create: `src/app/get-quote/page.tsx`
- Create: `src/app/get-quote/components/GetQuote-Form.tsx`

Public page. No auth required. On submit, creates an order (POST /api/orders) and redirects to `/orders/[token]`. There is no intermediate container — `page.tsx` imports `GetQuote-Form` directly since there is no server-fetched data or server-side logic needed.

- [ ] **Step 1: Create src/app/get-quote/page.tsx**

```tsx
import GetQuoteForm from "./components/GetQuote-Form"

export default function GetQuotePage() {
  return <GetQuoteForm />
}
```

- [ ] **Step 2: Create src/app/get-quote/components/GetQuote-Form.tsx**

```tsx
"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { useEffect } from "react"
import { Loader2, Trash2, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "sonner"
import type { LineItemPreset } from "@/models/preset"

type FormLineItem = {
  localId: string
  presetId: number | null
  description: string
  qty: number
  unitPrice: number
  isCustom: boolean
}

function newId() { return `li-${Date.now()}-${Math.random()}` }

export default function GetQuoteForm() {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [presets, setPresets] = useState<LineItemPreset[]>([])
  const [customerNotes, setCustomerNotes] = useState("")
  const [dueDate, setDueDate] = useState("")
  const [isHardDeadline, setIsHardDeadline] = useState(false)
  const [lineItems, setLineItems] = useState<FormLineItem[]>([])

  useEffect(() => {
    fetch("/api/line-item-presets")
      .then((r) => r.json())
      .then(({ data }) => { if (data) setPresets(data) })
  }, [])

  function addPreset(preset: LineItemPreset) {
    setLineItems((prev) => [...prev, {
      localId: newId(),
      presetId: preset.id,
      description: preset.name,
      qty: 1,
      unitPrice: preset.defaultPrice,
      isCustom: false,
    }])
  }

  function addCustom() {
    setLineItems((prev) => [...prev, {
      localId: newId(),
      presetId: null,
      description: "",
      qty: 1,
      unitPrice: 0,
      isCustom: true,
    }])
  }

  function updateItem(localId: string, field: keyof FormLineItem, value: any) {
    setLineItems((prev) => prev.map((li) => li.localId === localId ? { ...li, [field]: value } : li))
  }

  function removeItem(localId: string) {
    setLineItems((prev) => prev.filter((li) => li.localId !== localId))
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()

    if (!customerNotes.trim()) {
      toast.error("Please describe what you need.")
      return
    }

    if (lineItems.length === 0) {
      toast.error("Please add at least one item.")
      return
    }

    startTransition(async () => {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerNotes,
          dueDate: dueDate || null,
          isHardDeadline,
          lineItems: lineItems.map(({ description, qty, unitPrice }) => ({
            description,
            qty,
            unitPrice: unitPrice ?? 0,
          })),
        }),
      })
      const json = await res.json()
      if (json.error) { toast.error(json.error); return }

      const order = json.data
      const label = order.nickname ?? `Order #${order.id}`
      router.push(`/orders/${order.token}?name=${encodeURIComponent(label)}`)
    })
  }

  const presetsNotYetAdded = presets.filter(
    (p) => !lineItems.some((li) => li.presetId === p.id)
  )

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-(--color-foreground) mb-2">Request a Quote</h1>
      <p className="text-sm text-(--color-muted) mb-6">
        Tell us what you need. We'll review and send you a detailed quote shortly.
      </p>
      <form onSubmit={handleSubmit} className="space-y-6">
      {/* Job description */}
      <div className="space-y-1.5">
        <Label htmlFor="customerNotes">What do you need? *</Label>
        <Textarea
          id="customerNotes"
          value={customerNotes}
          onChange={(e) => setCustomerNotes(e.target.value)}
          rows={4}
          placeholder="Describe your project — quantities, colors, style, any special requirements…"
          required
        />
      </div>

      {/* Line items */}
      <div className="space-y-3">
        <Label>Items</Label>
        {lineItems.length > 0 ? (
          <div className="w-full overflow-x-auto border border-(--color-border) rounded-lg">
            <table className="w-full text-sm min-w-[420px]">
              <thead>
                <tr className="border-b border-(--color-border) bg-(--color-surface)">
                  <th className="text-left px-3 py-2.5 font-medium text-(--color-muted)">Item</th>
                  <th className="text-right px-3 py-2.5 font-medium text-(--color-muted) w-16">Qty</th>
                  <th className="text-right px-3 py-2.5 font-medium text-(--color-muted) w-24">Price</th>
                  <th className="text-right px-3 py-2.5 font-medium text-(--color-muted) w-24">Total</th>
                  <th className="w-8" />
                </tr>
              </thead>
              <tbody>
                {lineItems.map((item) => (
                  <tr key={item.localId} className="border-b border-(--color-border) last:border-0">
                    <td className="px-3 py-2">
                      {item.isCustom ? (
                        <Input
                          value={item.description}
                          onChange={(e) => updateItem(item.localId, "description", e.target.value)}
                          className="text-base h-8"
                          placeholder="Custom item description"
                        />
                      ) : (
                        <div>
                          <p className="font-medium text-(--color-foreground)">{item.description}</p>
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <Input
                        type="number" inputMode="numeric" min={1}
                        value={item.qty}
                        onChange={(e) => updateItem(item.localId, "qty", Math.max(1, Number(e.target.value)))}
                        className="text-base h-8 w-16 text-right"
                      />
                    </td>
                    <td className="px-3 py-2 text-right text-(--color-muted)">
                      {item.isCustom ? "TBD" : `$${Number(item.unitPrice).toFixed(2)}`}
                    </td>
                    <td className="px-3 py-2 text-right font-medium text-(--color-foreground)">
                      {item.isCustom ? "TBD" : `$${(item.qty * Number(item.unitPrice)).toFixed(2)}`}
                    </td>
                    <td className="px-3 py-2">
                      <Button
                        type="button" variant="ghost" size="sm"
                        className="h-8 w-8 p-0 text-(--color-danger)"
                        onClick={() => removeItem(item.localId)}
                        aria-label="Remove"
                      >
                        <Trash2 size={14} />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}

        {/* Add buttons */}
        <div className="flex flex-wrap gap-2">
          {presetsNotYetAdded.map((p) => (
            <Button key={p.id} type="button" variant="outline" size="sm" onClick={() => addPreset(p)} className="gap-1">
              <Plus size={12} /> {p.name}
            </Button>
          ))}
          <Button type="button" variant="outline" size="sm" onClick={addCustom} className="gap-1">
            <Plus size={12} /> Custom Item
          </Button>
        </div>
      </div>

      {/* Due date */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="dueDate">Due Date (optional)</Label>
          <Input
            id="dueDate"
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            className="text-base"
          />
        </div>
        <div className="flex items-end pb-1 gap-2">
          <input
            type="checkbox"
            id="isHardDeadline"
            checked={isHardDeadline}
            onChange={(e) => setIsHardDeadline(e.target.checked)}
            className="h-4 w-4 mt-0.5"
          />
          <Label htmlFor="isHardDeadline" className="cursor-pointer">Hard deadline</Label>
        </div>
      </div>

      <Button type="submit" disabled={isPending} className="w-full gap-2">
        {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        {isPending ? "Submitting…" : "Submit Quote Request"}
      </Button>
    </form>
    </div>
  )
}
```

- [ ] **Step 3: Smoke test in browser**

Navigate to `http://localhost:3000/get-quote`.

1. Add a couple items using the preset buttons
2. Fill in a description
3. Click Submit

Expected: redirects to `/orders/[token]` with the order created (check DB or network tab for the new order).

- [ ] **Step 4: Commit**

```bash
git add src/app/get-quote/
git commit -m "feat: get-quote public form page"
```

---

## Task 17: Enhanced Public Order Page

**Files:**
- Create: `src/app/orders/[token]/Orders-ActionButtons.tsx`
- Modify: `src/app/orders/[token]/page.tsx`
- Modify: `src/app/orders/[token]/layout.tsx`

Adds: Due Now dialog + Share button, View Only banner for state 3+, full order totals, setup costs section, Make Changes link for states 1–2, Edit Order button for admin.

- [ ] **Step 1: Create src/app/orders/[token]/Orders-ActionButtons.tsx**

```tsx
"use client"

import { useState } from "react"
import { Share2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog"
import { toast } from "sonner"

type Props = {
  totalDueNow: number
  showDueNow: boolean
  shareUrl: string
}

export default function OrdersActionButtons({ totalDueNow, showDueNow, shareUrl }: Props) {
  const [dueNowOpen, setDueNowOpen] = useState(false)

  function handleShare() {
    navigator.clipboard.writeText(shareUrl)
    toast.success("Link copied to clipboard")
  }

  return (
    <div className="flex items-center gap-2 shrink-0">
      {showDueNow ? (
        <>
          <Button onClick={() => setDueNowOpen(true)} className="bg-(--color-accent) text-(--color-accent-foreground) hover:bg-(--color-accent)/90">
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
        </>
      ) : null}

      <Button variant="outline" size="icon" onClick={handleShare} aria-label="Share order link">
        <Share2 size={16} />
      </Button>
    </div>
  )
}
```

- [ ] **Step 2: Replace src/app/orders/[token]/page.tsx**

```tsx
import { notFound } from "next/navigation"
import Image from "next/image"
import Link from "next/link"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Lock } from "lucide-react"
import { format } from "date-fns"
import OrdersActionButtons from "./Orders-ActionButtons"

export const dynamic = "force-dynamic"

const siteUrl = process.env.NEXTAUTH_URL ?? process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"

export default async function OrderPublicPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const session = await getServerSession(authOptions)
  const role = session?.user?.role ?? "anonymous"

  const order = await prisma.order.findUnique({
    where: { token },
    select: {
      id: true,
      nickname: true,
      mainImage: true,
      stateId: true,
      paymentPlan: true,
      totalPrice: true,
      totalAmount: true,
      totalSetUpPrice: true,
      subTotal: true,
      salesTax: true,
      discountManual: true,
      dueDate: true,
      customerNotes: true,
      createdAt: true,
      state: { select: { name: true, color: true } },
      orderLineItems: {
        orderBy: { sortOrder: "asc" },
        select: { id: true, description: true, qty: true, unitPrice: true, lineTotal: true, notes: true },
      },
      setUpCosts: {
        select: { id: true, userTotal: true, customSetupItems: true },
      },
      payments: { select: { id: true, amount: true } },
    },
  })

  if (!order) notFound()

  const title = order.nickname ?? `Order #${order.id}`
  const shareUrl = `${siteUrl}/orders/${token}?name=${encodeURIComponent(title)}`
  const alreadyPaid = order.payments.reduce((s, p) => s + Number(p.amount), 0)
  const showDueNow = order.stateId === 2 && order.paymentPlan !== null && order.paymentPlan !== "pay_at_pickup"
  const isReadOnly = order.stateId >= 3
  const isAdmin = role === "admin"
  const discountManual = Number(order.discountManual ?? 0)

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
      {/* Hero image */}
      {order.mainImage ? (
        <div className="relative w-full aspect-video rounded-xl overflow-hidden bg-(--color-surface)">
          <Image src={order.mainImage} alt={title} fill className="object-cover object-center" unoptimized />
        </div>
      ) : null}

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-(--color-foreground)">{title}</h1>
          <p className="text-sm text-(--color-muted) mt-0.5">
            Order #{order.id} · {format(new Date(order.createdAt), "MMM d, yyyy")}
          </p>
        </div>
        <div className="flex flex-col items-end gap-1.5 shrink-0">
          <Badge
            variant="outline"
            style={{ borderColor: order.state.color ?? undefined, color: order.state.color ?? undefined }}
          >
            {order.state.name}
          </Badge>
          <OrdersActionButtons
            totalDueNow={Number(order.totalPrice)}
            showDueNow={showDueNow}
            shareUrl={shareUrl}
          />
          {alreadyPaid > 0 ? (
            <p className="text-xs text-(--color-success)">Already Paid: ${alreadyPaid.toFixed(2)}</p>
          ) : null}
        </div>
      </div>

      {/* View Only banner for state 3+ */}
      {isReadOnly ? (
        <div className="rounded-lg border border-(--color-border) bg-(--color-surface) px-4 py-3 text-sm text-(--color-muted) flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Lock size={14} />
            View Only — this order is in progress and can no longer be edited.
          </div>
          {isAdmin ? (
            <Button asChild variant="outline" size="sm">
              <Link href={`/quote-builder?orderId=${order.id}`}>Edit Order</Link>
            </Button>
          ) : null}
        </div>
      ) : null}

      {/* Customer notes */}
      {order.customerNotes ? (
        <p className="text-sm text-(--color-foreground) bg-(--color-surface) rounded-lg p-4 border border-(--color-border)">
          {order.customerNotes}
        </p>
      ) : null}

      {/* Order items */}
      {order.orderLineItems.length > 0 ? (
        <div className="border border-(--color-border) rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-(--color-border) bg-(--color-surface)">
                <th className="text-left px-4 py-2.5 font-medium text-(--color-muted)">Description</th>
                <th className="text-right px-4 py-2.5 font-medium text-(--color-muted)">Qty</th>
                <th className="text-right px-4 py-2.5 font-medium text-(--color-muted)">Rate</th>
                <th className="text-right px-4 py-2.5 font-medium text-(--color-muted)">Amount</th>
              </tr>
            </thead>
            <tbody>
              {order.orderLineItems.map((item) => (
                <tr key={item.id} className="border-b border-(--color-border) last:border-0">
                  <td className="px-4 py-3">
                    <p className="font-medium text-(--color-foreground)">{item.description}</p>
                    {item.notes ? <p className="text-xs text-(--color-muted) mt-0.5">{item.notes}</p> : null}
                  </td>
                  <td className="px-4 py-3 text-right text-(--color-muted)">{item.qty}</td>
                  <td className="px-4 py-3 text-right text-(--color-muted)">${Number(item.unitPrice).toFixed(2)}</td>
                  <td className="px-4 py-3 text-right font-semibold text-(--color-foreground)">${Number(item.lineTotal).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {/* Setup costs */}
      {order.setUpCosts.length > 0 ? (
        <div className="border border-(--color-border) rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-(--color-border) bg-(--color-surface)">
                <th className="text-left px-4 py-2.5 font-medium text-(--color-muted)">Setup</th>
                <th className="text-right px-4 py-2.5 font-medium text-(--color-muted)">Qty</th>
                <th className="text-right px-4 py-2.5 font-medium text-(--color-muted)">Rate</th>
                <th className="text-right px-4 py-2.5 font-medium text-(--color-muted)">Amount</th>
              </tr>
            </thead>
            <tbody>
              {order.setUpCosts.map((sc) => {
                const items = sc.customSetupItems as { label: string; qty: number; rate: number }[] | null
                const item = items?.[0]
                return (
                  <tr key={sc.id} className="border-b border-(--color-border) last:border-0">
                    <td className="px-4 py-3 text-(--color-foreground)">{item?.label ?? "Setup"}</td>
                    <td className="px-4 py-3 text-right text-(--color-muted)">{item?.qty ?? 1}</td>
                    <td className="px-4 py-3 text-right text-(--color-muted)">${(item?.rate ?? Number(sc.userTotal)).toFixed(2)}</td>
                    <td className="px-4 py-3 text-right font-semibold text-(--color-foreground)">${Number(sc.userTotal).toFixed(2)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      ) : null}

      {/* Totals */}
      <div className="border border-(--color-border) rounded-lg p-4 space-y-1.5 text-sm bg-(--color-background)">
        <div className="flex justify-between">
          <span className="text-(--color-muted)">Subtotal</span>
          <span>${Number(order.subTotal).toFixed(2)}</span>
        </div>
        {discountManual > 0 ? (
          <div className="flex justify-between text-(--color-danger)">
            <span>Discount</span>
            <span>-${discountManual.toFixed(2)}</span>
          </div>
        ) : null}
        <div className="flex justify-between">
          <span className="text-(--color-muted)">Tax</span>
          <span>${Number(order.salesTax).toFixed(2)}</span>
        </div>
        <div className="flex justify-between font-semibold text-base border-t border-(--color-border) pt-2">
          <span>Total</span>
          <span>${Number(order.totalPrice).toFixed(2)}</span>
        </div>
      </div>

      {/* Due date */}
      {order.dueDate ? (
        <p className="text-sm text-(--color-muted)">
          Due {format(new Date(order.dueDate), "MMMM d, yyyy")}
        </p>
      ) : null}

      {/* Make Changes link for states 1–2, non-admin */}
      {!isReadOnly && !isAdmin ? (
        <div className="text-center pt-2">
          <Link
            href={`/quote-builder?token=${token}`}
            className="text-sm text-(--color-accent) underline underline-offset-2 hover:opacity-80"
          >
            Make Changes
          </Link>
        </div>
      ) : null}
    </div>
  )
}
```

- [ ] **Step 3: Update src/app/orders/[token]/layout.tsx**

Add `paymentTotal` to the OG description so it shows amount in share previews:

```tsx
import type { Metadata } from "next"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"

const siteUrl =
  process.env.NEXTAUTH_URL ?? process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"

export async function generateMetadata({
  params,
}: {
  params: Promise<{ token: string }>
}): Promise<Metadata> {
  const { token } = await params
  const order = await prisma.order.findUnique({
    where: { token },
    select: { id: true, nickname: true, mainImage: true, updatedAt: true, totalPrice: true, state: { select: { name: true } } },
  })

  if (!order) {
    return { title: "Order Not Found" }
  }

  const title = order.nickname
    ? `Order #${order.id} — ${order.nickname}`
    : `Order #${order.id}`
  const description = `${title} · ${order.state.name} · $${Number(order.totalPrice).toFixed(2)}`
  const imageUrl = `${siteUrl}/api/og/orders/${order.id}?v=${order.updatedAt.getTime()}`
  const canonicalUrl = `${siteUrl}/orders/${token}`

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url: canonicalUrl,
      images: [{ url: imageUrl, width: 1200, height: 630, alt: title }],
    },
    twitter: { card: "summary_large_image", title, description, images: [imageUrl] },
  }
}

export default function OrderPublicLayout({ children }: { children: React.ReactNode }) {
  return children
}
```

- [ ] **Step 4: Smoke test in browser**

1. Visit `http://localhost:3000/orders/<your-token>` (use Prisma Studio to find the token)
2. Verify: order title, state badge, items table (Qty · Rate · Amount columns), totals section
3. Log in as admin, revisit — verify Share button, "Edit Order" button in View Only banner (change stateId to 3 via dashboard first)
4. Visit `http://localhost:3000/orders/seed-test-order-1` while logged out — verify Make Changes link points to `/quote-builder?token=seed-test-order-1`

- [ ] **Step 5: Commit**

```bash
git add src/app/orders/[token]/
git commit -m "feat: enhanced public order page — Due Now, totals, setup costs, View Only banner, Make Changes link"
```

---

## Self-Review

**Spec coverage check:**

| Spec requirement | Task |
|---|---|
| SetupFeePreset + LineItemPreset schema | Task 1 |
| Preset seed data | Task 1 |
| GET/POST/PATCH/DELETE /api/setup-fee-presets | Task 3 |
| GET/POST/PATCH /api/line-item-presets | Task 4 |
| Quote builder permissions matrix | Task 5 |
| POST /api/orders allows anonymous | Task 6 |
| Token generated on order create | Task 6 |
| Admin notifications on get-quote submit | Task 6 |
| PATCH accepts setUpCosts + userId | Task 7 |
| Public GET by token | Task 8 |
| QB page redirect logic | Task 9 |
| QB container state + save | Task 9 |
| Banner (role + state aware) | Task 10 |
| Order items table with preset dropdown | Task 11 |
| Add Custom dialog in order items | Task 11 |
| Setup costs with preset dropdown | Task 12 |
| Live order totals panel | Task 13 |
| Admin discount input in totals | Task 13 |
| Admin user select + nickname | Task 14 |
| Price-change confirmation dialog | Task 15 |
| Save button: login / revert_state / save / none | Task 9 (QuoteBuilder.tsx) |
| Get Quote public form | Task 16 |
| Get Quote redirects to /orders/[token] | Task 16 |
| Public order: View Only banner state 3+ | Task 17 |
| Public order: Due Now skeleton dialog | Task 17 |
| Public order: Share button | Task 17 |
| Public order: Already Paid display | Task 17 |
| Public order: Setup costs section | Task 17 |
| Public order: Order totals | Task 17 |
| Public order: Make Changes link | Task 17 |
| Public order: Admin "Edit Order" button | Task 17 |
| OG metadata with payment status | Task 17 |

All spec requirements are covered. No placeholders remain.
