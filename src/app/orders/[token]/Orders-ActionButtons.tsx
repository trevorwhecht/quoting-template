"use client"

import { useState } from "react"
import dynamic from "next/dynamic"
import { Share2 } from "lucide-react"
import { useSession } from "next-auth/react"
import { Button } from "@/components/ui/button"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog"
import { toast } from "sonner"
const ClaimModal = dynamic(() => import("@/components/shared/modals/ClaimModal"))

type Props = {
  orderId: number
  totalDueNow: number
  showDueNow: boolean
  shareUrl: string
}

export default function OrdersActionButtons({ orderId, totalDueNow, showDueNow, shareUrl }: Props) {
  const { data: session } = useSession()
  const [dueNowOpen, setDueNowOpen] = useState(false)
  const [claimOpen, setClaimOpen] = useState(false)

  function handleDueNowClick() {
    if (!session) {
      setClaimOpen(true)
    } else {
      setDueNowOpen(true)
    }
  }

  function handleShare() {
    navigator.clipboard.writeText(shareUrl)
    toast.success("Link copied to clipboard")
  }

  return (
    <div className="flex items-center gap-2 shrink-0">
      {showDueNow ? (
        <>
          <Button onClick={handleDueNowClick}>
            Due Now ${totalDueNow.toFixed(2)}
          </Button>
          <Dialog open={dueNowOpen} onOpenChange={setDueNowOpen}>
            <DialogContent className="bg-(--color-background)">
              <DialogHeader>
                <DialogTitle>Payment Request Received</DialogTitle>
                <DialogDescription>
                  Thanks — our team will confirm your payment details and reach out shortly.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter className="pb-[max(1rem,env(safe-area-inset-bottom))]">
                <Button autoFocus onClick={() => setDueNowOpen(false)}>Got it</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          <ClaimModal
            open={claimOpen}
            onOpenChange={setClaimOpen}
            orderId={orderId}
            onSuccess={() => setDueNowOpen(true)}
          />
        </>
      ) : null}

      <Button variant="outline" size="icon" onClick={handleShare} aria-label="Share order link">
        <Share2 size={16} />
      </Button>
    </div>
  )
}
