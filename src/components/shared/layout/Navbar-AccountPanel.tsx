"use client"

import { useSession, signIn, signOut } from "next-auth/react"
import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"
import { Eye, EyeOff, LayoutGrid, BarChart2, Users, Settings, UserCog, LogOut } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import dynamic from "next/dynamic"
const ClaimModal = dynamic(() => import("@/components/shared/modals/ClaimModal"))

interface Props {
  isOpen: boolean
  onClose: () => void
  navigate: (href: string) => void
}

export default function NavbarAccountPanel({ isOpen, onClose, navigate }: Props) {
  const { data: session } = useSession()
  const router = useRouter()
  const [view, setView] = useState<"signin" | "signup">("signin")
  const [signInError, setSignInError] = useState<string | null>(null)
  const [signUpError, setSignUpError] = useState<string | null>(null)
  const [confirmError, setConfirmError] = useState<string | null>(null)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [showGuestModal, setShowGuestModal] = useState(false)

  const role = session?.user?.role
  const isStaff = role === "admin" || role === "employee"

  function switchView(next: "signin" | "signup") {
    setView(next)
    setSignInError(null)
    setSignUpError(null)
    setConfirmError(null)
    setShowPassword(false)
    setShowConfirmPassword(false)
  }

  function handleSignIn(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setSignInError(null)
    const form = new FormData(e.currentTarget)
    startTransition(async () => {
      const result = await signIn("credentials", {
        email: form.get("email") as string,
        password: form.get("password") as string,
        redirect: false,
      })
      if (result?.error) setSignInError("Invalid email or password.")
    })
  }

  function handleSignUp(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setSignUpError(null)
    setConfirmError(null)
    const form = new FormData(e.currentTarget)
    const password = form.get("password") as string
    const confirmPassword = form.get("confirmPassword") as string

    if (password !== confirmPassword) {
      setConfirmError("Passwords do not match.")
      return
    }

    const street = form.get("street") as string
    startTransition(async () => {
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: form.get("email"),
          password,
          firstName: form.get("firstName"),
          lastName: form.get("lastName"),
          phone: form.get("phone") || undefined,
          companyName: form.get("companyName") || undefined,
          address: street ? {
            street,
            city: form.get("city") as string,
            state: form.get("state") as string,
            zipCode: form.get("zipCode") as string,
          } : undefined,
        }),
      })
      const json = await res.json()
      if (json.error) { setSignUpError(json.error); return }
      const result = await signIn("credentials", {
        email: form.get("email") as string,
        password,
        redirect: false,
      })
      if (result?.error) {
        setSignUpError("Account created but sign-in failed — please sign in manually.")
        return
      }
      onClose()
      router.refresh()
      router.push("/account")
    })
  }

  return (
    <div
      className={cn(
        "absolute top-full right-0 left-0 sm:left-auto sm:w-80",
        "max-h-[calc(100dvh-3.5rem)] overflow-y-auto",
        "bg-(--color-background) border-b sm:border border-(--color-border) sm:rounded-b-lg shadow-lg z-40",
        "transition-[opacity,transform] duration-200 ease-out motion-reduce:transition-none",
        isOpen ? "opacity-100 translate-y-0 pointer-events-auto" : "opacity-0 -translate-y-2 pointer-events-none"
      )}
    >
      {session ? (
        <div className="flex flex-col">
          <div className="px-4 py-3 border-b border-(--color-border)">
            <p className="text-xs text-(--color-muted) capitalize">{session.user.role}</p>
            <p className="text-sm font-semibold text-(--color-foreground)">
              {session.user.firstName} {session.user.lastName}
            </p>
          </div>
          <div className="py-2">
            {isStaff ? (
              <>
                <PanelItem icon={<LayoutGrid className="h-4 w-4" />} onClick={() => navigate("/dashboard?view=orders")}>Orders</PanelItem>
                <PanelSubItem onClick={() => navigate("/dashboard?view=calendar")}>Calendar</PanelSubItem>
                <PanelSubItem onClick={() => navigate("/dashboard?view=complete")}>Complete</PanelSubItem>
                <PanelSubItem onClick={() => navigate("/dashboard?view=archive")}>Archive</PanelSubItem>
                {role === "admin" ? (
                  <>
                    <PanelItem icon={<BarChart2 className="h-4 w-4" />} onClick={() => navigate("/dashboard?view=insights")}>Insights</PanelItem>
                    <PanelItem icon={<Users className="h-4 w-4" />} onClick={() => navigate("/dashboard?view=users")}>Users</PanelItem>
                    <PanelItem icon={<Settings className="h-4 w-4" />} onClick={() => navigate("/dashboard?view=settings")}>Settings</PanelItem>
                  </>
                ) : null}
              </>
            ) : (
              <>
                <PanelItem icon={<LayoutGrid className="h-4 w-4" />} onClick={() => navigate("/account")}>Orders</PanelItem>
                <PanelItem icon={<UserCog className="h-4 w-4" />} onClick={() => navigate("/account/settings")}>Account Settings</PanelItem>
              </>
            )}
            <button
              className="flex items-center gap-3 px-4 py-3 text-sm font-medium text-(--color-danger) hover:bg-(--color-surface) transition-colors motion-reduce:transition-none w-full text-left touch-manipulation"
              onClick={() => { onClose(); signOut({ callbackUrl: "/" }) }}
            >
              <LogOut className="h-4 w-4" />
              Sign Out
            </button>
          </div>
        </div>
      ) : view === "signup" ? (
        <div className="p-4">
          <h3 className="font-semibold text-sm mb-3">Create Account</h3>
          <form onSubmit={handleSignUp} className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <Field id="panel-firstName" label="First Name">
                <Input id="panel-firstName" name="firstName" autoComplete="given-name" required className="text-base h-9" />
              </Field>
              <Field id="panel-lastName" label="Last Name">
                <Input id="panel-lastName" name="lastName" autoComplete="family-name" required className="text-base h-9" />
              </Field>
            </div>
            <Field id="panel-phone" label="Phone (optional)">
              <Input id="panel-phone" name="phone" type="tel" inputMode="tel" autoComplete="tel" className="text-base h-9" />
            </Field>
            <Field id="panel-email" label="Email">
              <Input id="panel-email" name="email" type="email" inputMode="email" autoComplete="email" required className="text-base h-9" />
            </Field>
            <Field id="panel-company" label="Company (optional)">
              <Input id="panel-company" name="companyName" autoComplete="organization" className="text-base h-9" />
            </Field>
            <Field id="panel-street" label="Address (optional)">
              <Input id="panel-street" name="street" autoComplete="street-address" className="text-base h-9" />
            </Field>
            <div className="grid grid-cols-2 gap-2">
              <Field id="panel-city" label="City">
                <Input id="panel-city" name="city" autoComplete="address-level2" className="text-base h-9" />
              </Field>
              <Field id="panel-state" label="State">
                <Input id="panel-state" name="state" autoComplete="address-level1" className="text-base h-9" />
              </Field>
            </div>
            <Field id="panel-zip" label="Zip Code">
              <Input id="panel-zip" name="zipCode" inputMode="numeric" autoComplete="postal-code" className="text-base h-9" />
            </Field>
            <Field id="panel-signup-password" label="Password">
              <div className="relative">
                <Input id="panel-signup-password" name="password" type={showPassword ? "text" : "password"} autoComplete="new-password" required minLength={8} className="text-base h-9 pr-10" />
                <EyeToggle show={showPassword} onToggle={() => setShowPassword(p => !p)} />
              </div>
            </Field>
            <Field id="panel-confirm-password" label="Confirm Password">
              <div className="relative">
                <Input id="panel-confirm-password" name="confirmPassword" type={showConfirmPassword ? "text" : "password"} autoComplete="new-password" required className="text-base h-9 pr-10" />
                <EyeToggle show={showConfirmPassword} onToggle={() => setShowConfirmPassword(p => !p)} />
              </div>
              {confirmError ? <p className="text-xs text-(--color-danger) mt-1" role="alert">{confirmError}</p> : null}
            </Field>
            {signUpError ? <p className="text-xs text-(--color-danger)" role="alert">{signUpError}</p> : null}
            <Button type="submit" className="w-full" size="sm" disabled={isPending}>
              {isPending ? "Creating…" : "Create Account"}
            </Button>
            <div className="text-center">
              <button
                type="button"
                onClick={() => switchView("signin")}
                className="text-xs text-(--color-muted) hover:text-(--color-foreground) underline transition-colors motion-reduce:transition-none touch-manipulation"
              >
                Back to Sign In
              </button>
            </div>
          </form>
        </div>
      ) : (
        <div className="p-4">
          <h3 className="font-semibold text-sm mb-3">Sign In</h3>
          <form onSubmit={handleSignIn} className="space-y-3">
            <Field id="panel-signin-email" label="Email">
              <Input id="panel-signin-email" name="email" type="email" inputMode="email" autoComplete="email" required className="text-base h-9" />
            </Field>
            <Field id="panel-signin-password" label="Password">
              <div className="relative">
                <Input id="panel-signin-password" name="password" type={showPassword ? "text" : "password"} autoComplete="current-password" required className="text-base h-9 pr-10" />
                <EyeToggle show={showPassword} onToggle={() => setShowPassword(p => !p)} />
              </div>
            </Field>
            {signInError ? <p className="text-xs text-(--color-danger)" role="alert">{signInError}</p> : null}
            <Button type="submit" className="w-full" size="sm" disabled={isPending}>
              {isPending ? "Signing in…" : "Sign In"}
            </Button>
            <div className="flex justify-between items-center">
              <button
                type="button"
                onClick={() => switchView("signup")}
                className="text-xs text-(--color-muted) hover:text-(--color-foreground) transition-colors motion-reduce:transition-none touch-manipulation"
              >
                Create Account
              </button>
              {/* TODO[7]: Forgot Password — send a time-limited reset link to the user's email.
                  Requires: email provider (Resend/Nodemailer), PasswordResetToken table in schema,
                  POST /api/auth/forgot-password handler, GET /reset-password?token=XXX page. */}
              <button type="button" disabled className="text-xs text-(--color-muted) opacity-40 cursor-not-allowed">
                Forgot Password?
              </button>
            </div>
            <div className="pt-1 border-t border-(--color-border) mt-3">
              <button
                type="button"
                onClick={() => { onClose(); setShowGuestModal(true) }}
                className="w-full py-2 text-sm text-(--color-muted) hover:text-(--color-foreground) transition-colors motion-reduce:transition-none touch-manipulation"
              >
                Continue as Guest
              </button>
            </div>
          </form>
        </div>
      )}
      <ClaimModal
        open={showGuestModal}
        onOpenChange={setShowGuestModal}
        redirectPath="/"
      />
    </div>
  )
}

function Field({ id, label, children }: { id: string; label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label htmlFor={id} className="text-xs">{label}</Label>
      {children}
    </div>
  )
}

function EyeToggle({ show, onToggle }: { show: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="absolute right-3 top-1/2 -translate-y-1/2 text-(--color-muted) hover:text-(--color-foreground)"
      aria-label={show ? "Hide password" : "Show password"}
    >
      {show ? <EyeOff size={14} /> : <Eye size={14} />}
    </button>
  )
}

function PanelItem({ icon, onClick, children }: { icon: React.ReactNode; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      className="flex items-center gap-3 px-4 py-3 text-sm font-medium text-(--color-foreground) hover:bg-(--color-surface) transition-colors motion-reduce:transition-none w-full text-left touch-manipulation"
      onClick={onClick}
    >
      {icon}
      {children}
    </button>
  )
}

function PanelSubItem({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      className="flex items-center pl-11 pr-4 py-2 text-xs text-(--color-muted) hover:text-(--color-foreground) hover:bg-(--color-surface) transition-colors motion-reduce:transition-none w-full text-left touch-manipulation"
      onClick={onClick}
    >
      {children}
    </button>
  )
}
