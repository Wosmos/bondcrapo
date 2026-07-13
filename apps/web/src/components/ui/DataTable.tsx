import { Fragment, isValidElement, type ReactNode } from "react";
import { StaticGrid, type StaticRow } from "./DataGrid";

export interface DataTableColumn<Row> {
  key: string;
  header: ReactNode;
  /** Renders the cell; defaults to `String(row[key])`. */
  cell?: (row: Row) => ReactNode;
  /** The value to sort, filter and export by; defaults to the cell's text. */
  value?: (row: Row) => string | number | null | undefined;
  /** Numeric columns align to the end, use tabular figures and filter by a range. */
  numeric?: boolean;
  /** Overrides the filter picked for the column ("select" for a few values, a range for numbers, otherwise text). */
  filter?: "text" | "select" | "range" | false;
}

export interface DataTableProps<Row> {
  /** Required: describes the table for assistive technology (WCAG). */
  caption: string;
  columns: DataTableColumn<Row>[];
  rows: Row[];
  getRowKey: (row: Row) => string | number;
  /** Shown instead of the body when `rows` is empty. */
  empty?: ReactNode;
  /** Name of the CSV download. */
  fileName?: string;
}

const DIGITS: Record<string, string> = Object.fromEntries(
  [..."۰۱۲۳۴۵۶۷۸۹", ..."٠١٢٣٤٥٦٧٨٩"].map((d, i) => [d, String(i % 10)]),
);

/** The visible text of a rendered cell, for sorting, filtering and the CSV download. */
export function textOf(node: ReactNode): string {
  if (node == null || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(textOf).filter(Boolean).join(" ");
  if (isValidElement<{ children?: ReactNode; dateTime?: string }>(node)) return textOf(node.props.children);
  return "";
}

/** A number read from a formatted cell ("Rs 1,234.50", Urdu digits), or undefined when there is none. */
export function numberOf(text: string): number | undefined {
  const plain = text.replace(/[۰-۹٠-٩]/g, (d) => DIGITS[d] ?? d).replace(/[,٬\s]/g, "");
  const m = plain.match(/-?\d+(?:[.٫]\d+)?/);
  return m ? Number(m[0].replace("٫", ".")) : undefined;
}

/**
 * Every table in the app: a server component friendly front for {@link StaticGrid}. Cells are
 * rendered here; the grid adds sorting, a filter per column, pages, a fixed header, a pinned first
 * column, full screen and a CSV download.
 */
export function DataTable<Row>({ caption, columns, rows, getRowKey, empty, fileName }: DataTableProps<Row>) {
  const staticRows: StaticRow[] = rows.map((row) => {
    const content = columns.map((c) => (c.cell ? c.cell(row) : String((row as Record<string, unknown>)[c.key] ?? "")));
    // Keyed, because the cells travel to the client grid as an array.
    const cells = content.map((node, i) => <Fragment key={columns[i]!.key}>{node}</Fragment>);
    const values = columns.map((c, i) => {
      if (c.value) return c.value(row) ?? null;
      const text = textOf(content[i]).replace(/\s+/g, " ").trim();
      return c.numeric ? (numberOf(text) ?? null) : text;
    });
    return { id: String(getRowKey(row)), cells, values };
  });
  return (
    <StaticGrid
      caption={caption}
      empty={empty}
      fileName={fileName}
      rows={staticRows}
      columns={columns.map((c) => ({ key: c.key, header: textOf(c.header), numeric: c.numeric, filter: c.filter }))}
    />
  );
}
