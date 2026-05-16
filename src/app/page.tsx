import Link from "next/link"
import { Button } from "@/components/ui/button"

export default function Home() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100dvh-3.5rem)] px-4 text-center">
      <h1 className="text-4xl font-bold tracking-tight text-(--color-foreground) mb-4">
        Welcome
      </h1>
      <p className="text-lg text-(--color-muted) mb-8 max-w-md">
        Get a quote for your project or sign in to manage your orders.
      </p>
      <div className="flex gap-4 flex-col sm:flex-row">
        <Button
          size="lg"
          nativeButton={false}
          render={<Link href="/get-quote" />}
        >
          Get a Quote
        </Button>
        <Button
          variant="outline"
          size="lg"
          nativeButton={false}
          render={<Link href="/login" />}
        >
          Sign In
        </Button>
      </div>
    </div>
  )
}
