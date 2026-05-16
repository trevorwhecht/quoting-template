import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle,
  AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction,
} from "@/components/ui/alert-dialog"

type Props = {
  open: boolean
  diff: { prev: number; next: number } | null
  onCancel: () => void
  onConfirm: () => void
}

export default function QuoteBuilderPriceChangeDialog({ open, diff, onCancel, onConfirm }: Props) {
  if (!diff) return null
  const delta = diff.next - diff.prev
  const isIncrease = delta > 0

  return (
    <AlertDialog open={open} onOpenChange={(v) => { if (!v) onCancel() }}>
      <AlertDialogContent className="bg-(--color-background)">
        <AlertDialogHeader>
          <AlertDialogTitle>Price Change Detected</AlertDialogTitle>
          <AlertDialogDescription>Review the price difference before saving.</AlertDialogDescription>
          <div className="space-y-2 text-sm pt-1">
            <div className="flex justify-between">
              <span className="text-(--color-muted)">Previous total</span>
              <span>${diff.prev.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-(--color-muted)">New total</span>
              <span>${diff.next.toFixed(2)}</span>
            </div>
            <div className={`flex justify-between font-semibold ${isIncrease ? "text-(--color-danger)" : "text-(--color-success)"}`}>
              <span>Difference</span>
              <span>{isIncrease ? `+$${delta.toFixed(2)}` : `-$${Math.abs(delta).toFixed(2)}`}</span>
            </div>
          </div>
        </AlertDialogHeader>
        <AlertDialogFooter className="pb-[max(1rem,env(safe-area-inset-bottom))]">
          <AlertDialogCancel onClick={onCancel}>Cancel</AlertDialogCancel>
          <AlertDialogAction autoFocus onClick={onConfirm}>Confirm & Save</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
