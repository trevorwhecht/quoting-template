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
