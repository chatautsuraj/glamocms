import { cn } from "@/lib/utils";

type PageHeaderProps = {
  title: string;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
};

export function PageHeader({ title, description, actions, className }: PageHeaderProps) {
  return (
    <div className={cn("flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between", className)}>
      <div className="min-w-0">
        <h1 className="break-words text-2xl font-semibold tracking-tight">{title}</h1>
        {description && <p className="mt-1 max-w-[75ch] text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex min-w-0 shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}
