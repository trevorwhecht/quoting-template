# quoting-template

Reusable Next.js starter for client-facing quoting and order management projects. Built on Next.js · React 19 · Tailwind 4 · Prisma · NextAuth v4 · shadcn/ui · Vercel.

---

## Forking This Template

Follow these steps in order every time you start a new project from this template.

### 1. Fork or Duplicate the Repo

**Option A — GitHub fork (recommended for independent projects):**
1. Go to the GitHub repo for `quoting-template`
2. Click **Fork** → give it your new project name (e.g. `acme-quoting`)
3. Clone your fork locally:
   ```bash
   git clone git@github.com:yourorg/acme-quoting.git
   cd acme-quoting
   ```

**Option B — Copy locally (for monorepo siblings):**
```bash
cp -r quoting-template my-new-project
cd my-new-project
git init && git add . && git commit -m "init from quoting-template"
```

---

### 2. Rename the Project

Update the project name in three places:

**`package.json`** — change the `name` field:
```json
{
  "name": "your-project-name"
}
```

**`CLAUDE.md`** — update the first heading and one-line description at the top of the file:
```md
# your-project-name

One line description of what this project does.
```

**`next.config.ts`** — update any hardcoded references if present.

---

### 3. Configure Your Fork

Run the setup wizard to set your business name, description, tax rate, and active order states:

```bash
npm run setup
```

The wizard prompts for each setting and shows the current value in brackets — press Enter to keep it or type a new value. Settings are written to `project.config.ts` at the project root.

> Re-run `npm run setup` any time to update these settings. After changing them, re-run `npx prisma db seed` to sync the changes to your database.

---

### 4. Install Dependencies

```bash
npm install
```

---

### 5. Set Up Environment Variables

Copy the env template and fill in your values:
```bash
cp .env.example .env.local
```

Open `.env.local` and fill in:

| Variable | Description |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string — **each project needs its own dedicated database** (see note below) |
| `NEXTAUTH_SECRET` | Random secret — run `openssl rand -base64 32` to generate |
| `NEXTAUTH_URL` | `http://localhost:3000` for local dev |
| `NEXT_PUBLIC_BASE_URL` | `http://localhost:3000` for local dev — used for order share links |
| `SEED_ADMIN_EMAIL` | Email for the seeded admin user |
| `SEED_ADMIN_PASSWORD` | Password for the seeded admin user |

> **Each forked project must have its own dedicated Prisma/PostgreSQL database.** Projects share the same Prisma account but each gets a separate database — schemas, migrations, and data must never be shared across projects. Create a new database in your Prisma dashboard before running migrations.

For production, create `.env.prod` with your production `DATABASE_URL` and set all vars in Vercel's environment settings.

---

### 6. Set Up the Database

Run migrations and generate the Prisma client:
```bash
npx prisma migrate dev
npx prisma generate
```

Seed the database with the admin user, order states, and universal settings:
```bash
npx prisma db seed
```

---

### 7. Define the UI Theme

This step locks in the visual identity for the project. Run the skill in Claude Code:

```
/ui-ux-pro-max
```

When prompted, provide your preferences:
- **Style direction** — e.g. clean minimal, glassmorphism, brutalist, etc.
- **Brand colors** — primary, accent, and any existing brand palette
- **Typography** — preferred fonts or leave it to the skill to recommend
- **Product type** — e.g. SaaS dashboard, client portal, internal tool
- **Chart conventions** — if the project has data visualizations

The skill will recommend a complete palette, font pairing, and style direction. Once you agree, fill in `.claude/rules/ui-theme.md` with the resolved decisions. All future UI work in the project will reference that file automatically.

---

### 8. Start the Dev Server

```bash
npm run dev         # port 3000, local DB
npm run dev:prod    # port 3001, production DB (requires .env.prod)
```

Open [http://localhost:3000](http://localhost:3000).

---

### 9. Set Up Vercel (when ready to deploy)

1. Push your repo to GitHub
2. Import it at [vercel.com/new](https://vercel.com/new)
3. Add all environment variables from `.env.local` in Vercel's project settings
4. Vercel auto-deploys on every push to `main`

---

## Project Structure

```
src/
  app/
    (pages)/          ← route group, no URL impact
    api/              ← Next.js Route Handlers
  components/
    ui/               ← shadcn + base primitives only
    shared/           ← promoted cross-feature components
  services/           ← business logic, external API calls
  hooks/              ← shared hooks
  lib/                ← db client, auth config, utilities
  models/             ← domain types
  types/              ← global shared types
```

## Key Scripts

| Command | Description |
|---|---|
| `npm run setup` | Configure your fork (business name, tax rate, order states) |
| `npm run dev` | Dev server on port 3000 (local DB) |
| `npm run dev:prod` | Dev server on port 3001 (prod DB) |
| `npm run build` | `prisma generate` + `next build` |
| `npx prisma db seed` | Seed admin user + initial data |
| `npx prisma migrate dev` | Run pending migrations |
| `npx prisma studio` | Browse the database in a UI |

---

## Early Setup: Inventory / Catalog

> **Every new project must replace `LineItemPreset` with a real catalog schema.**

The template ships a stub `LineItemPreset` table (name, description, price, cost) seeded with generic test data. It is intentionally minimal — it exists so the quote builder and Get Quote form have something to pull from during development.

**Before building any customer-facing quote flows on a real project, design and implement your actual inventory/catalog system.** A real implementation typically needs:

- Product variants (size, color, SKU, material)
- Product images
- Tiered or quantity-based pricing
- Category grouping
- Stock tracking
- Supplier / vendor fields

Do this in the early setup phase alongside `npm run setup` and the UI theme step. The stub migrations can be deleted or replaced — do not extend the stub table for production use.

---

## Developer Configuration

`project.config.ts` at the project root is the single file for all business-level settings. It is committed to git so your fork's config stays in version control.

| Setting | Description |
|---|---|
| `businessName` | Displayed name for the business |
| `businessDescription` | Short description shown in metadata and emails |
| `taxRate` | Sales tax as a decimal (e.g. `0.0775` = 7.75%) |
| `currency` | Currency code — edit manually if needed (not in wizard) |
| `orderStates.awaitingPayment` | Toggle "Awaiting Payment" order state |
| `orderStates.inProgress` | Toggle "In Progress" order state |
| `orderStates.readyForPickup` | Toggle "Ready for Pickup" order state |
| `orderStates.paymentNeeded` | Toggle "Payment Needed" order state |

**To add a new setting in the future:**
1. Add the field to `projectConfig` in `project.config.ts`
2. Add a prompt for it in `scripts/setup.ts`
3. Add the field to `SETTINGS` in `prisma/seed.ts` (if it should live in the database)
