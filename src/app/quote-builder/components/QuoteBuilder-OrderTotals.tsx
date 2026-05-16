import { Input } from "@/components/ui/input"
import type { TotalsResult } from "@/models/order"

type Props = {
  totals: TotalsResult
  discount: number | null
  onDiscountChange?: (v: number | null) => void
  role: string
}

export default function QuoteBuilderOrderTotals({ totals, discount, onDiscountChange, role }: Props) {
  const isAdmin = role === "admin"

  return (
    <div className="space-y-3">
      <h2 className="text-base font-semibold text-(--color-foreground)">Order Totals</h2>
      <div className="w-full overflow-x-auto border border-(--color-border) rounded-lg">
        <table className="w-full text-sm min-w-65">
          <thead>
            <tr className="border-b border-(--color-border) bg-(--color-surface)">
              <th className="text-left px-3 py-2.5 font-medium text-(--color-muted)">Description</th>
              <th className="text-right px-3 py-2.5 font-medium text-(--color-muted)">Amount</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-(--color-border)">
              <td className="px-3 py-2.5 text-(--color-foreground)">Sub Total</td>
              <td className="px-3 py-2.5 text-right font-medium">${totals.subTotal.toFixed(2)}</td>
            </tr>

            <tr className="border-b border-(--color-border)">
              <td className="px-3 py-2.5 text-(--color-foreground)">Discount</td>
              <td className="px-3 py-2 text-right">
                {isAdmin ? (
                  <div className="flex items-center justify-end gap-1">
                    <span className="text-(--color-muted)">$</span>
                    <Input
                      type="number"
                      inputMode="decimal"
                      step="0.01"
                      min={0}
                      value={discount ?? ""}
                      onChange={(e) => onDiscountChange?.(e.target.value ? Number(e.target.value) : null)}
                      className="text-base h-7 w-24 text-right"
                      placeholder="0"
                    />
                  </div>
                ) : (
                  <span className={discount ? "text-(--color-danger)" : "text-(--color-muted)"}>
                    {discount ? `-$${discount.toFixed(2)}` : "$0.00"}
                  </span>
                )}
              </td>
            </tr>

            <tr className="border-b border-(--color-border)">
              <td className="px-3 py-2.5 text-(--color-foreground)">
                Sales Tax
                {totals.salesTax > 0 ? (
                  <span className="text-xs text-(--color-muted) ml-1">
                    ({((totals.salesTax / Math.max(totals.subTotal, 0.01)) * 100).toFixed(2)}%)
                  </span>
                ) : null}
              </td>
              <td className="px-3 py-2.5 text-right font-medium">${totals.salesTax.toFixed(2)}</td>
            </tr>

            <tr className={isAdmin ? "border-b border-(--color-border)" : ""}>
              <td className="px-3 py-2.5 font-semibold text-(--color-foreground)">Total</td>
              <td className="px-3 py-2.5 text-right font-bold text-base">${totals.totalPrice.toFixed(2)}</td>
            </tr>

            {isAdmin ? (
              <tr>
                <td className="px-3 py-2.5 text-(--color-success)">Profit</td>
                <td className="px-3 py-2.5 text-right font-semibold text-(--color-success)">${totals.profit.toFixed(2)}</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  )
}
