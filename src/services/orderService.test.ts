import { describe, it, expect } from "vitest"
import { dec, serializeOrder, stripAdminFields, computeOrderTotals } from "./orderService"

describe("dec", () => {
  it("converts Prisma Decimal-like object to number", () => {
    expect(dec({ toFixed: () => "12.50", toString: () => "12.5" })).toBe(12.5)
  })
  it("converts string to number", () => {
    expect(dec("9.99")).toBe(9.99)
  })
  it("returns 0 for null", () => {
    expect(dec(null)).toBe(0)
  })
  it("returns 0 for undefined", () => {
    expect(dec(undefined)).toBe(0)
  })
  it("passes through a plain number", () => {
    expect(dec(42)).toBe(42)
  })
})

describe("serializeOrder", () => {
  it("converts Decimal fields to numbers", () => {
    const raw = {
      id: 1, totalPrice: "150.00", cost: "80.00", profit: "70.00",
      totalSetUpPrice: "0", totalSetUpCost: "0", totalAmount: "150.00",
      subTotal: "150.00", salesTax: "11.63", discountManual: null,
      discountReferral: null, discountMistake: null, rushFeeAmount: null,
      rushFeePercent: null, finalPrice: null, orderLineItems: [], setUpCosts: [], payments: [],
    }
    const result = serializeOrder(raw)
    expect(result.totalPrice).toBe(150)
    expect(result.cost).toBe(80)
    expect(result.profit).toBe(70)
    expect(result.salesTax).toBe(11.63)
    expect(result.discountManual).toBeNull()
  })

  it("serializes line item Decimal fields", () => {
    const raw = {
      id: 1, totalPrice: "100", cost: "0", profit: "0",
      totalSetUpPrice: "0", totalSetUpCost: "0", totalAmount: "100",
      subTotal: "100", salesTax: "0", discountManual: null,
      discountReferral: null, discountMistake: null, rushFeeAmount: null,
      rushFeePercent: null, finalPrice: null,
      orderLineItems: [
        { id: 1, unitPrice: "50.00", lineTotal: "100.00", unitCost: "30.00", variants: [] }
      ],
      setUpCosts: [], payments: [],
    }
    const result = serializeOrder(raw)
    expect(result.orderLineItems[0].unitPrice).toBe(50)
    expect(result.orderLineItems[0].unitCost).toBe(30)
  })
})

describe("stripAdminFields", () => {
  it("removes cost, profit, totalSetUpCost from order", () => {
    const order = {
      id: 1, totalPrice: 150, cost: 80, profit: 70, totalSetUpCost: 10,
      orderLineItems: [{ id: 1, unitCost: 30, variants: [{ id: 1, cost: 5 }] }],
      setUpCosts: [{ id: 1, adminTotal: 10 }],
    }
    const result = stripAdminFields(order)
    expect(result).not.toHaveProperty("cost")
    expect(result).not.toHaveProperty("profit")
    expect(result).not.toHaveProperty("totalSetUpCost")
    expect(result.orderLineItems[0]).not.toHaveProperty("unitCost")
    expect(result.orderLineItems[0].variants[0]).not.toHaveProperty("cost")
    expect(result.setUpCosts[0]).not.toHaveProperty("adminTotal")
  })
})

describe("computeOrderTotals", () => {
  it("computes all totals from line items and setup costs", () => {
    const result = computeOrderTotals({
      lineItems: [
        { qty: 2, unitPrice: 25, unitCost: 10 },
        { qty: 1, unitPrice: 50, unitCost: 20 },
      ],
      setUpCosts: [{ userTotal: 15, adminTotal: 5 }],
      taxRate: 0.1,
    })
    expect(result.totalQty).toBe(3)
    expect(result.totalAmount).toBe(100)       // 2*25 + 1*50
    expect(result.totalSetUpPrice).toBe(15)
    expect(result.totalSetUpCost).toBe(5)
    expect(result.subTotal).toBe(115)          // 100 + 15
    expect(result.salesTax).toBeCloseTo(11.5)  // 115 * 0.1
    expect(result.totalPrice).toBeCloseTo(126.5)
    expect(result.cost).toBe(45)               // 2*10 + 1*20 + 5
    expect(result.profit).toBeCloseTo(81.5)    // 126.5 - 45
  })

  it("applies discounts before tax", () => {
    const result = computeOrderTotals({
      lineItems: [{ qty: 1, unitPrice: 100, unitCost: 40 }],
      setUpCosts: [],
      taxRate: 0.1,
      discountManual: 10,
    })
    expect(result.subTotal).toBe(90)    // 100 - 10
    expect(result.salesTax).toBeCloseTo(9)
    expect(result.totalPrice).toBeCloseTo(99)
  })

  it("applies rush fee before tax", () => {
    const result = computeOrderTotals({
      lineItems: [{ qty: 1, unitPrice: 100, unitCost: 40 }],
      setUpCosts: [],
      taxRate: 0.1,
      rushFeeAmount: 20,
    })
    expect(result.subTotal).toBe(120)
  })
})
