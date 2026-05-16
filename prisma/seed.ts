import { PrismaClient, Prisma } from "@prisma/client"
import { hash } from "bcryptjs"
import { projectConfig } from "../project.config"

const prisma = new PrismaClient()

const REQUIRED_STATES = [
  { id: 0, name: "Archived",     sortOrder: -1, isRequired: true,  color: "#6b7280", description: "Archived orders — hidden from main kanban" },
  { id: 1, name: "Admin Review", sortOrder: 0,  isRequired: true,  color: "#f59e0b", description: "New orders awaiting admin review" },
  { id: 6, name: "Complete",     sortOrder: 5,  isRequired: true,  color: "#6b7280", description: "Order fulfilled and closed" },
]

const OPTIONAL_STATES = [
  { id: 2, name: "User Review",      sortOrder: 1, isRequired: false, color: "#3b82f6", description: "Quote sent — awaiting customer review and approval", enabled: projectConfig.orderStates.awaitingPayment },
  { id: 3, name: "In Progress",      sortOrder: 2, isRequired: false, color: "#8b5cf6", description: "Work actively underway",                             enabled: projectConfig.orderStates.inProgress },
  { id: 4, name: "Awaiting Pickup",  sortOrder: 3, isRequired: false, color: "#10b981", description: "Order complete, ready for customer collection",       enabled: projectConfig.orderStates.readyForPickup },
  { id: 5, name: "Awaiting Payment", sortOrder: 4, isRequired: false, color: "#ef4444", description: "Final payment required before release",               enabled: projectConfig.orderStates.paymentNeeded },
]

const SETTINGS = [
  { setting: "taxRate",             value: String(projectConfig.taxRate),            description: "Sales tax rate as decimal (e.g. 0.0775 = 7.75%)" },
  { setting: "businessName",        value: projectConfig.businessName,               description: "Business display name" },
  { setting: "businessDescription", value: projectConfig.businessDescription,        description: "Short business description" },
  { setting: "currency",            value: projectConfig.currency,                   description: "Currency code" },
]

const SETUP_FEE_PRESETS = [
  { id: 1, name: "Artwork Fee",  description: "Per color / design",   unitLabel: "Per Design", defaultRate: 25,  defaultCost: 0,   sortOrder: 0 },
  { id: 2, name: "Screen Setup", description: "Per screen",           unitLabel: "Per Screen", defaultRate: 15,  defaultCost: 8,   sortOrder: 1 },
  { id: 3, name: "Rush Fee",     description: "Expedited turnaround", unitLabel: "Flat",       defaultRate: 50,  defaultCost: 0,   sortOrder: 2 },
  { id: 4, name: "Shipping",     description: "Ground shipping",      unitLabel: "Flat",       defaultRate: 20,  defaultCost: 12,  sortOrder: 3 },
  { id: 5, name: "Custom Item",  description: "Misc setup charge",    unitLabel: "Per Item",   defaultRate: 0,   defaultCost: 0,   sortOrder: 4 },
]

const LINE_ITEM_PRESETS = [
  { id: 1, name: "Standard T-Shirt", description: "100% cotton, unisex", defaultPrice: new Prisma.Decimal(12.00), defaultCost: new Prisma.Decimal(5.00),  sortOrder: 0 },
  { id: 2, name: "Premium Hoodie",   description: "Fleece pullover",      defaultPrice: new Prisma.Decimal(28.00), defaultCost: new Prisma.Decimal(14.00), sortOrder: 1 },
  { id: 3, name: "Custom Item",      description: "Price set by admin",   defaultPrice: new Prisma.Decimal(0),     defaultCost: new Prisma.Decimal(0),     sortOrder: 2 },
]

async function main() {
  console.log("Seeding required order states...")
  for (const state of REQUIRED_STATES) {
    await prisma.orderState.upsert({
      where: { id: state.id },
      update: { name: state.name, description: state.description, color: state.color },
      create: state,
    })
  }

  console.log("Syncing optional order states...")
  for (const { enabled, ...state } of OPTIONAL_STATES) {
    if (enabled) {
      await prisma.orderState.upsert({
        where: { id: state.id },
        update: { name: state.name, description: state.description, color: state.color },
        create: state,
      })
      console.log(`  ✓ "${state.name}" active`)
    } else {
      try {
        await prisma.orderState.delete({ where: { id: state.id } })
        console.log(`  ✓ "${state.name}" removed`)
      } catch (e) {
        if (e instanceof Prisma.PrismaClientKnownRequestError) {
          if (e.code === "P2003") {
            console.warn(`  ⚠ Could not delete "${state.name}" — orders are still assigned to this state.`)
            console.warn(`    Remove or reassign those orders first, then re-run the seed.`)
          } else if (e.code !== "P2025") {
            throw e
          }
          // P2025 = record not found (already deleted) — silently ignore
        } else {
          throw e
        }
      }
    }
  }

  // Reset sequence so the next auto-generated OrderState ID doesn't conflict
  // with the explicitly-seeded IDs 0–6. Without this, nextval() returns 1 and
  // fails with a unique constraint violation on the first admin-created state.
  await prisma.$executeRaw`SELECT setval(pg_get_serial_sequence('"OrderState"', 'id'), COALESCE((SELECT MAX(id) FROM "OrderState"), 0) + 1)`

  console.log("Seeding universal settings...")
  for (const s of SETTINGS) {
    await prisma.universalSettings.upsert({
      where: { setting: s.setting },
      update: { value: s.value },
      create: s,
    })
  }

  console.log("Seeding setup fee presets...")
  for (const p of SETUP_FEE_PRESETS) {
    await prisma.setupFeePreset.upsert({
      where: { id: p.id },
      update: { name: p.name, description: p.description, unitLabel: p.unitLabel, defaultRate: p.defaultRate, defaultCost: p.defaultCost, sortOrder: p.sortOrder },
      create: p,
    })
  }

  console.log("Seeding line item presets...")
  for (const p of LINE_ITEM_PRESETS) {
    await prisma.lineItemPreset.upsert({
      where: { id: p.id },
      update: { name: p.name, description: p.description, defaultPrice: p.defaultPrice, defaultCost: p.defaultCost, sortOrder: p.sortOrder },
      create: p,
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
  const admin = await prisma.user.upsert({
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

  console.log("Seeding test order...")
  const existing = await prisma.order.findUnique({ where: { token: "seed-test-order-1" } })
  if (!existing) {
    await prisma.order.create({
      data: {
        userId: admin.id,
        stateId: 1, // Admin Review
        nickname: "Test Order #1",
        customerNotes: "Please make it blue.",
        totalQty: 24,
        subTotal: 240.00,
        salesTax: 18.60,
        totalPrice: 258.60,
        totalAmount: 258.60,
        cost: 120.00,
        profit: 120.00,
        isPaid: false,
        token: "seed-test-order-1",
        dueDate: new Date("2026-06-15"),
        orderLineItems: {
          create: [
            {
              description: "Custom T-Shirts",
              qty: 12,
              unitPrice: 10.00,
              lineTotal: 120.00,
              unitCost: 5.00,
              sortOrder: 0,
              variants: {
                create: [
                  { variant: "S", qty: 3, price: 10.00, cost: 5.00 },
                  { variant: "M", qty: 5, price: 10.00, cost: 5.00 },
                  { variant: "L", qty: 4, price: 10.00, cost: 5.00 },
                ],
              },
            },
            {
              description: "Custom Hoodies",
              qty: 12,
              unitPrice: 10.00,
              lineTotal: 120.00,
              unitCost: 5.00,
              sortOrder: 1,
              variants: {
                create: [
                  { variant: "M", qty: 6, price: 10.00, cost: 5.00 },
                  { variant: "L", qty: 6, price: 10.00, cost: 5.00 },
                ],
              },
            },
          ],
        },
      },
    })
    console.log("Test order created.")
  } else {
    console.log("Test order already exists — skipping.")
  }

  console.log("Seed complete.")
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
