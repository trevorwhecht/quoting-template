"use client"

import { useEffect, useState } from "react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import type { UserSummary } from "@/models/user"

type Props = {
  selectedUserId: string | null
  nickname: string
  onUserChange: (id: string | null) => void
  onNicknameChange: (name: string) => void
}

export default function QuoteBuilderUserSelect({ selectedUserId, nickname, onUserChange, onNicknameChange }: Props) {
  const [users, setUsers] = useState<UserSummary[]>([])
  const [query, setQuery] = useState("")
  const [open, setOpen] = useState(false)

  useEffect(() => {
    fetch("/api/users")
      .then((r) => r.json())
      .then(({ data }) => { if (data) setUsers(data) })
  }, [])

  const selected = users.find((u) => u.id === selectedUserId)

  const filtered = query.trim()
    ? users.filter((u) =>
        `${u.firstName} ${u.lastName} ${u.email}`.toLowerCase().includes(query.toLowerCase())
      )
    : users.slice(0, 10)

  function selectUser(id: string | null) {
    onUserChange(id)
    setQuery("")
    setOpen(false)
  }

  return (
    <div className="border border-(--color-border) rounded-lg p-4 space-y-4 bg-(--color-background)">
      <h2 className="text-base font-semibold text-(--color-foreground)">Admin Settings</h2>

      <div className="space-y-1.5">
        <Label>Assign to User</Label>
        <div className="relative">
          <Input
            value={open ? query : (selected ? `${selected.firstName} ${selected.lastName} (${selected.email})` : "No Account Yet")}
            onChange={(e) => { setQuery(e.target.value); setOpen(true) }}
            onFocus={() => setOpen(true)}
            onBlur={() => setTimeout(() => setOpen(false), 150)}
            className="text-base"
            placeholder="Search by name or email…"
          />
          {open ? (
            <div className="absolute z-20 top-full left-0 right-0 mt-1 border border-(--color-border) rounded-md bg-(--color-background) shadow-md max-h-52 overflow-y-auto">
              <button
                type="button"
                className="w-full text-left px-3 py-2 text-sm hover:bg-(--color-surface) text-(--color-muted)"
                onMouseDown={() => selectUser(null)}
              >
                No Account Yet
              </button>
              {filtered.map((u) => (
                <button
                  key={u.id}
                  type="button"
                  className="w-full text-left px-3 py-2 text-sm hover:bg-(--color-surface)"
                  onMouseDown={() => selectUser(u.id)}
                >
                  <span className="font-medium">{u.firstName} {u.lastName}</span>
                  <span className="text-(--color-muted) ml-2 text-xs">{u.email}</span>
                </button>
              ))}
            </div>
          ) : null}
        </div>
      </div>

      <div className="space-y-1.5">
        <Label>Order Name / Nickname</Label>
        <Input
          value={nickname}
          onChange={(e) => onNicknameChange(e.target.value)}
          className="text-base"
          placeholder="e.g. Spring Merch Drop"
        />
      </div>
    </div>
  )
}
