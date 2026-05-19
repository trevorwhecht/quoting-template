"use client"

import { useRef, useTransition } from "react"
import { Loader2, FileText } from "lucide-react"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import { useRouter } from "next/navigation"
import { format } from "date-fns"

type Props = {
  userId: string
  licenseUrl: string | null
  uploadedAt: Date | null
}

export default function AccountResellerLicense({ userId, licenseUrl, uploadedAt }: Props) {
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const [isPending, startTransition] = useTransition()

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ""

    startTransition(async () => {
      try {
        const formData = new FormData()
        formData.append("file", file)

        const res = await fetch(`/api/users/${userId}/reseller-license/upload`, {
          method: "POST",
          body: formData,
        })
        const json = await res.json()
        if (json.error) { toast.error(json.error); return }
        toast.success("License uploaded.")
        router.refresh()
      } catch {
        toast.error("Upload failed. Check your connection and try again.")
      }
    })
  }

  return (
    <div className="space-y-3">
      <h2 className="text-base font-semibold text-(--color-foreground)">Tax Exemption / Reseller License</h2>
      <div className="rounded-lg border border-(--color-border) p-4 flex items-center justify-between gap-4 bg-(--color-background)">
        {licenseUrl ? (
          <div className="flex items-center gap-2 text-sm">
            <FileText size={16} className="text-(--color-muted)" />
            <a
              href={licenseUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-(--color-primary) hover:underline"
            >
              View License
            </a>
            {uploadedAt ? (
              <span className="text-(--color-muted)">
                (uploaded {format(new Date(uploadedAt), "MMM d, yyyy")})
              </span>
            ) : null}
          </div>
        ) : (
          <p className="text-sm text-(--color-muted)">
            Upload a reseller license or tax exemption certificate to apply for tax deferral.
          </p>
        )}
        <div>
          <input
            ref={inputRef}
            type="file"
            accept=".pdf,.png,.jpg,.jpeg"
            className="hidden"
            onChange={handleFile}
          />
          <Button
            variant="outline"
            size="sm"
            disabled={isPending}
            onClick={() => inputRef.current?.click()}
            className="gap-2 shrink-0"
          >
            {isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
            {licenseUrl ? "Replace" : "Upload"}
          </Button>
        </div>
      </div>
    </div>
  )
}
