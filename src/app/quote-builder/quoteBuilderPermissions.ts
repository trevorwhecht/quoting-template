export type PermissionInput = {
  role: string          // 'admin' | 'employee' | 'user' | 'guest' | 'anonymous'
  stateId: number
  orderUserId: string | null
  sessionUserId: string | null
}

export type QuoteBuilderPermissions = {
  canEditLineItemPrices: boolean
  canEditLineItemQty: boolean
  canAddRemoveLineItems: boolean
  canEditSetupCosts: boolean
  canEditDiscount: boolean
  canSelectUser: boolean
  isReadOnly: boolean
  saveAction: "save" | "revert_state" | "login" | "none"
}

export function getQuoteBuilderPermissions(input: PermissionInput): QuoteBuilderPermissions {
  const { role, stateId, orderUserId, sessionUserId } = input

  const isAdmin = role === "admin"
  const isEmployee = role === "employee"
  const isOwner = (role === "user" || role === "guest") && sessionUserId === orderUserId && orderUserId != null
  const isAnonOnPublicOrder = role === "anonymous" && orderUserId == null

  const canEdit = isAdmin || (isEmployee && stateId <= 2) || ((isOwner || isAnonOnPublicOrder) && stateId <= 2)
  // isReadOnly: true when the viewer has no editing capability at all
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

  return {
    canEditLineItemPrices: isAdmin,
    canEditLineItemQty: canEdit,
    canAddRemoveLineItems: canEdit,
    canEditSetupCosts: isAdmin || (isEmployee && stateId <= 2),
    canEditDiscount: isAdmin,
    canSelectUser: isAdmin,
    isReadOnly,
    saveAction,
  }
}
