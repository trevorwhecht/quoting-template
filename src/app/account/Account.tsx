"use client"

import { useState, useTransition } from "react"
import { Eye, EyeOff, Loader2 } from "lucide-react"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"
import AccountOrderList from "./components/Account-OrderList"
import AccountResellerLicense from "./components/Account-ResellerLicense"

type Order = {
  id: number
  token: string | null
  nickname: string | null
  totalPrice: any
  dueDate: Date | null
  stateId: number
  state: { name: string; color: string | null }
}

type User = {
  id: string
  firstName: string
  lastName: string
  role: string
  resellerLicenseUrl: string | null
  resellerLicenseUploadedAt: Date | null
}

type Props = { user: User; orders: Order[] }

export default function Account({ user, orders }: Props) {
  const isGuest = user.role === "guest"
  const [showPasswordDialog, setShowPasswordDialog] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [pwError, setPwError] = useState<string | null>(null)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)

  function handleSetPassword(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setPwError(null)
    const form = new FormData(e.currentTarget)
    const password = form.get("password") as string
    const confirm = form.get("confirm") as string
    if (password !== confirm) { setPwError("Passwords do not match."); return }
    if (password.length < 8) { setPwError("Password must be at least 8 characters."); return }

    startTransition(async () => {
      const res = await fetch(`/api/users/${user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      })
      const json = await res.json()
      if (json.error) { setPwError(json.error); return }
      toast.success("Password set — you now have a full account.")
      setShowPasswordDialog(false)
    })
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-(--color-foreground)">My Orders</h1>
        <p className="text-sm text-(--color-muted) mt-0.5">{user.firstName} {user.lastName}</p>
      </div>

      {isGuest ? (
        <div className="rounded-lg border border-(--color-border) bg-(--color-surface) px-4 py-3 flex items-center justify-between gap-3">
          <p className="text-sm text-(--color-muted)">
            You&rsquo;re browsing as a guest — set a password to secure your account.
          </p>
          <Button size="sm" variant="outline" onClick={() => setShowPasswordDialog(true)}>
            Set Password
          </Button>
        </div>
      ) : null}

      <AccountOrderList orders={orders} />

      <AccountResellerLicense
        userId={user.id}
        licenseUrl={user.resellerLicenseUrl}
        uploadedAt={user.resellerLicenseUploadedAt}
      />

      <Dialog open={showPasswordDialog} onOpenChange={setShowPasswordDialog}>
        <DialogContent className="bg-(--color-background)">
          <DialogHeader>
            <DialogTitle>Set a Password</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSetPassword} className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="account-pw">New Password</Label>
              <div className="relative">
                <Input id="account-pw" name="password" type={showPassword ? "text" : "password"} autoComplete="new-password" required minLength={8} className="text-base pr-10" />
                <button
                  type="button"
                  onClick={() => setShowPassword(prev => !prev)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-(--color-muted) hover:text-(--color-foreground)"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="account-pw-confirm">Confirm Password</Label>
              <div className="relative">
                <Input id="account-pw-confirm" name="confirm" type={showConfirmPassword ? "text" : "password"} autoComplete="new-password" required className="text-base pr-10" />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(prev => !prev)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-(--color-muted) hover:text-(--color-foreground)"
                  aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                >
                  {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
            {pwError ? <p className="text-sm text-(--color-danger)" role="alert">{pwError}</p> : null}
            <DialogFooter className="pb-[max(1rem,env(safe-area-inset-bottom))]">
              <Button variant="outline" type="button" onClick={() => setShowPasswordDialog(false)}>Cancel</Button>
              <Button autoFocus type="submit" disabled={isPending} className="gap-2">
                {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {isPending ? "Saving…" : "Set Password"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
