/// <reference types="vitest/globals" />
import { getQuoteBuilderPermissions } from "./quoteBuilderPermissions"

describe("getQuoteBuilderPermissions", () => {
  describe("admin", () => {
    it("has full edit access regardless of state", () => {
      const p = getQuoteBuilderPermissions({ role: "admin", stateId: 5, orderUserId: "u1", sessionUserId: "u2" })
      expect(p.canEditLineItemPrices).toBe(true)
      expect(p.canEditLineItemQty).toBe(true)
      expect(p.canEditSetupCosts).toBe(true)
      expect(p.canEditDiscount).toBe(true)
      expect(p.canSelectUser).toBe(true)
      expect(p.isReadOnly).toBe(false)
      expect(p.saveAction).toBe("save")
    })
  })

  describe("employee", () => {
    it("can edit qty and setup costs but not prices, state 1", () => {
      const p = getQuoteBuilderPermissions({ role: "employee", stateId: 1, orderUserId: "u1", sessionUserId: "e1" })
      expect(p.canEditLineItemPrices).toBe(false)
      expect(p.canEditLineItemQty).toBe(true)
      expect(p.canEditSetupCosts).toBe(true)
      expect(p.canEditDiscount).toBe(false)
      expect(p.saveAction).toBe("save")
    })

    it("is read-only at state 3+", () => {
      const p = getQuoteBuilderPermissions({ role: "employee", stateId: 3, orderUserId: "u1", sessionUserId: "e1" })
      expect(p.isReadOnly).toBe(true)
      expect(p.canEditSetupCosts).toBe(false)
      expect(p.saveAction).toBe("none")
    })
  })

  describe("user (owner)", () => {
    it("can edit qty at state 1, save action is save", () => {
      const p = getQuoteBuilderPermissions({ role: "user", stateId: 1, orderUserId: "u1", sessionUserId: "u1" })
      expect(p.canEditLineItemQty).toBe(true)
      expect(p.canEditLineItemPrices).toBe(false)
      expect(p.canEditSetupCosts).toBe(false)
      expect(p.saveAction).toBe("save")
    })

    it("can edit qty at state 2, save action reverts state", () => {
      const p = getQuoteBuilderPermissions({ role: "user", stateId: 2, orderUserId: "u1", sessionUserId: "u1" })
      expect(p.canEditLineItemQty).toBe(true)
      expect(p.saveAction).toBe("revert_state")
    })

    it("is read-only at state 3+", () => {
      const p = getQuoteBuilderPermissions({ role: "user", stateId: 3, orderUserId: "u1", sessionUserId: "u1" })
      expect(p.isReadOnly).toBe(true)
      expect(p.saveAction).toBe("none")
    })
  })

  describe("anonymous on no-userId order", () => {
    it("can edit qty at state 1, save action is login", () => {
      const p = getQuoteBuilderPermissions({ role: "anonymous", stateId: 1, orderUserId: null, sessionUserId: null })
      expect(p.canEditLineItemQty).toBe(true)
      expect(p.saveAction).toBe("login")
    })
  })

  describe("anonymous on userId order", () => {
    it("is fully read-only", () => {
      const p = getQuoteBuilderPermissions({ role: "anonymous", stateId: 1, orderUserId: "u1", sessionUserId: null })
      expect(p.canEditLineItemQty).toBe(false)
      expect(p.isReadOnly).toBe(true)
      expect(p.saveAction).toBe("none")
    })
  })
})
