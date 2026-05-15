"use client"

import { useState, useEffect, useCallback } from "react"
import type { OrderStateModel } from "@/models/orderState"

export function useOrderStates() {
  const [orderStates, setOrderStates] = useState<OrderStateModel[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchOrderStates = useCallback(async () => {
    setLoading(true)
    setError(null)
    const res = await fetch("/api/order-states")
    const json = await res.json()
    setLoading(false)
    if (json.error) { setError(json.error); return }
    setOrderStates(json.data)
  }, [])

  useEffect(() => { fetchOrderStates() }, [fetchOrderStates])

  const updateState = useCallback((updated: OrderStateModel) => {
    setOrderStates((prev) => prev.map((s) => s.id === updated.id ? updated : s))
  }, [])

  return { orderStates, loading, error, refetch: fetchOrderStates, updateState }
}
