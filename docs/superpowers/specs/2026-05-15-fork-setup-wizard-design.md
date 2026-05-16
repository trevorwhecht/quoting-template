# Fork Setup Wizard — Design Spec

**Date:** 2026-05-15
**Status:** Approved

---

## 1. Purpose

When a developer forks this template to start a new project, they need to configure a handful of business-level settings before running the seed. Currently those values are hardcoded in `prisma/seed.ts` and must be manually edited.

This spec defines a `npm run setup` terminal wizard that prompts for all fork-time configuration, writes it to a committed `project.config.ts` file, and updates the README to document the new flow. The wizard is re-runnable at any time — it shows current values and updates only what the developer changes.

---

## 2. Files Affected

| File | Change |
|---|---|
| `project.config.ts` | **New** — typed config object at project root |
| `scripts/setup.ts` | **New** — terminal wizard script |
| `prisma/seed.ts` | **Modified** — import config instead of hardcoded defaults |
| `package.json` | **Modified** — add `"setup": "tsx scripts/setup.ts"` script |
| `README.md` | **Modified** — insert Step 3, add Developer Configuration section |

---

## 3. `project.config.ts`

A TypeScript file at the project root, committed to git. Template ships with neutral placeholder defaults. Every fork overwrites these with real values via the wizard (or manually).

```ts
// project.config.ts
export const projectConfig = {
  businessName: "My Business",
  businessDescription: "Your business description",
  taxRate: 0.0775,   // stored as decimal — 0.0775 = 7.75%
  currency: "USD",   // manual edit only — not in wizard

  orderStates: {
    awaitingPayment: true,  // "Awaiting Payment"
    inProgress: true,       // "In Progress"
    readyForPickup: true,   // "Ready for Pickup"
    paymentNeeded: true,    // "Payment Needed"
  },
} as const
```

**Rules:**
- `currency` is intentionally excluded from the wizard — change it manually if needed
- The three required order states (Archived, Needs Review, Complete) are not represented here — they always seed regardless
- The file is always rewritten from a template when the wizard runs — manual edits to this file survive only until the next `npm run setup` run (the current values are read back and shown as defaults, so nothing is lost)

---

## 4. `scripts/setup.ts`

Run via `tsx` (already in devDependencies). Uses Node's built-in `readline` — no additional dependencies.

### Flow

1. Print a banner header
2. Dynamically import `../project.config.ts` to read current values
3. Prompt for each configurable field, showing current value in brackets
4. Write a new `project.config.ts` from a template string with the collected values
5. Print a summary and next-steps reminder

### Terminal output

```
╔════════════════════════════════════╗
║   quoting-template project setup   ║
╚════════════════════════════════════╝

Configure your fork. Press Enter to keep the current value.

Business name [My Business]: 
Business description [Your business description]: 
Tax rate % [7.75]: 

Order states — toggle which optional states are active:
Include "Awaiting Payment"? [Y/n]: 
Include "In Progress"? [Y/n]: 
Include "Ready for Pickup"? [Y/n]: 
Include "Payment Needed"? [Y/n]: 

✓ Written to project.config.ts

Next steps:
  1. Fill in .env.local (DATABASE_URL, NEXTAUTH_SECRET, admin credentials)
  2. Run: npx prisma db seed
     Re-run any time — the seed syncs with project.config.ts on every run.
     Note: disabling an order state removes it from the DB only if no orders
     are currently assigned to it.
```

### Tax rate handling

- Wizard prompts as a percentage (`7.75`) for ease of entry
- Stored in `project.config.ts` as a decimal (`0.0775`)
- Conversion: `stored = input / 100`

### Boolean prompts

- Default shown as `[Y/n]` if currently `true`, `[y/N]` if currently `false`
- Pressing Enter keeps current value
- Accepts: `y`, `yes`, `n`, `no` (case-insensitive)

---

## 5. Seed Integration

`prisma/seed.ts` imports `projectConfig` and uses its values instead of hardcoded defaults.

### Settings

```ts
import { projectConfig } from "../project.config"

const SETTINGS = [
  { setting: "taxRate",            value: String(projectConfig.taxRate) },
  { setting: "businessName",       value: projectConfig.businessName },
  { setting: "businessDescription",value: projectConfig.businessDescription },
  { setting: "currency",           value: projectConfig.currency },
]
```

### Order states sync

The seed fully syncs the four optional states against the config:

- **Toggled on (`true`):** upsert the state (create if missing, skip update if exists)
- **Toggled off (`false`):** attempt to delete the state from the DB

**Delete behavior:** if orders are currently assigned to the state being deleted, the delete will fail on a foreign key constraint. The seed catches this, prints a warning, and continues:

```
⚠ Could not delete "Ready for Pickup" — orders are still assigned to this state.
  Remove or reassign those orders first, then re-run the seed.
```

The three required states (Archived, Needs Review, Complete — `isRequired: true`) are always upserted regardless of config.

---

## 6. README Updates

### New step order

```
1. Fork / clone the repo
2. Install dependencies       npm install
3. Configure your fork        npm run setup          ← NEW
4. Set up .env.local          secrets only (DATABASE_URL, NEXTAUTH_SECRET, etc.)
5. Set up the database        npx prisma migrate dev && npx prisma db seed
6. Define the UI theme        /ui-ux-pro-max in Claude Code
7. Start the dev server       npm run dev
8. Deploy to Vercel
```

### New "Developer Configuration" section

Added below the key scripts table. Explains:
- `project.config.ts` is the single file for business-level settings
- `npm run setup` is the canonical way to edit it
- Manual edits are also fine — the wizard reads current values so nothing is lost on re-run
- `currency` must be changed manually (not in wizard)
- After changing config, re-run `npx prisma db seed` to sync changes to the DB

---

## 7. Extensibility

To add a new setting in the future:
1. Add a field to `projectConfig` in `project.config.ts`
2. Add a prompt for it in `scripts/setup.ts`
3. Add the field to `SETTINGS` in `seed.ts` (if it should live in the DB) or use it directly wherever needed

No schema changes are required for settings that go through `UniversalSettings` — the key/value table handles arbitrary string values.

---

## 8. Out of Scope

- A web-based setup UI — terminal wizard only
- Secrets in the wizard (DATABASE_URL, NEXTAUTH_SECRET, admin credentials) — these stay in `.env.local`
- Modifying `currency` via wizard — manual edit only
- UI theme configuration — handled separately by `/ui-ux-pro-max`
