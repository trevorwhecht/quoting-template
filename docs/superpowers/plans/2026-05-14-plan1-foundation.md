# Quoting Template — Plan 1: Foundation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Install dependencies, write the Prisma schema, configure NextAuth with role-based JWT, theme globals.css with CSS variables, and build the Navbar + Login + Register pages — everything needed before the dashboard.

**Architecture:** Next.js 16 App Router, next-auth v4 credentials provider with JWT strategy, single User table with `role` field, shadcn/ui components throughout. No NextUI — it is not used in this project. All colors via CSS variables in globals.css. Route protection via next-auth middleware.

**Tech Stack:** Next.js 16, Prisma 6, next-auth ^4.24, @auth/prisma-adapter, shadcn/ui, Tailwind 4, bcryptjs, Sonner, tsx (seed runner), PostgreSQL

**This is Plan 1 of 3.** Plan 2 covers the full dashboard. Plan 3 covers Get Quote and Account pages.

---

> **Schema updates applied 2026-05-14** (post-review against Postgres best practices):
> - All money/price/cost fields changed from `Float` → `Decimal @db.Decimal(10,2)` to prevent floating-point rounding errors in financial calculations. `rushFeePercent` uses `@db.Decimal(5,4)`.
> - FK indexes added: `Order [userId]`, `Order [stateId]`, `Order [userId, createdAt]`, `OrderLineItem [orderId]`, `Payment [orderId]`, `Address [userId]`, `Account [userId]`, `Session [userId]`.
> - Seed script now resets the `OrderState` autoincrement sequence after seeding to prevent PK conflicts when admins add new states via UI.
> - Tailwind 4 CSS variable syntax standardized: `text-(--color-danger)` not `text-(--color-danger)` throughout all TSX code blocks.
>
> **The actual `prisma/schema.prisma` file reflects all schema changes.** The schema code block in Task 3 below is kept for reference — use the real file when running migrations.

**Spec:** `docs/superpowers/specs/2026-05-14-quoting-template-design.md`

---

## File Map

| File | Action | Purpose |
|------|--------|---------|
| `package.json` | Modify | Add scripts, deps |
| `.env.local` | Create (local only) | Dev secrets |
| `.env.example` | Create | Committed var checklist |
| `prisma/schema.prisma` | Create | Full DB schema |
| `prisma/seed.ts` | Create | Admin + order states + settings |
| `src/lib/prisma.ts` | Create | Singleton Prisma client |
| `src/lib/auth.ts` | Replace | NextAuth config with role callbacks |
| `src/types/next-auth.d.ts` | Create | Extend Session/JWT with role/firstName/lastName |
| `src/middleware.ts` | Create | Route protection |
| `src/app/api/auth/[...nextauth]/route.ts` | Create | NextAuth handler |
| `src/app/api/users/route.ts` | Create | POST register |
| `src/app/globals.css` | Replace | Full CSS variable theme |
| `src/app/layout.tsx` | Replace | SessionWrapper + Toaster + Navbar |
| `src/app/page.tsx` | Replace | Minimal landing page |
| `src/app/(auth)/login/page.tsx` | Create | Thin server component |
| `src/app/(auth)/login/Login.tsx` | Create | Login form container |
| `src/app/(auth)/register/page.tsx` | Create | Thin server component |
| `src/app/(auth)/register/Register.tsx` | Create | Register form container |
| `src/app/dashboard/page.tsx` | Create | Placeholder (replaced in Plan 2) |
| `src/components/shared/layout/SessionWrapper.tsx` | Create | Client SessionProvider wrapper |
| `src/components/shared/layout/Navbar.tsx` | Create | Auth-aware top nav (server) |
| `src/components/shared/layout/Navbar-Links.tsx` | Create | Client nav links + mobile menu |

---

## Task 1: Install Dependencies

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install runtime dependencies**

```bash
npm install bcryptjs dotenv-cli sonner
```

- [ ] **Step 2: Install dev dependencies**

```bash
npm install --save-dev @types/bcryptjs tsx dotenv
```

- [ ] **Step 3: Initialize shadcn**

```bash
npx shadcn@latest init --defaults
```

When prompted: choose default style, default base color, and yes to CSS variables. This writes `components.json` and updates `src/app/globals.css` with shadcn base vars (we will overwrite globals.css in Task 8).

- [ ] **Step 4: Add required shadcn components**

```bash
npx shadcn@latest add button input label card form select badge separator avatar dropdown-menu sheet dialog alert-dialog tabs table skeleton tooltip sonner
```

- [ ] **Step 5: Update package.json scripts**

Replace the `scripts` block and add the `prisma` seed config:

```json
{
  "scripts": {
    "dev": "next dev",
    "dev:prod": "dotenv -e .env.prod -- next dev --port 3001",
    "build": "prisma generate && next build",
    "start": "next start",
    "lint": "eslint .",
    "postinstall": "prisma generate"
  },
  "prisma": {
    "seed": "tsx prisma/seed.ts"
  }
}
```

- [ ] **Step 6: Verify install**

```bash
npm run lint
```

Expected: no errors (or only "no pages found" warnings which are fine at this stage).

---

## Task 2: Environment Files

**Files:**
- Create: `.env.local` (local only, gitignored)
- Create: `.env.example`

- [ ] **Step 1: Check .gitignore covers .env.local**

```bash
grep "env.local" .gitignore
```

Expected: `.env.local` is listed. If not, add it.

- [ ] **Step 2: Create .env.local with your local values**

```bash
# .env.local — never commit this file
DATABASE_URL="postgresql://USER:PASSWORD@localhost:5432/quoting_template"
NEXTAUTH_SECRET="generate-a-random-string-here"
NEXTAUTH_URL="http://localhost:3000"
SEED_ADMIN_EMAIL="admin@example.com"
SEED_ADMIN_PASSWORD="changeme123"
```

Generate `NEXTAUTH_SECRET`:
```bash
openssl rand -base64 32
```

- [ ] **Step 3: Create .env.example**

```bash
# .env.example — commit this file (values omitted)
DATABASE_URL=
NEXTAUTH_SECRET=
NEXTAUTH_URL=
SEED_ADMIN_EMAIL=
SEED_ADMIN_PASSWORD=
NEXT_PUBLIC_BASE_URL=       # required — base URL for Order.token public share links
CLOUDINARY_URL=             # optional — image uploads (order mainImage, quote attachments)
RESEND_API_KEY=             # optional — transactional email (state changes, quote ready)
TWILIO_ACCOUNT_SID=         # optional — SMS notifications
TWILIO_AUTH_TOKEN=          # optional — SMS notifications
TWILIO_PHONE_NUMBER=        # optional — SMS from number
```

---

## Task 3: Prisma Schema

**Files:**
- Create: `prisma/schema.prisma`

- [ ] **Step 1: Create the prisma directory and schema file**

Create `prisma/schema.prisma`:

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model User {
  id          String   @id @default(cuid())
  email       String   @unique
  password    String?
  firstName   String
  lastName    String
  companyName String?
  phone       String?
  role        String   @default("user") // 'guest' | 'user' | 'employee' | 'admin'
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  createdBy   String?
  updatedBy   String?

  accounts      Account[]
  sessions      Session[]
  orders        Order[]
  payments      Payment[]
  addresses     Address[]
  notifications Notification[]
}

model Address {
  id        String   @id @default(cuid())
  userId    String?
  label     String?  // 'home' | 'billing' | 'shipping' | etc.
  street    String
  city      String
  state     String
  zipCode   String
  country   String   @default("USA")
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  createdBy String?
  updatedBy String?

  user   User?   @relation(fields: [userId], references: [id], onDelete: SetNull)
  orders Order[] @relation("ShippingAddress")
}

model OrderState {
  id          Int      @id @default(autoincrement())
  name        String
  sortOrder   Int
  description String?
  isActive    Boolean  @default(true)
  isRequired  Boolean  @default(false) // archive + complete cannot be disabled
  color       String?                  // hex color for kanban column header
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  orders      Order[]
}

model Order {
  id                Int       @id @default(autoincrement())
  userId            String?   // null = admin "no account yet" orders only
  stateId           Int
  shippingAddressId String?
  nickname          String?
  customerNotes   String?   // from the Get Quote form, visible to customer
  notes           String?   // internal admin notes, never shown to customer
  totalQty        Int       @default(0)
  totalSetUpPrice Float     @default(0) // user-facing setup total
  totalSetUpCost  Float     @default(0) // admin COGS for setup (admin only)
  totalAmount     Float     @default(0) // sum of line item amounts
  subTotal        Float     @default(0) // totalAmount + totalSetUpPrice - discounts
  salesTax        Float     @default(0) // computed from UniversalSettings taxRate
  totalPrice      Float     @default(0) // subTotal + salesTax
  cost            Float     @default(0) // total COGS (admin only)
  profit          Float     @default(0) // totalPrice - cost (admin only)
  discountManual  Float?    // admin-applied discount before completion
  discountReferral Float?   // referral credit applied at quote start
  discountMistake Float?    // post-completion discount for order issues
  rushFeeAmount   Float?
  rushFeePercent  Float?
  rushFeeDays     Int?
  isPaid          Boolean   @default(false)
  paymentPlan     String?   // 'deposit' | 'full_upfront' | 'pay_at_pickup'
  finalPrice      Float?    // post-production admin adjustment
  dueDate         DateTime? // stores time — use for specific deadlines
  dueDateEnd      DateTime? // for date-range jobs
  startDate       DateTime? // optional job start date + time
  isHardDeadline  Boolean   @default(false)
  needsShipping   Boolean   @default(false)
  mainImage       String?
  token           String?   @unique // public share link token
  referredBy      String?   // userId of referrer
  completedDate   DateTime?
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt
  createdBy       String?
  updatedBy       String?

  state           OrderState      @relation(fields: [stateId], references: [id])
  user            User?           @relation(fields: [userId], references: [id])
  shippingAddress Address?        @relation("ShippingAddress", fields: [shippingAddressId], references: [id])
  orderLineItems  OrderLineItem[]
  setUpCosts      SetUpCost[]
  payments        Payment[]
  notifications   Notification[]
}

model OrderLineItem {
  id          Int      @id @default(autoincrement())
  orderId     Int
  description String
  qty         Int      @default(1)
  unitPrice   Float    @default(0)
  lineTotal   Float    @default(0) // unitPrice * qty
  unitCost    Float    @default(0) // admin COGS per unit (admin only)
  sortOrder   Int      @default(0)
  notes       String?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  createdBy   String?
  updatedBy   String?

  order    Order                  @relation(fields: [orderId], references: [id], onDelete: Cascade)
  variants OrderLineItemVariant[]
}

model OrderLineItemVariant {
  id              Int      @id @default(autoincrement())
  orderLineItemId Int
  variant         String   // size, color, SKU, config — anything that creates a sub-qty
  qty             Int
  price           Float
  cost            Float?
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  orderLineItem OrderLineItem @relation(fields: [orderLineItemId], references: [id], onDelete: Cascade)
}

model SetUpCost {
  id               Int      @id @default(autoincrement())
  orderId          Int
  userTotal        Float    // what customer sees/pays
  adminTotal       Float    @default(0) // actual cost to business (admin only)
  customSetupItems Json?    // [{ label, qty, rate, cost }] — flexible per project
  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt
  createdBy        String?
  updatedBy        String?

  order Order @relation(fields: [orderId], references: [id], onDelete: Cascade)
}

model Payment {
  id        Int      @id @default(autoincrement())
  orderId   Int
  userId    String?  // who recorded the payment (admin)
  amount    Float
  channel   String   // 'zelle' | 'stripe' | 'cash' | 'check' | 'other'
  note      String?
  paidAt    DateTime @default(now())
  createdAt DateTime @default(now())
  createdBy String?

  order Order @relation(fields: [orderId], references: [id], onDelete: Cascade)
  user  User? @relation(fields: [userId], references: [id])
}

model Notification {
  id         String   @id @default(cuid())
  userId     String
  orderId    Int?
  type       String   // e.g. 'order_submitted', 'state_changed', 'payment_recorded'
  title      String
  message    String
  actionUrl  String?
  actionText String?
  isRead     Boolean  @default(false)
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt

  user  User   @relation(fields: [userId], references: [id], onDelete: Cascade)
  order Order? @relation(fields: [orderId], references: [id], onDelete: Cascade)

  @@index([userId, isRead])
  @@map("notifications")
}

model MonthlyExpense {
  id             Int      @id @default(autoincrement())
  name           String
  description    String?
  cost           Float
  dateOfPurchase DateTime
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt
  createdBy      String?
  updatedBy      String?

  @@map("monthly_expenses")
}

model UniversalSettings {
  id            Int      @id @default(autoincrement())
  setting       String   @unique
  value         String
  description   String?
  lastUpdatedBy String?
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  @@map("universal_settings")
}

// NextAuth required tables
model Account {
  id                String  @id @default(cuid())
  userId            String
  type              String
  provider          String
  providerAccountId String
  refresh_token     String?
  access_token      String?
  expires_at        Int?
  token_type        String?
  scope             String?
  id_token          String?
  session_state     String?

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([provider, providerAccountId])
}

model Session {
  id           String   @id @default(cuid())
  sessionToken String   @unique
  userId       String
  expires      DateTime

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
}

model VerificationToken {
  identifier String
  token      String   @unique
  expires    DateTime

  @@unique([identifier, token])
}
```

- [ ] **Step 2: Run migration**

```bash
npx prisma migrate dev --name init
```

Expected: migration file created in `prisma/migrations/`, DB tables created, Prisma client generated.

- [ ] **Step 3: Verify schema in Prisma Studio**

```bash
npx prisma studio
```

Open `http://localhost:5555`. Confirm all tables are present: User, Address, Order, OrderState, OrderLineItem, OrderLineItemVariant, SetUpCost, Payment, Notification, MonthlyExpense, UniversalSettings, Account, Session, VerificationToken.

Close Studio when done (Ctrl+C).

---

## Task 4: Seed Script

**Files:**
- Create: `prisma/seed.ts`

- [ ] **Step 1: Write the seed file**

Create `prisma/seed.ts`:

```ts
import { PrismaClient } from "@prisma/client"
import { hash } from "bcryptjs"

const prisma = new PrismaClient()

const ORDER_STATES = [
  { id: 0, name: "Archived",          sortOrder: -1, isRequired: true,  color: "#6b7280", description: "Archived orders — hidden from main kanban" },
  { id: 1, name: "Needs Review",      sortOrder: 0,  isRequired: true,  color: "#f59e0b", description: "New orders awaiting admin review" },
  { id: 2, name: "Awaiting Payment",  sortOrder: 1,  isRequired: false, color: "#3b82f6", description: "Quote approved, awaiting deposit or payment" },
  { id: 3, name: "In Progress",       sortOrder: 2,  isRequired: false, color: "#8b5cf6", description: "Work actively underway" },
  { id: 4, name: "Ready for Pickup",  sortOrder: 3,  isRequired: false, color: "#10b981", description: "Order complete, ready for customer collection" },
  { id: 5, name: "Payment Needed",    sortOrder: 4,  isRequired: false, color: "#ef4444", description: "Final payment required before release" },
  { id: 6, name: "Complete",          sortOrder: 5,  isRequired: true,  color: "#6b7280", description: "Order fulfilled and closed" },
]

const SETTINGS = [
  { setting: "taxRate",       value: "0.0775",     description: "Sales tax rate (e.g. 0.0775 = 7.75%)" },
  { setting: "businessName",  value: "My Business", description: "Business display name" },
  { setting: "currency",      value: "USD",         description: "Currency code" },
]

async function main() {
  console.log("Seeding order states...")
  for (const state of ORDER_STATES) {
    await prisma.orderState.upsert({
      where: { id: state.id },
      update: {},
      create: state,
    })
  }

  // Reset sequence so the next auto-generated OrderState ID doesn't conflict
  // with the explicitly-seeded IDs 0–6. Without this, nextval() returns 1 and
  // fails with a unique constraint violation on the first admin-created state.
  await prisma.$executeRaw`SELECT setval(pg_get_serial_sequence('"OrderState"', 'id'), (SELECT MAX(id) FROM "OrderState") + 1)`

  console.log("Seeding universal settings...")
  for (const s of SETTINGS) {
    await prisma.universalSettings.upsert({
      where: { setting: s.setting },
      update: {},
      create: s,
    })
  }

  const adminEmail = process.env.SEED_ADMIN_EMAIL
  const adminPassword = process.env.SEED_ADMIN_PASSWORD

  if (!adminEmail || !adminPassword) {
    console.log("Skipping admin seed — SEED_ADMIN_EMAIL or SEED_ADMIN_PASSWORD not set in .env.local")
    return
  }

  console.log(`Seeding admin user: ${adminEmail}`)
  const hashedPassword = await hash(adminPassword, 12)
  await prisma.user.upsert({
    where: { email: adminEmail },
    update: {},
    create: {
      email: adminEmail,
      password: hashedPassword,
      firstName: "Admin",
      lastName: "User",
      role: "admin",
    },
  })

  console.log("Seed complete.")
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
```

- [ ] **Step 2: Run the seed**

```bash
npx prisma db seed
```

Expected output:
```
Seeding order states...
Seeding universal settings...
Seeding admin user: admin@example.com
Seed complete.
```

- [ ] **Step 3: Verify in Prisma Studio**

```bash
npx prisma studio
```

Check: OrderState table has 7 rows (ids 0–6), UniversalSettings has 3 rows, User has 1 row with `role = "admin"`. Close when done.

---

## Task 5: Core Library Files

**Files:**
- Create: `src/lib/prisma.ts`
- Replace: `src/lib/auth.ts`
- Create: `src/types/next-auth.d.ts`

- [ ] **Step 1: Create src/lib/prisma.ts**

```ts
import { PrismaClient } from "@prisma/client"

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient }

export const prisma = globalForPrisma.prisma ?? new PrismaClient()

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma
```

- [ ] **Step 2: Replace src/lib/auth.ts**

```ts
import type { NextAuthOptions } from "next-auth"
import CredentialsProvider from "next-auth/providers/credentials"
import { PrismaAdapter } from "@auth/prisma-adapter"
import { compare } from "bcryptjs"
import { prisma } from "./prisma"

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null

        const user = await prisma.user.findUnique({
          where: { email: credentials.email },
          select: { id: true, email: true, password: true, firstName: true, lastName: true, role: true },
        })

        if (!user?.password) return null

        const isValid = await compare(credentials.password, user.password)
        if (!isValid) return null

        return {
          id: user.id,
          email: user.email,
          name: `${user.firstName} ${user.lastName}`,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role,
        }
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.role = user.role
        token.firstName = user.firstName
        token.lastName = user.lastName
      }
      return token
    },
    session({ session, token }) {
      session.user.role = token.role as string
      session.user.firstName = token.firstName as string
      session.user.lastName = token.lastName as string
      return session
    },
  },
}
```

- [ ] **Step 3: Create src/types/next-auth.d.ts**

```ts
import "next-auth"
import "next-auth/jwt"

declare module "next-auth" {
  interface User {
    role: string
    firstName: string
    lastName: string
  }
  interface Session {
    user: {
      role: string
      firstName: string
      lastName: string
    } & import("next-auth").DefaultSession["user"]
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role: string
    firstName: string
    lastName: string
  }
}
```

---

## Task 6: NextAuth Route + Middleware

**Files:**
- Create: `src/app/api/auth/[...nextauth]/route.ts`
- Create: `src/middleware.ts`

- [ ] **Step 1: Create the NextAuth route handler**

Create `src/app/api/auth/[...nextauth]/route.ts`:

```ts
import NextAuth from "next-auth"
import { authOptions } from "@/lib/auth"

const handler = NextAuth(authOptions)
export { handler as GET, handler as POST }
```

- [ ] **Step 2: Create src/middleware.ts**

```ts
import { withAuth } from "next-auth/middleware"
import { NextResponse } from "next/server"

export default withAuth(
  function middleware(req) {
    const role = req.nextauth.token?.role
    const { pathname } = req.nextUrl

    // Users (customers) cannot access the staff dashboard
    if (pathname.startsWith("/dashboard") && role === "user") {
      return NextResponse.redirect(new URL("/account", req.url))
    }

    return NextResponse.next()
  },
  {
    callbacks: {
      authorized({ token, req }) {
        const { pathname } = req.nextUrl
        // Dashboard and account require authentication
        if (pathname.startsWith("/dashboard") || pathname.startsWith("/account")) {
          return !!token
        }
        return true
      },
    },
  }
)

export const config = {
  matcher: ["/dashboard/:path*", "/account/:path*"],
}
```

- [ ] **Step 3: Verify auth wires up**

```bash
npm run dev
```

Navigate to `http://localhost:3000/dashboard`. Expected: redirects to `/login` (404 for now, that's fine — page doesn't exist yet).

Stop the server (Ctrl+C).

---

## Task 7: Register API Route

**Files:**
- Create: `src/app/api/users/route.ts`

- [ ] **Step 1: Write the POST handler**

Create `src/app/api/users/route.ts`:

```ts
import { NextResponse } from "next/server"
import { hash } from "bcryptjs"
import { prisma } from "@/lib/prisma"

export async function POST(req: Request) {
  const body = await req.json()
  const { email, password, firstName, lastName, phone, companyName } = body

  if (!email || !password || !firstName || !lastName) {
    return NextResponse.json(
      { data: null, error: "email, password, firstName, and lastName are required" },
      { status: 400 }
    )
  }

  const existing = await prisma.user.findUnique({ where: { email } })
  if (existing) {
    return NextResponse.json({ data: null, error: "Email already in use" }, { status: 409 })
  }

  const hashedPassword = await hash(password, 12)

  const user = await prisma.user.create({
    data: {
      email,
      password: hashedPassword,
      firstName,
      lastName,
      phone: phone || null,
      companyName: companyName || null,
      role: "user",
    },
    select: { id: true, email: true, firstName: true, lastName: true, role: true },
  })

  return NextResponse.json({ data: user, error: null }, { status: 201 })
}
```

---

## Task 8: globals.css Theme

**Files:**
- Replace: `src/app/globals.css`

- [ ] **Step 1: Write the full theme**

Replace the entire contents of `src/app/globals.css`:

```css
@import "tailwindcss";

:root {
  color-scheme: light;

  /* Brand */
  --color-primary: #111827;
  --color-primary-foreground: #ffffff;
  --color-accent: #22c55e;
  --color-accent-foreground: #ffffff;

  /* Surface */
  --color-background: #ffffff;
  --color-surface: #f9fafb;
  --color-border: #e5e7eb;

  /* Text */
  --color-foreground: #111827;
  --color-muted: #6b7280;
  --color-muted-foreground: #9ca3af;

  /* Status / feedback */
  --color-success: #22c55e;
  --color-warning: #f59e0b;
  --color-danger: #ef4444;

  /* Kanban state column headers — match OrderState seed colors */
  --color-state-review: #f59e0b;
  --color-state-awaiting: #3b82f6;
  --color-state-progress: #8b5cf6;
  --color-state-pickup: #10b981;
  --color-state-payment: #ef4444;
  --color-state-complete: #6b7280;
  --color-state-archived: #6b7280;

  /* Radius */
  --radius: 0.5rem;

  /* shadcn required variables (mapped to our theme) */
  --background: var(--color-background);
  --foreground: var(--color-foreground);
  --card: var(--color-surface);
  --card-foreground: var(--color-foreground);
  --popover: var(--color-background);
  --popover-foreground: var(--color-foreground);
  --primary: var(--color-primary);
  --primary-foreground: var(--color-primary-foreground);
  --secondary: var(--color-surface);
  --secondary-foreground: var(--color-foreground);
  --muted: var(--color-surface);
  --muted-foreground: var(--color-muted);
  --accent: var(--color-surface);
  --accent-foreground: var(--color-foreground);
  --destructive: var(--color-danger);
  --border: var(--color-border);
  --input: var(--color-border);
  --ring: var(--color-primary);
}

@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
}

body {
  background: var(--color-background);
  color: var(--color-foreground);
  font-family: system-ui, -apple-system, sans-serif;
}

* {
  border-color: var(--color-border);
}

button, a {
  touch-action: manipulation; /* removes 300ms tap delay on mobile */
}

/* Z-index scale — use only these values, never arbitrary numbers */
/* z-10  — sticky elements, floating labels                        */
/* z-20  — dropdowns, popovers                                     */
/* z-40  — modals, dialogs                                         */
/* z-50  — nav overlays                                            */
/* z-[100] — toasts, notifications                                 */
```

---

## Task 9: Layout + SessionWrapper

**Files:**
- Create: `src/components/shared/layout/SessionWrapper.tsx`
- Replace: `src/app/layout.tsx`

- [ ] **Step 1: Create SessionWrapper**

Create `src/components/shared/layout/SessionWrapper.tsx`:

```tsx
"use client"

import { SessionProvider } from "next-auth/react"

export default function SessionWrapper({ children }: { children: React.ReactNode }) {
  return <SessionProvider>{children}</SessionProvider>
}
```

- [ ] **Step 2: Replace src/app/layout.tsx**

```tsx
import type { Metadata, Viewport } from "next"
import "./globals.css"
import SessionWrapper from "@/components/shared/layout/SessionWrapper"
import Navbar from "@/components/shared/layout/Navbar"
import { Toaster } from "@/components/ui/sonner"

export const metadata: Metadata = {
  title: "Quoting Template",
  description: "Order and quote management",
}

// Required for env(safe-area-inset-bottom) to work on iOS — dialogs and sheets need this
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen flex flex-col bg-(--color-background) text-(--color-foreground) antialiased">
        <SessionWrapper>
          <Navbar />
          <main className="flex-1">{children}</main>
          <Toaster />
        </SessionWrapper>
      </body>
    </html>
  )
}
```

---

## Task 10: Navbar

**Files:**
- Create: `src/components/shared/layout/Navbar.tsx`
- Create: `src/components/shared/layout/Navbar-Links.tsx`

- [ ] **Step 1: Create Navbar-Links.tsx (client — handles session + mobile menu)**

Create `src/components/shared/layout/Navbar-Links.tsx`:

```tsx
"use client"

import { useSession, signOut } from "next-auth/react"
import Link from "next/link"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Menu, X } from "lucide-react"

export default function NavbarLinks() {
  const { data: session } = useSession()
  const [open, setOpen] = useState(false)

  const role = session?.user?.role
  const isStaff = role === "admin" || role === "employee"

  const links = (
    <>
      <Link
        href="/get-quote"
        className="text-sm font-medium text-(--color-foreground) hover:text-(--color-primary) transition-colors motion-reduce:transition-none"
        onClick={() => setOpen(false)}
      >
        Get Quote
      </Link>

      {isStaff && (
        <Link
          href="/dashboard"
          className="text-sm font-medium text-(--color-foreground) hover:text-(--color-primary) transition-colors motion-reduce:transition-none"
          onClick={() => setOpen(false)}
        >
          Dashboard
        </Link>
      )}

      {session && !isStaff && (
        <Link
          href="/account"
          className="text-sm font-medium text-(--color-foreground) hover:text-(--color-primary) transition-colors motion-reduce:transition-none"
          onClick={() => setOpen(false)}
        >
          My Orders
        </Link>
      )}

      {session ? (
        <Button
          variant="outline"
          size="sm"
          onClick={() => { setOpen(false); signOut({ callbackUrl: "/" }) }}
        >
          Sign Out
        </Button>
      ) : (
        <Button asChild size="sm">
          <Link href="/login" onClick={() => setOpen(false)}>Sign In</Link>
        </Button>
      )}
    </>
  )

  return (
    <>
      {/* Desktop links */}
      <div className="hidden md:flex items-center gap-6">{links}</div>

      {/* Mobile hamburger */}
      <button
        className="md:hidden min-h-11 min-w-11 flex items-center justify-center rounded-md text-(--color-foreground) hover:bg-(--color-surface) transition-colors motion-reduce:transition-none touch-manipulation"
        onClick={() => setOpen(prev => !prev)}
        aria-label="Toggle navigation"
      >
        {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </button>

      {/* Mobile dropdown */}
      {open ? (
        <div className="absolute top-full left-0 right-0 bg-(--color-background) border-b border-(--color-border) flex flex-col gap-4 px-6 py-4 md:hidden z-50">
          {links}
        </div>
      ) : null}
    </>
  )
}
```

- [ ] **Step 2: Create Navbar.tsx (server component shell)**

Create `src/components/shared/layout/Navbar.tsx`:

```tsx
import Link from "next/link"
import NavbarLinks from "./Navbar-Links"

export default function Navbar() {
  return (
    <header className="relative border-b border-(--color-border) bg-(--color-background)">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
        <Link
          href="/"
          className="font-semibold text-(--color-foreground) text-lg tracking-tight"
        >
          QuotingApp
        </Link>
        <NavbarLinks />
      </div>
    </header>
  )
}
```

---

## Task 11: Login Page

**Files:**
- Create: `src/app/(auth)/login/page.tsx`
- Create: `src/app/(auth)/login/Login.tsx`

- [ ] **Step 1: Create the thin server page**

Create `src/app/(auth)/login/page.tsx`:

```tsx
import Login from "./Login"

export default function LoginPage() {
  return <Login />
}
```

- [ ] **Step 2: Create the Login container**

Create `src/app/(auth)/login/Login.tsx`:

```tsx
"use client"

import { signIn } from "next-auth/react"
import { useRouter } from "next/navigation"
import { useState, useRef } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"

export default function Login() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const emailRef = useRef<HTMLInputElement>(null)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const form = new FormData(e.currentTarget)

    const result = await signIn("credentials", {
      email: form.get("email") as string,
      password: form.get("password") as string,
      redirect: false,
    })

    setLoading(false)

    if (result?.error) {
      setError("Invalid email or password — try again or contact support.")
      emailRef.current?.focus()
      return
    }

    router.push("/dashboard")
    router.refresh()
  }

  return (
    <div className="min-h-[calc(100dvh-3.5rem)] flex items-center justify-center px-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Sign In</CardTitle>
          <CardDescription>Enter your email and password to continue</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input ref={emailRef} id="email" name="email" type="email" inputMode="email" autoComplete="email" required className="text-base" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input id="password" name="password" type="password" autoComplete="current-password" required className="text-base" />
            </div>
            {error && (
              <p className="text-sm text-(--color-danger)" role="alert">{error}</p>
            )}
            <Button type="submit" className="w-full touch-manipulation" disabled={loading}>
              {loading ? "Signing in…" : "Sign In"}
            </Button>
          </form>
          <p className="mt-4 text-center text-sm text-(--color-muted)">
            No account?{" "}
            <Link href="/register" className="text-(--color-primary) hover:underline">
              Register
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
```

---

## Task 12: Register Page

**Files:**
- Create: `src/app/(auth)/register/page.tsx`
- Create: `src/app/(auth)/register/Register.tsx`

- [ ] **Step 1: Create the thin server page**

Create `src/app/(auth)/register/page.tsx`:

```tsx
import Register from "./Register"

export default function RegisterPage() {
  return <Register />
}
```

- [ ] **Step 2: Create the Register container**

Create `src/app/(auth)/register/Register.tsx`:

```tsx
"use client"

import { signIn } from "next-auth/react"
import { useRouter } from "next/navigation"
import { useState, useRef } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"

export default function Register() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const emailRef = useRef<HTMLInputElement>(null)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const form = new FormData(e.currentTarget)

    const res = await fetch("/api/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: form.get("email"),
        password: form.get("password"),
        firstName: form.get("firstName"),
        lastName: form.get("lastName"),
        phone: form.get("phone") || undefined,
        companyName: form.get("companyName") || undefined,
      }),
    })

    const json = await res.json()

    if (json.error) {
      setLoading(false)
      setError(json.error)
      emailRef.current?.focus()
      return
    }

    // Auto sign-in after registration
    const result = await signIn("credentials", {
      email: form.get("email") as string,
      password: form.get("password") as string,
      redirect: false,
    })

    setLoading(false)

    if (result?.error) {
      setError("Account created but sign-in failed — please sign in manually.")
      router.push("/login")
      return
    }

    router.push("/account")
    router.refresh()
  }

  return (
    <div className="min-h-[calc(100dvh-3.5rem)] flex items-center justify-center px-4 py-8">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Create Account</CardTitle>
          <CardDescription>Fill in your details to get started</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="firstName">First Name</Label>
                <Input id="firstName" name="firstName" autoComplete="given-name" required className="text-base" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastName">Last Name</Label>
                <Input id="lastName" name="lastName" autoComplete="family-name" required className="text-base" />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input ref={emailRef} id="email" name="email" type="email" inputMode="email" autoComplete="email" required className="text-base" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input id="password" name="password" type="password" autoComplete="new-password" required minLength={8} className="text-base" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Phone <span className="text-(--color-muted)">(optional)</span></Label>
              <Input id="phone" name="phone" type="tel" inputMode="tel" autoComplete="tel" className="text-base" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="companyName">Company <span className="text-(--color-muted)">(optional)</span></Label>
              <Input id="companyName" name="companyName" autoComplete="organization" className="text-base" />
            </div>
            {error && (
              <p className="text-sm text-(--color-danger)" role="alert">{error}</p>
            )}
            <Button type="submit" className="w-full touch-manipulation" disabled={loading}>
              {loading ? "Creating account…" : "Create Account"}
            </Button>
          </form>
          <p className="mt-4 text-center text-sm text-(--color-muted)">
            Already have an account?{" "}
            <Link href="/login" className="text-(--color-primary) hover:underline">
              Sign In
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
```

---

## Task 13: Landing Page + Dashboard Placeholder

**Files:**
- Replace: `src/app/page.tsx`
- Create: `src/app/dashboard/page.tsx`

- [ ] **Step 1: Replace the stock landing page**

Replace `src/app/page.tsx`:

```tsx
import Link from "next/link"
import { Button } from "@/components/ui/button"

export default function Home() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100dvh-3.5rem)] px-4 text-center">
      <h1 className="text-4xl font-bold tracking-tight text-(--color-foreground) mb-4">
        Welcome
      </h1>
      <p className="text-lg text-(--color-muted) mb-8 max-w-md">
        Get a quote for your project or sign in to manage your orders.
      </p>
      <div className="flex gap-4 flex-col sm:flex-row">
        <Button asChild size="lg">
          <Link href="/get-quote">Get a Quote</Link>
        </Button>
        <Button asChild variant="outline" size="lg">
          <Link href="/login">Sign In</Link>
        </Button>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Create the dashboard placeholder**

Create `src/app/dashboard/page.tsx`:

```tsx
export default function DashboardPage() {
  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold text-(--color-foreground)">Dashboard</h1>
      <p className="text-(--color-muted) mt-2">Plan 2 will build this out.</p>
    </div>
  )
}
```

---

## Task 14: End-to-End Smoke Test

- [ ] **Step 1: Start dev server**

```bash
npm run dev
```

- [ ] **Step 2: Test the following flows manually**

| Flow | Expected |
|------|----------|
| `http://localhost:3000/` | Landing page with "Get a Quote" and "Sign In" buttons |
| `http://localhost:3000/dashboard` | Redirects to `/login` |
| `http://localhost:3000/login` | Login form renders |
| Sign in with seed admin email + password | Redirects to `/dashboard`, shows "Dashboard" placeholder |
| Navbar after login | Shows "Dashboard" and "Sign Out" links |
| `http://localhost:3000/register` | Register form renders |
| Register a new user | Redirects to `/account` (404 for now — fine) |
| Sign in as new user then visit `/dashboard` | Redirects to `/account` (role = user) |
| Sign out | Returns to `/`, Navbar shows "Sign In" |

- [ ] **Step 3: Fix any failures before continuing to Plan 2**

- [ ] **Step 4: Stop the dev server (Ctrl+C)**

---

## Self-Review Checklist

- [x] Schema covers all tables from spec §3
- [x] Auth enforces role in JWT + session, extends NextAuth types
- [x] Middleware redirects `user` role away from `/dashboard`
- [x] Register API validates required fields, hashes password, returns `{data, error}`
- [x] Seed upserts (idempotent — safe to re-run)
- [x] All colors via CSS variables — no raw Tailwind palette classes
- [x] All page files are thin server components importing containers
- [x] Navbar is server component; NavbarLinks is the only client boundary
- [x] SessionWrapper isolates `"use client"` for SessionProvider
- [x] `src/lib/prisma.ts` uses singleton pattern for dev hot-reload safety

---

## UI Requirements for Plan 2 (Dashboard)

These requirements must be applied when writing Plan 2. They are listed here so nothing is missed.

**Tables (kanban list, orders table):**
- Always wrap `<Table>` in `<div className="w-full overflow-x-auto">`
- Set `min-w-[Npx]` on the table (≈120px × column count)
- `whitespace-nowrap` on cells with names, dates, IDs, status badges

**Large lists:**
- If orders list exceeds 50 items, virtualize with `@tanstack/react-virtual` — install it in Plan 2 Task 1

**Dialog / Sheet footers:**
- Every `<DialogFooter>` and `<SheetFooter>` with action buttons needs `pb-[max(1rem,env(safe-area-inset-bottom))]`
- Full-screen sheets use `h-dvh overflow-y-auto` (never `h-screen`)

**Icon-only buttons (order card actions, sidebar toggles):**
- Every icon-only `<Button>` must have `aria-label`

**Order state colors:**
- Never use color alone to convey state — pair the colored badge with the state name text
- Kanban column headers: colored left border or header bg + text label, not color alone

**Kanban / dashboard container:**
- Use `min-h-dvh` on the page wrapper, not `min-h-screen`
- Kanban columns must be independently scrollable on mobile — `overflow-y-auto` per column, not on the page

**Hover-only actions:**
- Any button that appears on card hover must use `sm:opacity-0 sm:group-hover:opacity-100` so it's always visible on touch devices

---

## Performance & Composition Requirements for Plan 2 (Dashboard)

### Data Fetching (CRITICAL)
- **Parallelize dashboard fetches** — use `Promise.all()` for independent queries (orders + order states + settings). Never await them sequentially.
- **`React.cache()`** — wrap any server-side fetch helper in `React.cache()` so the same data isn't fetched twice during a single render pass (e.g., if two components both need `getOrderStates()`).
- **Start promises early, await late** — in API route handlers, kick off all DB queries before the first `await`.

### Bundle Size (CRITICAL)
- **`next/dynamic` for Recharts** — chart components are heavy. Import them with `next/dynamic({ ssr: false })` so they don't bloat the initial bundle. Insights view only.
- **Direct imports** — never import from barrel files. Always `import { Button } from "@/components/ui/button"`, never `import * from "@/components/ui"`.

### Re-render Optimization (MEDIUM)
- **`useTransition` for order state changes** — when moving an order to the next state, wrap the mutation in `startTransition` instead of a `loading` boolean. This keeps the UI responsive while the update is in flight.
- **`rerender-no-inline-components`** — never define a component function inside another component. Extract it above or into its own file.
- **Primitive effect dependencies** — use `order.id` not the full `order` object as an effect dependency to avoid spurious re-renders.

### Component Architecture (MEDIUM)
- **React 19 refs** — the stack is React 19.2.4. When writing custom shared components that accept a `ref`, pass it as a plain prop — no `forwardRef` wrapper needed.
- **Compound components for order cards** — the order card has distinct parts (header, state badge, actions). Structure it as a compound component with sub-components (`OrderCard.Header`, `OrderCard.Badge`, `OrderCard.Footer`) sharing context, rather than a single component with many boolean props.
- **No boolean prop proliferation** — if a component needs `isAdmin`, `isEmployee`, `showCost`, `showProfit` all as booleans, use a `role` prop and derive the rest inside. One source of truth.

### Server Actions (when added in Plan 2)
- Every server action must authenticate the session with `getServerSession(authOptions)` before touching the DB — same pattern as API routes. Never trust client-passed user IDs.
