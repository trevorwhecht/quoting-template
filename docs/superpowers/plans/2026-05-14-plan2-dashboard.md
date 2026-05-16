# Quoting Template — Plan 2: Dashboard

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the full staff dashboard — kanban board, order sheet, calendar/complete/archive views, insights charts, users management, and settings — everything behind `/dashboard`.

**Architecture:** URL-driven view switching via `?view=X&sub=Y` search params. Client hooks (`useOrders`, `useOrderStates`) own data fetching. The dashboard container reads the URL and swaps view components. The order sheet is a shadcn `Sheet` that slides in from the right when any order is clicked, shared across all views. All money fields from Prisma are `Prisma.Decimal` — they must pass through `serializeOrder()` before JSON serialization or the response will fail.

**Tech Stack:** Next.js 16 App Router · Prisma 6 (Decimal money fields) · next-auth v4 · shadcn/ui · Tailwind 4 · Recharts (dynamic import) · @tanstack/react-virtual · date-fns · Vitest

**This is Plan 2 of 3.** Plan 1 (complete) covers auth, schema, and nav. Plan 3 covers Get Quote and Account pages.

**Spec:** `docs/superpowers/specs/2026-05-14-quoting-template-design.md`

---

> **Critical patterns — read before implementing any task:**
>
> 1. **Decimal serialization** — All money fields (`totalPrice`, `cost`, `profit`, etc.) are `Prisma.Decimal`. Call `serializeOrder(order)` from `src/services/orderService.ts` before `NextResponse.json()`. Never skip this or the response crashes with a serialization error.
> 2. **Admin field stripping** — After `serializeOrder()`, call `stripAdminFields()` when `session.user.role === "employee"`. This removes `cost`, `profit`, `totalSetUpCost`, `adminTotal`, `unitCost`.
> 3. **No `Button asChild`** — shadcn uses Base UI which has no `asChild`. For button-styled links use `buttonVariants` + `<Link>`. Regular `<Button onClick={...}>` is fine.
> 4. **`getServerSession(authOptions)`** — Every API route must import both. Never use the v5 `auth()` helper.
> 5. **Async params in Next.js 16** — `export async function GET(req, { params }: { params: Promise<{ id: string }> }) { const { id } = await params }`
> 6. **`useTransition` for mutations** — Wrap all order state changes in `startTransition`, not a `loading` boolean.
> 7. **CSS variable syntax** — `text-(--color-foreground)` not `text-[var(--color-foreground)]`.
> 8. **Condition rendering** — `{condition ? <X /> : null}` never `{condition && <X />}`.

---

## File Map

| File | Action | Purpose |
|------|--------|---------|
| `package.json` | Modify | Add test script, recharts, react-virtual, date-fns, vitest |
| `vitest.config.ts` | Create | Vitest config with path alias |
| `src/models/order.ts` | Create | TypeScript types for Order, OrderSummary, OrderDetail |
| `src/models/orderState.ts` | Create | TypeScript type for OrderStateModel |
| `src/models/user.ts` | Create | TypeScript type for UserSummary |
| `src/services/orderService.ts` | Create | serializeOrder, stripAdminFields, computeOrderTotals |
| `src/services/orderService.test.ts` | Create | Vitest unit tests for orderService |
| `src/app/api/orders/route.ts` | Create | GET list + POST create |
| `src/app/api/orders/[id]/route.ts` | Create | GET detail + PATCH + DELETE |
| `src/app/api/order-states/route.ts` | Create | GET all + POST create |
| `src/app/api/order-states/[id]/route.ts` | Create | PATCH + DELETE |
| `src/app/api/users/[id]/route.ts` | Create | GET user + PATCH role |
| `src/app/api/payments/route.ts` | Create | POST record payment |
| `src/app/api/payments/[id]/route.ts` | Create | DELETE payment |
| `src/app/api/setup-costs/[id]/route.ts` | Create | PATCH setup cost |
| `src/app/api/insights/route.ts` | Create | GET aggregated revenue/profit/state/channel data |
| `src/hooks/useOrders.ts` | Create | Client hook: fetch + mutate orders |
| `src/hooks/useOrderStates.ts` | Create | Client hook: fetch order states |
| `src/app/dashboard/page.tsx` | Replace | URL-driven view routing (replaces placeholder) |
| `src/app/dashboard/Dashboard.tsx` | Create | Container: layout shell + open sheet state |
| `src/app/dashboard/components/Dashboard-Sidebar.tsx` | Create | Desktop sidebar with role-aware nav |
| `src/app/dashboard/components/Dashboard-Header.tsx` | Create | Mobile top bar with hamburger |
| `src/app/dashboard/components/kanban/Dashboard-OrderCard.tsx` | Create | Compound order card component |
| `src/app/dashboard/components/kanban/Dashboard-KanbanColumn.tsx` | Create | Single kanban column |
| `src/app/dashboard/components/kanban/Dashboard-Kanban.tsx` | Create | Full kanban board |
| `src/app/dashboard/components/views/Dashboard-OrdersView.tsx` | Create | Orders view container with sub-nav |
| `src/app/dashboard/components/views/Dashboard-CalendarView.tsx` | Create | Calendar view (orders by due date) |
| `src/app/dashboard/components/views/Dashboard-CompleteView.tsx` | Create | Complete orders list |
| `src/app/dashboard/components/views/Dashboard-ArchiveView.tsx` | Create | Archive orders list |
| `src/app/dashboard/components/views/Dashboard-InsightsView.tsx` | Create | Revenue/profit charts (admin only) |
| `src/app/dashboard/components/views/Dashboard-UsersView.tsx` | Create | Users table with role management |
| `src/app/dashboard/components/views/Dashboard-SettingsView.tsx` | Create | Order states + business settings |
| `src/app/dashboard/components/orders/Dashboard-OrderSheet.tsx` | Create | Sheet shell with tabs |
| `src/app/dashboard/components/orders/Dashboard-OrderSheet-LineItems.tsx` | Create | Line items tab |
| `src/app/dashboard/components/orders/Dashboard-OrderSheet-SetupCosts.tsx` | Create | Setup costs tab |
| `src/app/dashboard/components/orders/Dashboard-OrderSheet-Payment.tsx` | Create | Payments tab |

---

## Task 1: Install Dependencies

**Files:**
- Modify: `package.json`
- Create: `vitest.config.ts`

- [ ] **Step 1: Install runtime dependencies**

```bash
npm install recharts @tanstack/react-virtual date-fns
```

- [ ] **Step 2: Install dev dependencies**

```bash
npm install --save-dev vitest @vitest/coverage-v8
```

- [ ] **Step 3: Add test scripts to package.json**

In `package.json`, add to the `scripts` block:

```json
"test": "vitest run",
"test:watch": "vitest"
```

Full updated scripts block:
```json
"scripts": {
  "dev": "next dev",
  "dev:prod": "dotenv -e .env.prod -- next dev --port 3001",
  "build": "prisma generate && next build",
  "start": "next start",
  "lint": "eslint .",
  "postinstall": "prisma generate",
  "test": "vitest run",
  "test:watch": "vitest"
}
```

- [ ] **Step 4: Create vitest.config.ts**

Create `vitest.config.ts` at the project root:

```ts
import { defineConfig } from "vitest/config"
import path from "path"

export default defineConfig({
  test: {
    environment: "node",
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
})
```

- [ ] **Step 5: Verify**

```bash
npm run test
```

Expected: "No test files found" (0 tests, no failures). That's correct — tests come in Task 3.

---

## Task 2: TypeScript Models

**Files:**
- Create: `src/models/order.ts`
- Create: `src/models/orderState.ts`
- Create: `src/models/user.ts`

- [ ] **Step 1: Create src/models/orderState.ts**

```ts
export type OrderStateModel = {
  id: number
  name: string
  sortOrder: number
  description: string | null
  isActive: boolean
  isRequired: boolean
  color: string | null
  createdAt: string
  updatedAt: string
}
```

- [ ] **Step 2: Create src/models/user.ts**

```ts
export type UserSummary = {
  id: string
  email: string
  firstName: string
  lastName: string
  companyName: string | null
  phone: string | null
  role: string
  createdAt: string
}
```

- [ ] **Step 3: Create src/models/order.ts**

```ts
import type { OrderStateModel } from "./orderState"
import type { UserSummary } from "./user"

export type OrderLineItemVariant = {
  id: number
  orderLineItemId: number
  variant: string
  qty: number
  price: number
  cost: number | null
}

export type OrderLineItem = {
  id: number
  orderId: number
  description: string
  qty: number
  unitPrice: number
  lineTotal: number
  unitCost: number
  sortOrder: number
  notes: string | null
  variants: OrderLineItemVariant[]
  createdAt: string
  updatedAt: string
}

export type SetUpCost = {
  id: number
  orderId: number
  userTotal: number
  adminTotal: number
  customSetupItems: any
  createdAt: string
  updatedAt: string
}

export type Payment = {
  id: number
  orderId: number
  userId: string | null
  amount: number
  channel: string
  note: string | null
  paidAt: string
  createdAt: string
}

// Shape returned by GET /api/orders (list) — lean, for kanban/list views
export type OrderSummary = {
  id: number
  nickname: string | null
  stateId: number
  state: Pick<OrderStateModel, "id" | "name" | "color">
  user: Pick<UserSummary, "id" | "firstName" | "lastName" | "email"> | null
  totalQty: number
  totalPrice: number
  cost: number           // 0 for employee (stripped at API)
  profit: number         // 0 for employee (stripped at API)
  isPaid: boolean
  dueDate: string | null
  dueDateEnd: string | null
  isHardDeadline: boolean
  completedDate: string | null
  token: string | null
  createdAt: string
  _count: { orderLineItems: number }
}

// Shape returned by GET /api/orders/:id — full detail for sheet
export type OrderDetail = {
  id: number
  nickname: string | null
  stateId: number
  state: OrderStateModel
  user: Pick<UserSummary, "id" | "firstName" | "lastName" | "email" | "phone" | "companyName"> | null
  customerNotes: string | null
  notes: string | null
  totalQty: number
  totalSetUpPrice: number
  totalSetUpCost: number   // 0 for employee
  totalAmount: number
  subTotal: number
  salesTax: number
  totalPrice: number
  cost: number             // 0 for employee
  profit: number           // 0 for employee
  discountManual: number | null
  discountReferral: number | null
  discountMistake: number | null
  rushFeeAmount: number | null
  rushFeePercent: number | null
  rushFeeDays: number | null
  isPaid: boolean
  paymentPlan: string | null
  finalPrice: number | null
  dueDate: string | null
  dueDateEnd: string | null
  startDate: string | null
  isHardDeadline: boolean
  needsShipping: boolean
  mainImage: string | null
  token: string | null
  completedDate: string | null
  createdAt: string
  updatedAt: string
  orderLineItems: OrderLineItem[]
  setUpCosts: SetUpCost[]
  payments: Payment[]
}

export type TotalsInput = {
  lineItems: { qty: number; unitPrice: number; unitCost: number }[]
  setUpCosts: { userTotal: number; adminTotal: number }[]
  taxRate: number
  discountManual?: number | null
  discountReferral?: number | null
  discountMistake?: number | null
  rushFeeAmount?: number | null
}

export type TotalsResult = {
  totalQty: number
  totalAmount: number
  totalSetUpPrice: number
  totalSetUpCost: number
  subTotal: number
  salesTax: number
  totalPrice: number
  cost: number
  profit: number
}
```

---

## Task 3: orderService + Unit Tests

**Files:**
- Create: `src/services/orderService.ts`
- Create: `src/services/orderService.test.ts`

- [ ] **Step 1: Write the failing tests first**

Create `src/services/orderService.test.ts`:

```ts
import { describe, it, expect } from "vitest"
import { dec, serializeOrder, stripAdminFields, computeOrderTotals } from "./orderService"

describe("dec", () => {
  it("converts Prisma Decimal-like object to number", () => {
    expect(dec({ toFixed: () => "12.50", toString: () => "12.5" })).toBe(12.5)
  })
  it("converts string to number", () => {
    expect(dec("9.99")).toBe(9.99)
  })
  it("returns 0 for null", () => {
    expect(dec(null)).toBe(0)
  })
  it("returns 0 for undefined", () => {
    expect(dec(undefined)).toBe(0)
  })
  it("passes through a plain number", () => {
    expect(dec(42)).toBe(42)
  })
})

describe("serializeOrder", () => {
  it("converts Decimal fields to numbers", () => {
    const raw = {
      id: 1, totalPrice: "150.00", cost: "80.00", profit: "70.00",
      totalSetUpPrice: "0", totalSetUpCost: "0", totalAmount: "150.00",
      subTotal: "150.00", salesTax: "11.63", discountManual: null,
      discountReferral: null, discountMistake: null, rushFeeAmount: null,
      rushFeePercent: null, finalPrice: null, orderLineItems: [], setUpCosts: [], payments: [],
    }
    const result = serializeOrder(raw)
    expect(result.totalPrice).toBe(150)
    expect(result.cost).toBe(80)
    expect(result.profit).toBe(70)
    expect(result.salesTax).toBe(11.63)
    expect(result.discountManual).toBeNull()
  })

  it("serializes line item Decimal fields", () => {
    const raw = {
      id: 1, totalPrice: "100", cost: "0", profit: "0",
      totalSetUpPrice: "0", totalSetUpCost: "0", totalAmount: "100",
      subTotal: "100", salesTax: "0", discountManual: null,
      discountReferral: null, discountMistake: null, rushFeeAmount: null,
      rushFeePercent: null, finalPrice: null,
      orderLineItems: [
        { id: 1, unitPrice: "50.00", lineTotal: "100.00", unitCost: "30.00", variants: [] }
      ],
      setUpCosts: [], payments: [],
    }
    const result = serializeOrder(raw)
    expect(result.orderLineItems[0].unitPrice).toBe(50)
    expect(result.orderLineItems[0].unitCost).toBe(30)
  })
})

describe("stripAdminFields", () => {
  it("removes cost, profit, totalSetUpCost from order", () => {
    const order = {
      id: 1, totalPrice: 150, cost: 80, profit: 70, totalSetUpCost: 10,
      orderLineItems: [{ id: 1, unitCost: 30, variants: [{ id: 1, cost: 5 }] }],
      setUpCosts: [{ id: 1, adminTotal: 10 }],
    }
    const result = stripAdminFields(order)
    expect(result).not.toHaveProperty("cost")
    expect(result).not.toHaveProperty("profit")
    expect(result).not.toHaveProperty("totalSetUpCost")
    expect(result.orderLineItems[0]).not.toHaveProperty("unitCost")
    expect(result.orderLineItems[0].variants[0]).not.toHaveProperty("cost")
    expect(result.setUpCosts[0]).not.toHaveProperty("adminTotal")
  })
})

describe("computeOrderTotals", () => {
  it("computes all totals from line items and setup costs", () => {
    const result = computeOrderTotals({
      lineItems: [
        { qty: 2, unitPrice: 25, unitCost: 10 },
        { qty: 1, unitPrice: 50, unitCost: 20 },
      ],
      setUpCosts: [{ userTotal: 15, adminTotal: 5 }],
      taxRate: 0.1,
    })
    expect(result.totalQty).toBe(3)
    expect(result.totalAmount).toBe(100)       // 2*25 + 1*50
    expect(result.totalSetUpPrice).toBe(15)
    expect(result.totalSetUpCost).toBe(5)
    expect(result.subTotal).toBe(115)          // 100 + 15
    expect(result.salesTax).toBeCloseTo(11.5)  // 115 * 0.1
    expect(result.totalPrice).toBeCloseTo(126.5)
    expect(result.cost).toBe(45)               // 2*10 + 1*20 + 5
    expect(result.profit).toBeCloseTo(81.5)    // 126.5 - 45
  })

  it("applies discounts before tax", () => {
    const result = computeOrderTotals({
      lineItems: [{ qty: 1, unitPrice: 100, unitCost: 40 }],
      setUpCosts: [],
      taxRate: 0.1,
      discountManual: 10,
    })
    expect(result.subTotal).toBe(90)    // 100 - 10
    expect(result.salesTax).toBeCloseTo(9)
    expect(result.totalPrice).toBeCloseTo(99)
  })

  it("applies rush fee before tax", () => {
    const result = computeOrderTotals({
      lineItems: [{ qty: 1, unitPrice: 100, unitCost: 40 }],
      setUpCosts: [],
      taxRate: 0.1,
      rushFeeAmount: 20,
    })
    expect(result.subTotal).toBe(120)
  })
})
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npm test
```

Expected: `Cannot find module './orderService'` — confirms tests are wired but service doesn't exist yet.

- [ ] **Step 3: Create src/services/orderService.ts**

```ts
import type { TotalsInput, TotalsResult } from "@/models/order"

function round2(v: number): number {
  return Math.round(v * 100) / 100
}

// Converts any Prisma Decimal, string, or number to a plain number. Returns 0 for null/undefined.
export function dec(v: any): number {
  if (v == null) return 0
  return Number(v)
}

// Converts all Prisma Decimal fields on a raw order object to plain numbers for JSON serialization.
// MUST be called before NextResponse.json() on any order query result.
export function serializeOrder(order: any): any {
  return {
    ...order,
    totalSetUpPrice: dec(order.totalSetUpPrice),
    totalSetUpCost: dec(order.totalSetUpCost),
    totalAmount: dec(order.totalAmount),
    subTotal: dec(order.subTotal),
    salesTax: dec(order.salesTax),
    totalPrice: dec(order.totalPrice),
    cost: dec(order.cost),
    profit: dec(order.profit),
    discountManual: order.discountManual != null ? dec(order.discountManual) : null,
    discountReferral: order.discountReferral != null ? dec(order.discountReferral) : null,
    discountMistake: order.discountMistake != null ? dec(order.discountMistake) : null,
    rushFeeAmount: order.rushFeeAmount != null ? dec(order.rushFeeAmount) : null,
    rushFeePercent: order.rushFeePercent != null ? dec(order.rushFeePercent) : null,
    finalPrice: order.finalPrice != null ? dec(order.finalPrice) : null,
    orderLineItems: order.orderLineItems?.map((li: any) => ({
      ...li,
      unitPrice: dec(li.unitPrice),
      lineTotal: dec(li.lineTotal),
      unitCost: dec(li.unitCost),
      variants: li.variants?.map((v: any) => ({
        ...v,
        price: dec(v.price),
        cost: v.cost != null ? dec(v.cost) : null,
      })) ?? [],
    })) ?? [],
    setUpCosts: order.setUpCosts?.map((s: any) => ({
      ...s,
      userTotal: dec(s.userTotal),
      adminTotal: dec(s.adminTotal),
    })) ?? [],
    payments: order.payments?.map((p: any) => ({
      ...p,
      amount: dec(p.amount),
    })) ?? [],
  }
}

// Removes admin-only fields for employee role responses.
// Call after serializeOrder().
export function stripAdminFields(order: any): any {
  const { cost, profit, totalSetUpCost, ...rest } = order
  return {
    ...rest,
    orderLineItems: rest.orderLineItems?.map(({ unitCost, ...li }: any) => ({
      ...li,
      variants: li.variants?.map(({ cost: _c, ...v }: any) => v) ?? [],
    })) ?? [],
    setUpCosts: rest.setUpCosts?.map(({ adminTotal, ...s }: any) => s) ?? [],
  }
}

// Computes all derived totals from line items and setup costs.
// Used when creating or updating an order with line item changes.
export function computeOrderTotals(input: TotalsInput): TotalsResult {
  const { lineItems, setUpCosts, taxRate } = input
  const discount =
    (input.discountManual ?? 0) +
    (input.discountReferral ?? 0) +
    (input.discountMistake ?? 0)
  const rushFee = input.rushFeeAmount ?? 0

  const totalQty = lineItems.reduce((s, li) => s + li.qty, 0)
  const totalAmount = round2(lineItems.reduce((s, li) => s + li.qty * li.unitPrice, 0))
  const totalSetUpPrice = round2(setUpCosts.reduce((s, sc) => s + sc.userTotal, 0))
  const totalSetUpCost = round2(setUpCosts.reduce((s, sc) => s + sc.adminTotal, 0))
  const lineCost = round2(lineItems.reduce((s, li) => s + li.qty * li.unitCost, 0))

  const subTotal = round2(totalAmount + totalSetUpPrice - discount + rushFee)
  const salesTax = round2(subTotal * taxRate)
  const totalPrice = round2(subTotal + salesTax)
  const cost = round2(lineCost + totalSetUpCost)
  const profit = round2(totalPrice - cost)

  return { totalQty, totalAmount, totalSetUpPrice, totalSetUpCost, subTotal, salesTax, totalPrice, cost, profit }
}
```

- [ ] **Step 4: Run tests — all must pass**

```bash
npm test
```

Expected: 14 passing tests, 0 failing.

---

## Task 4: API — GET/POST /api/orders

**Files:**
- Create: `src/app/api/orders/route.ts`

- [ ] **Step 1: Create the route**

Create `src/app/api/orders/route.ts`:

```ts
import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { serializeOrder, stripAdminFields, computeOrderTotals } from "@/services/orderService"

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
      user: { select: { id: true, firstName: true, lastName: true, email: true } },
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
  if (!session) return NextResponse.json({ data: null, error: "Unauthorized" }, { status: 401 })

  const role = session.user.role
  if (role !== "admin" && role !== "employee") {
    return NextResponse.json({ data: null, error: "Forbidden" }, { status: 403 })
  }

  const body = await req.json()
  const { userId, nickname, customerNotes, notes, dueDate, lineItems = [], stateId = 1 } = body

  if (!Array.isArray(lineItems) || lineItems.length === 0) {
    return NextResponse.json({ data: null, error: "At least one line item is required" }, { status: 400 })
  }

  const taxSetting = await prisma.universalSettings.findUnique({ where: { setting: "taxRate" } })
  const taxRate = taxSetting ? Number(taxSetting.value) : 0

  const totals = computeOrderTotals({ lineItems, setUpCosts: [], taxRate })

  const order = await prisma.order.create({
    data: {
      userId: userId || null,
      stateId,
      nickname: nickname || null,
      customerNotes: customerNotes || null,
      notes: notes || null,
      dueDate: dueDate ? new Date(dueDate) : null,
      ...totals,
      createdBy: session.user.email ?? null,
      orderLineItems: {
        create: lineItems.map((li: any, idx: number) => ({
          description: li.description,
          qty: li.qty,
          unitPrice: li.unitPrice,
          lineTotal: li.qty * li.unitPrice,
          unitCost: li.unitCost ?? 0,
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

  return NextResponse.json({ data: serializeOrder(order), error: null }, { status: 201 })
}
```

---

## Task 5: API — GET/PATCH/DELETE /api/orders/[id]

**Files:**
- Create: `src/app/api/orders/[id]/route.ts`

- [ ] **Step 1: Create the route**

Create `src/app/api/orders/[id]/route.ts`:

```ts
import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { serializeOrder, stripAdminFields, computeOrderTotals } from "@/services/orderService"

const ORDER_DETAIL_INCLUDE = {
  state: true,
  user: { select: { id: true, firstName: true, lastName: true, email: true, phone: true, companyName: true } },
  orderLineItems: { include: { variants: true }, orderBy: { sortOrder: "asc" as const } },
  setUpCosts: true,
  payments: { orderBy: { paidAt: "desc" as const } },
}

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ data: null, error: "Unauthorized" }, { status: 401 })

  const role = session.user.role
  if (role !== "admin" && role !== "employee") {
    return NextResponse.json({ data: null, error: "Forbidden" }, { status: 403 })
  }

  const { id } = await params
  const order = await prisma.order.findUnique({ where: { id: Number(id) }, include: ORDER_DETAIL_INCLUDE })
  if (!order) return NextResponse.json({ data: null, error: "Not found" }, { status: 404 })

  const serialized = serializeOrder(order)
  return NextResponse.json({ data: role === "employee" ? stripAdminFields(serialized) : serialized, error: null })
}

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
    needsShipping, finalPrice, lineItems,
  } = body

  // Build scalar update payload
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

  // Mark completedDate when transitioning to Complete (stateId=6)
  if (stateId === 6) scalarUpdate.completedDate = new Date()
  if (stateId !== undefined && stateId !== 6) scalarUpdate.completedDate = null

  if (lineItems !== undefined) {
    // Replace all line items and recompute totals
    const taxSetting = await prisma.universalSettings.findUnique({ where: { setting: "taxRate" } })
    const taxRate = taxSetting ? Number(taxSetting.value) : 0

    const existingSetUpCosts = await prisma.setUpCost.findMany({ where: { orderId } })
    const scCosts = existingSetUpCosts.map((s) => ({ userTotal: Number(s.userTotal), adminTotal: Number(s.adminTotal) }))

    const totals = computeOrderTotals({
      lineItems,
      setUpCosts: scCosts,
      taxRate,
      discountManual: scalarUpdate.discountManual,
      discountReferral: scalarUpdate.discountReferral,
      discountMistake: scalarUpdate.discountMistake,
      rushFeeAmount: scalarUpdate.rushFeeAmount,
    })
    Object.assign(scalarUpdate, totals)

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

  const updated = await prisma.order.update({
    where: { id: orderId },
    data: scalarUpdate,
    include: ORDER_DETAIL_INCLUDE,
  })

  const serialized = serializeOrder(updated)
  return NextResponse.json({ data: role === "employee" ? stripAdminFields(serialized) : serialized, error: null })
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ data: null, error: "Unauthorized" }, { status: 401 })

  if (session.user.role !== "admin") {
    return NextResponse.json({ data: null, error: "Forbidden" }, { status: 403 })
  }

  const { id } = await params
  await prisma.order.delete({ where: { id: Number(id) } })
  return NextResponse.json({ data: { id: Number(id) }, error: null })
}
```

---

## Task 6: API — /api/order-states

**Files:**
- Create: `src/app/api/order-states/route.ts`
- Create: `src/app/api/order-states/[id]/route.ts`

- [ ] **Step 1: Create src/app/api/order-states/route.ts**

```ts
import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ data: null, error: "Unauthorized" }, { status: 401 })

  const role = session.user.role
  if (role !== "admin" && role !== "employee") {
    return NextResponse.json({ data: null, error: "Forbidden" }, { status: 403 })
  }

  const states = await prisma.orderState.findMany({ orderBy: { sortOrder: "asc" } })
  return NextResponse.json({ data: states, error: null })
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ data: null, error: "Unauthorized" }, { status: 401 })
  if (session.user.role !== "admin") return NextResponse.json({ data: null, error: "Forbidden" }, { status: 403 })

  const body = await req.json()
  const { name, color, description } = body
  if (!name) return NextResponse.json({ data: null, error: "name is required" }, { status: 400 })

  const maxSort = await prisma.orderState.aggregate({ _max: { sortOrder: true } })
  const sortOrder = (maxSort._max.sortOrder ?? 0) + 1

  const state = await prisma.orderState.create({
    data: { name, color: color || null, description: description || null, sortOrder },
  })
  return NextResponse.json({ data: state, error: null }, { status: 201 })
}
```

- [ ] **Step 2: Create src/app/api/order-states/[id]/route.ts**

```ts
import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ data: null, error: "Unauthorized" }, { status: 401 })
  if (session.user.role !== "admin") return NextResponse.json({ data: null, error: "Forbidden" }, { status: 403 })

  const { id } = await params
  const body = await req.json()
  const { name, color, description, isActive, sortOrder } = body

  const update: Record<string, any> = {}
  if (name !== undefined) update.name = name
  if (color !== undefined) update.color = color
  if (description !== undefined) update.description = description
  if (isActive !== undefined) update.isActive = isActive
  if (sortOrder !== undefined) update.sortOrder = sortOrder

  const state = await prisma.orderState.update({ where: { id: Number(id) }, data: update })
  return NextResponse.json({ data: state, error: null })
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ data: null, error: "Unauthorized" }, { status: 401 })
  if (session.user.role !== "admin") return NextResponse.json({ data: null, error: "Forbidden" }, { status: 403 })

  const { id } = await params
  const state = await prisma.orderState.findUnique({ where: { id: Number(id) } })
  if (!state) return NextResponse.json({ data: null, error: "Not found" }, { status: 404 })
  if (state.isRequired) return NextResponse.json({ data: null, error: "Cannot delete a required state" }, { status: 400 })

  await prisma.orderState.delete({ where: { id: Number(id) } })
  return NextResponse.json({ data: { id: Number(id) }, error: null })
}
```

---

## Task 7: API — /api/users/[id]

**Files:**
- Create: `src/app/api/users/[id]/route.ts`

- [ ] **Step 1: Create the route**

Create `src/app/api/users/[id]/route.ts`:

```ts
import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ data: null, error: "Unauthorized" }, { status: 401 })
  if (session.user.role !== "admin") return NextResponse.json({ data: null, error: "Forbidden" }, { status: 403 })

  const { id } = await params
  const user = await prisma.user.findUnique({
    where: { id },
    select: { id: true, email: true, firstName: true, lastName: true, companyName: true, phone: true, role: true, createdAt: true },
  })
  if (!user) return NextResponse.json({ data: null, error: "Not found" }, { status: 404 })
  return NextResponse.json({ data: user, error: null })
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ data: null, error: "Unauthorized" }, { status: 401 })
  if (session.user.role !== "admin") return NextResponse.json({ data: null, error: "Forbidden" }, { status: 403 })

  const { id } = await params
  const body = await req.json()
  const { role } = body

  if (!role || !["admin", "employee", "user"].includes(role)) {
    return NextResponse.json({ data: null, error: "role must be admin, employee, or user" }, { status: 400 })
  }

  // Prevent admin from demoting themselves
  const me = await prisma.user.findUnique({ where: { email: session.user.email! }, select: { id: true } })
  if (me?.id === id && role !== "admin") {
    return NextResponse.json({ data: null, error: "Cannot demote your own account" }, { status: 400 })
  }

  const user = await prisma.user.update({
    where: { id },
    data: { role },
    select: { id: true, email: true, firstName: true, lastName: true, role: true, createdAt: true },
  })
  return NextResponse.json({ data: user, error: null })
}
```

---

## Task 8: API — Payments + Setup Costs

**Files:**
- Create: `src/app/api/payments/route.ts`
- Create: `src/app/api/payments/[id]/route.ts`
- Create: `src/app/api/setup-costs/[id]/route.ts`

- [ ] **Step 1: Create src/app/api/payments/route.ts**

```ts
import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ data: null, error: "Unauthorized" }, { status: 401 })
  if (session.user.role !== "admin") return NextResponse.json({ data: null, error: "Forbidden" }, { status: 403 })

  const body = await req.json()
  const { orderId, amount, channel, note, paidAt } = body

  if (!orderId || !amount || !channel) {
    return NextResponse.json({ data: null, error: "orderId, amount, and channel are required" }, { status: 400 })
  }

  const me = await prisma.user.findUnique({ where: { email: session.user.email! }, select: { id: true } })

  const payment = await prisma.payment.create({
    data: {
      orderId: Number(orderId),
      userId: me?.id ?? null,
      amount: Number(amount),
      channel,
      note: note || null,
      paidAt: paidAt ? new Date(paidAt) : new Date(),
      createdBy: session.user.email ?? null,
    },
  })
  return NextResponse.json({ data: { ...payment, amount: Number(payment.amount) }, error: null }, { status: 201 })
}
```

- [ ] **Step 2: Create src/app/api/payments/[id]/route.ts**

```ts
import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ data: null, error: "Unauthorized" }, { status: 401 })
  if (session.user.role !== "admin") return NextResponse.json({ data: null, error: "Forbidden" }, { status: 403 })

  const { id } = await params
  await prisma.payment.delete({ where: { id: Number(id) } })
  return NextResponse.json({ data: { id: Number(id) }, error: null })
}
```

- [ ] **Step 3: Create src/app/api/setup-costs/[id]/route.ts**

```ts
import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { serializeOrder, computeOrderTotals } from "@/services/orderService"

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ data: null, error: "Unauthorized" }, { status: 401 })
  if (session.user.role !== "admin") return NextResponse.json({ data: null, error: "Forbidden" }, { status: 403 })

  const { id } = await params
  const body = await req.json()
  const { userTotal, adminTotal, customSetupItems } = body

  const existing = await prisma.setUpCost.findUnique({ where: { id: Number(id) } })
  if (!existing) return NextResponse.json({ data: null, error: "Not found" }, { status: 404 })

  const updated = await prisma.setUpCost.update({
    where: { id: Number(id) },
    data: {
      userTotal: userTotal !== undefined ? Number(userTotal) : undefined,
      adminTotal: adminTotal !== undefined ? Number(adminTotal) : undefined,
      customSetupItems: customSetupItems !== undefined ? customSetupItems : undefined,
    },
  })

  // Recompute order totals
  const taxSetting = await prisma.universalSettings.findUnique({ where: { setting: "taxRate" } })
  const taxRate = taxSetting ? Number(taxSetting.value) : 0

  const lineItems = await prisma.orderLineItem.findMany({ where: { orderId: existing.orderId } })
  const allSetUpCosts = await prisma.setUpCost.findMany({ where: { orderId: existing.orderId } })

  const totals = computeOrderTotals({
    lineItems: lineItems.map((li) => ({ qty: li.qty, unitPrice: Number(li.unitPrice), unitCost: Number(li.unitCost) })),
    setUpCosts: allSetUpCosts.map((s) => ({ userTotal: Number(s.userTotal), adminTotal: Number(s.adminTotal) })),
    taxRate,
  })

  await prisma.order.update({ where: { id: existing.orderId }, data: totals })

  return NextResponse.json({ data: { ...updated, userTotal: Number(updated.userTotal), adminTotal: Number(updated.adminTotal) }, error: null })
}
```

---

## Task 9: API — /api/insights

**Files:**
- Create: `src/app/api/insights/route.ts`

- [ ] **Step 1: Create the route**

Create `src/app/api/insights/route.ts`:

```ts
import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { format, subMonths, startOfMonth } from "date-fns"

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ data: null, error: "Unauthorized" }, { status: 401 })
  if (session.user.role !== "admin") return NextResponse.json({ data: null, error: "Forbidden" }, { status: 403 })

  const twelveMonthsAgo = startOfMonth(subMonths(new Date(), 11))

  // Fetch completed orders in window
  const completedOrders = await prisma.order.findMany({
    where: { completedDate: { gte: twelveMonthsAgo } },
    select: { completedDate: true, totalPrice: true, profit: true },
  })

  // Group by month
  const byMonth: Record<string, { revenue: number; profit: number }> = {}
  for (const o of completedOrders) {
    if (!o.completedDate) continue
    const month = format(o.completedDate, "yyyy-MM")
    if (!byMonth[month]) byMonth[month] = { revenue: 0, profit: 0 }
    byMonth[month].revenue += Number(o.totalPrice)
    byMonth[month].profit += Number(o.profit)
  }
  const revenueByMonth = Object.entries(byMonth)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, v]) => ({ month, revenue: Math.round(v.revenue * 100) / 100, profit: Math.round(v.profit * 100) / 100 }))

  // Orders by state (all active orders, not just completed)
  const ordersByState = await prisma.order.groupBy({
    by: ["stateId"],
    _count: { id: true },
  })
  const stateDetails = await prisma.orderState.findMany({ select: { id: true, name: true } })
  const stateMap = Object.fromEntries(stateDetails.map((s) => [s.id, s.name]))
  const ordersByStateResult = ordersByState.map((row) => ({
    stateId: row.stateId,
    stateName: stateMap[row.stateId] ?? "Unknown",
    count: row._count.id,
  }))

  // Payments by channel
  const payments = await prisma.payment.groupBy({
    by: ["channel"],
    _sum: { amount: true },
    _count: { id: true },
  })
  const paymentsByChannel = payments.map((p) => ({
    channel: p.channel,
    total: Math.round(Number(p._sum.amount ?? 0) * 100) / 100,
    count: p._count.id,
  }))

  return NextResponse.json({
    data: { revenueByMonth, ordersByState: ordersByStateResult, paymentsByChannel },
    error: null,
  })
}
```

---

## Task 10: Client Hooks

**Files:**
- Create: `src/hooks/useOrders.ts`
- Create: `src/hooks/useOrderStates.ts`

- [ ] **Step 1: Create src/hooks/useOrders.ts**

```ts
"use client"

import { useState, useEffect, useCallback } from "react"
import type { OrderSummary, OrderDetail } from "@/models/order"

export function useOrders() {
  const [orders, setOrders] = useState<OrderSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchOrders = useCallback(async () => {
    setLoading(true)
    setError(null)
    const res = await fetch("/api/orders")
    const json = await res.json()
    setLoading(false)
    if (json.error) { setError(json.error); return }
    setOrders(json.data)
  }, [])

  useEffect(() => { fetchOrders() }, [fetchOrders])

  const updateOrder = useCallback((updated: OrderSummary) => {
    setOrders((prev) => prev.map((o) => o.id === updated.id ? updated : o))
  }, [])

  const removeOrder = useCallback((id: number) => {
    setOrders((prev) => prev.filter((o) => o.id !== id))
  }, [])

  return { orders, loading, error, refetch: fetchOrders, updateOrder, removeOrder }
}
```

- [ ] **Step 2: Create src/hooks/useOrderStates.ts**

```ts
"use client"

import { useState, useEffect, useCallback } from "react"
import type { OrderStateModel } from "@/models/orderState"

export function useOrderStates() {
  const [orderStates, setOrderStates] = useState<OrderStateModel[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchOrderStates = useCallback(async () => {
    setLoading(true)
    setError(null)
    const res = await fetch("/api/order-states")
    const json = await res.json()
    setLoading(false)
    if (json.error) { setError(json.error); return }
    setOrderStates(json.data)
  }, [])

  useEffect(() => { fetchOrderStates() }, [fetchOrderStates])

  const updateState = useCallback((updated: OrderStateModel) => {
    setOrderStates((prev) => prev.map((s) => s.id === updated.id ? updated : s))
  }, [])

  return { orderStates, loading, error, refetch: fetchOrderStates, updateState }
}
```

---

## Task 11: Dashboard Layout Shell

**Files:**
- Create: `src/app/dashboard/Dashboard.tsx`
- Create: `src/app/dashboard/components/Dashboard-Sidebar.tsx`
- Create: `src/app/dashboard/components/Dashboard-Header.tsx`

- [ ] **Step 1: Create Dashboard-Sidebar.tsx**

Create `src/app/dashboard/components/Dashboard-Sidebar.tsx`:

```tsx
"use client"

import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { cn } from "@/lib/utils"
import { LayoutGrid, Calendar, CheckCircle, Archive, BarChart2, Users, Settings } from "lucide-react"

type SidebarLinkProps = {
  href: string
  label: string
  icon: React.ReactNode
  active: boolean
}

function SidebarLink({ href, label, icon, active }: SidebarLinkProps) {
  return (
    <Link
      href={href}
      className={cn(
        "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors motion-reduce:transition-none",
        active
          ? "bg-(--color-primary) text-(--color-primary-foreground)"
          : "text-(--color-foreground) hover:bg-(--color-surface)"
      )}
    >
      {icon}
      {label}
    </Link>
  )
}

type Props = { role: string }

export default function DashboardSidebar({ role }: Props) {
  const searchParams = useSearchParams()
  const view = searchParams.get("view") ?? "orders"
  const sub = searchParams.get("sub") ?? "default"

  const isAdmin = role === "admin"

  return (
    <aside className="hidden md:flex flex-col w-56 shrink-0 border-r border-(--color-border) bg-(--color-background) h-[calc(100dvh-3.5rem)] sticky top-14 overflow-y-auto p-3 gap-1">
      <p className="text-xs font-semibold text-(--color-muted) uppercase tracking-wider px-3 mb-1">Orders</p>
      <SidebarLink href="?view=orders&sub=default" label="Kanban" icon={<LayoutGrid size={16} />} active={view === "orders" && sub === "default"} />
      <SidebarLink href="?view=orders&sub=calendar" label="Calendar" icon={<Calendar size={16} />} active={view === "orders" && sub === "calendar"} />
      <SidebarLink href="?view=orders&sub=complete" label="Complete" icon={<CheckCircle size={16} />} active={view === "orders" && sub === "complete"} />
      <SidebarLink href="?view=orders&sub=archive" label="Archive" icon={<Archive size={16} />} active={view === "orders" && sub === "archive"} />

      {isAdmin ? (
        <>
          <p className="text-xs font-semibold text-(--color-muted) uppercase tracking-wider px-3 mt-4 mb-1">Insights</p>
          <SidebarLink href="?view=insights" label="Insights" icon={<BarChart2 size={16} />} active={view === "insights"} />
          <p className="text-xs font-semibold text-(--color-muted) uppercase tracking-wider px-3 mt-4 mb-1">Admin</p>
          <SidebarLink href="?view=users" label="Users" icon={<Users size={16} />} active={view === "users"} />
          <SidebarLink href="?view=settings" label="Settings" icon={<Settings size={16} />} active={view === "settings"} />
        </>
      ) : null}
    </aside>
  )
}
```

- [ ] **Step 2: Create Dashboard-Header.tsx (mobile)**

Create `src/app/dashboard/components/Dashboard-Header.tsx`:

```tsx
"use client"

import { useState } from "react"
import Link from "next/link"
import { Menu, X } from "lucide-react"
import { cn } from "@/lib/utils"

type Props = { role: string }

export default function DashboardHeader({ role }: Props) {
  const [open, setOpen] = useState(false)
  const isAdmin = role === "admin"

  const navLinks = [
    { href: "?view=orders&sub=default", label: "Kanban" },
    { href: "?view=orders&sub=calendar", label: "Calendar" },
    { href: "?view=orders&sub=complete", label: "Complete" },
    { href: "?view=orders&sub=archive", label: "Archive" },
    ...(isAdmin ? [
      { href: "?view=insights", label: "Insights" },
      { href: "?view=users", label: "Users" },
      { href: "?view=settings", label: "Settings" },
    ] : []),
  ]

  return (
    <div className="md:hidden border-b border-(--color-border) bg-(--color-background) relative">
      <div className="flex items-center justify-between px-4 h-12">
        <span className="text-sm font-semibold text-(--color-foreground)">Dashboard</span>
        <button
          onClick={() => setOpen((prev) => !prev)}
          className="min-h-10 min-w-10 flex items-center justify-center rounded-md hover:bg-(--color-surface) touch-manipulation"
          aria-label="Toggle dashboard menu"
        >
          {open ? <X size={18} /> : <Menu size={18} />}
        </button>
      </div>
      {open ? (
        <div className="absolute top-full left-0 right-0 bg-(--color-background) border-b border-(--color-border) flex flex-col py-2 z-50">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setOpen(false)}
              className="px-4 py-2 text-sm text-(--color-foreground) hover:bg-(--color-surface)"
            >
              {link.label}
            </Link>
          ))}
        </div>
      ) : null}
    </div>
  )
}
```

- [ ] **Step 3: Create Dashboard.tsx**

Create `src/app/dashboard/Dashboard.tsx`:

```tsx
"use client"

import { Suspense, useState } from "react"
import { useSearchParams } from "next/navigation"
import DashboardSidebar from "./components/Dashboard-Sidebar"
import DashboardHeader from "./components/Dashboard-Header"
import DashboardOrdersView from "./components/views/Dashboard-OrdersView"
import DashboardCalendarView from "./components/views/Dashboard-CalendarView"
import DashboardCompleteView from "./components/views/Dashboard-CompleteView"
import DashboardArchiveView from "./components/views/Dashboard-ArchiveView"
import DashboardInsightsView from "./components/views/Dashboard-InsightsView"
import DashboardUsersView from "./components/views/Dashboard-UsersView"
import DashboardSettingsView from "./components/views/Dashboard-SettingsView"
import DashboardOrderSheet from "./components/orders/Dashboard-OrderSheet"
import { useOrders } from "@/hooks/useOrders"
import { useOrderStates } from "@/hooks/useOrderStates"
import type { OrderDetail } from "@/models/order"

type Props = { role: string }

function DashboardInner({ role }: Props) {
  const searchParams = useSearchParams()
  const view = searchParams.get("view") ?? "orders"
  const sub = searchParams.get("sub") ?? "default"

  const { orders, loading: ordersLoading, refetch: refetchOrders, updateOrder, removeOrder } = useOrders()
  const { orderStates, loading: statesLoading, refetch: refetchStates, updateState } = useOrderStates()

  const [selectedOrder, setSelectedOrder] = useState<OrderDetail | null>(null)
  const [sheetOpen, setSheetOpen] = useState(false)

  function handleOpenOrder(order: OrderDetail) {
    setSelectedOrder(order)
    setSheetOpen(true)
  }

  function handleOrderUpdated(updated: OrderDetail) {
    updateOrder(updated as any)
    setSelectedOrder(updated)
  }

  function handleOrderDeleted(id: number) {
    removeOrder(id)
    setSheetOpen(false)
  }

  const activeStates = orderStates.filter((s) => s.isActive || s.isRequired)

  function renderView() {
    if (view === "orders") {
      if (sub === "calendar") return <DashboardCalendarView orders={orders} loading={ordersLoading} onOpenOrder={handleOpenOrder} />
      if (sub === "complete") return <DashboardCompleteView orders={orders} loading={ordersLoading} onOpenOrder={handleOpenOrder} />
      if (sub === "archive") return <DashboardArchiveView orders={orders} loading={ordersLoading} onOpenOrder={handleOpenOrder} />
      return <DashboardOrdersView orders={orders} loading={ordersLoading} orderStates={activeStates} statesLoading={statesLoading} onOpenOrder={handleOpenOrder} role={role} />
    }
    if (view === "insights" && role === "admin") return <DashboardInsightsView />
    if (view === "users" && role === "admin") return <DashboardUsersView />
    if (view === "settings" && role === "admin") return <DashboardSettingsView orderStates={orderStates} onStateUpdated={updateState} onStatesRefetch={refetchStates} />
    return <DashboardOrdersView orders={orders} loading={ordersLoading} orderStates={activeStates} statesLoading={statesLoading} onOpenOrder={handleOpenOrder} role={role} />
  }

  return (
    <div className="flex min-h-[calc(100dvh-3.5rem)]">
      <DashboardSidebar role={role} />
      <div className="flex-1 flex flex-col min-w-0">
        <DashboardHeader role={role} />
        <main className="flex-1">{renderView()}</main>
      </div>
      <DashboardOrderSheet
        order={selectedOrder}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        onOrderUpdated={handleOrderUpdated}
        onOrderDeleted={handleOrderDeleted}
        role={role}
        orderStates={orderStates}
      />
    </div>
  )
}

export default function Dashboard(props: Props) {
  return (
    <Suspense>
      <DashboardInner {...props} />
    </Suspense>
  )
}
```

---

## Task 12: Replace dashboard/page.tsx

**Files:**
- Replace: `src/app/dashboard/page.tsx`

- [ ] **Step 1: Replace the placeholder**

Replace `src/app/dashboard/page.tsx`:

```tsx
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { redirect } from "next/navigation"
import Dashboard from "./Dashboard"

export default async function DashboardPage() {
  const session = await getServerSession(authOptions)
  if (!session) redirect("/login")

  const role = session.user.role
  if (role !== "admin" && role !== "employee") redirect("/account")

  return <Dashboard role={role} />
}
```

- [ ] **Step 2: Verify dev server starts without errors**

```bash
npm run dev
```

Navigate to `http://localhost:3000/dashboard` (signed in as admin). Expected: no crash, blank or loading state (views not built yet). Stop the server.

---

## Task 13: Dashboard-OrderCard (Compound Component)

**Files:**
- Create: `src/app/dashboard/components/kanban/Dashboard-OrderCard.tsx`

- [ ] **Step 1: Create the compound component**

Create `src/app/dashboard/components/kanban/Dashboard-OrderCard.tsx`:

```tsx
"use client"

import { createContext, useContext } from "react"
import { format, isPast } from "date-fns"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Link2 } from "lucide-react"
import { toast } from "sonner"
import type { OrderSummary } from "@/models/order"

type Ctx = { order: OrderSummary; role: string; onOpen: () => void }
const CardCtx = createContext<Ctx | null>(null)

function useCard(): Ctx {
  const ctx = useContext(CardCtx)
  if (!ctx) throw new Error("Must be inside OrderCard")
  return ctx
}

function Root({ order, role, onOpen, children }: Ctx & { children: React.ReactNode }) {
  return (
    <CardCtx.Provider value={{ order, role, onOpen }}>
      <div
        className="group relative bg-(--color-background) border border-(--color-border) rounded-lg p-3 cursor-pointer hover:shadow-sm transition-shadow motion-reduce:transition-none"
        onClick={onOpen}
      >
        {children}
      </div>
    </CardCtx.Provider>
  )
}

function Header() {
  const { order } = useCard()
  return (
    <div className="mb-2">
      <p className="font-medium text-sm text-(--color-foreground) whitespace-nowrap truncate">
        {order.nickname ? order.nickname : `Order #${order.id}`}
      </p>
      {order.user ? (
        <p className="text-xs text-(--color-muted) truncate">
          {order.user.firstName} {order.user.lastName}
        </p>
      ) : (
        <p className="text-xs text-(--color-muted)">No account</p>
      )}
    </div>
  )
}

function Badges() {
  const { order } = useCard()
  return (
    <div className="flex flex-wrap gap-1 mb-2">
      <Badge
        variant="outline"
        className="text-xs whitespace-nowrap"
        style={{ borderColor: order.state.color ?? undefined }}
      >
        {order.state.name}
      </Badge>
      {order.isPaid ? (
        <Badge className="text-xs bg-(--color-success) text-white border-0">Paid</Badge>
      ) : null}
    </div>
  )
}

function Footer() {
  const { order, role } = useCard()
  const isAdmin = role === "admin"
  const isOverdue =
    order.dueDate && !order.completedDate && isPast(new Date(order.dueDate))

  function handleCopyLink(e: React.MouseEvent) {
    e.stopPropagation()
    if (!order.token) { toast.error("No share link for this order"); return }
    const base = process.env.NEXT_PUBLIC_BASE_URL ?? window.location.origin
    navigator.clipboard.writeText(`${base}/orders/${order.token}`)
    toast.success("Link copied")
  }

  return (
    <div className="flex items-end justify-between mt-3">
      <div className="text-xs text-(--color-muted) space-y-0.5">
        {order._count.orderLineItems > 0 ? (
          <p>{order._count.orderLineItems} item{order._count.orderLineItems !== 1 ? "s" : ""}</p>
        ) : null}
        {order.dueDate ? (
          <p className={cn(isOverdue && "text-(--color-danger) font-medium")}>
            Due {format(new Date(order.dueDate), "MMM d")}
            {order.isHardDeadline ? " ⚑" : ""}
          </p>
        ) : null}
      </div>
      <div className="flex items-end gap-2">
        <div className="text-right">
          <p className="text-sm font-semibold text-(--color-foreground)">${order.totalPrice.toFixed(2)}</p>
          {isAdmin && order.profit > 0 ? (
            <p className="text-xs text-(--color-success)">${order.profit.toFixed(2)} profit</p>
          ) : null}
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 w-7 p-0 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity"
          onClick={handleCopyLink}
          aria-label="Copy public share link"
        >
          <Link2 size={14} />
        </Button>
      </div>
    </div>
  )
}

export const OrderCard = Object.assign(Root, { Header, Badges, Footer })
```

---

## Task 14: Dashboard-KanbanColumn + Dashboard-Kanban

**Files:**
- Create: `src/app/dashboard/components/kanban/Dashboard-KanbanColumn.tsx`
- Create: `src/app/dashboard/components/kanban/Dashboard-Kanban.tsx`

- [ ] **Step 1: Create Dashboard-KanbanColumn.tsx**

Create `src/app/dashboard/components/kanban/Dashboard-KanbanColumn.tsx`:

```tsx
"use client"

import { useRef } from "react"
import { useVirtualizer } from "@tanstack/react-virtual"
import { OrderCard } from "./Dashboard-OrderCard"
import type { OrderSummary, OrderDetail } from "@/models/order"
import type { OrderStateModel } from "@/models/orderState"

type Props = {
  state: Pick<OrderStateModel, "id" | "name" | "color">
  orders: OrderSummary[]
  role: string
  onOpenOrder: (order: OrderDetail) => void
}

export default function DashboardKanbanColumn({ state, orders, role, onOpenOrder }: Props) {
  const parentRef = useRef<HTMLDivElement>(null)

  const virtualizer = useVirtualizer({
    count: orders.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 130,
    overscan: 5,
  })

  const totalValue = orders.reduce((s, o) => s + o.totalPrice, 0)

  async function handleOpenOrder(order: OrderSummary) {
    const res = await fetch(`/api/orders/${order.id}`)
    const json = await res.json()
    if (!json.error) onOpenOrder(json.data)
  }

  return (
    <div className="flex flex-col w-72 shrink-0 bg-(--color-surface) rounded-lg border border-(--color-border) overflow-hidden">
      {/* Column header */}
      <div
        className="px-3 py-2.5 border-b-2"
        style={{ borderBottomColor: state.color ?? "var(--color-border)" }}
      >
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold text-(--color-foreground)">{state.name}</span>
          <span className="text-xs text-(--color-muted) bg-(--color-background) rounded-full px-2 py-0.5">
            {orders.length}
          </span>
        </div>
        {orders.length > 0 ? (
          <p className="text-xs text-(--color-muted) mt-0.5">${totalValue.toFixed(2)}</p>
        ) : null}
      </div>

      {/* Scrollable card list — virtualized */}
      <div ref={parentRef} className="overflow-y-auto flex-1 max-h-[calc(100dvh-12rem)] p-2">
        <div style={{ height: virtualizer.getTotalSize(), position: "relative" }}>
          {virtualizer.getVirtualItems().map((virtualRow) => {
            const order = orders[virtualRow.index]
            return (
              <div
                key={order.id}
                style={{
                  position: "absolute",
                  top: virtualRow.start,
                  left: 0,
                  right: 0,
                  paddingBottom: 8,
                }}
              >
                <OrderCard order={order} role={role} onOpen={() => handleOpenOrder(order)}>
                  <OrderCard.Header />
                  <OrderCard.Badges />
                  <OrderCard.Footer />
                </OrderCard>
              </div>
            )
          })}
        </div>
        {orders.length === 0 ? (
          <p className="text-xs text-(--color-muted) text-center py-6">No orders</p>
        ) : null}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Create Dashboard-Kanban.tsx**

Create `src/app/dashboard/components/kanban/Dashboard-Kanban.tsx`:

```tsx
"use client"

import DashboardKanbanColumn from "./Dashboard-KanbanColumn"
import { Skeleton } from "@/components/ui/skeleton"
import type { OrderSummary, OrderDetail } from "@/models/order"
import type { OrderStateModel } from "@/models/orderState"

type Props = {
  orders: OrderSummary[]
  loading: boolean
  orderStates: OrderStateModel[]
  statesLoading: boolean
  onOpenOrder: (order: OrderDetail) => void
  role: string
}

export default function DashboardKanban({ orders, loading, orderStates, statesLoading, onOpenOrder, role }: Props) {
  if (statesLoading || loading) {
    return (
      <div className="flex gap-4 p-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="w-72 shrink-0 space-y-2">
            <Skeleton className="h-12 rounded-lg" />
            <Skeleton className="h-28 rounded-lg" />
            <Skeleton className="h-28 rounded-lg" />
          </div>
        ))}
      </div>
    )
  }

  const activeStates = orderStates.filter((s) => s.isActive || s.isRequired).sort((a, b) => a.sortOrder - b.sortOrder)
  // Exclude archived (id=0) from main kanban — it has its own view
  const kanbanStates = activeStates.filter((s) => s.id !== 0)

  return (
    <div className="flex gap-4 p-4 overflow-x-auto min-h-[calc(100dvh-10rem)]">
      {kanbanStates.map((state) => {
        const stateOrders = orders.filter((o) => o.stateId === state.id)
        return (
          <DashboardKanbanColumn
            key={state.id}
            state={state}
            orders={stateOrders}
            role={role}
            onOpenOrder={onOpenOrder}
          />
        )
      })}
    </div>
  )
}
```

---

## Task 15: Dashboard-OrdersView

**Files:**
- Create: `src/app/dashboard/components/views/Dashboard-OrdersView.tsx`

- [ ] **Step 1: Create the view**

Create `src/app/dashboard/components/views/Dashboard-OrdersView.tsx`:

```tsx
"use client"

import { useSearchParams } from "next/navigation"
import { cn } from "@/lib/utils"
import { buttonVariants } from "@/components/ui/button"
import Link from "next/link"
import DashboardKanban from "../kanban/Dashboard-Kanban"
import type { OrderSummary, OrderDetail } from "@/models/order"
import type { OrderStateModel } from "@/models/orderState"

type Props = {
  orders: OrderSummary[]
  loading: boolean
  orderStates: OrderStateModel[]
  statesLoading: boolean
  onOpenOrder: (order: OrderDetail) => void
  role: string
}

const SUB_TABS = [
  { key: "default", label: "Kanban" },
  { key: "calendar", label: "Calendar" },
  { key: "complete", label: "Complete" },
  { key: "archive", label: "Archive" },
]

export default function DashboardOrdersView({ orders, loading, orderStates, statesLoading, onOpenOrder, role }: Props) {
  const searchParams = useSearchParams()
  const sub = searchParams.get("sub") ?? "default"

  return (
    <div className="flex flex-col">
      {/* Sub-nav tabs */}
      <div className="border-b border-(--color-border) px-4 flex gap-1 pt-2">
        {SUB_TABS.map((tab) => (
          <Link
            key={tab.key}
            href={`?view=orders&sub=${tab.key}`}
            className={cn(
              "px-3 py-2 text-sm font-medium rounded-t-md border-b-2 transition-colors motion-reduce:transition-none",
              sub === tab.key
                ? "border-(--color-primary) text-(--color-primary)"
                : "border-transparent text-(--color-muted) hover:text-(--color-foreground)"
            )}
          >
            {tab.label}
          </Link>
        ))}
      </div>

      {/* Default: kanban */}
      <DashboardKanban
        orders={orders}
        loading={loading}
        orderStates={orderStates}
        statesLoading={statesLoading}
        onOpenOrder={onOpenOrder}
        role={role}
      />
    </div>
  )
}
```

---

## Task 16: Dashboard-CalendarView

**Files:**
- Create: `src/app/dashboard/components/views/Dashboard-CalendarView.tsx`

- [ ] **Step 1: Create the calendar view**

Create `src/app/dashboard/components/views/Dashboard-CalendarView.tsx`:

```tsx
"use client"

import { useState } from "react"
import { format, startOfMonth, endOfMonth, eachDayOfInterval, startOfWeek, endOfWeek, isSameDay, isSameMonth, isPast, isToday, addMonths, subMonths } from "date-fns"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { ChevronLeft, ChevronRight } from "lucide-react"
import type { OrderSummary, OrderDetail } from "@/models/order"

type Props = {
  orders: OrderSummary[]
  loading: boolean
  onOpenOrder: (order: OrderDetail) => void
}

export default function DashboardCalendarView({ orders, loading, onOpenOrder }: Props) {
  const [currentMonth, setCurrentMonth] = useState(new Date())

  const monthStart = startOfMonth(currentMonth)
  const monthEnd = endOfMonth(currentMonth)
  const calStart = startOfWeek(monthStart, { weekStartsOn: 0 })
  const calEnd = endOfWeek(monthEnd, { weekStartsOn: 0 })
  const days = eachDayOfInterval({ start: calStart, end: calEnd })

  const ordersWithDue = orders.filter((o) => o.dueDate)

  async function handleOpen(order: OrderSummary) {
    const res = await fetch(`/api/orders/${order.id}`)
    const json = await res.json()
    if (!json.error) onOpenOrder(json.data)
  }

  return (
    <div className="p-4">
      {/* Month navigation */}
      <div className="flex items-center justify-between mb-4">
        <Button variant="outline" size="sm" onClick={() => setCurrentMonth((m) => subMonths(m, 1))} aria-label="Previous month">
          <ChevronLeft size={16} />
        </Button>
        <h2 className="text-lg font-semibold text-(--color-foreground)">{format(currentMonth, "MMMM yyyy")}</h2>
        <Button variant="outline" size="sm" onClick={() => setCurrentMonth((m) => addMonths(m, 1))} aria-label="Next month">
          <ChevronRight size={16} />
        </Button>
      </div>

      {/* Day-of-week headers */}
      <div className="grid grid-cols-7 mb-1">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
          <div key={d} className="text-center text-xs font-medium text-(--color-muted) py-1">{d}</div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 border-l border-t border-(--color-border)">
        {days.map((day) => {
          const dayOrders = ordersWithDue.filter((o) => isSameDay(new Date(o.dueDate!), day))
          const isCurrentMonth = isSameMonth(day, currentMonth)
          const overdue = isPast(day) && !isToday(day) && dayOrders.some((o) => !o.completedDate)

          return (
            <div
              key={day.toISOString()}
              className={cn(
                "border-r border-b border-(--color-border) min-h-[80px] p-1",
                !isCurrentMonth && "bg-(--color-surface) opacity-60",
                isToday(day) && "bg-blue-50"
              )}
            >
              <p className={cn(
                "text-xs font-medium mb-1",
                isToday(day) ? "text-blue-600" : isCurrentMonth ? "text-(--color-foreground)" : "text-(--color-muted)",
                overdue && "text-(--color-danger)"
              )}>
                {format(day, "d")}
              </p>
              <div className="space-y-0.5">
                {dayOrders.slice(0, 3).map((order) => (
                  <button
                    key={order.id}
                    onClick={() => handleOpen(order)}
                    className={cn(
                      "w-full text-left text-xs px-1 py-0.5 rounded truncate block touch-manipulation",
                      order.completedDate
                        ? "bg-(--color-success) bg-opacity-20 text-(--color-success)"
                        : isPast(new Date(order.dueDate!)) ? "bg-(--color-danger) bg-opacity-20 text-(--color-danger)" : "bg-(--color-primary) bg-opacity-10 text-(--color-primary)"
                    )}
                    style={{ borderLeft: `2px solid ${order.state.color ?? "var(--color-border)"}` }}
                  >
                    {order.nickname ?? `#${order.id}`}
                  </button>
                ))}
                {dayOrders.length > 3 ? (
                  <p className="text-xs text-(--color-muted) px-1">+{dayOrders.length - 3} more</p>
                ) : null}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
```

---

## Task 17: Dashboard-CompleteView + Dashboard-ArchiveView

**Files:**
- Create: `src/app/dashboard/components/views/Dashboard-CompleteView.tsx`
- Create: `src/app/dashboard/components/views/Dashboard-ArchiveView.tsx`

- [ ] **Step 1: Create Dashboard-CompleteView.tsx**

Create `src/app/dashboard/components/views/Dashboard-CompleteView.tsx`:

```tsx
"use client"

import { format } from "date-fns"
import { Skeleton } from "@/components/ui/skeleton"
import type { OrderSummary, OrderDetail } from "@/models/order"

type Props = {
  orders: OrderSummary[]
  loading: boolean
  onOpenOrder: (order: OrderDetail) => void
}

export default function DashboardCompleteView({ orders, loading, onOpenOrder }: Props) {
  const completed = orders.filter((o) => o.stateId === 6).sort((a, b) => {
    if (!a.completedDate) return 1
    if (!b.completedDate) return -1
    return new Date(b.completedDate).getTime() - new Date(a.completedDate).getTime()
  })

  async function handleOpen(order: OrderSummary) {
    const res = await fetch(`/api/orders/${order.id}`)
    const json = await res.json()
    if (!json.error) onOpenOrder(json.data)
  }

  if (loading) return <div className="p-4 space-y-2">{[1,2,3].map(i => <Skeleton key={i} className="h-16 rounded-lg" />)}</div>

  return (
    <div className="p-4">
      <h2 className="text-lg font-semibold text-(--color-foreground) mb-4">Complete ({completed.length})</h2>
      {completed.length === 0 ? (
        <p className="text-(--color-muted) text-sm">No completed orders.</p>
      ) : (
        <div className="w-full overflow-x-auto">
          <table className="min-w-[640px] w-full text-sm">
            <thead>
              <tr className="border-b border-(--color-border) text-left">
                <th className="pb-2 font-medium text-(--color-muted) whitespace-nowrap pr-4">Order</th>
                <th className="pb-2 font-medium text-(--color-muted) whitespace-nowrap pr-4">Customer</th>
                <th className="pb-2 font-medium text-(--color-muted) whitespace-nowrap pr-4">Total</th>
                <th className="pb-2 font-medium text-(--color-muted) whitespace-nowrap pr-4">Completed</th>
                <th className="pb-2 font-medium text-(--color-muted) whitespace-nowrap">Paid</th>
              </tr>
            </thead>
            <tbody>
              {completed.map((order) => (
                <tr
                  key={order.id}
                  onClick={() => handleOpen(order)}
                  className="border-b border-(--color-border) hover:bg-(--color-surface) cursor-pointer transition-colors"
                >
                  <td className="py-3 pr-4 whitespace-nowrap font-medium">
                    {order.nickname ?? `#${order.id}`}
                  </td>
                  <td className="py-3 pr-4 whitespace-nowrap text-(--color-muted)">
                    {order.user ? `${order.user.firstName} ${order.user.lastName}` : "—"}
                  </td>
                  <td className="py-3 pr-4 whitespace-nowrap">${order.totalPrice.toFixed(2)}</td>
                  <td className="py-3 pr-4 whitespace-nowrap text-(--color-muted)">
                    {order.completedDate ? format(new Date(order.completedDate), "MMM d, yyyy") : "—"}
                  </td>
                  <td className="py-3 whitespace-nowrap">
                    <span className={order.isPaid ? "text-(--color-success)" : "text-(--color-danger)"}>
                      {order.isPaid ? "Yes" : "No"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Create Dashboard-ArchiveView.tsx**

Create `src/app/dashboard/components/views/Dashboard-ArchiveView.tsx`:

```tsx
"use client"

import { format } from "date-fns"
import { Skeleton } from "@/components/ui/skeleton"
import type { OrderSummary, OrderDetail } from "@/models/order"

type Props = {
  orders: OrderSummary[]
  loading: boolean
  onOpenOrder: (order: OrderDetail) => void
}

export default function DashboardArchiveView({ orders, loading, onOpenOrder }: Props) {
  const archived = orders.filter((o) => o.stateId === 0).sort((a, b) =>
    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  )

  async function handleOpen(order: OrderSummary) {
    const res = await fetch(`/api/orders/${order.id}`)
    const json = await res.json()
    if (!json.error) onOpenOrder(json.data)
  }

  if (loading) return <div className="p-4 space-y-2">{[1,2,3].map(i => <Skeleton key={i} className="h-16 rounded-lg" />)}</div>

  return (
    <div className="p-4">
      <h2 className="text-lg font-semibold text-(--color-foreground) mb-4">Archive ({archived.length})</h2>
      {archived.length === 0 ? (
        <p className="text-(--color-muted) text-sm">No archived orders.</p>
      ) : (
        <div className="w-full overflow-x-auto">
          <table className="min-w-[640px] w-full text-sm">
            <thead>
              <tr className="border-b border-(--color-border) text-left">
                <th className="pb-2 font-medium text-(--color-muted) whitespace-nowrap pr-4">Order</th>
                <th className="pb-2 font-medium text-(--color-muted) whitespace-nowrap pr-4">Customer</th>
                <th className="pb-2 font-medium text-(--color-muted) whitespace-nowrap pr-4">Total</th>
                <th className="pb-2 font-medium text-(--color-muted) whitespace-nowrap">Created</th>
              </tr>
            </thead>
            <tbody>
              {archived.map((order) => (
                <tr
                  key={order.id}
                  onClick={() => handleOpen(order)}
                  className="border-b border-(--color-border) hover:bg-(--color-surface) cursor-pointer transition-colors"
                >
                  <td className="py-3 pr-4 whitespace-nowrap font-medium">
                    {order.nickname ?? `#${order.id}`}
                  </td>
                  <td className="py-3 pr-4 whitespace-nowrap text-(--color-muted)">
                    {order.user ? `${order.user.firstName} ${order.user.lastName}` : "—"}
                  </td>
                  <td className="py-3 pr-4 whitespace-nowrap">${order.totalPrice.toFixed(2)}</td>
                  <td className="py-3 whitespace-nowrap text-(--color-muted)">
                    {format(new Date(order.createdAt), "MMM d, yyyy")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
```

---

## Task 18: Dashboard-OrderSheet (Main Shell)

**Files:**
- Create: `src/app/dashboard/components/orders/Dashboard-OrderSheet.tsx`

- [ ] **Step 1: Create the sheet shell**

Create `src/app/dashboard/components/orders/Dashboard-OrderSheet.tsx`:

```tsx
"use client"

import { useTransition, useState } from "react"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "sonner"
import { format } from "date-fns"
import DashboardOrderSheetLineItems from "./Dashboard-OrderSheet-LineItems"
import DashboardOrderSheetSetupCosts from "./Dashboard-OrderSheet-SetupCosts"
import DashboardOrderSheetPayment from "./Dashboard-OrderSheet-Payment"
import type { OrderDetail } from "@/models/order"
import type { OrderStateModel } from "@/models/orderState"

type Props = {
  order: OrderDetail | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onOrderUpdated: (order: OrderDetail) => void
  onOrderDeleted: (id: number) => void
  role: string
  orderStates: OrderStateModel[]
}

export default function DashboardOrderSheet({ order, open, onOpenChange, onOrderUpdated, onOrderDeleted, role, orderStates }: Props) {
  const [isPending, startTransition] = useTransition()
  const isAdmin = role === "admin"

  async function patchOrder(updates: Record<string, any>) {
    if (!order) return
    const res = await fetch(`/api/orders/${order.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates),
    })
    const json = await res.json()
    if (json.error) { toast.error(json.error); return }
    onOrderUpdated(json.data)
    toast.success("Saved")
  }

  function handleStateChange(stateId: string) {
    startTransition(() => patchOrder({ stateId: Number(stateId) }))
  }

  async function handleDelete() {
    if (!order) return
    if (!confirm(`Delete order #${order.id}? This cannot be undone.`)) return
    const res = await fetch(`/api/orders/${order.id}`, { method: "DELETE" })
    const json = await res.json()
    if (json.error) { toast.error(json.error); return }
    onOrderDeleted(order.id)
    toast.success("Order deleted")
  }

  if (!order) return null

  const tabs = isAdmin
    ? ["details", "line-items", "setup-costs", "payment"]
    : ["details", "line-items"]

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-[600px] h-dvh overflow-y-auto flex flex-col p-0">
        <SheetHeader className="px-6 pt-6 pb-4 border-b border-(--color-border) shrink-0">
          <div className="flex items-start justify-between gap-2">
            <div>
              <SheetTitle className="text-(--color-foreground)">
                {order.nickname ? order.nickname : `Order #${order.id}`}
              </SheetTitle>
              {order.user ? (
                <p className="text-sm text-(--color-muted) mt-0.5">
                  {order.user.firstName} {order.user.lastName} · {order.user.email}
                </p>
              ) : null}
            </div>
            <Badge variant="outline" style={{ borderColor: order.state.color ?? undefined }}>
              {order.state.name}
            </Badge>
          </div>
        </SheetHeader>

        <Tabs defaultValue="details" className="flex-1 flex flex-col min-h-0">
          <TabsList className="mx-6 mt-4 shrink-0">
            {tabs.map((tab) => (
              <TabsTrigger key={tab} value={tab} className="capitalize">
                {tab.replace("-", " ")}
              </TabsTrigger>
            ))}
          </TabsList>

          {/* Details Tab */}
          <TabsContent value="details" className="flex-1 overflow-y-auto px-6 pb-6 space-y-4 mt-4">
            <div className="space-y-2">
              <Label>State</Label>
              <Select
                value={String(order.stateId)}
                onValueChange={handleStateChange}
                disabled={isPending}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {orderStates.map((s) => (
                    <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Nickname</Label>
              <Input
                defaultValue={order.nickname ?? ""}
                onBlur={(e) => { if (e.target.value !== (order.nickname ?? "")) patchOrder({ nickname: e.target.value || null }) }}
                className="text-base"
              />
            </div>

            <div className="space-y-2">
              <Label>Internal Notes</Label>
              <Textarea
                defaultValue={order.notes ?? ""}
                rows={3}
                onBlur={(e) => { if (e.target.value !== (order.notes ?? "")) patchOrder({ notes: e.target.value || null }) }}
              />
            </div>

            {order.customerNotes ? (
              <div className="space-y-2">
                <Label className="text-(--color-muted)">Customer Notes (read-only)</Label>
                <p className="text-sm text-(--color-foreground) bg-(--color-surface) rounded-md p-3 border border-(--color-border)">{order.customerNotes}</p>
              </div>
            ) : null}

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Due Date</Label>
                <Input
                  type="date"
                  defaultValue={order.dueDate ? format(new Date(order.dueDate), "yyyy-MM-dd") : ""}
                  onBlur={(e) => patchOrder({ dueDate: e.target.value || null })}
                  className="text-base"
                />
              </div>
              <div className="space-y-2">
                <Label>Due Date End</Label>
                <Input
                  type="date"
                  defaultValue={order.dueDateEnd ? format(new Date(order.dueDateEnd), "yyyy-MM-dd") : ""}
                  onBlur={(e) => patchOrder({ dueDateEnd: e.target.value || null })}
                  className="text-base"
                />
              </div>
            </div>

            {isAdmin ? (
              <>
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-2">
                    <Label>Rush Fee $</Label>
                    <Input type="number" inputMode="decimal" defaultValue={order.rushFeeAmount ?? ""} onBlur={(e) => patchOrder({ rushFeeAmount: e.target.value ? Number(e.target.value) : null })} className="text-base" />
                  </div>
                  <div className="space-y-2">
                    <Label>Rush %</Label>
                    <Input type="number" inputMode="decimal" defaultValue={order.rushFeePercent ?? ""} onBlur={(e) => patchOrder({ rushFeePercent: e.target.value ? Number(e.target.value) : null })} className="text-base" />
                  </div>
                  <div className="space-y-2">
                    <Label>Rush Days</Label>
                    <Input type="number" inputMode="numeric" defaultValue={order.rushFeeDays ?? ""} onBlur={(e) => patchOrder({ rushFeeDays: e.target.value ? Number(e.target.value) : null })} className="text-base" />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Discount (manual) $</Label>
                    <Input type="number" inputMode="decimal" defaultValue={order.discountManual ?? ""} onBlur={(e) => patchOrder({ discountManual: e.target.value ? Number(e.target.value) : null })} className="text-base" />
                  </div>
                  <div className="space-y-2">
                    <Label>Payment Plan</Label>
                    <Select defaultValue={order.paymentPlan ?? ""} onValueChange={(v) => patchOrder({ paymentPlan: v || null })}>
                      <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">None</SelectItem>
                        <SelectItem value="deposit">Deposit</SelectItem>
                        <SelectItem value="full_upfront">Full Upfront</SelectItem>
                        <SelectItem value="pay_at_pickup">Pay at Pickup</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Totals summary */}
                <div className="rounded-md border border-(--color-border) p-4 space-y-1.5 text-sm">
                  <div className="flex justify-between"><span className="text-(--color-muted)">Items</span><span>${order.totalAmount.toFixed(2)}</span></div>
                  <div className="flex justify-between"><span className="text-(--color-muted)">Setup</span><span>${order.totalSetUpPrice.toFixed(2)}</span></div>
                  {order.discountManual ? <div className="flex justify-between text-(--color-danger)"><span>Discount</span><span>-${order.discountManual.toFixed(2)}</span></div> : null}
                  {order.rushFeeAmount ? <div className="flex justify-between"><span className="text-(--color-muted)">Rush Fee</span><span>${order.rushFeeAmount.toFixed(2)}</span></div> : null}
                  <div className="flex justify-between border-t border-(--color-border) pt-1.5"><span className="text-(--color-muted)">Subtotal</span><span>${order.subTotal.toFixed(2)}</span></div>
                  <div className="flex justify-between"><span className="text-(--color-muted)">Tax</span><span>${order.salesTax.toFixed(2)}</span></div>
                  <div className="flex justify-between font-semibold text-base"><span>Total</span><span>${order.totalPrice.toFixed(2)}</span></div>
                  <div className="flex justify-between text-(--color-success)"><span>Profit</span><span>${order.profit.toFixed(2)}</span></div>
                </div>
              </>
            ) : null}

            {isAdmin ? (
              <div className="pt-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
                <Button variant="destructive" size="sm" onClick={handleDelete}>Delete Order</Button>
              </div>
            ) : null}
          </TabsContent>

          {/* Line Items Tab */}
          <TabsContent value="line-items" className="flex-1 overflow-y-auto px-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] mt-4">
            <DashboardOrderSheetLineItems order={order} onOrderUpdated={onOrderUpdated} role={role} />
          </TabsContent>

          {/* Setup Costs Tab (admin only) */}
          {isAdmin ? (
            <TabsContent value="setup-costs" className="flex-1 overflow-y-auto px-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] mt-4">
              <DashboardOrderSheetSetupCosts order={order} onOrderUpdated={onOrderUpdated} />
            </TabsContent>
          ) : null}

          {/* Payment Tab (admin only) */}
          {isAdmin ? (
            <TabsContent value="payment" className="flex-1 overflow-y-auto px-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] mt-4">
              <DashboardOrderSheetPayment order={order} onOrderUpdated={onOrderUpdated} />
            </TabsContent>
          ) : null}
        </Tabs>
      </SheetContent>
    </Sheet>
  )
}
```

Note: shadcn's `Sheet` from `@/components/ui/sheet` was installed in Plan 1. The `Textarea` component was not — add it in step 2 if it's missing.

- [ ] **Step 2: Check if Textarea is installed; install if not**

```bash
ls src/components/ui/textarea.tsx 2>/dev/null || npx shadcn@latest add textarea
```

---

## Task 19: Dashboard-OrderSheet-LineItems

**Files:**
- Create: `src/app/dashboard/components/orders/Dashboard-OrderSheet-LineItems.tsx`

- [ ] **Step 1: Create the line items tab**

Create `src/app/dashboard/components/orders/Dashboard-OrderSheet-LineItems.tsx`:

```tsx
"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { toast } from "sonner"
import { Trash2, Plus } from "lucide-react"
import type { OrderDetail, OrderLineItem } from "@/models/order"

type Props = {
  order: OrderDetail
  onOrderUpdated: (order: OrderDetail) => void
  role: string
}

type DraftLineItem = {
  id?: number
  description: string
  qty: number
  unitPrice: number
  unitCost: number
  notes: string
}

function toLineItem(li: OrderLineItem): DraftLineItem {
  return { id: li.id, description: li.description, qty: li.qty, unitPrice: li.unitPrice, unitCost: li.unitCost, notes: li.notes ?? "" }
}

export default function DashboardOrderSheetLineItems({ order, onOrderUpdated, role }: Props) {
  const isAdmin = role === "admin"
  const [items, setItems] = useState<DraftLineItem[]>(order.orderLineItems.map(toLineItem))
  const [saving, setSaving] = useState(false)

  function updateItem(idx: number, field: keyof DraftLineItem, value: string | number) {
    setItems((prev) => prev.map((item, i) => i === idx ? { ...item, [field]: value } : item))
  }

  function addItem() {
    setItems((prev) => [...prev, { description: "", qty: 1, unitPrice: 0, unitCost: 0, notes: "" }])
  }

  function removeItem(idx: number) {
    setItems((prev) => prev.filter((_, i) => i !== idx))
  }

  async function save() {
    setSaving(true)
    const res = await fetch(`/api/orders/${order.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lineItems: items }),
    })
    const json = await res.json()
    setSaving(false)
    if (json.error) { toast.error(json.error); return }
    onOrderUpdated(json.data)
    setItems(json.data.orderLineItems.map(toLineItem))
    toast.success("Line items saved")
  }

  const subtotalItems = items.reduce((s, li) => s + li.qty * li.unitPrice, 0)

  return (
    <div className="space-y-4">
      <div className="w-full overflow-x-auto">
        <table className="min-w-[480px] w-full text-sm">
          <thead>
            <tr className="border-b border-(--color-border) text-left">
              <th className="pb-2 font-medium text-(--color-muted) pr-2">Description</th>
              <th className="pb-2 font-medium text-(--color-muted) w-16 pr-2">Qty</th>
              <th className="pb-2 font-medium text-(--color-muted) w-24 pr-2">Price</th>
              {isAdmin ? <th className="pb-2 font-medium text-(--color-muted) w-24 pr-2">Cost</th> : null}
              <th className="pb-2 font-medium text-(--color-muted) w-20 pr-2">Total</th>
              <th className="pb-2 w-8"></th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, idx) => (
              <tr key={idx} className="border-b border-(--color-border)">
                <td className="py-2 pr-2">
                  <Input
                    value={item.description}
                    onChange={(e) => updateItem(idx, "description", e.target.value)}
                    placeholder="Description"
                    className="text-base h-8"
                  />
                </td>
                <td className="py-2 pr-2">
                  <Input
                    type="number"
                    inputMode="numeric"
                    value={item.qty}
                    onChange={(e) => updateItem(idx, "qty", Math.max(1, Number(e.target.value)))}
                    className="text-base h-8 w-16"
                    min={1}
                  />
                </td>
                <td className="py-2 pr-2">
                  <Input
                    type="number"
                    inputMode="decimal"
                    value={item.unitPrice}
                    onChange={(e) => updateItem(idx, "unitPrice", Number(e.target.value))}
                    className="text-base h-8 w-24"
                    step="0.01"
                  />
                </td>
                {isAdmin ? (
                  <td className="py-2 pr-2">
                    <Input
                      type="number"
                      inputMode="decimal"
                      value={item.unitCost}
                      onChange={(e) => updateItem(idx, "unitCost", Number(e.target.value))}
                      className="text-base h-8 w-24"
                      step="0.01"
                    />
                  </td>
                ) : null}
                <td className="py-2 pr-2 whitespace-nowrap text-(--color-muted)">
                  ${(item.qty * item.unitPrice).toFixed(2)}
                </td>
                <td className="py-2">
                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-(--color-danger)" onClick={() => removeItem(idx)} aria-label="Remove line item">
                    <Trash2 size={14} />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between">
        <Button variant="outline" size="sm" onClick={addItem}>
          <Plus size={14} className="mr-1" /> Add Item
        </Button>
        <p className="text-sm font-medium text-(--color-foreground)">Items total: ${subtotalItems.toFixed(2)}</p>
      </div>

      <Button onClick={save} disabled={saving} className="w-full">
        {saving ? "Saving…" : "Save Line Items"}
      </Button>
    </div>
  )
}
```

---

## Task 20: Dashboard-OrderSheet-SetupCosts + Dashboard-OrderSheet-Payment

**Files:**
- Create: `src/app/dashboard/components/orders/Dashboard-OrderSheet-SetupCosts.tsx`
- Create: `src/app/dashboard/components/orders/Dashboard-OrderSheet-Payment.tsx`

- [ ] **Step 1: Create Dashboard-OrderSheet-SetupCosts.tsx**

Create `src/app/dashboard/components/orders/Dashboard-OrderSheet-SetupCosts.tsx`:

```tsx
"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"
import type { OrderDetail, SetUpCost } from "@/models/order"

type Props = {
  order: OrderDetail
  onOrderUpdated: (order: OrderDetail) => void
}

export default function DashboardOrderSheetSetupCosts({ order, onOrderUpdated }: Props) {
  const [saving, setSaving] = useState<number | null>(null)
  const [userTotal, setUserTotal] = useState<Record<number, string>>(
    Object.fromEntries(order.setUpCosts.map((s) => [s.id, String(s.userTotal)]))
  )
  const [adminTotal, setAdminTotal] = useState<Record<number, string>>(
    Object.fromEntries(order.setUpCosts.map((s) => [s.id, String(s.adminTotal)]))
  )

  async function saveSetupCost(setupCost: SetUpCost) {
    setSaving(setupCost.id)
    const res = await fetch(`/api/setup-costs/${setupCost.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userTotal: Number(userTotal[setupCost.id] ?? setupCost.userTotal),
        adminTotal: Number(adminTotal[setupCost.id] ?? setupCost.adminTotal),
      }),
    })
    const json = await res.json()
    setSaving(null)
    if (json.error) { toast.error(json.error); return }
    // Refetch order to get updated totals
    const orderRes = await fetch(`/api/orders/${order.id}`)
    const orderJson = await orderRes.json()
    if (!orderJson.error) onOrderUpdated(orderJson.data)
    toast.success("Setup cost saved")
  }

  if (order.setUpCosts.length === 0) {
    return <p className="text-sm text-(--color-muted)">No setup costs on this order.</p>
  }

  return (
    <div className="space-y-6">
      {order.setUpCosts.map((sc) => (
        <div key={sc.id} className="border border-(--color-border) rounded-lg p-4 space-y-3">
          <h3 className="text-sm font-semibold text-(--color-foreground)">Setup Cost #{sc.id}</h3>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Customer Price ($)</Label>
              <Input
                type="number"
                inputMode="decimal"
                value={userTotal[sc.id] ?? sc.userTotal}
                onChange={(e) => setUserTotal((prev) => ({ ...prev, [sc.id]: e.target.value }))}
                step="0.01"
                className="text-base"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Actual Cost ($)</Label>
              <Input
                type="number"
                inputMode="decimal"
                value={adminTotal[sc.id] ?? sc.adminTotal}
                onChange={(e) => setAdminTotal((prev) => ({ ...prev, [sc.id]: e.target.value }))}
                step="0.01"
                className="text-base"
              />
            </div>
          </div>
          <Button size="sm" onClick={() => saveSetupCost(sc)} disabled={saving === sc.id}>
            {saving === sc.id ? "Saving…" : "Save"}
          </Button>
        </div>
      ))}
    </div>
  )
}
```

- [ ] **Step 2: Create Dashboard-OrderSheet-Payment.tsx**

Create `src/app/dashboard/components/orders/Dashboard-OrderSheet-Payment.tsx`:

```tsx
"use client"

import { useState } from "react"
import { format } from "date-fns"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { toast } from "sonner"
import { Trash2 } from "lucide-react"
import type { OrderDetail } from "@/models/order"

type Props = {
  order: OrderDetail
  onOrderUpdated: (order: OrderDetail) => void
}

const CHANNELS = ["zelle", "stripe", "cash", "check", "other"]

export default function DashboardOrderSheetPayment({ order, onOrderUpdated }: Props) {
  const [amount, setAmount] = useState("")
  const [channel, setChannel] = useState("cash")
  const [note, setNote] = useState("")
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState<number | null>(null)

  const totalPaid = order.payments.reduce((s, p) => s + p.amount, 0)
  const balance = order.totalPrice - totalPaid

  async function addPayment() {
    if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
      toast.error("Enter a valid amount"); return
    }
    setSaving(true)
    const res = await fetch("/api/payments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderId: order.id, amount: Number(amount), channel, note: note || null }),
    })
    const json = await res.json()
    setSaving(false)
    if (json.error) { toast.error(json.error); return }
    const orderRes = await fetch(`/api/orders/${order.id}`)
    const orderJson = await orderRes.json()
    if (!orderJson.error) onOrderUpdated(orderJson.data)
    setAmount("")
    setNote("")
    toast.success("Payment recorded")
  }

  async function deletePayment(paymentId: number) {
    setDeleting(paymentId)
    const res = await fetch(`/api/payments/${paymentId}`, { method: "DELETE" })
    const json = await res.json()
    setDeleting(null)
    if (json.error) { toast.error(json.error); return }
    const orderRes = await fetch(`/api/orders/${order.id}`)
    const orderJson = await orderRes.json()
    if (!orderJson.error) onOrderUpdated(orderJson.data)
    toast.success("Payment removed")
  }

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="rounded-md border border-(--color-border) p-4 space-y-2 text-sm">
        <div className="flex justify-between"><span className="text-(--color-muted)">Order Total</span><span className="font-medium">${order.totalPrice.toFixed(2)}</span></div>
        <div className="flex justify-between text-(--color-success)"><span>Paid</span><span>${totalPaid.toFixed(2)}</span></div>
        <div className="flex justify-between font-semibold"><span>Balance</span><span className={balance > 0 ? "text-(--color-danger)" : "text-(--color-success)"}>${balance.toFixed(2)}</span></div>
      </div>

      {/* Payment history */}
      {order.payments.length > 0 ? (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-(--color-foreground)">Payment History</h3>
          {order.payments.map((p) => (
            <div key={p.id} className="flex items-center justify-between text-sm border-b border-(--color-border) py-2">
              <div>
                <p className="font-medium">${p.amount.toFixed(2)} <span className="text-(--color-muted) capitalize">· {p.channel}</span></p>
                {p.note ? <p className="text-xs text-(--color-muted)">{p.note}</p> : null}
                <p className="text-xs text-(--color-muted)">{format(new Date(p.paidAt), "MMM d, yyyy")}</p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0 text-(--color-danger)"
                onClick={() => deletePayment(p.id)}
                disabled={deleting === p.id}
                aria-label="Delete payment"
              >
                <Trash2 size={14} />
              </Button>
            </div>
          ))}
        </div>
      ) : null}

      <Separator />

      {/* Add payment form */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-(--color-foreground)">Record Payment</h3>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>Amount ($)</Label>
            <Input type="number" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} step="0.01" placeholder="0.00" className="text-base" />
          </div>
          <div className="space-y-1.5">
            <Label>Channel</Label>
            <Select value={channel} onValueChange={setChannel}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {CHANNELS.map((c) => <SelectItem key={c} value={c} className="capitalize">{c}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="space-y-1.5">
          <Label>Note (optional)</Label>
          <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Zelle confirmation #" className="text-base" />
        </div>
        <Button onClick={addPayment} disabled={saving} className="w-full pb-[max(0px,env(safe-area-inset-bottom))]">
          {saving ? "Recording…" : "Record Payment"}
        </Button>
      </div>
    </div>
  )
}
```

---

## Task 21: Dashboard-InsightsView

**Files:**
- Create: `src/app/dashboard/components/views/Dashboard-InsightsView.tsx`

- [ ] **Step 1: Create the insights view with dynamic recharts import**

Create `src/app/dashboard/components/views/Dashboard-InsightsView.tsx`:

```tsx
"use client"

import { useEffect, useState } from "react"
import dynamic from "next/dynamic"
import { Skeleton } from "@/components/ui/skeleton"

// Dynamic imports — recharts is heavy, do NOT load it on initial bundle
const BarChart = dynamic(() => import("recharts").then((m) => m.BarChart), { ssr: false })
const Bar = dynamic(() => import("recharts").then((m) => m.Bar), { ssr: false })
const LineChart = dynamic(() => import("recharts").then((m) => m.LineChart), { ssr: false })
const Line = dynamic(() => import("recharts").then((m) => m.Line), { ssr: false })
const XAxis = dynamic(() => import("recharts").then((m) => m.XAxis), { ssr: false })
const YAxis = dynamic(() => import("recharts").then((m) => m.YAxis), { ssr: false })
const CartesianGrid = dynamic(() => import("recharts").then((m) => m.CartesianGrid), { ssr: false })
const Tooltip = dynamic(() => import("recharts").then((m) => m.Tooltip), { ssr: false })
const ResponsiveContainer = dynamic(() => import("recharts").then((m) => m.ResponsiveContainer), { ssr: false })

type InsightsData = {
  revenueByMonth: { month: string; revenue: number; profit: number }[]
  ordersByState: { stateId: number; stateName: string; count: number }[]
  paymentsByChannel: { channel: string; total: number; count: number }[]
}

export default function DashboardInsightsView() {
  const [data, setData] = useState<InsightsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch("/api/insights").then((r) => r.json()).then((json) => {
      setLoading(false)
      if (json.error) { setError(json.error); return }
      setData(json.data)
    })
  }, [])

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-64 rounded-lg" />
        <div className="grid grid-cols-2 gap-4">
          <Skeleton className="h-48 rounded-lg" />
          <Skeleton className="h-48 rounded-lg" />
        </div>
      </div>
    )
  }

  if (error) return <div className="p-6 text-(--color-danger) text-sm">{error}</div>
  if (!data) return null

  return (
    <div className="p-6 space-y-8">
      <h2 className="text-xl font-semibold text-(--color-foreground)">Insights</h2>

      {/* Revenue & Profit over time */}
      <div>
        <h3 className="text-sm font-semibold text-(--color-muted) uppercase tracking-wider mb-3">Revenue & Profit (last 12 months)</h3>
        <div className="rounded-lg border border-(--color-border) p-4 h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data.revenueByMonth}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v: number) => `$${v.toFixed(2)}`} />
              <Line type="monotone" dataKey="revenue" stroke="var(--color-primary)" strokeWidth={2} dot={false} name="Revenue" />
              <Line type="monotone" dataKey="profit" stroke="var(--color-success)" strokeWidth={2} dot={false} name="Profit" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Orders by state */}
        <div>
          <h3 className="text-sm font-semibold text-(--color-muted) uppercase tracking-wider mb-3">Orders by State</h3>
          <div className="rounded-lg border border-(--color-border) p-4 h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.ordersByState}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                <XAxis dataKey="stateName" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="count" fill="var(--color-primary)" name="Orders" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Payments by channel */}
        <div>
          <h3 className="text-sm font-semibold text-(--color-muted) uppercase tracking-wider mb-3">Payments by Channel</h3>
          <div className="rounded-lg border border-(--color-border) p-4 h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.paymentsByChannel}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                <XAxis dataKey="channel" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v: number) => `$${v.toFixed(2)}`} />
                <Bar dataKey="total" fill="var(--color-accent)" name="Total ($)" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  )
}
```

---

## Task 22: Dashboard-UsersView

**Files:**
- Create: `src/app/dashboard/components/views/Dashboard-UsersView.tsx`

- [ ] **Step 1: Create the users view**

Create `src/app/dashboard/components/views/Dashboard-UsersView.tsx`:

```tsx
"use client"

import { useState, useEffect, useTransition } from "react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"
import { format } from "date-fns"
import type { UserSummary } from "@/models/user"

export default function DashboardUsersView() {
  const [users, setUsers] = useState<UserSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    fetch("/api/users").then((r) => r.json()).then((json) => {
      setLoading(false)
      if (!json.error) setUsers(json.data)
    })
  }, [])

  function handleRoleChange(userId: string, role: string) {
    startTransition(async () => {
      const res = await fetch(`/api/users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role }),
      })
      const json = await res.json()
      if (json.error) { toast.error(json.error); return }
      setUsers((prev) => prev.map((u) => u.id === userId ? { ...u, role: json.data.role } : u))
      toast.success("Role updated")
    })
  }

  const filtered = users.filter((u) => {
    const q = search.toLowerCase()
    return (
      u.email.toLowerCase().includes(q) ||
      u.firstName.toLowerCase().includes(q) ||
      u.lastName.toLowerCase().includes(q)
    )
  })

  const ROLE_COLORS: Record<string, string> = {
    admin: "bg-(--color-danger) text-white",
    employee: "bg-(--color-warning) text-white",
    user: "bg-(--color-surface) text-(--color-foreground)",
  }

  if (loading) return <div className="p-4 space-y-2">{[1,2,3,4].map(i => <Skeleton key={i} className="h-14 rounded-lg" />)}</div>

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-(--color-foreground)">Users ({filtered.length})</h2>
        <Input
          placeholder="Search name or email…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs text-base"
          inputMode="search"
        />
      </div>

      <div className="w-full overflow-x-auto">
        <table className="min-w-[640px] w-full text-sm">
          <thead>
            <tr className="border-b border-(--color-border) text-left">
              <th className="pb-2 font-medium text-(--color-muted) pr-4 whitespace-nowrap">Name</th>
              <th className="pb-2 font-medium text-(--color-muted) pr-4 whitespace-nowrap">Email</th>
              <th className="pb-2 font-medium text-(--color-muted) pr-4 whitespace-nowrap">Role</th>
              <th className="pb-2 font-medium text-(--color-muted) pr-4 whitespace-nowrap">Joined</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((user) => (
              <tr key={user.id} className="border-b border-(--color-border)">
                <td className="py-3 pr-4 whitespace-nowrap font-medium">
                  {user.firstName} {user.lastName}
                </td>
                <td className="py-3 pr-4 text-(--color-muted) whitespace-nowrap">{user.email}</td>
                <td className="py-3 pr-4 whitespace-nowrap">
                  <Select
                    value={user.role}
                    onValueChange={(v) => handleRoleChange(user.id, v)}
                    disabled={isPending}
                  >
                    <SelectTrigger className="h-8 w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="user">User</SelectItem>
                      <SelectItem value="employee">Employee</SelectItem>
                      <SelectItem value="admin">Admin</SelectItem>
                    </SelectContent>
                  </Select>
                </td>
                <td className="py-3 whitespace-nowrap text-(--color-muted)">
                  {format(new Date(user.createdAt), "MMM d, yyyy")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
```

Note: The Users view needs `GET /api/users` — add a GET handler to the existing `src/app/api/users/route.ts` after this task.

- [ ] **Step 2: Add GET /api/users to the existing route**

In `src/app/api/users/route.ts`, add before the existing `POST` handler:

```ts
export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ data: null, error: "Unauthorized" }, { status: 401 })
  if (session.user.role !== "admin") return NextResponse.json({ data: null, error: "Forbidden" }, { status: 403 })

  const users = await prisma.user.findMany({
    select: { id: true, email: true, firstName: true, lastName: true, companyName: true, phone: true, role: true, createdAt: true },
    orderBy: { createdAt: "desc" },
  })
  return NextResponse.json({ data: users, error: null })
}
```

Also add the missing imports at the top of `src/app/api/users/route.ts`:

```ts
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
```

---

## Task 23: Dashboard-SettingsView

**Files:**
- Create: `src/app/dashboard/components/views/Dashboard-SettingsView.tsx`

- [ ] **Step 1: Create the settings view**

Create `src/app/dashboard/components/views/Dashboard-SettingsView.tsx`:

```tsx
"use client"

import { useState, useTransition } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"
import { ChevronUp, ChevronDown, Lock, Plus } from "lucide-react"
import type { OrderStateModel } from "@/models/orderState"

type Props = {
  orderStates: OrderStateModel[]
  onStateUpdated: (state: OrderStateModel) => void
  onStatesRefetch: () => void
}

export default function DashboardSettingsView({ orderStates, onStateUpdated, onStatesRefetch }: Props) {
  const [isPending, startTransition] = useTransition()
  const [taxRate, setTaxRate] = useState("")
  const [businessName, setBusinessName] = useState("")
  const [newStateName, setNewStateName] = useState("")
  const [newStateColor, setNewStateColor] = useState("#6b7280")
  const [savingBiz, setSavingBiz] = useState(false)
  const [addingState, setAddingState] = useState(false)

  async function toggleActive(state: OrderStateModel) {
    if (state.isRequired) return
    startTransition(async () => {
      const res = await fetch(`/api/order-states/${state.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !state.isActive }),
      })
      const json = await res.json()
      if (json.error) { toast.error(json.error); return }
      onStateUpdated(json.data)
      toast.success(state.isActive ? "State deactivated" : "State activated")
    })
  }

  async function moveState(state: OrderStateModel, direction: "up" | "down") {
    const sorted = [...orderStates].sort((a, b) => a.sortOrder - b.sortOrder)
    const idx = sorted.findIndex((s) => s.id === state.id)
    const swapIdx = direction === "up" ? idx - 1 : idx + 1
    if (swapIdx < 0 || swapIdx >= sorted.length) return

    const swapState = sorted[swapIdx]
    startTransition(async () => {
      await Promise.all([
        fetch(`/api/order-states/${state.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sortOrder: swapState.sortOrder }) }),
        fetch(`/api/order-states/${swapState.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sortOrder: state.sortOrder }) }),
      ])
      onStatesRefetch()
    })
  }

  async function addState() {
    if (!newStateName.trim()) { toast.error("Name is required"); return }
    setAddingState(true)
    const res = await fetch("/api/order-states", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newStateName.trim(), color: newStateColor }),
    })
    const json = await res.json()
    setAddingState(false)
    if (json.error) { toast.error(json.error); return }
    setNewStateName("")
    onStatesRefetch()
    toast.success("State added")
  }

  async function saveBusinessSettings() {
    setSavingBiz(true)
    const updates: { setting: string; value: string }[] = []
    if (taxRate) updates.push({ setting: "taxRate", value: taxRate })
    if (businessName) updates.push({ setting: "businessName", value: businessName })

    await Promise.all(
      updates.map((u) =>
        fetch("/api/settings", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(u),
        })
      )
    )
    setSavingBiz(false)
    toast.success("Settings saved")
  }

  const sortedStates = [...orderStates].sort((a, b) => a.sortOrder - b.sortOrder)

  return (
    <div className="p-6 max-w-2xl space-y-8">
      <h2 className="text-xl font-semibold text-(--color-foreground)">Settings</h2>

      {/* Order States */}
      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-(--color-muted) uppercase tracking-wider">Order States</h3>
        <div className="rounded-lg border border-(--color-border) divide-y divide-(--color-border)">
          {sortedStates.map((state) => (
            <div key={state.id} className="flex items-center justify-between px-4 py-3">
              <div className="flex items-center gap-3">
                <div
                  className="w-3 h-3 rounded-full shrink-0"
                  style={{ backgroundColor: state.color ?? "var(--color-border)" }}
                />
                <span className="text-sm font-medium text-(--color-foreground)">{state.name}</span>
                {state.isRequired ? (
                  <Lock size={12} className="text-(--color-muted)" />
                ) : null}
                {!state.isActive ? (
                  <Badge variant="outline" className="text-xs">Inactive</Badge>
                ) : null}
              </div>
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => moveState(state, "up")} disabled={isPending} aria-label="Move state up">
                  <ChevronUp size={14} />
                </Button>
                <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => moveState(state, "down")} disabled={isPending} aria-label="Move state down">
                  <ChevronDown size={14} />
                </Button>
                {!state.isRequired ? (
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs ml-1"
                    onClick={() => toggleActive(state)}
                    disabled={isPending}
                  >
                    {state.isActive ? "Deactivate" : "Activate"}
                  </Button>
                ) : null}
              </div>
            </div>
          ))}
        </div>

        {/* Add new state */}
        <div className="flex gap-2">
          <input
            type="color"
            value={newStateColor}
            onChange={(e) => setNewStateColor(e.target.value)}
            className="h-9 w-9 rounded-md border border-(--color-border) cursor-pointer p-0.5"
            title="Pick state color"
          />
          <Input
            value={newStateName}
            onChange={(e) => setNewStateName(e.target.value)}
            placeholder="New state name…"
            className="text-base"
            onKeyDown={(e) => { if (e.key === "Enter") addState() }}
          />
          <Button onClick={addState} disabled={addingState}>
            <Plus size={14} className="mr-1" /> Add
          </Button>
        </div>
      </div>

      <Separator />

      {/* Business settings */}
      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-(--color-muted) uppercase tracking-wider">Business Settings</h3>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Business Name</Label>
            <Input
              value={businessName}
              onChange={(e) => setBusinessName(e.target.value)}
              placeholder="My Business"
              className="text-base max-w-sm"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Tax Rate (decimal, e.g. 0.0775 for 7.75%)</Label>
            <Input
              type="number"
              inputMode="decimal"
              value={taxRate}
              onChange={(e) => setTaxRate(e.target.value)}
              placeholder="0.0775"
              step="0.001"
              className="text-base max-w-xs"
            />
          </div>
        </div>
        <Button onClick={saveBusinessSettings} disabled={savingBiz}>
          {savingBiz ? "Saving…" : "Save Settings"}
        </Button>
        <p className="text-xs text-(--color-muted)">Note: tax rate changes apply to new total calculations only — existing orders are not retroactively updated.</p>
      </div>
    </div>
  )
}
```

Note: The settings view calls `/api/settings` for business settings. Add that route after this task.

- [ ] **Step 2: Create /api/settings/route.ts for business settings**

Create `src/app/api/settings/route.ts`:

```ts
import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ data: null, error: "Unauthorized" }, { status: 401 })
  if (session.user.role !== "admin") return NextResponse.json({ data: null, error: "Forbidden" }, { status: 403 })

  const settings = await prisma.universalSettings.findMany()
  return NextResponse.json({ data: settings, error: null })
}

export async function PATCH(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ data: null, error: "Unauthorized" }, { status: 401 })
  if (session.user.role !== "admin") return NextResponse.json({ data: null, error: "Forbidden" }, { status: 403 })

  const body = await req.json()
  const { setting, value } = body
  if (!setting || value === undefined) {
    return NextResponse.json({ data: null, error: "setting and value are required" }, { status: 400 })
  }

  const updated = await prisma.universalSettings.upsert({
    where: { setting },
    update: { value: String(value), lastUpdatedBy: session.user.email ?? null },
    create: { setting, value: String(value) },
  })
  return NextResponse.json({ data: updated, error: null })
}
```

---

## Task 24: End-to-End Smoke Test

- [ ] **Step 1: Run the unit tests**

```bash
npm test
```

Expected: all 14 orderService tests passing.

- [ ] **Step 2: Start the dev server**

```bash
npm run dev
```

- [ ] **Step 3: Test each dashboard flow manually**

| Flow | Expected |
|------|----------|
| Sign in as admin → `/dashboard` | Dashboard renders with sidebar, kanban view (empty or with seeded orders) |
| `?view=orders&sub=calendar` | Calendar grid for current month |
| `?view=orders&sub=complete` | "No completed orders" message |
| `?view=orders&sub=archive` | "No archived orders" message |
| `?view=insights` | Charts render (empty data is fine — no orders yet) |
| `?view=users` | Users table with at least the admin user, role selector works |
| `?view=settings` | Order states listed with up/down/activate buttons; add state form |
| Create a test order via API | `curl -X POST http://localhost:3000/api/orders -H "Cookie: ..."` (use browser devtools to copy session cookie) |
| Open the test order in kanban | Order card shows, click opens sheet |
| Change order state in sheet | State badge updates on card in kanban after sheet mutation |
| Add a line item in Line Items tab | Line item appears in table, totals update |
| Record payment in Payment tab (admin) | Payment appears in history, balance decrements |
| Sign in as employee → `/dashboard` | Dashboard renders; Setup Costs and Payment tabs absent from sheet |
| Sign in as user → `/dashboard` | Redirected to `/account` (404 for now — Plan 3) |
| Mobile: open nav hamburger | Mobile nav menu opens and closes |

- [ ] **Step 4: Fix any failures before declaring Plan 2 complete**

- [ ] **Step 5: Stop the dev server (Ctrl+C)**

---

## Self-Review Checklist

- [ ] All API routes return `{ data, error }` tuples
- [ ] All API routes call `getServerSession(authOptions)` before any DB access
- [ ] Employee responses go through `stripAdminFields()` — cost/profit/unitCost never leak
- [ ] All Prisma order queries pass through `serializeOrder()` before `NextResponse.json()`
- [ ] Next.js 16 async params: `const { id } = await params` in all dynamic routes
- [ ] No `Button asChild` — all button-styled links use `buttonVariants` + `<Link>`
- [ ] Kanban columns use `@tanstack/react-virtual` for long lists
- [ ] Recharts loaded with `next/dynamic({ ssr: false })` — not in the initial bundle
- [ ] All Sheet/Dialog footers with action buttons have `pb-[max(1rem,env(safe-area-inset-bottom))]`
- [ ] Icon-only buttons all have `aria-label`
- [ ] State change in order sheet wrapped in `useTransition`
- [ ] `{condition ? <X /> : null}` — no `{condition && <X />}`
- [ ] CSS variable syntax throughout: `text-(--color-foreground)` not the legacy bracket syntax
- [ ] All files under ~250 lines

---

## Notes for Plan 3 (Get Quote + Account)

Plan 3 will need:
- `GET /api/orders` for `user` role — returns only that user's orders, no cost/profit
- `POST /api/orders` public path — create order without auth (Get Quote form)
- `src/app/account/` pages
- `src/app/get-quote/` pages with the multi-step form
- Cloudinary upload integration (`CLOUDINARY_URL` env var)
- Notification creation on order submit

---

## ⚠️ Plan 2 Revision Notes
### (OWA review + grill session — read before executing ANY task; these override task code where they conflict)

Eight issues were found. Each revision below is self-contained with complete replacement code.

---

### Revision 1 — Kanban sort order (overrides Task 4 GET + Task 14 KanbanColumn)

**Problem:** `GET /api/orders` returns all orders `orderBy: { createdAt: "desc" }`. OWA sorts differently per column: State 1 = newest first (admin reviews new orders first), States 2+ = soonest dueDate first (staff sees urgent work first). Nulls sort last.

**Fix A — API route `GET /api/orders`:** Change `orderBy` to return two sort keys:

```ts
// In src/app/api/orders/route.ts, replace the findMany orderBy:
const orders = await prisma.order.findMany({
  include: {
    state: { select: { id: true, name: true, color: true } },
    user: { select: { id: true, firstName: true, lastName: true, email: true } },
    _count: { select: { orderLineItems: true } },
  },
  orderBy: [
    { stateId: "asc" },
    { createdAt: "desc" },   // secondary sort, client overrides per state
  ],
})
```

**Fix B — `Dashboard-KanbanColumn.tsx`:** Sort orders client-side within each column before passing to virtualizer:

```ts
// Add inside DashboardKanbanColumn, before the virtualizer:
const sortedOrders = [...orders].sort((a, b) => {
  if (state.id === 1) {
    // Needs Review: newest first so admin sees new orders at top
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  }
  // All other states: soonest due date first, nulls last
  if (!a.dueDate && !b.dueDate) return 0
  if (!a.dueDate) return 1
  if (!b.dueDate) return -1
  return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()
})
// Replace `orders` with `sortedOrders` in the virtualizer count and getVirtualItems render
```

Full updated `Dashboard-KanbanColumn.tsx`:

```tsx
"use client"

import { useRef } from "react"
import { useVirtualizer } from "@tanstack/react-virtual"
import { OrderCard } from "./Dashboard-OrderCard"
import type { OrderSummary, OrderDetail } from "@/models/order"
import type { OrderStateModel } from "@/models/orderState"

type Props = {
  state: Pick<OrderStateModel, "id" | "name" | "color">
  orders: OrderSummary[]
  role: string
  onOpenOrder: (order: OrderDetail) => void
}

export default function DashboardKanbanColumn({ state, orders, role, onOpenOrder }: Props) {
  const parentRef = useRef<HTMLDivElement>(null)

  const sortedOrders = [...orders].sort((a, b) => {
    if (state.id === 1) {
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    }
    if (!a.dueDate && !b.dueDate) return 0
    if (!a.dueDate) return 1
    if (!b.dueDate) return -1
    return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()
  })

  const virtualizer = useVirtualizer({
    count: sortedOrders.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 130,
    overscan: 5,
  })

  const totalValue = orders.reduce((s, o) => s + o.totalPrice, 0)

  async function handleOpenOrder(order: OrderSummary) {
    const res = await fetch(`/api/orders/${order.id}`)
    const json = await res.json()
    if (!json.error) onOpenOrder(json.data)
  }

  return (
    <div className="flex flex-col w-72 shrink-0 bg-(--color-surface) rounded-lg border border-(--color-border) overflow-hidden">
      <div
        className="px-3 py-2.5 border-b-2"
        style={{ borderBottomColor: state.color ?? "var(--color-border)" }}
      >
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold text-(--color-foreground)">{state.name}</span>
          <span className="text-xs text-(--color-muted) bg-(--color-background) rounded-full px-2 py-0.5">
            {orders.length}
          </span>
        </div>
        {orders.length > 0 ? (
          <p className="text-xs text-(--color-muted) mt-0.5">${totalValue.toFixed(2)}</p>
        ) : null}
      </div>

      <div ref={parentRef} className="overflow-y-auto flex-1 max-h-[calc(100dvh-12rem)] p-2">
        <div style={{ height: virtualizer.getTotalSize(), position: "relative" }}>
          {virtualizer.getVirtualItems().map((virtualRow) => {
            const order = sortedOrders[virtualRow.index]
            return (
              <div
                key={order.id}
                style={{ position: "absolute", top: virtualRow.start, left: 0, right: 0, paddingBottom: 8 }}
              >
                <OrderCard order={order} role={role} onOpen={() => handleOpenOrder(order)}>
                  <OrderCard.Header />
                  <OrderCard.Badges />
                  <OrderCard.Footer />
                </OrderCard>
              </div>
            )
          })}
        </div>
        {sortedOrders.length === 0 ? (
          <p className="text-xs text-(--color-muted) text-center py-6">No orders</p>
        ) : null}
      </div>
    </div>
  )
}
```

---

### Revision 2 — PATCH totals bug (overrides Task 5 PATCH handler)

**Problem:** When `lineItems` is in the PATCH body, `computeOrderTotals` is called with `scalarUpdate.discountManual` which is `undefined` if the body didn't include it. `computeOrderTotals` treats `undefined` as 0, silently zeroing out existing discounts.

**Fix:** Fetch the current order first, use its values as defaults.

Replace the `lineItems !== undefined` block in `PATCH /api/orders/[id]` with:

```ts
if (lineItems !== undefined) {
  const currentOrder = await prisma.order.findUnique({
    where: { id: orderId },
    select: {
      discountManual: true, discountReferral: true, discountMistake: true, rushFeeAmount: true,
    },
  })

  const taxSetting = await prisma.universalSettings.findUnique({ where: { setting: "taxRate" } })
  const taxRate = taxSetting ? Number(taxSetting.value) : 0

  const existingSetUpCosts = await prisma.setUpCost.findMany({ where: { orderId } })
  const scCosts = existingSetUpCosts.map((s) => ({
    userTotal: Number(s.userTotal),
    adminTotal: Number(s.adminTotal),
  }))

  const totals = computeOrderTotals({
    lineItems,
    setUpCosts: scCosts,
    taxRate,
    discountManual: scalarUpdate.discountManual !== undefined
      ? scalarUpdate.discountManual
      : Number(currentOrder?.discountManual ?? 0),
    discountReferral: scalarUpdate.discountReferral !== undefined
      ? scalarUpdate.discountReferral
      : Number(currentOrder?.discountReferral ?? 0),
    discountMistake: scalarUpdate.discountMistake !== undefined
      ? scalarUpdate.discountMistake
      : Number(currentOrder?.discountMistake ?? 0),
    rushFeeAmount: scalarUpdate.rushFeeAmount !== undefined
      ? scalarUpdate.rushFeeAmount
      : Number(currentOrder?.rushFeeAmount ?? 0),
  })
  Object.assign(scalarUpdate, totals)

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
```

---

### Revision 3 — Post-mutation refetch pattern (overrides Tasks 10, 11, 18, 19, 20)

**Problem:** `Dashboard.tsx` calls `updateOrder(updated as any)` which puts an `OrderDetail` (with `orderLineItems[]`) into the `OrderSummary[]` list. `OrderCard.Footer` then does `order._count.orderLineItems` which is `undefined` → broken item count display.

**OWA's approach (and correct fix):** After any sheet mutation, refetch the full orders list. The sheet keeps its own `selectedOrder` detail state. Two API calls per action (PATCH + GET list) — perfectly acceptable.

**Fix A — `useOrders.ts`:** Remove `updateOrder` and `removeOrder`. The hook just manages fetching.

Replace `src/hooks/useOrders.ts` with:

```ts
"use client"

import { useState, useEffect, useCallback } from "react"
import type { OrderSummary } from "@/models/order"

export function useOrders() {
  const [orders, setOrders] = useState<OrderSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchOrders = useCallback(async () => {
    setLoading(true)
    setError(null)
    const res = await fetch("/api/orders")
    const json = await res.json()
    setLoading(false)
    if (json.error) { setError(json.error); return }
    setOrders(json.data)
  }, [])

  useEffect(() => { fetchOrders() }, [fetchOrders])

  return { orders, loading, error, refetch: fetchOrders }
}
```

**Fix B — `Dashboard.tsx`:** Simplify mutation handlers to use `refetch`. Remove `updateOrder`/`removeOrder` from destructure.

Replace the mutation handlers in `Dashboard.tsx`:

```tsx
const { orders, loading: ordersLoading, refetch: refetchOrders } = useOrders()
const { orderStates, loading: statesLoading, refetch: refetchStates, updateState } = useOrderStates()

const [selectedOrder, setSelectedOrder] = useState<OrderDetail | null>(null)
const [sheetOpen, setSheetOpen] = useState(false)

function handleOpenOrder(order: OrderDetail) {
  setSelectedOrder(order)
  setSheetOpen(true)
}

function handleOrderUpdated(updated: OrderDetail) {
  setSelectedOrder(updated)   // keep sheet fresh
  refetchOrders()             // refresh kanban/list
}

function handleOrderDeleted() {
  setSheetOpen(false)
  refetchOrders()
}
```

**Fix C — All sheet sub-components (LineItems, SetupCosts, Payment):** Change all `onOrderUpdated(json.data)` calls to instead pass the detail back to the parent which handles the refetch. The `onOrderUpdated` prop signature stays the same (`(order: OrderDetail) => void`) — no interface changes needed. The parent's `handleOrderUpdated` now does both jobs.

---

### Revision 4 — Sub-nav visible on all order sub-views (overrides Tasks 11, 12, 15)

**Problem:** `DashboardOrdersView.tsx` contains the sub-nav tabs but is only rendered for `sub === "default"`. Calendar, Complete, and Archive views are rendered directly from `Dashboard.tsx` without the sub-nav. Users on those views have no tab strip to navigate back to Kanban.

**Fix:** Extract the sub-nav to its own component. Render it in `Dashboard.tsx` whenever `view === "orders"`. Remove `DashboardOrdersView.tsx` entirely — it was only a wrapper around kanban + the sub-nav.

**New file — `src/app/dashboard/components/Dashboard-OrdersSubNav.tsx`:**

```tsx
"use client"

import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { cn } from "@/lib/utils"

const TABS = [
  { key: "default", label: "Kanban" },
  { key: "calendar", label: "Calendar" },
  { key: "complete", label: "Complete" },
  { key: "archive", label: "Archive" },
] as const

export default function DashboardOrdersSubNav() {
  const sub = useSearchParams().get("sub") ?? "default"
  return (
    <div className="border-b border-(--color-border) px-4 flex gap-1 pt-2 shrink-0 bg-(--color-background)">
      {TABS.map(({ key, label }) => (
        <Link
          key={key}
          href={`?view=orders&sub=${key}`}
          className={cn(
            "px-3 py-2 text-sm font-medium rounded-t-md border-b-2 transition-colors motion-reduce:transition-none",
            sub === key
              ? "border-(--color-primary) text-(--color-primary)"
              : "border-transparent text-(--color-muted) hover:text-(--color-foreground)"
          )}
        >
          {label}
        </Link>
      ))}
    </div>
  )
}
```

**Updated `Dashboard.tsx` `renderView()`** — replace the entire `renderView` function:

```tsx
function renderView() {
  if (view === "orders") {
    return (
      <div className="flex flex-col flex-1 min-h-0">
        <Suspense><DashboardOrdersSubNav /></Suspense>
        {sub === "calendar"
          ? <DashboardCalendarView orders={orders} loading={ordersLoading} onOpenOrder={handleOpenOrder} />
          : sub === "complete"
          ? <DashboardCompleteView orders={orders} loading={ordersLoading} onOpenOrder={handleOpenOrder} />
          : sub === "archive"
          ? <DashboardArchiveView orders={orders} loading={ordersLoading} onOpenOrder={handleOpenOrder} />
          : <DashboardKanban orders={orders} loading={ordersLoading} orderStates={activeStates} statesLoading={statesLoading} onOpenOrder={handleOpenOrder} role={role} />
        }
      </div>
    )
  }
  if (view === "insights" && role === "admin") return <DashboardInsightsView />
  if (view === "users" && role === "admin") return <DashboardUsersView />
  if (view === "settings" && role === "admin") {
    return <DashboardSettingsView orderStates={orderStates} onStateUpdated={updateState} onStatesRefetch={refetchStates} />
  }
  // Default fallback
  return (
    <div className="flex flex-col flex-1 min-h-0">
      <Suspense><DashboardOrdersSubNav /></Suspense>
      <DashboardKanban orders={orders} loading={ordersLoading} orderStates={activeStates} statesLoading={statesLoading} onOpenOrder={handleOpenOrder} role={role} />
    </div>
  )
}
```

Add import at top of `Dashboard.tsx`:
```ts
import DashboardOrdersSubNav from "./components/Dashboard-OrdersSubNav"
```

**Delete `Dashboard-OrdersView.tsx`** — no longer needed.

**Updated File Map additions:**
- Create: `src/app/dashboard/components/Dashboard-OrdersSubNav.tsx`
- DELETE: `src/app/dashboard/components/views/Dashboard-OrdersView.tsx` (do not create this file)

---

### Revision 5 — Settings load current values (overrides Task 23)

**Problem:** `Dashboard-SettingsView.tsx` initializes `taxRate` and `businessName` as empty strings. Users see blank inputs and don't know current values.

**Fix:** Add a `useEffect` that fetches `/api/settings` on mount and populates the state.

Replace the state declarations and add an effect at the top of `DashboardSettingsView`:

```tsx
const [taxRate, setTaxRate] = useState("")
const [businessName, setBusinessName] = useState("")
const [loadingSettings, setLoadingSettings] = useState(true)

useEffect(() => {
  fetch("/api/settings").then((r) => r.json()).then((json) => {
    setLoadingSettings(false)
    if (!json.data) return
    const tax = json.data.find((s: any) => s.setting === "taxRate")
    const biz = json.data.find((s: any) => s.setting === "businessName")
    if (tax) setTaxRate(tax.value)
    if (biz) setBusinessName(biz.value)
  })
}, [])
```

Also show a loading state for the business settings section:

```tsx
{loadingSettings ? (
  <Skeleton className="h-24 rounded-lg" />
) : (
  /* existing business settings form */
)}
```

---

### Revision 6 — State-change notifications (adds to Task 5 PATCH handler)

**Problem:** Notifications table exists in the schema but is never written to. OWA creates notifications when state changes for orders with a linked user.

**Fix:** After the `prisma.order.update` call in `PATCH /api/orders/[id]`, add notification creation when stateId changes:

```ts
// After `const updated = await prisma.order.update(...)`:

if (stateId !== undefined && updated.userId) {
  const STATE_NOTIFICATIONS: Record<number, { title: string; message: string }> = {
    2: { title: "Quote Ready to Review", message: `Your quote #${orderId} has been reviewed and is ready for your approval.` },
    3: { title: "Order In Progress", message: `We've started working on your order #${orderId}. Estimated completion date will be set soon.` },
    4: { title: "Ready for Pickup", message: `Your order #${orderId} is complete and ready for pickup!` },
    5: { title: "Final Payment Needed", message: `Your order #${orderId} is ready. Please arrange final payment before pickup.` },
    6: { title: "Order Complete", message: `Your order #${orderId} has been completed. Thank you for your business!` },
  }
  const notifData = STATE_NOTIFICATIONS[stateId as number]
  if (notifData) {
    await prisma.notification.create({
      data: {
        userId: updated.userId,
        orderId: orderId,
        type: "state_changed",
        title: notifData.title,
        message: notifData.message,
      },
    }).catch(() => { /* non-fatal — log and continue */ })
  }
}
```

Note: Wrapped in `.catch(() => {})` so a notification failure never breaks the state update response.

---

### Revision 7 — Complete `src/app/api/users/route.ts` with GET (overrides Task 22 Step 2)

**Problem:** Task 22 Step 2 says "add GET handler + missing imports" but doesn't show the full updated file. This is a placeholder violation.

Replace `src/app/api/users/route.ts` entirely with:

```ts
import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { hash } from "bcryptjs"
import { prisma } from "@/lib/prisma"

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ data: null, error: "Unauthorized" }, { status: 401 })
  if (session.user.role !== "admin") return NextResponse.json({ data: null, error: "Forbidden" }, { status: 403 })

  const users = await prisma.user.findMany({
    select: {
      id: true, email: true, firstName: true, lastName: true,
      companyName: true, phone: true, role: true, createdAt: true,
    },
    orderBy: { createdAt: "desc" },
  })
  return NextResponse.json({ data: users, error: null })
}

export async function POST(req: Request) {
  // TODO[7]: Rate limiting — no IP-based rate limit; add before production to prevent account spam.
  const body = await req.json()
  const { email, password, firstName, lastName, phone, companyName, address } = body

  if (!email || !password || !firstName || !lastName) {
    return NextResponse.json(
      { data: null, error: "email, password, firstName, and lastName are required" },
      { status: 400 }
    )
  }
  if (password.length < 8) {
    return NextResponse.json(
      { data: null, error: "Password must be at least 8 characters" },
      { status: 400 }
    )
  }

  const existing = await prisma.user.findUnique({ where: { email } })
  if (existing) return NextResponse.json({ data: null, error: "Email already in use" }, { status: 409 })

  try {
    const hashedPassword = await hash(password, 12)
    const user = await prisma.user.create({
      data: {
        email, password: hashedPassword, firstName, lastName,
        phone: phone || null, companyName: companyName || null, role: "user",
      },
      select: { id: true, email: true, firstName: true, lastName: true, role: true },
    })

    if (address?.street) {
      await prisma.address.create({
        data: {
          userId: user.id,
          street: address.street, city: address.city || "",
          state: address.state || "", zipCode: address.zipCode || "",
          label: "primary",
        },
      })
    }

    return NextResponse.json({ data: user, error: null }, { status: 201 })
  } catch {
    return NextResponse.json({ data: null, error: "Failed to create account" }, { status: 500 })
  }
}
```

---

### Revision 8 — Calendar shows orders spanning date ranges (improves Task 16)

**Problem:** Calendar view only places orders on `dueDate`. OWA also shows orders on every day in the `dueDate → dueDateEnd` range. Missed this in original plan.

**Fix:** In `Dashboard-CalendarView.tsx`, replace the filter for orders matching a day:

```ts
// Replace:
const dayOrders = ordersWithDue.filter((o) => isSameDay(new Date(o.dueDate!), day))

// With:
const dayOrders = ordersWithDue.filter((o) => {
  const start = new Date(o.dueDate!)
  const end = o.dueDateEnd ? new Date(o.dueDateEnd) : start
  // Day is within [start, end] range (inclusive)
  return day >= start && day <= end
})
```

Note: `OrderSummary` already includes `dueDateEnd: string | null` from Task 2 models.

---

### Summary of file map changes

| Change | Reason |
|--------|--------|
| ADD `src/app/dashboard/components/Dashboard-OrdersSubNav.tsx` | Extracted sub-nav (Revision 4) |
| DO NOT CREATE `src/app/dashboard/components/views/Dashboard-OrdersView.tsx` | Replaced by inline rendering in Dashboard.tsx (Revision 4) |
| SIMPLIFY `src/hooks/useOrders.ts` | Remove updateOrder/removeOrder (Revision 3) |
| REPLACE `src/app/api/users/route.ts` | Full file with GET + POST + imports (Revision 7) |

---

### Revision 9 — OWA deep-read corrections (overrides multiple tasks; read this before any UI work)

**Sources:** Live read of `src/app/employee/dashboard/page.tsx` (244 lines) + `OrdersView.tsx` (8,522 lines).

---

#### 9a — Navigation is flat, not nested (overrides Task 11, Task 15, Task 16, Task 17, Task 18)

**Problem:** Plan tasks describe `?view=orders&sub=calendar` nested URL params and a `Dashboard-OrdersSubNav.tsx` component with tabs for Kanban/Calendar/Complete/Archive. OWA doesn't do this. All views are top-level sidebar items.

**Correct pattern:**
- Sidebar items: Orders (`?view=orders`) · Calendar (`?view=calendar`) · Complete (`?view=complete`) · Archive (`?view=archive`) · Insights (`?view=insights`) · Users (`?view=users`) · Settings (`?view=settings`)
- `Dashboard.tsx` renders one view at a time based on `searchParams.view`
- "Complete" renders `<DashboardOrdersView filterStateId={6} />` — reuses the same kanban/list component with a filter
- "Archive" renders `<DashboardOrdersView filterStateId={0} />`
- **Delete `Dashboard-OrdersSubNav.tsx` from the plan entirely** — it's not needed
- **No `?sub=` param anywhere** — remove all references

Updated `Dashboard.tsx` view switching:
```tsx
const view = searchParams?.view ?? "orders"

return (
  <div className="flex h-dvh overflow-hidden">
    <DashboardSidebar activeView={view} />
    <main className="flex-1 overflow-y-auto">
      {view === "orders" && <DashboardOrdersView />}
      {view === "calendar" && <DashboardCalendarView />}
      {view === "complete" && <DashboardOrdersView filterStateId={6} />}
      {view === "archive" && <DashboardOrdersView filterStateId={0} />}
      {view === "insights" && <DashboardInsightsView />}
      {view === "users" && <DashboardUsersView />}
      {view === "settings" && <DashboardSettingsView />}
    </main>
  </div>
)
```

---

#### 9b — Order detail is a Dialog, not Sheet; structure is 3 sections not 4 tabs (overrides Task 19)

**Problem:** Plan describes a `Sheet` with 4 tabs (Details / Line Items / Payments / Overview). OWA uses a single `Dialog` with all content in one scrollable view, no tabs.

**Correct structure inside the Dialog:**

```
Dialog
  ├── Header: "Order #215" + editable nickname input + date + state name
  ├── Body (scrollable):
  │   ├── OrderDetailsView
  │   │   ├── Order Items table (DESIGN · STYLE · COLOR · QTY · PRINT · BLANK · RATE · AMOUNT + TOTALS row)
  │   │   ├── [Grid: 2-col if hasSetupCosts, 1-col otherwise]
  │   │   │   ├── Set Up Costs table (only if order has setup costs)
  │   │   │   └── Order Totals table (Sub Total · discounts · Sales Tax · Total · Profit)
  │   │   └── Impressions + Estimated Time footer
  │   └── Admin Actions Footer (state-dependent — see 9c)
```

**Set Up Costs table in our template:** Keep simple. Only one possible line item: Shipping ($20 flat). The table shows: ITEM · DESCRIPTION · QTY · RATE · AMOUNT. If `setUpCosts[0].shippingQty` is set (value = 1), show one row: "Shipping" / "Flat Rate" / 1 / $20 / $20. If no setup costs, hide the entire section (full-width Order Totals).

**Component:** `src/app/dashboard/components/order-detail/Dashboard-OrderDetailDialog.tsx`

---

#### 9c — Action buttons are state-dependent (overrides Task 19 action buttons)

**Problem:** Plan says fixed buttons "REVERT · CREATE DUPLICATE · EDIT · SEND TO [STATE]". The actual pattern is completely different per state.

**Correct per-state button sets:**

**State 0 (archived):**
```tsx
<div className="flex justify-end gap-3">
  <Button onClick={() => router.push(`/quote-builder?reorderId=${order.id}`)}>Create Duplicate</Button>
  <Button onClick={() => router.push(`/quote-builder?orderId=${order.id}`)}>Edit</Button>
  <Button onClick={handleRestoreOrder}>Restore</Button>
  <Button variant="destructive" onClick={() => setDeleteOpen(true)}>Delete</Button>
</div>
```

**State 1 (Admin Review — has extra controls):**
```tsx
<>
  {/* Payment Type + Tax Deferral — required before advancing */}
  <div className="grid grid-cols-2 gap-4">
    <div>
      <label>Payment Type</label>
      <Select value={paymentMethod} onValueChange={setPaymentMethod}>
        <SelectItem value="pay_at_pickup">Pay at Pickup</SelectItem>
        <SelectItem value="deposit">Deposit</SelectItem>
        <SelectItem value="full_upfront">Full Upfront</SelectItem>
      </Select>
    </div>
    <div>
      <label>Tax Deferral</label>
      <Button
        onClick={() => setTaxDeferral(prev => !prev)}
        className={taxDeferral ? "bg-(--color-success)" : ""}
      >
        {taxDeferral ? "Tax Deferral Enabled" : "Enable Tax Deferral"}
      </Button>
    </div>
  </div>
  {paymentMethod === "deposit" && (
    <Input type="number" label="Deposit Amount" value={depositAmount} onChange={...} />
  )}
  {/* Action row */}
  <div className="flex justify-end gap-3">
    <Button variant="destructive" onClick={() => setRevertOpen(true)}>Revert</Button>
    <Button onClick={() => router.push(`/quote-builder?reorderId=${order.id}`)}>Create Duplicate</Button>
    <Button onClick={() => router.push(`/quote-builder?orderId=${order.id}`)}>Edit</Button>
    <Button disabled={!paymentMethod} onClick={() => openStateModal(1, 2)}>Send To Customer</Button>
  </div>
</>
```

**State 2:**
```tsx
<div className="flex justify-end gap-3">
  <Button variant="destructive" onClick={() => setRevertOpen(true)}>Revert</Button>
  <Button onClick={() => router.push(`/quote-builder?reorderId=${order.id}`)}>Create Duplicate</Button>
  <Button onClick={() => router.push(`/quote-builder?orderId=${order.id}`)}>Edit</Button>
  <Button onClick={() => openStateModal(2, 3)}>Approve For Customer</Button>
</div>
```

**States 3–5 (simplify from OWA — just Revert + Edit + advance):**
```tsx
<div className="flex justify-end gap-3">
  <Button variant="destructive" onClick={() => setRevertOpen(true)}>Revert</Button>
  <Button onClick={() => router.push(`/quote-builder?reorderId=${order.id}`)}>Create Duplicate</Button>
  <Button onClick={() => router.push(`/quote-builder?orderId=${order.id}`)}>Edit</Button>
  <Button onClick={() => openStateModal(order.stateId, order.stateId + 1)}>
    {getAdvanceLabel(order.stateId)}  {/* e.g. "Mark In Progress", "Mark Complete" */}
  </Button>
</div>
```

**State 6 (complete):**
```tsx
<div className="flex justify-end gap-3">
  <Button onClick={() => router.push(`/quote-builder?reorderId=${order.id}`)}>Create Duplicate</Button>
  <Button variant="destructive" onClick={() => openStateModal(6, 0)}>Archive</Button>
</div>
```

Note: **"Revert" is admin-only** (not shown to employee role). The "Edit" / "Create Duplicate" / state-advance buttons are visible to employee too.

---

#### 9d — URL sync for order modal (new addition to Task 19)

When order dialog opens, add `?orderId=X` to URL. When it closes, remove it. This enables direct links to orders.

```tsx
// On open:
const params = new URLSearchParams(window.location.search)
params.set("orderId", String(order.id))
router.replace(`${pathname}?${params}`, { scroll: false })

// On close:
const params = new URLSearchParams(window.location.search)
params.delete("orderId")
const newUrl = params.toString() ? `${pathname}?${params}` : pathname
router.replace(newUrl, { scroll: false })
```

On mount in `Dashboard.tsx`, if `searchParams.orderId` is set, auto-open that order's dialog.

---

#### 9e — `Create Duplicate` uses `reorderId` param, not `orderId` (overrides any task mentioning quote builder nav)

`/quote-builder?orderId=X` = edit existing order (load and mutate in place)
`/quote-builder?reorderId=X` = create a copy (pre-fill form from source, save as new order)

Both are Plan 3 concerns. For Plan 2, just navigate with the correct param — don't implement the quote builder itself.

---

#### 9f — Summary of file map changes from Revision 9

| Change | Reason |
|--------|--------|
| DELETE `Dashboard-OrdersSubNav.tsx` from plan | Navigation is flat sidebar items, not sub-tabs (9a) |
| RENAME order detail component → `Dashboard-OrderDetailDialog.tsx` | It's a Dialog, not a Sheet (9b) |
| State-dependent action buttons in `Dashboard-OrderDetailDialog.tsx` | Per-state button sets (9c) |
| URL sync in `Dashboard-OrderDetailDialog.tsx` + `Dashboard.tsx` | `?orderId=X` deep-link support (9d) |
| `Dashboard.tsx` view switching uses flat `?view=` only | No `?sub=` param anywhere (9a) |
