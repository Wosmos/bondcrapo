"use client";

import {
  ArrowsInIcon,
  ArrowsOutIcon,
  CaretDoubleLeftIcon,
  CaretDoubleRightIcon,
  CaretDownIcon,
  CaretLeftIcon,
  CaretRightIcon,
  CaretUpDownIcon,
  CaretUpIcon,
  DownloadSimpleIcon,
  FunnelIcon,
  FunnelXIcon,
} from "@/components/ui/icons";
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type ColumnFiltersState,
  type FilterFn,
  type SortingState,
} from "@tanstack/react-table";
import { useTranslations } from "next-intl";
import { useEffect, useId, useMemo, useState, type ReactNode } from "react";
import { Button } from "@/components/shadcn/button";
import { Input } from "@/components/shadcn/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/shadcn/select";
import { cn } from "@/lib/utils";

/** What a column needs beyond TanStack's definition. */
export interface GridColumnMeta {
  /** Right aligned, tabular figures; filtered as a min to max range. */
  numeric?: boolean;
  /** Filter control: free text (default), a choice of the column's values, a number range, or none. */
  filter?: "text" | "select" | "range" | false;
  /** Plain text for the CSV export and the select filter (defaults to the raw value). */
  text?: (value: unknown) => string;
}

declare module "@tanstack/react-table" {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface ColumnMeta<TData, TValue> {
    numeric?: boolean;
    filter?: "text" | "select" | "range" | false;
    text?: (value: unknown) => string;
  }
}

export type GridColumn<Row> = ColumnDef<Row, unknown> & { meta?: GridColumnMeta; header: string };

const PAGE_SIZES = [10, 25, 50, 100] as const;

const includesText: FilterFn<unknown> = (row, id, query: string) => {
  const meta = row.getAllCells().find((c) => c.column.id === id)?.column.columnDef.meta;
  const value = row.getValue(id);
  const text = meta?.text ? meta.text(value) : String(value ?? "");
  return text.toLowerCase().includes(String(query).toLowerCase());
};
const equalsText: FilterFn<unknown> = (row, id, choice: string) => {
  const meta = row.getAllCells().find((c) => c.column.id === id)?.column.columnDef.meta;
  const value = row.getValue(id);
  return (meta?.text ? meta.text(value) : String(value ?? "")) === choice;
};
const inRange: FilterFn<unknown> = (row, id, [min, max]: [string, string]) => {
  const v = Number(row.getValue(id));
  return (min === "" || v >= Number(min)) && (max === "" || v <= Number(max));
};

/**
 * Every data table in the app: sorting, a filter per column, pages with a choice of rows per page,
 * a fixed header and a pinned first column inside a scroll area, full screen, and a CSV download
 * of the filtered rows. Built on TanStack Table and the shadcn/ui parts. The first column should
 * identify the row (a bond number, a draw), since it stays visible while scrolling sideways.
 */
export function DataGrid<Row>({
  columns,
  data,
  caption,
  fileName = "bondcheck.csv",
  initialPageSize = 25,
  initialSorting = [],
  toolbar,
  empty,
}: {
  columns: GridColumn<Row>[];
  data: Row[];
  /** Names the table for screen readers and the full screen view. */
  caption: string;
  fileName?: string;
  initialPageSize?: (typeof PAGE_SIZES)[number];
  initialSorting?: SortingState;
  /** Extra controls shown before the grid's own (a summary, a button). */
  toolbar?: ReactNode;
  /** Shown in the body when there are no rows at all (before any filter). */
  empty?: ReactNode;
}) {
  const t = useTranslations("common.grid");
  const id = useId();
  const [sorting, setSorting] = useState<SortingState>(initialSorting);
  const [filters, setFilters] = useState<ColumnFiltersState>([]);
  const [pagination, setPagination] = useState({
    pageIndex: 0,
    pageSize: initialPageSize as number,
  });
  const [full, setFull] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  // A table that fits on one page stays a plain table: no buttons, no pages.
  const small = data.length <= PAGE_SIZES[0];
  // Full screen fills the window below the site header, so the navigation stays in reach.
  const [top, setTop] = useState(0);
  const toggleFull = () => {
    if (!full)
      setTop(
        Math.max(0, document.querySelector("body header")?.getBoundingClientRect().bottom ?? 0),
      );
    setFull((f) => !f);
  };

  const cols = useMemo(
    () =>
      columns.map((c) => {
        const kind = c.meta?.filter ?? (c.meta?.numeric ? "range" : "text");
        const filterFn = kind === "select" ? equalsText : kind === "range" ? inRange : includesText;
        return { ...c, filterFn: filterFn as FilterFn<Row>, enableColumnFilter: kind !== false };
      }),
    [columns],
  );

  const table = useReactTable({
    data,
    columns: cols,
    state: { sorting, columnFilters: filters, pagination },
    onSortingChange: setSorting,
    onColumnFiltersChange: (u) => {
      setFilters(u);
      setPagination((p) => ({ ...p, pageIndex: 0 }));
    },
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  });

  // Escape leaves full screen; the page behind does not scroll while it is open.
  useEffect(() => {
    if (!full) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setFull(false);
    document.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
    };
  }, [full]);

  const filtered = table.getFilteredRowModel().rows;
  const total = filtered.length;
  const { pageIndex, pageSize } = table.getState().pagination;
  const from = total === 0 ? 0 : pageIndex * pageSize + 1;
  const to = Math.min(total, (pageIndex + 1) * pageSize);
  const pages = Math.max(1, table.getPageCount());

  const exportCsv = () => {
    const leaves = table.getVisibleLeafColumns();
    const esc = (s: string) => (/[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);
    const lines = [leaves.map((c) => esc(String(c.columnDef.header))).join(",")];
    for (const row of filtered) {
      lines.push(
        leaves
          .map((c) => {
            const v = row.getValue(c.id);
            return esc(c.columnDef.meta?.text ? c.columnDef.meta.text(v) : String(v ?? ""));
          })
          .join(","),
      );
    }
    const url = URL.createObjectURL(
      new Blob(["﻿" + lines.join("\n")], { type: "text/csv;charset=utf-8" }),
    );
    const a = Object.assign(document.createElement("a"), { href: url, download: fileName });
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div
      role={full ? "dialog" : undefined}
      aria-modal={full || undefined}
      aria-label={full ? caption : undefined}
      style={full ? { top } : undefined}
      className={cn(
        "flex flex-col gap-3",
        full && "fixed inset-x-0 bottom-0 z-30 bg-paper p-3 sm:p-6",
      )}
    >
      <div className={cn("flex flex-wrap items-center gap-2", small && !toolbar && "hidden")}>
        {toolbar ? <div className="me-auto">{toolbar}</div> : <span className="me-auto" />}
        {small ? null : (
          <>
            <Button
              type="button"
              variant={showFilters ? "secondary" : "outline"}
              size="sm"
              onClick={() => setShowFilters((v) => !v)}
              aria-pressed={showFilters}
            >
              <FunnelIcon aria-hidden="true" />
              {t("filters")}
            </Button>
            {filters.length > 0 ? (
              <Button type="button" variant="ghost" size="sm" onClick={() => setFilters([])}>
                <FunnelXIcon aria-hidden="true" />
                {t("clearFilters")}
              </Button>
            ) : null}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={exportCsv}
              disabled={total === 0}
            >
              <DownloadSimpleIcon aria-hidden="true" />
              <span className="max-sm:sr-only">{t("exportCsv")}</span>
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={toggleFull}
              aria-pressed={full}
            >
              {full ? <ArrowsInIcon aria-hidden="true" /> : <ArrowsOutIcon aria-hidden="true" />}
              <span className="max-sm:sr-only">{full ? t("restore") : t("maximize")}</span>
            </Button>
          </>
        )}
      </div>

      <div
        tabIndex={0}
        role="region"
        aria-label={caption}
        className={cn(
          "overflow-auto rounded-xl border border-line bg-surface focus-visible:outline-2 focus-visible:outline-focus",
          full ? "min-h-0 flex-1" : "max-h-[70vh]",
        )}
      >
        <table className="w-full border-separate border-spacing-0 text-sm">
          <caption className="sr-only">{caption}</caption>
          <thead className="sticky top-0 z-20">
            {table.getHeaderGroups().map((group) => (
              <tr key={group.id}>
                {group.headers.map((h, i) => {
                  const meta = h.column.columnDef.meta;
                  const sorted = h.column.getIsSorted();
                  return (
                    <th
                      key={h.id}
                      scope="col"
                      aria-sort={
                        sorted === "asc"
                          ? "ascending"
                          : sorted === "desc"
                            ? "descending"
                            : undefined
                      }
                      className={cn(
                        "border-b border-line bg-surface-2 px-3 py-2 align-top font-semibold whitespace-nowrap text-ink-2",
                        meta?.numeric ? "text-end" : "text-start",
                        i === 0 && "sticky start-0 z-10",
                      )}
                    >
                      {h.column.getCanSort() ? (
                        <button
                          type="button"
                          onClick={h.column.getToggleSortingHandler()}
                          aria-label={t("sortBy", { column: String(h.column.columnDef.header) })}
                          className={cn(
                            "inline-flex min-h-8 items-center gap-1 hover:text-ink",
                            meta?.numeric && "flex-row-reverse",
                          )}
                        >
                          {String(h.column.columnDef.header)}
                          {sorted === "asc" ? (
                            <CaretUpIcon aria-hidden="true" className="size-3.5" />
                          ) : sorted === "desc" ? (
                            <CaretDownIcon aria-hidden="true" className="size-3.5" />
                          ) : (
                            <CaretUpDownIcon aria-hidden="true" className="size-3.5 opacity-50" />
                          )}
                        </button>
                      ) : (
                        String(h.column.columnDef.header)
                      )}
                      {showFilters && h.column.getCanFilter() ? (
                        <ColumnFilter
                          column={h.column}
                          data={data}
                          label={t("filter", { column: String(h.column.columnDef.header) })}
                          all={t("all")}
                          min={t("min")}
                          max={t("max")}
                          search={t("search")}
                          idBase={`${id}-${h.id}`}
                        />
                      ) : null}
                    </th>
                  );
                })}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.length === 0 ? (
              <tr>
                <td
                  colSpan={table.getVisibleLeafColumns().length}
                  className="px-3 py-8 text-center text-ink-2"
                >
                  {data.length === 0 && empty ? empty : t("noMatches")}
                </td>
              </tr>
            ) : (
              table.getRowModel().rows.map((row) => (
                <tr key={row.id} className="group">
                  {row.getVisibleCells().map((cell, i) => {
                    const meta = cell.column.columnDef.meta;
                    const Cell = i === 0 ? "th" : "td";
                    return (
                      <Cell
                        key={cell.id}
                        scope={i === 0 ? "row" : undefined}
                        className={cn(
                          "border-b border-line bg-surface px-3 py-2 align-middle font-normal text-ink group-hover:bg-surface-2",
                          meta?.numeric ? "text-end tabular-nums whitespace-nowrap" : "text-start",
                          i === 0 && "sticky start-0 z-10 border-e",
                        )}
                      >
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </Cell>
                    );
                  })}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div
        className={cn(
          "flex flex-wrap items-center justify-between gap-3 text-sm text-ink-2",
          small && "hidden",
        )}
      >
        <div className="flex items-center gap-2">
          <label htmlFor={`${id}-size`}>{t("rowsPerPage")}</label>
          <Select value={String(pageSize)} onValueChange={(v) => table.setPageSize(Number(v))}>
            <SelectTrigger id={`${id}-size`} size="sm" className="w-20 bg-surface">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PAGE_SIZES.map((n) => (
                <SelectItem key={n} value={String(n)}>
                  {n}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <p aria-live="polite" className="tabular-nums">
          {t("showing", { from, to, total })}
          <span className="mx-2" aria-hidden="true">
            ·
          </span>
          {t("page", { page: pageIndex + 1, pages })}
        </p>
        <div className="flex items-center gap-1">
          {(
            [
              ["first", CaretDoubleLeftIcon, () => table.firstPage(), !table.getCanPreviousPage()],
              ["previous", CaretLeftIcon, () => table.previousPage(), !table.getCanPreviousPage()],
              ["next", CaretRightIcon, () => table.nextPage(), !table.getCanNextPage()],
              ["last", CaretDoubleRightIcon, () => table.lastPage(), !table.getCanNextPage()],
            ] as const
          ).map(([key, Icon, go, disabled]) => (
            <Button
              key={key}
              type="button"
              variant="outline"
              size="icon"
              className="size-9"
              onClick={go}
              disabled={disabled}
              aria-label={t(key)}
            >
              <Icon aria-hidden="true" className="rtl:-scale-x-100" />
            </Button>
          ))}
        </div>
      </div>
    </div>
  );
}

function ColumnFilter<Row>({
  column,
  data,
  label,
  all,
  min,
  max,
  idBase,
  search,
}: {
  column: import("@tanstack/react-table").Column<Row, unknown>;
  data: Row[];
  label: string;
  all: string;
  min: string;
  max: string;
  idBase: string;
  search: string;
}) {
  const meta = column.columnDef.meta;
  const kind = meta?.filter ?? (meta?.numeric ? "range" : "text");
  const value = column.getFilterValue();

  if (kind === "select") {
    const options = [
      ...new Set(
        data.map((r) => {
          const v = (column.accessorFn ? column.accessorFn(r, 0) : undefined) as unknown;
          return meta?.text ? meta.text(v) : String(v ?? "");
        }),
      ),
    ].sort();
    return (
      <div className="mt-1.5 font-normal">
        <Select
          value={(value as string) ?? "__all"}
          onValueChange={(v) => column.setFilterValue(v === "__all" ? undefined : v)}
        >
          <SelectTrigger size="sm" aria-label={label} className="h-8 min-w-24 bg-surface text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all">{all}</SelectItem>
            {options.map((o) => (
              <SelectItem key={o} value={o}>
                {o}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    );
  }
  if (kind === "range") {
    const [lo, hi] = (value as [string, string] | undefined) ?? ["", ""];
    const set = (next: [string, string]) =>
      column.setFilterValue(next[0] === "" && next[1] === "" ? undefined : next);
    return (
      <div className="mt-1.5 flex gap-1 font-normal">
        <Input
          id={`${idBase}-min`}
          inputMode="numeric"
          value={lo}
          onChange={(e) => set([e.target.value.replace(/[^\d.]/g, ""), hi])}
          placeholder={min}
          aria-label={`${label} (${min})`}
          className="h-8 w-20 bg-surface px-2 text-xs"
        />
        <Input
          id={`${idBase}-max`}
          inputMode="numeric"
          value={hi}
          onChange={(e) => set([lo, e.target.value.replace(/[^\d.]/g, "")])}
          placeholder={max}
          aria-label={`${label} (${max})`}
          className="h-8 w-20 bg-surface px-2 text-xs"
        />
      </div>
    );
  }
  return (
    <div className="mt-1.5 font-normal">
      <Input
        id={`${idBase}-q`}
        value={(value as string) ?? ""}
        onChange={(e) => column.setFilterValue(e.target.value || undefined)}
        placeholder={search}
        aria-label={label}
        className="h-8 min-w-24 bg-surface px-2 text-xs"
      />
    </div>
  );
}

/** A column of a {@link StaticGrid}: plain data, so a server component can describe it. */
export interface StaticColumn {
  key: string;
  header: string;
  numeric?: boolean;
  filter?: GridColumnMeta["filter"];
}

/** A row of a {@link StaticGrid}: rendered cells, plus a plain value per cell to sort, filter and export by. */
export interface StaticRow {
  id: string;
  cells: ReactNode[];
  values: (string | number | null)[];
}

/**
 * {@link DataGrid} for rows that were rendered elsewhere (usually on the server by `DataTable`).
 * Columns with only a handful of distinct values get a choice filter instead of a text box.
 */
export function StaticGrid({
  columns,
  rows,
  caption,
  empty,
  fileName,
}: {
  columns: StaticColumn[];
  rows: StaticRow[];
  caption: string;
  empty?: ReactNode;
  fileName?: string;
}) {
  const grid = useMemo<GridColumn<StaticRow>[]>(
    () =>
      columns.map((c, i) => {
        const distinct = new Set(rows.map((r) => r.values[i])).size;
        const filter =
          c.filter ??
          (c.numeric ? "range" : rows.length > 10 && distinct <= 12 ? "select" : "text");
        return {
          id: c.key,
          header: c.header,
          accessorFn: (r: StaticRow) => r.values[i] ?? undefined,
          sortUndefined: "last",
          meta: { numeric: c.numeric, filter },
          cell: ({ row }: { row: { original: StaticRow } }) => row.original.cells[i],
        } as GridColumn<StaticRow>;
      }),
    [columns, rows],
  );
  return (
    <DataGrid
      columns={grid}
      data={rows}
      caption={caption}
      empty={empty}
      fileName={fileName}
      toolbar={<p className="text-sm font-semibold text-ink">{caption}</p>}
    />
  );
}
