import type { ReactNode } from "react";
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@/components/shadcn/table";
import { cn } from "@/lib/utils";

export interface DataTableColumn<Row> {
  key: string;
  header: ReactNode;
  /** Renders the cell; defaults to `String(row[key])`. */
  cell?: (row: Row) => ReactNode;
  /** Numeric columns align to the end and use tabular figures. */
  numeric?: boolean;
}

export interface DataTableProps<Row> {
  /** Required: describes the table for assistive technology (WCAG). */
  caption: string;
  columns: DataTableColumn<Row>[];
  rows: Row[];
  getRowKey: (row: Row) => string | number;
  /** Shown instead of the body when `rows` is empty. */
  empty?: ReactNode;
}

/**
 * shadcn/ui Table with a caption on top and `scope` headers; server component friendly. The
 * table scrolls sideways inside its rounded frame on narrow screens. Large lists must be
 * paginated by the caller.
 */
export function DataTable<Row>({ caption, columns, rows, getRowKey, empty }: DataTableProps<Row>) {
  return (
    <div className="overflow-hidden rounded-xl border border-line bg-surface">
      <Table regionLabel={caption}>
        <TableCaption className="mt-0 caption-top px-4 pt-3 pb-2 text-start text-sm font-semibold text-ink">{caption}</TableCaption>
        <TableHeader className="bg-surface-2/60">
          <TableRow className="hover:bg-transparent">
            {columns.map((c) => (
              <TableHead
                key={c.key}
                scope="col"
                className={cn("h-10 px-4 text-xs font-semibold tracking-wide whitespace-normal text-ink-2 uppercase", c.numeric ? "text-end" : "text-start")}
              >
                {c.header}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0 && empty ? (
            <TableRow className="hover:bg-transparent">
              <TableCell colSpan={columns.length} className="px-4 py-8 text-center whitespace-normal text-ink-2">
                {empty}
              </TableCell>
            </TableRow>
          ) : (
            rows.map((row) => (
              <TableRow key={getRowKey(row)} className="hover:bg-surface-2/40">
                {columns.map((c) => (
                  <TableCell key={c.key} className={cn("px-4 py-2.5 whitespace-normal text-ink", c.numeric ? "text-end tabular-nums" : "text-start")}>
                    {c.cell ? c.cell(row) : String((row as Record<string, unknown>)[c.key] ?? "")}
                  </TableCell>
                ))}
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
