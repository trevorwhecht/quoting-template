import type { OrderStateModel } from "./orderState"
import type { UserSummary } from "./user"

export type SetupCostItem = {
  label: string
  description?: string | null
  qty: number
  rate: number
  cost: number
}

export type OrderLineItemVariant = {
  id: number
  orderLineItemId: number
  variant: string
  qty: number
  price: number
  cost: number | null
}

export type OrderLineItem = {
  id: number
  orderId: number
  description: string
  qty: number
  unitPrice: number
  lineTotal: number
  unitCost: number
  sortOrder: number
  notes: string | null
  variants: OrderLineItemVariant[]
  createdAt: string
  updatedAt: string
}

export type SetUpCost = {
  id: number
  orderId: number
  userTotal: number
  adminTotal: number
  customSetupItems: any
  createdAt: string
  updatedAt: string
}

export type Payment = {
  id: number
  orderId: number
  userId: string | null
  amount: number
  channel: string
  note: string | null
  paidAt: string
  createdAt: string
}

// Shape returned by GET /api/orders (list) — lean, for kanban/list views
export type OrderSummary = {
  id: number
  nickname: string | null
  stateId: number
  state: Pick<OrderStateModel, "id" | "name" | "color">
  user: Pick<UserSummary, "id" | "firstName" | "lastName" | "email" | "role"> | null
  totalQty: number
  totalPrice: number
  cost: number           // 0 for employee (stripped at API)
  profit: number         // 0 for employee (stripped at API)
  isPaid: boolean
  paymentPlan: string | null
  dueDate: string | null
  dueDateEnd: string | null
  isHardDeadline: boolean
  completedDate: string | null
  token: string | null
  createdAt: string
  _count: { orderLineItems: number }
}

// Shape returned by GET /api/orders/:id — full detail for sheet
export type OrderDetail = {
  id: number
  nickname: string | null
  stateId: number
  state: OrderStateModel
  user: Pick<UserSummary, "id" | "firstName" | "lastName" | "email" | "phone" | "companyName" | "resellerLicenseUrl" | "resellerLicenseUploadedAt"> | null
  customerNotes: string | null
  notes: string | null
  totalQty: number
  totalSetUpPrice: number
  totalSetUpCost: number   // 0 for employee
  totalAmount: number
  subTotal: number
  salesTax: number
  totalPrice: number
  cost: number             // 0 for employee
  profit: number           // 0 for employee
  discountManual: number | null
  discountReferral: number | null
  discountMistake: number | null
  rushFeeAmount: number | null
  rushFeePercent: number | null
  rushFeeDays: number | null
  isPaid: boolean
  paymentPlan: string | null
  finalPrice: number | null
  dueDate: string | null
  dueDateEnd: string | null
  startDate: string | null
  isHardDeadline: boolean
  needsShipping: boolean
  taxDeferralRequested: boolean
  mainImage: string | null
  token: string | null
  completedDate: string | null
  createdAt: string
  updatedAt: string
  orderLineItems: OrderLineItem[]
  setUpCosts: SetUpCost[]
  payments: Payment[]
}

export type TotalsInput = {
  lineItems: { qty: number; unitPrice: number; unitCost: number }[]
  setUpCosts: { userTotal: number; adminTotal: number }[]
  taxRate: number
  discountManual?: number | null
  discountReferral?: number | null
  discountMistake?: number | null
  rushFeeAmount?: number | null
}

export type TotalsResult = {
  totalQty: number
  totalAmount: number
  totalSetUpPrice: number
  totalSetUpCost: number
  subTotal: number
  salesTax: number
  totalPrice: number
  cost: number
  profit: number
}
