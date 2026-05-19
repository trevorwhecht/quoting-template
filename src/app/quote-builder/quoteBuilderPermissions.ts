import type { EmployeeFieldPermissions } from "@/services/orderService"
export type { EmployeeFieldPermissions }

export type PermissionInput = {
  role: string
  stateId: number
  orderUserId: string | null
  sessionUserId: string | null
  employeePermissions?: EmployeeFieldPermissions
}

export type QuoteBuilderPermissions = {
  canEditLineItemPrices: boolean
  canViewLineItemPrices: boolean
  canEditLineItemQty: boolean
  canAddRemoveLineItems: boolean
  canEditSetupCosts: boolean
  canViewSetupCosts: boolean
  canEditDiscount: boolean
  canSelectUser: boolean
  isReadOnly: boolean
  saveAction: "save" | "revert_state" | "login" | "none"
}

export function getQuoteBuilderPermissions(input: PermissionInput): QuoteBuilderPermissions {
  const { role, stateId, orderUserId, sessionUserId, employeePermissions } = input

  const isAdmin = role === "admin"
  const isEmployee = role === "employee"
  const isOwner = (role === "user" || role === "guest") && sessionUserId === orderUserId && orderUserId != null
  const isAnonOnPublicOrder = role === "anonymous" && orderUserId == null

  const canEdit = isAdmin || (isEmployee && stateId <= 2) || ((isOwner || isAnonOnPublicOrder) && stateId <= 2)
  const isReadOnly = !canEdit

  const saveAction = ((): QuoteBuilderPermissions["saveAction"] => {
    if (isAdmin) return "save"
    if (isEmployee) return stateId <= 2 ? "save" : "none"
    if (isOwner) {
      if (stateId >= 3) return "none"
      return stateId === 2 ? "revert_state" : "save"
    }
    if (isAnonOnPublicOrder && stateId <= 2) return "login"
    return "none"
  })()

  const empPrice = employeePermissions?.lineItemPriceAccess ?? "view"
  const empSetup = employeePermissions?.setupCostAccess ?? "edit"

  return {
    canEditLineItemPrices: isAdmin || (isEmployee && empPrice === "edit"),
    canViewLineItemPrices: isAdmin || !isEmployee || empPrice !== "none",
    canEditLineItemQty: canEdit,
    canAddRemoveLineItems: canEdit,
    canEditSetupCosts: isAdmin || (isEmployee && stateId <= 2 && empSetup === "edit"),
    canViewSetupCosts: isAdmin || !isEmployee || empSetup !== "none",
    canEditDiscount: isAdmin,
    canSelectUser: isAdmin,
    isReadOnly,
    saveAction,
  }
}
