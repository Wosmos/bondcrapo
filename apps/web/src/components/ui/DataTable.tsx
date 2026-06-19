import type { ReactNode } from "react";

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

/** Server component friendly table with caption and `scope` headers. Large lists must be paginated by the caller. */
export function DataTable<Row>({ caption, columns, rows, getRowKey, empty }: DataTableProps<Row>) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-line bg-surface">
      <table className="w-full border-collapse text-sm">
        <caption className="px-4 pt-3 pb-2 text-start text-sm font-semibold text-ink">{caption}</caption>
        <thead>
          <tr className="border-b border-line bg-surface-2/60">
            {columns.map((c) => (
              <th
                key={c.key}
                scope="col"
                className={`px-4 py-2.5 text-xs font-semibold tracking-wide text-ink-2 uppercase ${c.numeric ? "text-end" : "text-start"}`}
              >
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && empty ? (
            <tr>
              <td colSpan={columns.length} className="px-4 py-8 text-center text-ink-2">
                {empty}
              </td>
            </tr>
          ) : (
            rows.map((row) => (
              <tr key={getRowKey(row)} className="border-b border-line last:border-b-0 hover:bg-surface-2/40">
                {columns.map((c) => (
                  <td
                    key={c.key}
                    className={`px-4 py-2.5 text-ink ${c.numeric ? "text-end tabular-nums" : "text-start"}`}
                  >
                    {c.cell ? c.cell(row) : String((row as Record<string, unknown>)[c.key] ?? "")}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
