import { cva, type VariantProps } from "class-variance-authority";
import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

/**
 * Pill buttons (DESIGN.md). Every size except `sm` meets the 44px touch target.
 * Filled variants go quiet when disabled (muted fill, readable text) instead of fading to a washed-out
 * pink or grey slab that reads as an error.
 */
const QUIET_DISABLED = "disabled:bg-muted disabled:text-muted-foreground disabled:shadow-none disabled:opacity-100 disabled:brightness-100";
const buttonVariants = cva(
  "inline-flex select-none items-center justify-center gap-2 whitespace-nowrap rounded-full text-sm font-semibold transition-[background-color,color,box-shadow,transform] active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-45",
  {
    variants: {
      variant: {
        default: ["bg-ink text-background hover:bg-ink/90 dark:bg-foreground dark:text-background", QUIET_DISABLED].join(" "),
        brand: ["bg-brand text-brand-foreground shadow-card hover:brightness-[1.04]", QUIET_DISABLED].join(" "),
        secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        outline: "border border-input bg-card text-foreground hover:bg-accent",
        ghost: "text-foreground hover:bg-accent",
        destructive: ["bg-danger text-danger-foreground hover:bg-danger/90", QUIET_DISABLED].join(" "),
        success: ["bg-success text-success-foreground hover:bg-success/90", QUIET_DISABLED].join(" "),
        link: "rounded-md px-0 text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-11 px-5",
        sm: "h-9 px-3.5 text-xs",
        lg: "h-12 px-6 text-base",
        xl: "h-14 px-7 text-lg",
        icon: "h-11 w-11",
        "icon-sm": "h-9 w-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(({ className, variant, size, type = "button", ...props }, ref) => (
  <button type={type} className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />
));
Button.displayName = "Button";

export { Button, buttonVariants };
