"use client"

import { useEffect, useState } from "react"
import dynamic from "next/dynamic"
import { Skeleton } from "@/components/ui/skeleton"

// Dynamic imports — recharts is heavy, do NOT load it on initial bundle
const BarChart = dynamic(() => import("recharts").then((m) => m.BarChart), { ssr: false })
const Bar = dynamic(() => import("recharts").then((m) => m.Bar), { ssr: false })
const LineChart = dynamic(() => import("recharts").then((m) => m.LineChart), { ssr: false })
const Line = dynamic(() => import("recharts").then((m) => m.Line), { ssr: false })
const XAxis = dynamic(() => import("recharts").then((m) => m.XAxis), { ssr: false })
const YAxis = dynamic(() => import("recharts").then((m) => m.YAxis), { ssr: false })
const CartesianGrid = dynamic(() => import("recharts").then((m) => m.CartesianGrid), { ssr: false })
const Tooltip = dynamic(() => import("recharts").then((m) => m.Tooltip), { ssr: false })
const ResponsiveContainer = dynamic(() => import("recharts").then((m) => m.ResponsiveContainer), { ssr: false })

type InsightsData = {
  revenueByMonth: { month: string; revenue: number; profit: number }[]
  ordersByState: { stateId: number; stateName: string; count: number }[]
  paymentsByChannel: { channel: string; total: number; count: number }[]
}

export default function DashboardInsightsView() {
  const [data, setData] = useState<InsightsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch("/api/insights")
      .then((r) => r.json())
      .then((json) => {
        setLoading(false)
        if (json.error) { setError(json.error); return }
        setData(json.data)
      })
      .catch(() => {
        setLoading(false)
        setError("Failed to load insights")
      })
  }, [])

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-64 rounded-lg" />
        <div className="grid grid-cols-2 gap-4">
          <Skeleton className="h-48 rounded-lg" />
          <Skeleton className="h-48 rounded-lg" />
        </div>
      </div>
    )
  }

  if (error) return <div className="p-6 text-(--color-danger) text-sm">{error}</div>
  if (!data) return null

  return (
    <div className="p-6 space-y-8">
      <h2 className="text-xl font-semibold text-(--color-foreground)">Insights</h2>

      {/* Revenue & Profit over time */}
      <div>
        <h3 className="text-sm font-semibold text-(--color-muted) uppercase tracking-wider mb-3">Revenue & Profit (last 12 months)</h3>
        <div className="rounded-lg border border-(--color-border) p-4 h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data.revenueByMonth}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v: any) => v != null ? `$${v.toFixed(2)}` : ""} />
              <Line type="monotone" dataKey="revenue" stroke="var(--color-primary)" strokeWidth={2} dot={false} name="Revenue" />
              <Line type="monotone" dataKey="profit" stroke="var(--color-success)" strokeWidth={2} dot={false} name="Profit" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Orders by state */}
        <div>
          <h3 className="text-sm font-semibold text-(--color-muted) uppercase tracking-wider mb-3">Orders by State</h3>
          <div className="rounded-lg border border-(--color-border) p-4 h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.ordersByState}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                <XAxis dataKey="stateName" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="count" fill="var(--color-primary)" name="Orders" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Payments by channel */}
        <div>
          <h3 className="text-sm font-semibold text-(--color-muted) uppercase tracking-wider mb-3">Payments by Channel</h3>
          <div className="rounded-lg border border-(--color-border) p-4 h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.paymentsByChannel}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                <XAxis dataKey="channel" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v: any) => v != null ? `$${v.toFixed(2)}` : ""} />
                <Bar dataKey="total" fill="var(--color-accent)" name="Total ($)" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  )
}
