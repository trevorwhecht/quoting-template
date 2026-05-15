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

**`CLAUDE.md`** — update the top line and description:
```md
---
description: your-project-name — one line description of what this project does
---

# your-project-name
```

**`next.config.ts`** — update any hardcoded references if present.

---

### 3. Install Dependencies

```bash
npm install
```

---

### 4. Set Up Environment Variables

Copy the env template and fill in your values:
```bash
cp .env .env.local
```

Open `.env.local` and fill in:

| Variable | Description |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string (local dev DB) |
| `NEXTAUTH_SECRET` | Random secret — run `openssl rand -base64 32` to generate |
| `NEXTAUTH_URL` | `http://localhost:3000` for local dev |
| `SEED_ADMIN_EMAIL` | Email for the seeded admin user |
| `SEED_ADMIN_PASSWORD` | Password for the seeded admin user |

For production, create `.env.prod` with your production `DATABASE_URL` and set all vars in Vercel's environment settings.

---

### 5. Set Up the Database

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

### 6. Define the UI Theme

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

### 7. Start the Dev Server

```bash
npm run dev         # port 3000, local DB
npm run dev:prod    # port 3001, production DB (requires .env.prod)
```

Open [http://localhost:3000](http://localhost:3000).

---

### 8. Set Up Vercel (when ready to deploy)

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
| `npm run dev` | Dev server on port 3000 (local DB) |
| `npm run dev:prod` | Dev server on port 3001 (prod DB) |
| `npm run build` | `prisma generate` + `next build` |
| `npx prisma db seed` | Seed admin user + initial data |
| `npx prisma migrate dev` | Run pending migrations |
| `npx prisma studio` | Browse the database in a UI |
