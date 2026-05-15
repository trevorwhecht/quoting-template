"use client"

import { useState, useEffect, useTransition } from "react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { toast } from "sonner"
import { format } from "date-fns"
import type { UserSummary } from "@/models/user"

export default function DashboardUsersView() {
  const [users, setUsers] = useState<UserSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    fetch("/api/users").then((r) => r.json()).then((json) => {
      setLoading(false)
      if (!json.error) setUsers(json.data)
    })
  }, [])

  function handleRoleChange(userId: string, role: string) {
    startTransition(async () => {
      const res = await fetch(`/api/users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role }),
      })
      const json = await res.json()
      if (json.error) { toast.error(json.error); return }
      setUsers((prev) => prev.map((u) => u.id === userId ? { ...u, role: json.data.role } : u))
      toast.success("Role updated")
    })
  }

  const filtered = users.filter((u) => {
    const q = search.toLowerCase()
    return (
      u.email.toLowerCase().includes(q) ||
      u.firstName.toLowerCase().includes(q) ||
      u.lastName.toLowerCase().includes(q)
    )
  })

  if (loading) return <div className="p-4 space-y-2">{[1,2,3,4].map(i => <Skeleton key={i} className="h-14 rounded-lg" />)}</div>

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-(--color-foreground)">Users ({filtered.length})</h2>
        <Input
          placeholder="Search name or email…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs text-base"
          inputMode="search"
        />
      </div>

      <div className="w-full overflow-x-auto">
        <table className="min-w-[640px] w-full text-sm">
          <thead>
            <tr className="border-b border-(--color-border) text-left">
              <th className="pb-2 font-medium text-(--color-muted) pr-4 whitespace-nowrap">Name</th>
              <th className="pb-2 font-medium text-(--color-muted) pr-4 whitespace-nowrap">Email</th>
              <th className="pb-2 font-medium text-(--color-muted) pr-4 whitespace-nowrap">Role</th>
              <th className="pb-2 font-medium text-(--color-muted) pr-4 whitespace-nowrap">Joined</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((user) => (
              <tr key={user.id} className="border-b border-(--color-border)">
                <td className="py-3 pr-4 whitespace-nowrap font-medium">
                  {user.firstName} {user.lastName}
                </td>
                <td className="py-3 pr-4 text-(--color-muted) whitespace-nowrap">{user.email}</td>
                <td className="py-3 pr-4 whitespace-nowrap">
                  <Select
                    value={user.role}
                    onValueChange={(v) => v && handleRoleChange(user.id, v)}
                    disabled={isPending}
                  >
                    <SelectTrigger className="h-8 w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="user">User</SelectItem>
                      <SelectItem value="employee">Employee</SelectItem>
                      <SelectItem value="admin">Admin</SelectItem>
                    </SelectContent>
                  </Select>
                </td>
                <td className="py-3 whitespace-nowrap text-(--color-muted)">
                  {format(new Date(user.createdAt), "MMM d, yyyy")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
