import { Button as ButtonPrimitive } from "@base-ui/react/button"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center rounded-lg border border-transparent bg-clip-padding text-sm font-medium whitespace-nowrap transition-all outline-none select-none focus-visible:border-(--color-primary) focus-visible:ring-3 focus-visible:ring-(--color-primary)/50 active:not-aria-[haspopup]:translate-y-px disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-(--color-danger) aria-invalid:ring-3 aria-invalid:ring-(--color-danger)/20 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: "bg-(--color-background) text-(--color-foreground) border-(--color-border) shadow-sm hover:bg-(--color-surface)",
        outline:
          "border-(--color-border) bg-(--color-background) hover:bg-(--color-surface) hover:text-(--color-foreground) aria-expanded:bg-(--color-surface) aria-expanded:text-(--color-foreground)",
        secondary:
          "bg-(--color-surface) text-(--color-foreground) hover:bg-(--color-surface)/80 aria-expanded:bg-(--color-surface) aria-expanded:text-(--color-foreground)",
        ghost:
          "hover:bg-(--color-surface) hover:text-(--color-foreground) aria-expanded:bg-(--color-surface) aria-expanded:text-(--color-foreground)",
        destructive:
          "bg-(--color-danger)/10 text-(--color-danger) hover:bg-(--color-danger)/20 focus-visible:border-(--color-danger)/40 focus-visible:ring-(--color-danger)/20",
        link: "text-(--color-primary) underline-offset-4 hover:underline",
      },
      size: {
        default:
          "h-8 gap-1.5 px-2.5 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2",
        xs: "h-6 gap-1 rounded-[min(var(--radius-md),10px)] px-2 text-xs in-data-[slot=button-group]:rounded-lg has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3",
        sm: "h-7 gap-1 rounded-[min(var(--radius-md),12px)] px-2.5 text-[0.8rem] in-data-[slot=button-group]:rounded-lg has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3.5",
        lg: "h-9 gap-1.5 px-2.5 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2",
        icon: "size-8",
        "icon-xs":
          "size-6 rounded-[min(var(--radius-md),10px)] in-data-[slot=button-group]:rounded-lg [&_svg:not([class*='size-'])]:size-3",
        "icon-sm":
          "size-7 rounded-[min(var(--radius-md),12px)] in-data-[slot=button-group]:rounded-lg",
        "icon-lg": "size-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  nativeButton,
  ...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariants>) {
  const hasRender = (props as Partial<ButtonPrimitive.Props>).render !== undefined
  const effectiveNativeButton = nativeButton ?? (hasRender ? false : undefined)

  return (
    <ButtonPrimitive
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      nativeButton={effectiveNativeButton}
      {...props}
    />
  )
}

export { Button, buttonVariants }
