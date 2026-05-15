"use client"

import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { cn } from "@/lib/utils"
import { LayoutGrid, Calendar, CheckCircle, Archive, BarChart2, Users, Settings } from "lucide-react"

type Props = { role: string; firstName: string; lastName: string }

export default function DashboardSidebar({ role, firstName, lastName }: Props) {
  const searchParams = useSearchParams()
  const view = searchParams.get("view") ?? "orders"
  const isAdmin = role === "admin"

  return (
    <aside className="hidden md:flex flex-col w-14 lg:w-56 shrink-0 border-r border-(--color-border) bg-(--color-background) h-[calc(100dvh-3.5rem)] sticky top-14 overflow-y-auto p-2 gap-1">
      <div className="hidden lg:block px-3 py-3 mb-1 border-b border-(--color-border)">
        <p className="text-sm font-semibold capitalize">{role} Dashboard</p>
        <p className="text-xs text-(--color-muted)">{firstName} {lastName}</p>
      </div>
      <SidebarLink href="?view=orders" label="Orders" icon={<LayoutGrid size={16} />} active={view === "orders"} />
      <SubLink href="?view=calendar" label="Calendar" icon={<Calendar size={14} />} active={view === "calendar"} />
      <SubLink href="?view=complete" label="Complete" icon={<CheckCircle size={14} />} active={view === "complete"} />
      <SubLink href="?view=archive" label="Archive" icon={<Archive size={14} />} active={view === "archive"} />

      {isAdmin ? (
        <>
          <div className="my-1 mx-1 border-t border-(--color-border)" />
          <SidebarLink href="?view=insights" label="Insights" icon={<BarChart2 size={16} />} active={view === "insights"} />
          <SidebarLink href="?view=users" label="Users" icon={<Users size={16} />} active={view === "users"} />
          <SidebarLink href="?view=settings" label="Settings" icon={<Settings size={16} />} active={view === "settings"} />
        </>
      ) : null}
    </aside>
  )
}

type LinkProps = { href: string; label: string; icon: React.ReactNode; active: boolean }

function SidebarLink({ href, label, icon, active }: LinkProps) {
  return (
    <Link
      href={href}
      title={label}
      className={cn(
        "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors motion-reduce:transition-none",
        "justify-center lg:justify-start",
        active
          ? "bg-(--color-primary) text-(--color-primary-foreground)"
          : "text-(--color-foreground) hover:bg-(--color-surface)"
      )}
    >
      {icon}
      <span className="hidden lg:inline">{label}</span>
    </Link>
  )
}

function SubLink({ href, label, icon, active }: LinkProps) {
  return (
    <Link
      href={href}
      title={label}
      className={cn(
        "flex items-center rounded-md text-sm transition-colors motion-reduce:transition-none",
        "justify-center px-3 py-1.5",
        "lg:justify-start lg:pl-8 lg:pr-3",
        active
          ? "text-(--color-primary) font-semibold"
          : "text-(--color-muted) hover:text-(--color-foreground) hover:bg-(--color-surface)"
      )}
    >
      <span className="lg:hidden">{icon}</span>
      <span className="hidden lg:inline">{label}</span>
    </Link>
  )
}
