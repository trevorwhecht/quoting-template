import { Lock } from "lucide-react"
import type { OrderDetail } from "@/models/order"

type Props = {
  order: OrderDetail | null
  role: string
}

export default function QuoteBuilderBanner({ order, role }: Props) {
  if (!order) return null

  const { stateId, id } = order

  if (role === "admin") {
    return (
      <div className="rounded-lg border border-(--color-warning) bg-(--color-warning)/10 px-4 py-3 text-sm text-(--color-warning)">
        Edit Mode — Order #{id}. Changes save when you click Save Changes.
      </div>
    )
  }

  if (stateId >= 3) {
    return (
      <div className="rounded-lg border border-(--color-border) bg-(--color-surface) px-4 py-3 text-sm text-(--color-muted) flex items-center gap-2">
        <Lock size={14} />
        This order is in progress and can no longer be edited.
      </div>
    )
  }

  if (stateId === 2) {
    return (
      <div className="rounded-lg border border-(--color-warning) bg-(--color-warning)/10 px-4 py-3 text-sm text-(--color-warning)">
        Your quote is approved. Making changes will send it back for review.
      </div>
    )
  }

  return (
    <div className="rounded-lg border border-(--color-border) bg-(--color-surface) px-4 py-3 text-sm text-(--color-muted)">
      Your quote is being reviewed. You can still make changes.
    </div>
  )
}
