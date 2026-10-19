import { cn } from "@/lib/utils";

type AvatarProps = {
  initials: string;
  className?: string;
  size?: "sm" | "md" | "lg";
};

const sizeMap = {
  sm: "h-8 w-8 text-xs",
  md: "h-9 w-9 text-sm",
  lg: "h-11 w-11 text-base",
};

export function Avatar({ initials, className, size = "md" }: AvatarProps) {
  return (
    <div aria-hidden className={cn("inline-flex shrink-0 items-center justify-center rounded-full bg-rose-tint font-semibold text-foreground", sizeMap[size], className)}>
      {initials}
    </div>
  );
}
