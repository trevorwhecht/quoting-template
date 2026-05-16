// scripts/setup.ts
import * as path from "node:path"
import * as fs from "node:fs"
import { createInterface } from "node:readline/promises"
import { readCurrentConfig, buildConfigSource, formatPct, parsePct, type ProjectConfig } from "./setup-utils"

const CONFIG_PATH = path.resolve(process.cwd(), "project.config.ts")

async function main() {
  const current = readCurrentConfig(CONFIG_PATH)

  const rl = createInterface({ input: process.stdin, output: process.stdout })

  console.log(`
╔════════════════════════════════════╗
║   quoting-template project setup   ║
╚════════════════════════════════════╝

Configure your fork. Press Enter to keep the current value.
`)

  async function ask(prompt: string, defaultVal: string): Promise<string> {
    const answer = await rl.question(prompt)
    return answer.trim() || defaultVal
  }

  async function askBool(label: string, curr: boolean): Promise<boolean> {
    const hint = curr ? "Y/n" : "y/N"
    const answer = await rl.question(`Include "${label}"? [${hint}]: `)
    if (!answer.trim()) return curr
    return answer.trim().toLowerCase().startsWith("y")
  }

  const businessName = await ask(
    `Business name [${current.businessName}]: `,
    current.businessName
  )
  const businessDescription = await ask(
    `Business description [${current.businessDescription}]: `,
    current.businessDescription
  )
  let taxRate: number
  for (;;) {
    const raw = await ask(
      `Tax rate % [${formatPct(current.taxRate)}]: `,
      formatPct(current.taxRate)
    )
    const parsed = parsePct(raw)
    if (!isNaN(parsed) && parsed >= 0) { taxRate = parsed; break }
    console.log("  Invalid — enter a number like 7.75")
  }

  console.log("\nOrder states — toggle which optional states are active:")
  const awaitingPayment = await askBool("Awaiting Payment", current.orderStates.awaitingPayment)
  const inProgress      = await askBool("In Progress",      current.orderStates.inProgress)
  const readyForPickup  = await askBool("Ready for Pickup",  current.orderStates.readyForPickup)
  const paymentNeeded   = await askBool("Payment Needed",    current.orderStates.paymentNeeded)

  rl.close()

  const newConfig: ProjectConfig = {
    businessName,
    businessDescription,
    taxRate,
    currency: current.currency,
    orderStates: { awaitingPayment, inProgress, readyForPickup, paymentNeeded },
  }

  try {
    fs.writeFileSync(CONFIG_PATH, buildConfigSource(newConfig), "utf8")
  } catch (e: any) {
    console.error(`\nFailed to write ${CONFIG_PATH}:\n  ${e.message}`)
    process.exit(1)
  }

  console.log(`
✓ Written to project.config.ts

Next steps:
  1. Fill in .env.local (DATABASE_URL, NEXTAUTH_SECRET, admin credentials)
  2. Run: npx prisma db seed
     Re-run any time to sync config changes to the database.
     Note: disabling an order state removes it from the DB only if no orders
     are currently assigned to it.
`)
}

main().catch((e) => { console.error(e); process.exit(1) })
