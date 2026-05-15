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
        stateId: 1, // Needs Review
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
