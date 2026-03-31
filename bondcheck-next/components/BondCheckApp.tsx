"use client";

import { useState, useCallback } from "react";
import useSWR, { useSWRConfig } from "swr";
import { useThrottle } from "@/hooks/useThrottle";
import { Header } from "./Header";
import { StatsDashboard } from "./StatsDashboard";
import { FilterPanel } from "./FilterPanel";
import { ResultsTable } from "./ResultsTable";
import { ScannerModal } from "./ScannerModal";
import type { FilterState, DrawsResponse } from "@/types";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

const defaultFilters: FilterState = {
  searchMode: "single",
  bondNumber: "",
  bondList: "",
  startBond: "",
  endBond: "",
  denomination: "",
  rank: "",
  year: "",
  sortBy: "draw_date",
  sortOrder: "DESC",
  startDate: "",
  endDate: "",
  minAmount: "",
  rowLimit: 50,
};

function buildQueryString(filters: FilterState, page: number): string {
  const params = new URLSearchParams();
  params.set("limit", String(filters.rowLimit));
  params.set("offset", String(page * filters.rowLimit));

  if (filters.searchMode === "single" && filters.bondNumber) {
    params.set("bond_number", filters.bondNumber);
  }
  if ((filters.searchMode === "multi" || filters.searchMode === "mixed") && filters.bondList) {
    params.set("bond_list", filters.bondList);
  }
  if ((filters.searchMode === "series" || filters.searchMode === "mixed") && filters.startBond) {
    params.set("start_bond", filters.startBond);
  }
  if ((filters.searchMode === "series" || filters.searchMode === "mixed") && filters.endBond) {
    params.set("end_bond", filters.endBond);
  }
  if (filters.denomination) params.set("denomination", filters.denomination);
  if (filters.rank) params.set("position", filters.rank);
  if (filters.year) params.set("year", filters.year);
  if (filters.sortBy) params.set("sort_by", filters.sortBy);
  if (filters.sortOrder) params.set("sort_order", filters.sortOrder);
  if (filters.startDate) params.set("start_date", filters.startDate);
  if (filters.endDate) params.set("end_date", filters.endDate);
  if (filters.minAmount) params.set("min_amount", filters.minAmount);

  return params.toString();
}

export function BondCheckApp() {
  const [filters, setFilters] = useState<FilterState>(defaultFilters);
  const [page, setPage] = useState(0);
  const [refreshKey, setRefreshKey] = useState(0);
  const [scannerOpen, setScannerOpen] = useState(false);
  const { mutate } = useSWRConfig();

  const queryString = buildQueryString(filters, page);
  const swrKey = `/api/draws?${queryString}`;
  const { data, isLoading } = useSWR<DrawsResponse>(
    swrKey,
    fetcher,
    {
      keepPreviousData: true,
      revalidateIfStale: false,
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
    }
  );

  // --- Throttled handlers: [handler, disabled] ---

  const [handleSearch, searchDisabled] = useThrottle(useCallback(() => {
    setPage(0);
  }, []), 500);

  const [handleReset, resetDisabled] = useThrottle(useCallback(() => {
    setFilters(defaultFilters);
    setPage(0);
  }, []), 500);

  const [handleRefresh, refreshDisabled] = useThrottle(useCallback(() => {
    setRefreshKey((k) => k + 1);
    mutate((key) => typeof key === "string" && key.startsWith("/api/"), undefined, { revalidate: true });
  }, [mutate]), 1000);

  const handleFilterChange = useCallback((key: string, value: string) => {
    setFilters((f) => ({ ...f, [key]: value }));
    setPage(0);
  }, []);

  const [handleSort] = useThrottle(useCallback((columnKey: string) => {
    setFilters((f) => {
      if (f.sortBy === columnKey) {
        if (f.sortOrder === "DESC") return { ...f, sortOrder: "ASC" as const };
        return { ...f, sortBy: "draw_date", sortOrder: "DESC" as const };
      }
      return { ...f, sortBy: columnKey, sortOrder: "DESC" as const };
    });
    setPage(0);
  }, []), 300);

  const handleBondsFound = useCallback((bonds: string[]) => {
    if (bonds.length > 0) {
      setFilters((f) => {
        const current = f.bondList;
        const newList = [current, ...bonds].filter((x) => x).join(", ");
        return {
          ...f,
          bondList: newList,
          searchMode: "multi" as const,
        };
      });
      setTimeout(handleSearch, 100);
    }
  }, [handleSearch]);

  const [handleExportPDF, exportDisabled] = useThrottle(useCallback(async () => {
    const [{ jsPDF }, { default: autoTable }] = await Promise.all([
      import("jspdf"),
      import("jspdf-autotable"),
    ]);

    const exportParams = new URLSearchParams();
    exportParams.set("limit", "5000");
    exportParams.set("offset", "0");
    if (filters.denomination) exportParams.set("denomination", filters.denomination);
    if (filters.rank) exportParams.set("position", filters.rank);
    if (filters.year) exportParams.set("year", filters.year);
    if (filters.sortBy) exportParams.set("sort_by", filters.sortBy);
    if (filters.sortOrder) exportParams.set("sort_order", filters.sortOrder);
    if (filters.minAmount) exportParams.set("min_amount", filters.minAmount);

    const res = await fetch(`/api/draws?${exportParams.toString()}`);
    const exportData: DrawsResponse = await res.json();

    if (!exportData.draws?.length) {
      alert("No data available to export.");
      return;
    }

    const doc = new jsPDF("p", "pt", "a4");

    doc.setFillColor(15, 23, 42);
    doc.rect(0, 0, 595, 80, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(20);
    doc.setFont("helvetica", "bold");
    doc.text("BondCheck PRO", 40, 45);
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.text("Prize Bond Report", 545, 40, { align: "right" });
    doc.text(
      new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }),
      545, 53, { align: "right" }
    );

    doc.setTextColor(71, 85, 105);
    doc.setFontSize(8);
    const summary = [
      filters.denomination ? `Denom: ${filters.denomination}` : "All Denoms",
      filters.year ? `Year: ${filters.year}` : "All Years",
      filters.rank ? `Rank: ${filters.rank}` : "All Ranks",
    ].join(" | ");
    doc.text(`FILTERS: ${summary}`, 40, 105);

    const tableData = exportData.draws.map((d, i) => [
      i + 1,
      d.bond_number,
      `Rs. ${d.denomination}`,
      d.prize_position,
      `Rs. ${(d.prize_amount || 0).toLocaleString()}`,
      d.draw_date,
    ]);

    autoTable(doc, {
      startY: 120,
      head: [["#", "Bond #", "Denom", "Rank", "Prize Amount", "Draw Date"]],
      body: tableData,
      theme: "striped",
      headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255], fontSize: 9, fontStyle: "bold", halign: "center" },
      bodyStyles: { fontSize: 8, valign: "middle" },
      columnStyles: {
        0: { halign: "center", fontStyle: "bold", cellWidth: 30 },
        1: { halign: "center", fontStyle: "bold" },
        2: { halign: "center" },
        3: { halign: "center" },
        4: { halign: "right" },
        5: { halign: "center" },
      },
      margin: { left: 40, right: 40 },
      didDrawPage: () => {
        const pageHeight = doc.internal.pageSize.height;
        doc.setDrawColor(226, 232, 240);
        doc.line(40, pageHeight - 40, 555, pageHeight - 40);
        doc.setFontSize(8);
        doc.setTextColor(148, 163, 184);
        doc.text("bondcheckpro", 40, pageHeight - 25);
        doc.text("Page " + (doc.internal as unknown as { getNumberOfPages: () => number }).getNumberOfPages(), 520, pageHeight - 25);
      },
    });

    doc.save(`BondCheck_Report_${Date.now()}.pdf`);
  }, [filters]), 2000);

  const [handlePageChange, pageDisabled] = useThrottle(useCallback((p: number) => {
    setPage(p);
  }, []), 300);

  const [handleOpenScanner, scannerBtnDisabled] = useThrottle(useCallback(() => {
    setScannerOpen(true);
  }, []), 500);

  const hasActiveFilters = !!(
    filters.denomination || filters.rank || filters.year || filters.minAmount
  );

  return (
    <>
      <Header onRefresh={handleRefresh} refreshDisabled={refreshDisabled || isLoading} />
      <StatsDashboard refreshKey={refreshKey} />
      <FilterPanel
        filters={filters}
        onChange={setFilters}
        onSearch={handleSearch}
        onOpenScanner={handleOpenScanner}
        onExportPDF={handleExportPDF}
        onReset={handleReset}
        hasActiveFilters={hasActiveFilters}
        searchDisabled={searchDisabled}
        scannerDisabled={scannerBtnDisabled}
        exportDisabled={exportDisabled}
        resetDisabled={resetDisabled}
      />
      <ResultsTable
        draws={data?.draws ?? []}
        total={data?.total ?? 0}
        page={page}
        limit={filters.rowLimit}
        onPageChange={handlePageChange}
        onLimitChange={(n) => { setFilters((f) => ({ ...f, rowLimit: n })); setPage(0); }}
        isLoading={isLoading}
        filters={{
          denomination: filters.denomination,
          rank: filters.rank,
          year: filters.year,
          minAmount: filters.minAmount,
          sortBy: filters.sortBy,
          sortOrder: filters.sortOrder,
        }}
        onFilterChange={handleFilterChange}
        onSort={handleSort}
        pageDisabled={pageDisabled}
        onReset={handleReset}
        hasActiveFilters={hasActiveFilters}
      />
      <ScannerModal
        isOpen={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onBondsFound={handleBondsFound}
      />
    </>
  );
}
