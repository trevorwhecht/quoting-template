import { describe, it, expect } from "vitest"
import {
  formatPct,
  parsePct,
  parseConfigSource,
  buildConfigSource,
  type ProjectConfig,
} from "./setup-utils"

const BASE_CONFIG: ProjectConfig = {
  businessName: "Acme Events",
  businessDescription: "Wedding rentals",
  taxRate: 0.0825,
  currency: "USD",
  orderStates: {
    awaitingPayment: true,
    inProgress: true,
    readyForPickup: false,
    paymentNeeded: true,
  },
}

describe("formatPct", () => {
  it("converts 0.0775 to '7.75'", () => {
    expect(formatPct(0.0775)).toBe("7.75")
  })
  it("converts 0.1 to '10'", () => {
    expect(formatPct(0.1)).toBe("10")
  })
  it("converts 0.0825 to '8.25'", () => {
    expect(formatPct(0.0825)).toBe("8.25")
  })
})

describe("parsePct", () => {
  it("converts '7.75' to 0.0775", () => {
    expect(parsePct("7.75")).toBeCloseTo(0.0775)
  })
  it("converts '10' to 0.1", () => {
    expect(parsePct("10")).toBeCloseTo(0.1)
  })
  it("round-trips with formatPct", () => {
    expect(parsePct(formatPct(0.0775))).toBeCloseTo(0.0775)
  })
})

describe("parseConfigSource", () => {
  it("returns defaults when source is empty string", () => {
    const cfg = parseConfigSource("")
    expect(cfg.businessName).toBe("My Business")
    expect(cfg.taxRate).toBe(0.0775)
    expect(cfg.orderStates.readyForPickup).toBe(true)
    expect(cfg.orderStates.paymentNeeded).toBe(true)
  })

  it("parses all string fields", () => {
    const src = buildConfigSource(BASE_CONFIG)
    const cfg = parseConfigSource(src)
    expect(cfg.businessName).toBe("Acme Events")
    expect(cfg.businessDescription).toBe("Wedding rentals")
    expect(cfg.currency).toBe("USD")
  })

  it("parses taxRate as a decimal number", () => {
    const src = buildConfigSource(BASE_CONFIG)
    const cfg = parseConfigSource(src)
    expect(cfg.taxRate).toBeCloseTo(0.0825)
  })

  it("parses boolean orderState toggles", () => {
    const src = buildConfigSource(BASE_CONFIG)
    const cfg = parseConfigSource(src)
    expect(cfg.orderStates.awaitingPayment).toBe(true)
    expect(cfg.orderStates.inProgress).toBe(true)
    expect(cfg.orderStates.readyForPickup).toBe(false)
    expect(cfg.orderStates.paymentNeeded).toBe(true)
  })

  it("round-trips with buildConfigSource", () => {
    const src = buildConfigSource(BASE_CONFIG)
    const cfg = parseConfigSource(src)
    expect(cfg).toEqual(BASE_CONFIG)
  })
})

describe("buildConfigSource", () => {
  it("produces a valid TypeScript export", () => {
    const src = buildConfigSource(BASE_CONFIG)
    expect(src).toContain("export const projectConfig =")
    expect(src).toContain("} as const")
  })

  it("includes correct string values", () => {
    const src = buildConfigSource(BASE_CONFIG)
    expect(src).toContain('"Acme Events"')
    expect(src).toContain('"Wedding rentals"')
  })

  it("includes correct numeric value", () => {
    const src = buildConfigSource(BASE_CONFIG)
    expect(src).toContain("0.0825")
  })

  it("includes correct boolean values", () => {
    const src = buildConfigSource(BASE_CONFIG)
    expect(src).toContain("readyForPickup: false")
    expect(src).toContain("awaitingPayment: true")
  })
})
