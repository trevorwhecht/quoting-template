import type { Metadata, Viewport } from "next"
import "./globals.css"
import SessionWrapper from "@/components/shared/layout/SessionWrapper"
import Navbar from "@/components/shared/layout/Navbar"
import { Toaster } from "@/components/ui/sonner"

export const metadata: Metadata = {
  title: "Quoting Template",
  description: "Order and quote management",
}

// Required for env(safe-area-inset-bottom) to work on iOS — dialogs and sheets need this
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen flex flex-col bg-(--color-background) text-(--color-foreground) antialiased">
        <SessionWrapper>
          <Navbar />
          <main className="flex-1">{children}</main>
          <Toaster />
        </SessionWrapper>
      </body>
    </html>
  )
}
