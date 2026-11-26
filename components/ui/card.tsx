import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export function Card({
  className,
  children,
  as: Tag = "section",
  ...rest
}: {
  className?: string;
  children: ReactNode;
  as?: "section" | "div" | "article";
} & React.HTMLAttributes<HTMLElement>) {
  return (
    <Tag
      className={cn(
        "border-border bg-surface shadow-card rounded-2xl border",
        className,
      )}
      {...rest}
    >
      {children}
    </Tag>
  );
}

export function CardHeader({
  title,
  description,
  action,
  id,
  className,
}: {
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  id?: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-start justify-between gap-x-4 gap-y-2 px-5 pt-5 sm:px-6",
        className,
      )}
    >
      <div className="min-w-0">
        <h2 id={id} className="text-[15px] font-semibold tracking-tight">
          {title}
        </h2>
        {description && (
          <p className="text-muted mt-0.5 text-sm">{description}</p>
        )}
      </div>
      {action}
    </div>
  );
}
