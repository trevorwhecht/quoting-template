"use client"

import { useState, useEffect, useCallback } from "react"
import type { OrderSummary } from "@/models/order"

export function useOrders() {
  const [orders, setOrders] = useState<OrderSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchOrders = useCallback(async () => {
    setLoading(true)
    setError(null)
    const res = await fetch("/api/orders")
    const json = await res.json()
    setLoading(false)
    if (json.error) { setError(json.error); return }
    setOrders(json.data)
  }, [])

  useEffect(() => { fetchOrders() }, [fetchOrders])

  return { orders, loading, error, refetch: fetchOrders }
}
