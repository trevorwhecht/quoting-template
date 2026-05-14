# Quoting Template — Design Spec

**Date:** 2026-05-14  
**Reference project:** OneWithArts (`/Developer/repos/onewitharts`)  
**Stack:** Next.js 16 App Router · Prisma · NextAuth · Tailwind 4 · shadcn/ui · PostgreSQL

---

## 1. Purpose

A reusable Next.js starter for any quoting/order-management business. Every decision must stay generic and portable — no domain-specific logic. OWA is the behavioral reference; the template is a clean rebuild with proper component decomposition, shadcn UI, and a generic schema.

The two biggest improvements over OWA:
1. **Scalability** — OWA's `OrdersView.tsx` is 8,500 lines. The template enforces ~250 lines per file with clear component boundaries.
2. **Self-service** — OWA requires manual DB edits to manage roles and states. The template exposes both through admin UI.
3. *Customizalbe Themes** — will need to easily change the website themes overtime will build at more and more themes to swap between.

---

## 2. Auth & Roles

### Single User table with `role` field

```
role: 'admin' | 'employee' | 'user'
```

- OWA's two-table pattern (User + Employee) is dropped. All three roles live in one `User` table.
- Initial admin is created via a Prisma seed script (`prisma/seed.ts`) reading `SEED_ADMIN_EMAIL` and `SEED_ADMIN_PASSWORD` from `.env.local`. Self-registered users default to `user`.
- Admins can promote/demote any user via the dashboard Users view. An admin cannot demote themselves (prevents lockout).

### Auth flow

- NextAuth credentials provider (email + bcrypt password).
- Role is stored in the JWT and attached to the session via `callbacks.jwt` and `callbacks.session`.
- The `auth()` helper from NextAuth is used in server components and route handlers for role checks.

### Profit/cost visibility

- `admin`: sees all fields including `cost`, `profit`, `totalSetUpCost`, `adminTotal` on setup costs.
- `employee`: sees price, qty, state — never cost or profit. **Enforced at the API layer** (route handler returns a stripped shape), not just in the UI. This is more secure than OWA's client-only `useEmployeeView` context.
- `user`: sees only their own orders, no cost/profit fields at all.

### Route protection

- `/dashboard` and all sub-routes: require `admin` or `employee` role. Redirect to `/login` if unauthenticated, redirect to `/` if authenticated as `user`.
- `/api/orders` (admin shape): requires `admin` or `employee`. Returns cost/profit only if `admin`.
- `/api/orders` (user shape): requires any authenticated session.
- `/get-quote`: public. No auth required.

---

## 3. Database Schema

### Tables kept from OWA (unchanged)

- `Account` — NextAuth standard
- `Session` — NextAuth standard
- `VerificationToken` — NextAuth standard
- `UniversalSettings` — Generic key/value app settings (tax rate, business name, etc.)
- `Notification` — `type, title, message, actionUrl, actionText, isRead, userId, orderId`

### Tables kept with modifications

#### `User`
```
id            String    @id @default(cuid())
email         String    @unique
password      String?
firstName     String
lastName      String
companyName   String?
phone         String?
role          String    @default("user")   // 'admin' | 'employee' | 'user'
addressId     String?
createdAt     DateTime  @default(now())
updatedAt     DateTime  @updatedAt
createdBy     String?
updatedBy     String?
```
Relations: `accounts, sessions, orders, notifications, address`

Dropped from OWA: `referralLink, referralAmount, resellerLicenseId, resellerLicensePhotoUrl, taxDeferralApproved, favoriteBlanks, servicePricingTierId, markupTier`

#### `Address`
Kept exactly as OWA. Generic.

#### `OrderState`
```
id          Int      @id @default(autoincrement())
name        String
sortOrder   Int
description String?
isActive    Boolean  @default(true)
isRequired  Boolean  @default(false)   // archive + complete cannot be deleted
color       String?                    // hex, for kanban column header
createdAt   DateTime @default(now())
updatedAt   DateTime @updatedAt
```
Seeded with 7 defaults:

| id | name | sortOrder | isRequired |
|----|------|-----------|------------|
| 0 | Archived | -1 | true |
| 1 | Needs Review | 0 | true |
| 2 | Awaiting Payment | 1 | false |
| 3 | In Progress | 2 | false |
| 4 | Ready for Pickup | 3 | false |
| 5 | Payment Needed | 4 | false |
| 6 | Complete | 5 | true |

Admin can toggle `isActive` on any non-required state. Kanban renders only active states ordered by `sortOrder`. Orders in a deactivated state remain in the DB and appear in a collapsed "Other" column so no data is lost.

Dropped from OWA: `employeeId` relation

#### `Order`
```
id                Int       @id @default(autoincrement())
userId            String?                     // null = admin-created, no account yet
stateId           Int
nickname          String?
customerNotes     String?                     // from the Get Quote form
notes             String?                     // internal admin notes
totalQty          Int       @default(0)
totalSetUpPrice   Float     @default(0)       // user-facing setup total
totalSetUpCost    Float     @default(0)       // admin COGS for setup
totalAmount       Float     @default(0)       // sum of line item amounts
subTotal          Float     @default(0)       // totalAmount + totalSetUpPrice
salesTax          Float     @default(0)       // computed from UniversalSettings tax rate
totalPrice        Float     @default(0)       // subTotal + salesTax
cost              Float     @default(0)       // total COGS (admin only)
profit            Float     @default(0)       // totalPrice - cost (admin only)
discountManual    Float?                      // admin-applied pre-production discount
discountReferral  Float?                      // referral credit applied at quote start
discountMistake   Float?                      // post-completion discount for issues
rushFeeAmount     Float?
rushFeePercent    Float?
rushFeeDays       Int?
isPaid            Boolean   @default(false)
paymentPlan       String?                     // 'deposit' | 'full_upfront' | 'pay_at_pickup'
finalPrice        Float?                      // post-production admin adjustment
dueDate           DateTime?                   // stores date + time (use time for specific deadlines)
dueDateEnd        DateTime?                   // for date range jobs
startDate         DateTime?                   // optional job start date + time
isHardDeadline    Boolean   @default(false)
needsShipping     Boolean   @default(false)
mainImage         String?
token             String?   @unique           // public share link
referredBy        String?                     // userId of referrer
completedDate     DateTime?
createdAt         DateTime  @default(now())
updatedAt         DateTime  @updatedAt
createdBy         String?
updatedBy         String?
```
Relations: `state, user, orderLineItems, setUpCosts, payments, notifications`

#### `OrderLineItem`
Generic — no blank/garment/embellishment references.
```
id          Int      @id @default(autoincrement())
orderId     Int
description String
qty         Int      @default(1)
unitPrice   Float    @default(0)
lineTotal   Float    @default(0)    // unitPrice * qty
unitCost    Float    @default(0)    // admin COGS per unit
notes       String?
createdAt   DateTime @default(now())
updatedAt   DateTime @updatedAt
createdBy   String?
updatedBy   String?
```

#### `OrderLineItemSize`
Size breakdown per line item. Generic — any business selling items by size.
```
id              Int      @id @default(autoincrement())
orderLineItemId Int
size            String
qty             Int
price           Float
cost            Float?
createdAt       DateTime @default(now())
updatedAt       DateTime @updatedAt
```

#### `SetUpCost`
Concept kept, OWA-specific fields dropped.
```
id               Int      @id @default(autoincrement())
orderId          Int
userTotal        Float                   // what customer sees/pays
adminTotal       Float    @default(0)   // actual cost (admin only)
customSetupItems Json?                  // [{label, qty, rate, cost}] — flexible line items
createdAt        DateTime @default(now())
updatedAt        DateTime @updatedAt
createdBy        String?
updatedBy        String?
```

#### `Payment`
New table — replaces `depositAmount` on Order. Tracks every payment event against an order, enabling payment history charts and multi-installment support.
```
id          Int      @id @default(autoincrement())
orderId     Int
amount      Float
channel     String                  // 'zelle' | 'stripe' | 'cash' | 'check' | 'other'
note        String?
createdAt   DateTime @default(now())
createdBy   String?
```
`Order.isPaid` remains as a cached boolean flag for fast querying. `Order.depositAmount` is removed — the Payment table is the source of truth.

#### `MonthlyExpense`
Kept exactly as OWA. Generic overhead tracking.

### Tables dropped entirely

`Employee, EmployeeAvailability, ServicePricingTier, BlankMaster, BlankVariant, BlankImage, ProvidedBlank, Embellishment, EmbellishmentBridge, EmbellishmentBridge, ScreenPrintPricing, ScreenPrintSetupFees, HeatTransferPricing, HeatTransferSetupFees, EmbroideryPricing, EmbroiderySetupFees, PricingVersion, ScreenPrintPricingVersion, SetupFeesVersion, MarkupTier, PortfolioImage, PreOrder, PreOrderOption, PreOrderSubmission, PreOrderSubmissionSize, OrderLineItemMockup, OrderProgress`

---

## 4. Folder Structure

```
src/
  app/
    (public)/
      page.tsx                          ← landing / marketing homepage
      get-quote/
        page.tsx
        GetQuote.tsx                    ← quote request form container
        components/
          GetQuote-Form.tsx
          GetQuote-LineItems.tsx
    (auth)/
      login/
        page.tsx
        Login.tsx
      register/
        page.tsx
        Register.tsx
    dashboard/
      page.tsx                          ← thin server component
      Dashboard.tsx                     ← container: reads session, renders layout
      components/
        Dashboard-Sidebar.tsx           ← nav, role-aware (admin shows Users/Settings)
        Dashboard-Header.tsx            ← top bar for mobile
        views/
          Dashboard-OrdersView.tsx      ← kanban container (default sub-view)
          Dashboard-CalendarView.tsx    ← orders by due date (Orders sub-nav)
          Dashboard-CompleteView.tsx    ← stateId=6 list (Orders sub-nav)
          Dashboard-ArchiveView.tsx     ← stateId=0 list (Orders sub-nav)
          Dashboard-InsightsView.tsx    ← revenue/profit charts (admin only)
          Dashboard-UsersView.tsx
          Dashboard-SettingsView.tsx
        kanban/
          Dashboard-Kanban.tsx          ← renders columns from active OrderStates
          Dashboard-KanbanColumn.tsx    ← single column + header stats
          Dashboard-OrderCard.tsx       ← single order card
        orders/
          Dashboard-OrderSheet.tsx      ← shadcn Sheet: order detail panel
          Dashboard-OrderSheet-LineItems.tsx
          Dashboard-OrderSheet-SetupCosts.tsx
          Dashboard-OrderSheet-Payment.tsx
    account/
      page.tsx
      Account.tsx
      components/
        Account-OrderList.tsx           ← user's own orders (no cost/profit)
        Account-OrderDetail.tsx
    api/
      auth/[...nextauth]/route.ts
      orders/
        route.ts                        ← GET (list), POST (create)
        [id]/route.ts                   ← GET, PATCH, DELETE
      users/
        route.ts
        [id]/route.ts
      order-states/
        route.ts
        [id]/route.ts
      payments/
        route.ts                        ← POST (record payment)
        [id]/route.ts                   ← DELETE
      setup-costs/
        [id]/route.ts
      insights/
        route.ts                        ← GET aggregated revenue/profit data (admin only)
  components/
    ui/                                 ← shadcn primitives only
    shared/
      layout/
        Navbar.tsx
        Navbar-Links.tsx
  services/
    orderService.ts                     ← business logic (state transitions, totals)
    userService.ts
  hooks/
    useOrders.ts
    useOrderStates.ts
  lib/
    auth.ts
    prisma.ts
  models/
    order.ts                            ← TypeScript types
    user.ts
  types/
  utils/
  constants/
    orderStates.ts                      ← default seed values
```

---

## 5. Dashboard Architecture

The dashboard follows OWA's layout (sidebar + main content) rebuilt as focused components.

### Layout
- Left sidebar: `Dashboard-Sidebar.tsx` — nav items driven by `role`. Admin sees Orders, Insights, Users, Settings. Employee sees Orders and Insights. Sidebar is hidden on mobile, replaced by a top `Dashboard-Header.tsx` with a hamburger.
- Main content: view components swapped in by URL search param (`?view=orders&subview=default`). URL-driven so links are shareable.
- Orders has four sub-nav items below it in the sidebar: **Default** (kanban), **Calendar**, **Complete**, **Archive** — matching OWA's sub-navigation pattern.

### Kanban board (Orders — Default subview)
- `Dashboard-Kanban.tsx` fetches active `OrderState` rows and renders one `Dashboard-KanbanColumn.tsx` per state.
- Each column shows: state name, order count, total value (price), and scrollable order cards.
- `Dashboard-OrderCard.tsx` shows: nickname/id, customer name, total price, profit (admin only), qty, due date, payment status badge. Single action button in bottom-right: **Copy public URL** (copies `token`-based share link). Clicking anywhere else on the card opens `Dashboard-OrderSheet.tsx`.
- Order state is changed via a select in the order sheet. Drag-and-drop (dnd-kit) is a stretch goal — implement only after core sheet functionality is solid.

### Orders — Calendar subview
Orders plotted by `dueDate` / `dueDateEnd` on a monthly calendar grid. Overdue orders highlighted. Read-only — clicking an order opens the same `Dashboard-OrderSheet.tsx`.

### Orders — Complete subview
Flat list of all orders at `stateId = 6`. Sortable by `completedDate`. Same sheet on click.

### Orders — Archive subview
Flat list of all orders at `stateId = 0`. Same sheet on click.

### Order sheet
shadcn `Sheet` component sliding in from the right. Tabs: **Details**, **Line Items**, **Setup Costs**, **Payment**. Admin sees all tabs including cost/profit figures. Employee sees Details and Line Items only (no cost, no payment details). Actions at bottom: Revert state, Edit, Send to Customer (copies public URL). State change select is in the Details tab.

### Insights view (admin only)
Charts for: revenue over time, profit over time, orders by state, payment channel breakdown. Data from `/api/insights`. Uses a lightweight chart library (Recharts — already in common use with shadcn projects). Employee role does not see this view.

### Users view (admin only)
Table of all users with inline role selector (shadcn `Select`). Pagination. Search by name/email.

### Settings view (admin only)
- Order States: toggle `isActive`, rename, reorder (drag). Required states show a lock icon.
- Business settings: tax rate, business name, currency (stored in `UniversalSettings`).

---

## 6. Get Quote Page (public)

A multi-line form users fill out before having an account. Fields:
- Name, email, phone, company (optional)
- Job description / `customerNotes`
- Line items: description, qty (add/remove rows)
- Due date (date picker, optional range toggle for `dueDateEnd`)
- File upload (optional, stored to Cloudinary — same provider as OWA; `CLOUDINARY_URL` env var, easily swapped)
- Submit creates an `Order` at `stateId = 1` (Needs Review) with `userId = null` if not logged in, or linked to session user if logged in.

Unauthenticated users can always reach this page. The navbar shows "Get Quote" regardless of auth state.

---

## 7. Theming

All design tokens live in `globals.css` as CSS variables. Components reference variables, never raw Tailwind palette values. Swapping a theme for a new client is one file.

```css
:root {
  /* Brand */
  --color-primary: #000000;
  --color-primary-foreground: #ffffff;
  --color-accent: #22c55e;

  /* Surface */
  --color-background: #ffffff;
  --color-surface: #f9fafb;
  --color-border: #e5e7eb;

  /* Text */
  --color-foreground: #111827;
  --color-muted: #6b7280;

  /* State colors (kanban column headers) */
  --color-state-review: #f59e0b;
  --color-state-awaiting: #3b82f6;
  --color-state-progress: #8b5cf6;
  --color-state-pickup: #10b981;
  --color-state-payment: #ef4444;
  --color-state-complete: #6b7280;

  /* Spacing / radius */
  --radius: 0.5rem;
}
```

shadcn is configured to reference these variables via `tailwind.config` so all shadcn components inherit the theme automatically.

---

## 8. Data Flow

### Order list (admin/employee dashboard)
```
Dashboard-OrdersView
  → useOrders() hook
    → GET /api/orders?view=kanban
      → auth() check: admin | employee
      → prisma.order.findMany({ include: state, user, _count: lineItems })
      → if employee: strip cost, profit, adminTotal from response
  → Dashboard-Kanban (receives orders grouped by stateId)
    → Dashboard-KanbanColumn (per active state)
      → Dashboard-OrderCard (per order)
```

### Order detail (sheet open)
```
Dashboard-OrderSheet
  → GET /api/orders/:id
    → auth() check
    → full order with lineItems, setUpCosts, notifications
    → strip sensitive fields if employee
  → tabs render from fetched data
  → PATCH /api/orders/:id for inline edits (state change, payment update, notes)
```

### Get Quote submission
```
GetQuote-Form submit
  → POST /api/orders
    → validate: name, email, at least one line item
    → if session: link userId
    → create Order at stateId=1, create OrderLineItems
    → create Notification for all admin users
    → return { data: { orderId, token }, error: null }
```

---

## 9. Error Handling

All API routes return `{ data, error }` tuples. No thrown errors bubble to the client.

```ts
// success
return NextResponse.json({ data: order, error: null })
// failure
return NextResponse.json({ data: null, error: 'Order not found' }, { status: 404 })
```

Client hooks map these to UI state: loading, error banner (shadcn `Alert`), or rendered data.

---

## 10. Key Decisions Log

| Decision | Rationale |
|---|---|
| Single User table with `role` field | Simpler than OWA's User+Employee split; admin role management via UI |
| Profit/cost stripped at API layer | More secure than OWA's client-only employee view context |
| OrderState as DB table with `isActive` | Clients can toggle states without code changes |
| shadcn/ui replaces NextUI | Consistent with template stack; better Tailwind 4 compatibility |
| All files ≤ 250 lines | OWA's 8,500-line OrdersView is the anti-pattern this prevents |
| `dueDateEnd` + `startDate` added | Date ranges and explicit start times for complex jobs |
| `dueDate` is `DateTime` (not `Date`) | Enables specific time deadlines, not just calendar days |
| `customerNotes` + `notes` separate | Customer-facing context vs internal admin notes are distinct concerns |
| `paymentPlan` on Order, `channel` on Payment | Plan = the agreement (deposit/upfront/pickup); channel = how money moved (zelle/stripe/cash) |
| Separate `Payment` table replaces `depositAmount` | Multi-installment support + payment history charts without schema changes per order |
| `SetUpCost.customSetupItems` as JSON | Companies define their own setup line items without schema changes |
| Tax rate in `UniversalSettings` | Configurable per deployment without code changes |
| Orders sub-nav: Default/Calendar/Complete/Archive | Mirrors OWA's proven navigation pattern; each sub-view is a focused component |
| Insights admin-only | Profit data must not be accessible to employee role; enforced at API layer |
| Drag-and-drop as stretch goal | Core sheet workflow must be solid first; DnD adds complexity for marginal gain |
