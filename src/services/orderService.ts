import type { TotalsInput, TotalsResult } from "@/models/order"

function round2(v: number): number {
  return Math.round(v * 100) / 100
}

// Converts any Prisma Decimal, string, or number to a plain number. Returns 0 for null/undefined.
export function dec(v: any): number {
  if (v == null) return 0
  return Number(v)
}

// Converts all Prisma Decimal fields on a raw order object to plain numbers for JSON serialization.
// MUST be called before NextResponse.json() on any order query result.
export function serializeOrder(order: any): any {
  return {
    ...order,
    totalSetUpPrice: dec(order.totalSetUpPrice),
    totalSetUpCost: dec(order.totalSetUpCost),
    totalAmount: dec(order.totalAmount),
    subTotal: dec(order.subTotal),
    salesTax: dec(order.salesTax),
    totalPrice: dec(order.totalPrice),
    cost: dec(order.cost),
    profit: dec(order.profit),
    discountManual: order.discountManual != null ? dec(order.discountManual) : null,
    discountReferral: order.discountReferral != null ? dec(order.discountReferral) : null,
    discountMistake: order.discountMistake != null ? dec(order.discountMistake) : null,
    rushFeeAmount: order.rushFeeAmount != null ? dec(order.rushFeeAmount) : null,
    rushFeePercent: order.rushFeePercent != null ? dec(order.rushFeePercent) : null,
    finalPrice: order.finalPrice != null ? dec(order.finalPrice) : null,
    orderLineItems: order.orderLineItems?.map((li: any) => ({
      ...li,
      unitPrice: dec(li.unitPrice),
      lineTotal: dec(li.lineTotal),
      unitCost: dec(li.unitCost),
      variants: li.variants?.map((v: any) => ({
        ...v,
        price: dec(v.price),
        cost: v.cost != null ? dec(v.cost) : null,
      })) ?? [],
    })) ?? [],
    setUpCosts: order.setUpCosts?.map((s: any) => ({
      ...s,
      userTotal: dec(s.userTotal),
      adminTotal: dec(s.adminTotal),
    })) ?? [],
    payments: order.payments?.map((p: any) => ({
      ...p,
      amount: dec(p.amount),
    })) ?? [],
  }
}

// Removes admin-only fields for employee role responses.
// Call after serializeOrder().
export function stripAdminFields(order: any): any {
  const { cost, profit, totalSetUpCost, ...rest } = order
  return {
    ...rest,
    orderLineItems: rest.orderLineItems?.map(({ unitCost, ...li }: any) => ({
      ...li,
      variants: li.variants?.map(({ cost: _c, ...v }: any) => v) ?? [],
    })) ?? [],
    setUpCosts: rest.setUpCosts?.map(({ adminTotal, ...s }: any) => s) ?? [],
  }
}

// Computes all derived totals from line items and setup costs.
// Used when creating or updating an order with line item changes.
export function computeOrderTotals(input: TotalsInput): TotalsResult {
  const { lineItems, setUpCosts, taxRate } = input
  const discount =
    (input.discountManual ?? 0) +
    (input.discountReferral ?? 0) +
    (input.discountMistake ?? 0)
  const rushFee = input.rushFeeAmount ?? 0

  const totalQty = lineItems.reduce((s, li) => s + li.qty, 0)
  const totalAmount = round2(lineItems.reduce((s, li) => s + li.qty * li.unitPrice, 0))
  const totalSetUpPrice = round2(setUpCosts.reduce((s, sc) => s + sc.userTotal, 0))
  const totalSetUpCost = round2(setUpCosts.reduce((s, sc) => s + sc.adminTotal, 0))
  const lineCost = round2(lineItems.reduce((s, li) => s + li.qty * li.unitCost, 0))

  const subTotal = round2(totalAmount + totalSetUpPrice - discount + rushFee)
  const salesTax = round2(subTotal * taxRate)
  const totalPrice = round2(subTotal + salesTax)
  const cost = round2(lineCost + totalSetUpCost)
  const profit = round2(totalPrice - cost)

  return { totalQty, totalAmount, totalSetUpPrice, totalSetUpCost, subTotal, salesTax, totalPrice, cost, profit }
}
