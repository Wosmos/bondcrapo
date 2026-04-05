"use client";

import { useMemo } from "react";
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  createColumnHelper,
} from "@tanstack/react-table";
import { CopyButton } from "./ui/CopyButton";
import { PrizeRankBadge } from "./ui/PrizeRankBadge";
import {
  SelectColumnFilter,
  InputColumnFilter,
  TextColumnFilter,
  SortableHeader,
} from "./ui/ColumnHeaderFilter";
import { formatDate } from "@/lib/utils";
import type { Winner, FilterState } from "@/types";

type ColumnFilters = Pick<FilterState, "denomination" | "rank" | "year" | "city" | "minDraw" | "minAmount" | "sortBy" | "sortOrder">;

interface ResultsTableProps {
  draws: Winner[];
  total: number;
  page: number;
  limit: number;
  onPageChange: (page: number) => void;
  onLimitChange: (limit: number) => void;
  isLoading: boolean;
  filters: ColumnFilters;
  onFilterChange: (key: string, value: string) => void;
  onSort: (columnKey: string) => void;
  pageDisabled: boolean;
  onReset: () => void;
  hasActiveFilters: boolean;
}

const DENOMINATION_OPTIONS = [
  { value: "", label: "All" },
  ...[100, 200, 750, 1000, 1500, 2500, 5000, 7500, 10000, 15000, 25000, 40000].map((d) => ({
    value: String(d),
    label: `Rs. ${d.toLocaleString()}`,
  })),
];

const RANK_OPTIONS = [
  { value: "", label: "All" },
  { value: "1st", label: "1st" },
  { value: "2nd", label: "2nd" },
  { value: "3rd", label: "3rd" },
];

const YEAR_OPTIONS = [
  { value: "", label: "All" },
  ...Array.from({ length: 2026 - 1999 + 1 }, (_, i) => 2026 - i).map((y) => ({
    value: String(y),
    label: String(y),
  })),
];

const columnHelper = createColumnHelper<Winner & { index: number }>();

export function ResultsTable({
  draws,
  total,
  page,
  limit,
  onPageChange,
  onLimitChange,
  isLoading,
  filters,
  onFilterChange,
  onSort,
  pageDisabled,
  onReset,
  hasActiveFilters,
}: ResultsTableProps) {
  const data = draws.map((d, i) => ({ ...d, index: page * limit + i + 1 }));
  const pageCount = Math.ceil(total / limit);

  // Count how many times each bond number appears on this page
  const bondCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const d of draws) {
      counts[d.bond_number] = (counts[d.bond_number] || 0) + 1;
    }
    return counts;
  }, [draws]);

  // Track which bond numbers we've already shown the badge for (first occurrence only)
  const shownBadge = useMemo(() => new Set<string>(), [draws]); // eslint-disable-line react-hooks/exhaustive-deps

  const columns = useMemo(
    () => [
      columnHelper.accessor("index", {
        header: () => (
          <span className="text-gray-500 font-bold uppercase text-[0.65rem] tracking-wider">#</span>
        ),
        size: 50,
        cell: (info) => (
          <span className="font-bold text-gray-400">{info.getValue()}</span>
        ),
      }),
      columnHelper.accessor("bond_number", {
        header: () => (
          <SortableHeader
            label="Bond #"
            sortKey="bond_number"
            sortBy={filters.sortBy}
            sortOrder={filters.sortOrder}
            onSort={() => onSort("bond_number")}
          />
        ),
        cell: (info) => {
          const bn = info.getValue();
          const count = bondCounts[bn] || 1;
          const isFirst = !shownBadge.has(bn);
          if (isFirst && count > 1) shownBadge.add(bn);

          return (
            <div className="flex items-center gap-1.5">
              <CopyButton value={bn} />
              {count > 1 && isFirst && (
                <span className="text-[9px] font-bold text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded-full whitespace-nowrap">
                  Won {count}x
                </span>
              )}
            </div>
          );
        },
      }),
      columnHelper.accessor("draw_number", {
        header: () => (
          <InputColumnFilter
            label="Draw"
            value={filters.minDraw}
            onChange={(v) => onFilterChange("minDraw", v)}
            placeholder="Min #"
            sortKey="draw_number"
            sortBy={filters.sortBy}
            sortOrder={filters.sortOrder}
            onSort={() => onSort("draw_number")}
          />
        ),
        size: 100,
        cell: (info) => {
          const val = info.getValue();
          return val ? (
            <span className="text-xs font-semibold text-gray-500">#{val}</span>
          ) : (
            <span className="text-xs text-gray-300">-</span>
          );
        },
      }),
      columnHelper.accessor("city", {
        header: () => (
          <TextColumnFilter
            label="City"
            value={filters.city}
            onChange={(v) => onFilterChange("city", v)}
            placeholder="Filter..."
            sortKey="city"
            sortBy={filters.sortBy}
            sortOrder={filters.sortOrder}
            onSort={() => onSort("city")}
          />
        ),
        size: 120,
        cell: (info) => {
          const val = info.getValue();
          return val ? (
            <span className="text-xs font-medium text-gray-600">{val}</span>
          ) : (
            <span className="text-xs text-gray-300">-</span>
          );
        },
      }),
      columnHelper.accessor("denomination", {
        header: () => (
          <SelectColumnFilter
            label="Value"
            value={filters.denomination}
            options={DENOMINATION_OPTIONS}
            onChange={(v) => onFilterChange("denomination", v)}
            sortKey="denomination"
            sortBy={filters.sortBy}
            sortOrder={filters.sortOrder}
            onSort={() => onSort("denomination")}
          />
        ),
        cell: (info) => `Rs. ${info.getValue().toLocaleString()}`,
      }),
      columnHelper.accessor("prize_position", {
        header: () => (
          <SelectColumnFilter
            label="Rank"
            value={filters.rank}
            options={RANK_OPTIONS}
            onChange={(v) => onFilterChange("rank", v)}
          />
        ),
        cell: (info) => <PrizeRankBadge position={info.getValue()} />,
      }),
      columnHelper.accessor("prize_amount", {
        header: () => (
          <InputColumnFilter
            label="Prize"
            value={filters.minAmount}
            onChange={(v) => onFilterChange("minAmount", v)}
            placeholder="Min PKR"
            sortKey="prize_amount"
            sortBy={filters.sortBy}
            sortOrder={filters.sortOrder}
            onSort={() => onSort("prize_amount")}
          />
        ),
        cell: (info) => (
          <span className="font-mono font-semibold">
            Rs. {info.getValue().toLocaleString()}
          </span>
        ),
      }),
      columnHelper.accessor("draw_date", {
        header: () => (
          <SelectColumnFilter
            label="Date"
            value={filters.year}
            options={YEAR_OPTIONS}
            onChange={(v) => onFilterChange("year", v)}
            sortKey="draw_date"
            sortBy={filters.sortBy}
            sortOrder={filters.sortOrder}
            onSort={() => onSort("draw_date")}
          />
        ),
        cell: (info) => (
          <span className="text-gray-600 font-medium">
            {formatDate(info.getValue())}
          </span>
        ),
      }),
    ],
    [filters, onFilterChange, onSort]
  );

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true,
    pageCount,
    state: { pagination: { pageIndex: page, pageSize: limit } },
  });

  return (
    <div className="relative group mt-6 border border-gray-100 rounded-lg p-1 flex flex-col" style={{ height: "calc(100vh - 260px)", minHeight: 400 }}>
      <div className="absolute -top-3 left-4 bg-[#f8fafc] px-2 z-20 text-[10px] uppercase font-bold text-gray-400 tracking-widest flex items-center gap-2">
        Prize Bond Results
        {hasActiveFilters && (
          <button
            onClick={onReset}
            className="text-[9px] font-semibold text-gray-400 hover:text-red-500 transition-colors uppercase tracking-wider"
          >
            Clear filters
          </button>
        )}
      </div>

      <div
        className="transition-opacity duration-300 flex-1 flex flex-col min-h-0"
        style={{ opacity: isLoading ? 0.5 : 1 }}
      >
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm flex-1 flex flex-col min-h-0 overflow-hidden">
          <div className="flex-1 overflow-auto min-h-0 scrollbar-thin">
            <table className="w-full text-left" style={{ whiteSpace: "nowrap" }}>
              <thead className="sticky top-0 z-10">
                {table.getHeaderGroups().map((hg) => (
                  <tr key={hg.id}>
                    {hg.headers.map((header) => (
                      <th
                        key={header.id}
                        className="bg-white border-b-2 border-[#0f172a] px-3 py-2.5 align-top"
                        style={{ width: header.getSize() !== 150 ? header.getSize() : undefined }}
                      >
                        {flexRender(header.column.columnDef.header, header.getContext())}
                      </th>
                    ))}
                  </tr>
                ))}
              </thead>
              <tbody>
                {table.getRowModel().rows.length === 0 ? (
                  <tr>
                    <td colSpan={columns.length} className="text-center py-16 text-gray-400">
                      {isLoading ? (
                        <div>
                          <svg className="w-8 h-8 mx-auto mb-3 animate-spin text-gray-300" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                          </svg>
                          <p className="text-sm">Searching...</p>
                        </div>
                      ) : (
                        <div>
                          <svg className="w-10 h-10 mx-auto mb-3 text-gray-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                          </svg>
                          <p className="text-sm font-medium text-gray-500">No matching bonds found</p>
                          <p className="text-xs mt-1">Try a different number or change your filters</p>
                        </div>
                      )}
                    </td>
                  </tr>
                ) : (
                  table.getRowModel().rows.map((row) => {
                    const bn = row.original.bond_number;
                    const isRepeat = (bondCounts[bn] || 1) > 1;
                    return (
                      <tr key={row.id} className={`hover:bg-gray-50 transition-colors ${isRepeat ? "bg-amber-50/40" : ""}`}>
                        {row.getVisibleCells().map((cell) => (
                          <td key={cell.id} className={`border-b border-gray-100 px-3 py-2.5 text-[0.85rem] ${isRepeat ? "bg-amber-50/40" : "bg-white"}`}>
                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                          </td>
                        ))}
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="bg-white border-t border-gray-200 px-4 py-4 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5">
                <label className="text-xs text-gray-500">Rows</label>
                <select
                  value={limit}
                  onChange={(e) => onLimitChange(Number(e.target.value))}
                  className="text-xs border border-gray-200 rounded-md px-2 py-1.5 bg-white text-gray-700 font-medium focus:outline-none focus:ring-1 focus:ring-[#0f172a]"
                >
                  {[10, 25, 50, 100].map((n) => (
                    <option key={n} value={n}>{n}</option>
                  ))}
                </select>
              </div>
              <span className="text-xs text-gray-400">
                {page * limit + 1}&ndash;{Math.min((page + 1) * limit, total)} of {total.toLocaleString()}
              </span>
            </div>
            <div className="flex gap-1">
              <button
                onClick={() => onPageChange(page - 1)}
                disabled={page === 0 || pageDisabled}
                className="px-3 py-1.5 border border-gray-200 rounded-md text-sm font-medium bg-white hover:bg-[#0f172a] hover:text-white hover:border-[#0f172a] disabled:opacity-30 disabled:pointer-events-none disabled:hover:bg-white disabled:hover:text-inherit disabled:hover:border-gray-200 transition-all"
              >
                Previous
              </button>
              {Array.from({ length: Math.min(pageCount, 7) }, (_, i) => {
                let pageNum: number;
                if (pageCount <= 7) {
                  pageNum = i;
                } else if (page < 4) {
                  pageNum = i;
                } else if (page > pageCount - 5) {
                  pageNum = pageCount - 7 + i;
                } else {
                  pageNum = page - 3 + i;
                }
                return (
                  <button
                    key={pageNum}
                    onClick={() => onPageChange(pageNum)}
                    disabled={pageDisabled}
                    className={`px-3 py-1.5 border rounded-md text-sm font-medium transition-all disabled:opacity-30 disabled:pointer-events-none ${
                      pageNum === page
                        ? "bg-[#0f172a] text-white border-[#0f172a] font-bold"
                        : "border-gray-200 bg-white hover:bg-[#0f172a] hover:text-white hover:border-[#0f172a]"
                    }`}
                  >
                    {pageNum + 1}
                  </button>
                );
              })}
              <button
                onClick={() => onPageChange(page + 1)}
                disabled={page >= pageCount - 1 || pageDisabled}
                className="px-3 py-1.5 border border-gray-200 rounded-md text-sm font-medium bg-white hover:bg-[#0f172a] hover:text-white hover:border-[#0f172a] disabled:opacity-30 disabled:pointer-events-none disabled:hover:bg-white disabled:hover:text-inherit disabled:hover:border-gray-200 transition-all"
              >
                Next
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
