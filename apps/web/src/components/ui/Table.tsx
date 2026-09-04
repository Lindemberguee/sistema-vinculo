import type { ReactNode } from "react";
import { cn } from "./cn";

export function Table({
  children,
  className,
  dense,
}: {
  children: ReactNode;
  className?: string;
  /** Tighter row padding for long lists. */
  dense?: boolean;
}) {
  return (
    <div className="overflow-x-auto">
      <table
        className={cn(
          "w-full border-collapse text-sm [&_tbody_tr]:transition-colors [&_tbody_tr:hover]:bg-canvas/70",
          dense && "[&_.td]:!py-1.5 [&_.th]:!py-1.5",
          className,
        )}
      >
        {children}
      </table>
    </div>
  );
}

type SortDir = "ascending" | "descending" | "none";

export function Th({
  children,
  className,
  sortable,
  sorted = "none",
  sticky,
  onClick,
}: {
  children?: ReactNode;
  className?: string;
  /** Renders a sort caret and sets `aria-sort`. */
  sortable?: boolean;
  sorted?: SortDir;
  /** Pins the header row on vertical scroll. */
  sticky?: boolean;
  onClick?: () => void;
}) {
  return (
    <th
      scope="col"
      className={cn(
        "th",
        sticky && "sticky top-0 z-sticky bg-canvas",
        sortable && "cursor-pointer select-none hover:text-ink",
        className,
      )}
      aria-sort={sortable ? sorted : undefined}
      onClick={onClick}
    >
      {sortable ? (
        <span className="inline-flex items-center gap-1">
          {children}
          <span aria-hidden className="text-faint">
            {sorted === "ascending" ? "↑" : sorted === "descending" ? "↓" : "↕"}
          </span>
        </span>
      ) : (
        children
      )}
    </th>
  );
}

export function Td({ children, className, colSpan }: { children?: ReactNode; className?: string; colSpan?: number }) {
  return (
    <td className={cn("td", className)} colSpan={colSpan}>
      {children}
    </td>
  );
}

export function Tr({ children, className }: { children: ReactNode; className?: string }) {
  return <tr className={cn("border-t border-line first:border-t-0", className)}>{children}</tr>;
}
