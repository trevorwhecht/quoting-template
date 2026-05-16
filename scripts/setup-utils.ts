import * as fs from "node:fs"

export type ProjectConfig = {
  businessName: string
  businessDescription: string
  taxRate: number
  currency: string
  orderStates: {
    awaitingPayment: boolean
    inProgress: boolean
    readyForPickup: boolean
    paymentNeeded: boolean
  }
}

const DEFAULTS: ProjectConfig = {
  businessName: "My Business",
  businessDescription: "Your business description",
  taxRate: 0.0775,
  currency: "USD",
  orderStates: {
    awaitingPayment: true,
    inProgress: true,
    readyForPickup: true,
    paymentNeeded: true,
  },
}

export function formatPct(decimal: number): string {
  return parseFloat((decimal * 100).toFixed(4)).toString()
}

export function parsePct(input: string): number {
  return parseFloat(input) / 100
}

export function parseConfigSource(src: string): ProjectConfig {
  function str(key: string, fallback: string): string {
    const m = src.match(new RegExp(`${key}:\\s*"([^"]*)"`) )
    return m ? m[1] : fallback
  }
  function num(key: string, fallback: number): number {
    const m = src.match(new RegExp(`${key}:\\s*([\\d.]+)`))
    return m ? parseFloat(m[1]) : fallback
  }
  function bool(key: string, fallback: boolean): boolean {
    const m = src.match(new RegExp(`${key}:\\s*(true|false)`))
    return m ? m[1] === "true" : fallback
  }
  return {
    businessName: str("businessName", DEFAULTS.businessName),
    businessDescription: str("businessDescription", DEFAULTS.businessDescription),
    taxRate: num("taxRate", DEFAULTS.taxRate),
    currency: str("currency", DEFAULTS.currency),
    orderStates: {
      awaitingPayment: bool("awaitingPayment", DEFAULTS.orderStates.awaitingPayment),
      inProgress: bool("inProgress", DEFAULTS.orderStates.inProgress),
      readyForPickup: bool("readyForPickup", DEFAULTS.orderStates.readyForPickup),
      paymentNeeded: bool("paymentNeeded", DEFAULTS.orderStates.paymentNeeded),
    },
  }
}

export function readCurrentConfig(configPath: string): ProjectConfig {
  if (!fs.existsSync(configPath)) return parseConfigSource("")
  return parseConfigSource(fs.readFileSync(configPath, "utf8"))
}

export function buildConfigSource(cfg: ProjectConfig): string {
  return `export const projectConfig = {
  businessName: ${JSON.stringify(cfg.businessName)},
  businessDescription: ${JSON.stringify(cfg.businessDescription)},
  taxRate: ${cfg.taxRate},   // ${formatPct(cfg.taxRate)}%
  currency: ${JSON.stringify(cfg.currency)},   // manual edit only

  orderStates: {
    awaitingPayment: ${cfg.orderStates.awaitingPayment},   // "Awaiting Payment"
    inProgress: ${cfg.orderStates.inProgress},             // "In Progress"
    readyForPickup: ${cfg.orderStates.readyForPickup},     // "Ready for Pickup"
    paymentNeeded: ${cfg.orderStates.paymentNeeded},       // "Payment Needed"
  },
} as const
`
}
