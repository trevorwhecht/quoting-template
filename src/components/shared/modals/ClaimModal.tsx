"use client"

import { useState, useTransition } from "react"
import { signIn } from "next-auth/react"
import { useRouter } from "next/navigation"
import { Loader2 } from "lucide-react"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"

type Tab = "signin" | "register" | "guest"

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  orderId?: number
  redirectPath?: string
  onSuccess?: () => void
}

const EMPTY_GUEST = { firstName: "", lastName: "", email: "", phone: "", company: "" }

export default function ClaimModal({ open, onOpenChange, orderId, redirectPath, onSuccess }: Props) {
  const router = useRouter()
  const [tab, setTab] = useState<Tab>("signin")
  const [isPending, startTransition] = useTransition()
  const [guest, setGuest] = useState(EMPTY_GUEST)

  function handleOpenChange(next: boolean) {
    if (!next) setGuest(EMPTY_GUEST)
    onOpenChange(next)
  }

  function handleGuestSubmit(e: React.FormEvent) {
    e.preventDefault()
    startTransition(async () => {
      const createRes = await fetch("/api/users/guest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(guest),
      })
      const createJson = await createRes.json()
      if (createJson.error) { toast.error(createJson.error); return }

      const signInResult = await signIn("guest", { email: guest.email, redirect: false })
      if (signInResult?.error) { toast.error("Sign-in failed — try again."); return }

      if (orderId) {
        await fetch(`/api/orders/${orderId}/claim`, { method: "POST" })
      }

      handleOpenChange(false)
      router.refresh()
      onSuccess?.()
    })
  }

  const signInHref = `/login?redirect=${encodeURIComponent(redirectPath ?? "/")}`
  const registerHref = `/register${orderId ? `?claimToken=${orderId}` : ""}`

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="bg-(--color-background) sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Sign in to continue</DialogTitle>
        </DialogHeader>

        {/* Tab bar */}
        <div className="flex gap-1 rounded-lg border border-(--color-border) p-1">
          {(["signin", "register", "guest"] as Tab[]).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={`flex-1 rounded-md py-1.5 text-sm transition-colors motion-reduce:transition-none ${
                tab === t
                  ? "bg-(--color-primary) text-(--color-primary-foreground)"
                  : "text-(--color-muted) hover:text-(--color-foreground)"
              }`}
            >
              {t === "signin" ? "Sign In" : t === "register" ? "Register" : "Guest"}
            </button>
          ))}
        </div>

        {tab === "signin" ? (
          <div className="space-y-3 py-2 text-center">
            <p className="text-sm text-(--color-muted)">Sign in to your existing account to continue.</p>
            <Button render={<a href={signInHref} />} className="w-full">
              Go to Sign In
            </Button>
          </div>
        ) : tab === "register" ? (
          <div className="space-y-3 py-2 text-center">
            <p className="text-sm text-(--color-muted)">Create a new account to save your order and access it later.</p>
            <Button render={<a href={registerHref} />} className="w-full">
              Create Account
            </Button>
          </div>
        ) : (
          <form onSubmit={handleGuestSubmit} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>First Name *</Label>
                <Input
                  value={guest.firstName}
                  onChange={(e) => setGuest((g) => ({ ...g, firstName: e.target.value }))}
                  className="text-base"
                  autoComplete="given-name"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label>Last Name *</Label>
                <Input
                  value={guest.lastName}
                  onChange={(e) => setGuest((g) => ({ ...g, lastName: e.target.value }))}
                  className="text-base"
                  autoComplete="family-name"
                  required
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Email *</Label>
              <Input
                type="email"
                inputMode="email"
                autoComplete="email"
                value={guest.email}
                onChange={(e) => setGuest((g) => ({ ...g, email: e.target.value }))}
                className="text-base"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label>Phone *</Label>
              <Input
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                value={guest.phone}
                onChange={(e) => setGuest((g) => ({ ...g, phone: e.target.value }))}
                className="text-base"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label>
                Company{" "}
                <span className="font-normal text-(--color-muted)">(optional)</span>
              </Label>
              <Input
                autoComplete="organization"
                value={guest.company}
                onChange={(e) => setGuest((g) => ({ ...g, company: e.target.value }))}
                className="text-base"
              />
            </div>
            <Button type="submit" disabled={isPending} className="w-full gap-2">
              {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {isPending ? "Continuing…" : "Continue as Guest"}
            </Button>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}
