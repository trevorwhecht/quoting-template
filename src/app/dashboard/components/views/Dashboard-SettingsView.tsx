"use client"

import { useEffect, useState, useTransition } from "react"
import { toast } from "sonner"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import DashboardSettingsViewSetupFeePresets from "./Dashboard-SettingsView-SetupFeePresets"
import DashboardSettingsViewLineItemPresets from "./Dashboard-SettingsView-LineItemPresets"

type Access = "none" | "view" | "edit"

const ACCESS_KEYS = [
  { key: "employeeLineItemPriceAccess", label: "Line Item Price", description: "Whether employees can see / edit the unit price on order line items" },
  { key: "employeeLineItemCostAccess", label: "Line Item Cost", description: "Whether employees can see / edit the unit cost on order line items" },
  { key: "employeeSetupCostAccess", label: "Setup Cost (Cost Column)", description: "Whether employees can see / edit the internal cost on setup cost rows" },
] as const

export default function DashboardSettingsView() {
  const [permissions, setPermissions] = useState<Record<string, Access>>({
    employeeLineItemPriceAccess: "view",
    employeeLineItemCostAccess: "none",
    employeeSetupCostAccess: "edit",
  })
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then(({ data }) => {
        if (!data) return
        // Functional update avoids stale closure on `permissions` (rerender-functional-setstate)
        setPermissions((prev) => {
          const next = { ...prev }
          for (const item of data) {
            if (item.setting in next) next[item.setting] = item.value as Access
          }
          return next
        })
      })
  }, [])

  function handleAccessChange(key: string, value: Access) {
    const prev = permissions[key]
    setPermissions((p) => ({ ...p, [key]: value }))
    startTransition(async () => {
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ setting: key, value }),
      })
      const json = await res.json()
      if (json.error) {
        toast.error(json.error)
        setPermissions((p) => ({ ...p, [key]: prev as Access }))
      }
    })
  }

  return (
    <div className="p-6 max-w-4xl space-y-10">
      <h2 className="text-xl font-semibold text-(--color-foreground)">Settings</h2>
      <DashboardSettingsViewLineItemPresets />
      <DashboardSettingsViewSetupFeePresets />

      <div className="space-y-4">
        <div>
          <h3 className="text-base font-semibold text-(--color-foreground)">Employee Permissions</h3>
          <p className="text-sm text-(--color-muted) mt-0.5">Control what employees can see and edit in the quote builder.</p>
        </div>
        <div className="rounded-lg border border-(--color-border) overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-(--color-border) bg-(--color-surface)">
                <th className="text-left px-4 py-2.5 font-medium text-(--color-muted)">Field</th>
                <th className="text-left px-4 py-2.5 font-medium text-(--color-muted)">Description</th>
                <th className="text-left px-4 py-2.5 font-medium text-(--color-muted) w-36">Access</th>
              </tr>
            </thead>
            <tbody>
              {ACCESS_KEYS.map(({ key, label, description }) => (
                <tr key={key} className="border-b border-(--color-border) last:border-0">
                  <td className="px-4 py-3 font-medium text-(--color-foreground) whitespace-nowrap">{label}</td>
                  <td className="px-4 py-3 text-(--color-muted) text-xs">{description}</td>
                  <td className="px-4 py-3">
                    <Select
                      value={permissions[key] ?? "none"}
                      onValueChange={(v) => handleAccessChange(key, v as Access)}
                      disabled={isPending}
                    >
                      <SelectTrigger className="w-28 text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-(--color-background)">
                        <SelectItem value="none">Hidden</SelectItem>
                        <SelectItem value="view">View Only</SelectItem>
                        <SelectItem value="edit">Editable</SelectItem>
                      </SelectContent>
                    </Select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-(--color-muted)">
          <strong>Hidden</strong> — field stripped from API response and not shown in UI. &nbsp;
          <strong>View Only</strong> — visible but read-only. &nbsp;
          <strong>Editable</strong> — fully editable.
        </p>
      </div>
    </div>
  )
}
