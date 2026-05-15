"use client"

import { useSession } from "next-auth/react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { Menu, X, UserRound } from "lucide-react"
import { cn } from "@/lib/utils"
import NavbarAccountPanel from "./Navbar-AccountPanel"

export default function NavbarLinks() {
  const { data: session } = useSession()
  const router = useRouter()
  const [navOpen, setNavOpen] = useState(false)
  const [accountOpen, setAccountOpen] = useState(false)

  const role = session?.user?.role
  const isStaff = role === "admin" || role === "employee"

  function closeAll() {
    setNavOpen(false)
    setAccountOpen(false)
  }

  function navigate(href: string) {
    closeAll()
    router.push(href)
  }

  return (
    <>
      {/* Backdrop — closes any open panel on outside click */}
      {(navOpen || accountOpen) ? (
        <div className="fixed inset-0 z-30" onClick={closeAll} />
      ) : null}

      {/* Top bar: [left: hamburger? + logo + nav links] [right: account icon] */}
      <div className="h-14 flex items-center justify-between relative z-40">

        {/* Left group */}
        <div className="flex items-center gap-4">
          {/* Mobile hamburger */}
          <button
            className="md:hidden min-h-11 min-w-11 flex items-center justify-center rounded-md text-(--color-foreground) hover:bg-(--color-surface) transition-colors motion-reduce:transition-none touch-manipulation"
            onClick={() => { setNavOpen(p => !p); setAccountOpen(false) }}
            aria-label={navOpen ? "Close navigation" : "Open navigation"}
            aria-expanded={navOpen}
          >
            <div className="relative w-5 h-5">
              <Menu className={cn(
                "absolute inset-0 w-5 h-5 transition-[opacity,transform] duration-200 motion-reduce:transition-none",
                navOpen ? "opacity-0 rotate-90 scale-75" : "opacity-100 rotate-0 scale-100"
              )} />
              <X className={cn(
                "absolute inset-0 w-5 h-5 transition-[opacity,transform] duration-200 motion-reduce:transition-none",
                navOpen ? "opacity-100 rotate-0 scale-100" : "opacity-0 -rotate-90 scale-75"
              )} />
            </div>
          </button>

          {/* Logo */}
          <Link href="/" onClick={closeAll} className="font-semibold text-(--color-foreground) text-lg tracking-tight shrink-0">
            QuotingApp
          </Link>

          {/* Desktop nav links — immediately after logo */}
          <nav className="hidden md:flex items-center gap-6">
            <DesktopLink href="/get-quote" onClick={closeAll}>Get Quote</DesktopLink>
            {isStaff ? (
              <DesktopLink href="/dashboard" onClick={closeAll}>Dashboard</DesktopLink>
            ) : null}
            {session && !isStaff ? (
              <DesktopLink href="/account" onClick={closeAll}>My Orders</DesktopLink>
            ) : null}
          </nav>
        </div>

        {/* Right group: account icon always on far right */}
        <button
          className="min-h-11 min-w-11 flex items-center justify-center rounded-md text-(--color-foreground) hover:bg-(--color-surface) transition-colors motion-reduce:transition-none touch-manipulation"
          onClick={() => { setAccountOpen(p => !p); setNavOpen(false) }}
          aria-label={accountOpen ? "Close account menu" : "Open account menu"}
          aria-expanded={accountOpen}
        >
          <div className="relative w-5 h-5">
            <UserRound className={cn(
              "absolute inset-0 w-5 h-5 transition-[opacity,transform] duration-200 motion-reduce:transition-none",
              accountOpen ? "opacity-0 rotate-90 scale-75" : "opacity-100 rotate-0 scale-100"
            )} />
            <X className={cn(
              "absolute inset-0 w-5 h-5 transition-[opacity,transform] duration-200 motion-reduce:transition-none",
              accountOpen ? "opacity-100 rotate-0 scale-100" : "opacity-0 -rotate-90 scale-75"
            )} />
          </div>
        </button>
      </div>

      {/* Mobile nav panel */}
      <div
        className={cn(
          "absolute top-full left-0 right-0 md:hidden",
          "bg-(--color-background) border-b border-(--color-border) shadow-lg z-40",
          "transition-[opacity,transform] duration-200 ease-out motion-reduce:transition-none",
          navOpen
            ? "opacity-100 translate-y-0 pointer-events-auto"
            : "opacity-0 -translate-y-2 pointer-events-none"
        )}
      >
        <nav className="flex flex-col py-2">
          <MobileLink href="/get-quote" onClick={closeAll}>Get Quote</MobileLink>
          {isStaff ? (
            <MobileLink href="/dashboard" onClick={closeAll}>Dashboard</MobileLink>
          ) : null}
          {session && !isStaff ? (
            <MobileLink href="/account" onClick={closeAll}>My Orders</MobileLink>
          ) : null}
        </nav>
      </div>

      {/* Account panel */}
      <NavbarAccountPanel isOpen={accountOpen} onClose={closeAll} navigate={navigate} />
    </>
  )
}

function DesktopLink({ href, onClick, children }: { href: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className="text-base font-medium text-(--color-foreground) hover:text-(--color-primary) transition-colors motion-reduce:transition-none"
    >
      {children}
    </Link>
  )
}

function MobileLink({ href, onClick, children }: { href: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className="flex items-center px-4 py-3 text-base font-medium text-(--color-foreground) hover:bg-(--color-surface) transition-colors motion-reduce:transition-none touch-manipulation"
    >
      {children}
    </Link>
  )
}
