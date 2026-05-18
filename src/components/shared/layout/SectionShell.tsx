import type { ReactNode } from "react"

type Props = {
  title: string
  action?: ReactNode
  children: ReactNode
}

export default function SectionShell({ title, action, children }: Props) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-(--color-foreground)">{title}</h2>
        {action ? action : null}
      </div>
      {children}
    </div>
  )
}
