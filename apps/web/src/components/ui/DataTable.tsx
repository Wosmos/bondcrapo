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
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <caption className="pb-2 text-start text-sm font-medium text-slate-700">{caption}</caption>
        <thead>
          <tr className="border-b border-slate-200">
            {columns.map((c) => (
              <th
                key={c.key}
                scope="col"
                className={`px-3 py-2 font-semibold text-slate-700 ${c.numeric ? "text-end" : "text-start"}`}
              >
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && empty ? (
            <tr>
              <td colSpan={columns.length} className="px-3 py-6 text-center text-slate-600">
                {empty}
              </td>
            </tr>
          ) : (
            rows.map((row) => (
              <tr key={getRowKey(row)} className="border-b border-slate-100">
                {columns.map((c) => (
                  <td
                    key={c.key}
                    className={`px-3 py-2 ${c.numeric ? "text-end tabular-nums" : "text-start"}`}
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
