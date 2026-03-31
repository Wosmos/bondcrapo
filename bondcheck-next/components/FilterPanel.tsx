"use client";

import type { FilterState, SearchMode } from "@/types";

interface FilterPanelProps {
  filters: FilterState;
  onChange: (filters: FilterState) => void;
  onSearch: () => void;
  onOpenScanner: () => void;
  onExportPDF: () => void;
  onReset: () => void;
  hasActiveFilters: boolean;
  searchDisabled: boolean;
  scannerDisabled: boolean;
  exportDisabled: boolean;
  resetDisabled: boolean;
}

export function FilterPanel({
  filters,
  onChange,
  onSearch,
  onOpenScanner,
  onExportPDF,
  onReset,
  hasActiveFilters,
  searchDisabled,
  scannerDisabled,
  exportDisabled,
  resetDisabled,
}: FilterPanelProps) {
  const update = (partial: Partial<FilterState>) =>
    onChange({ ...filters, ...partial });

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") onSearch();
  };

  return (
    <div className="p-3 sm:p-4 rounded-lg mb-4 shadow-sm border border-gray-100 bg-white/50 backdrop-blur-md">
      <div className="flex flex-wrap gap-2 sm:gap-3 items-end">
        {/* Search Mode */}
        <div className="w-full sm:w-auto shrink-0">
          <label className="block text-[10px] font-bold uppercase text-gray-400 mb-1 tracking-widest">
            Mode
          </label>
          <select
            value={filters.searchMode}
            onChange={(e) => update({ searchMode: e.target.value as SearchMode })}
            className="w-full sm:w-36 h-9 pl-2.5 pr-7 bg-white border border-gray-200 text-xs font-medium rounded-md appearance-none cursor-pointer hover:border-gray-300 transition-all"
          >
            <option value="single">Single Search</option>
            <option value="multi">Multi-Search</option>
            <option value="series">Bulk Series</option>
            <option value="mixed">Combined</option>
          </select>
        </div>

        {/* Smart Scan */}
        <button
          onClick={onOpenScanner}
          disabled={scannerDisabled}
          className="h-9 px-3 bg-emerald-50 text-emerald-600 border border-emerald-100 hover:bg-emerald-100 rounded-md flex items-center gap-1.5 transition-all font-bold text-[10px] uppercase tracking-widest shrink-0 disabled:opacity-40 disabled:pointer-events-none"
          title="Scan bond numbers"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          <span className="hidden sm:inline">Scan</span>
        </button>

        {/* Dynamic Inputs */}
        <div className="flex-1 flex gap-2 items-end min-w-0">
          {filters.searchMode === "single" && (
            <div className="w-full relative">
              <label className="block text-[10px] font-bold uppercase text-gray-400 mb-1 tracking-widest">
                Bond Number
              </label>
              <input
                type="text"
                value={filters.bondNumber}
                onChange={(e) => update({ bondNumber: e.target.value })}
                onKeyDown={handleKeyDown}
                className="w-full h-9 pl-3 pr-8 bg-white border border-gray-200 text-xs font-medium focus:border-[#0f172a] focus:ring-1 focus:ring-[#0f172a]/10 rounded-md transition-all"
                placeholder="e.g. 123456 or 123..."
              />
              <svg className="w-3.5 h-3.5 absolute right-2.5 top-[30px] text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
          )}

          {(filters.searchMode === "multi" || filters.searchMode === "mixed") && (
            <div className="w-full">
              <label className="block text-[10px] font-bold uppercase text-gray-400 mb-1 tracking-widest">
                Bond Numbers
              </label>
              <input
                type="text"
                value={filters.bondList}
                onChange={(e) => update({ bondList: e.target.value })}
                onKeyDown={handleKeyDown}
                className="w-full h-9 px-3 bg-white border border-gray-200 text-xs font-medium focus:border-[#0f172a] focus:ring-1 focus:ring-[#0f172a]/10 rounded-md transition-all"
                placeholder="112233, 445566, 778899"
              />
            </div>
          )}

          {(filters.searchMode === "series" || filters.searchMode === "mixed") && (
            <div className="flex gap-2 w-full">
              <div className="flex-1">
                <label className="block text-[10px] font-bold uppercase text-gray-400 mb-1 tracking-widest">Start</label>
                <input
                  type="number"
                  value={filters.startBond}
                  onChange={(e) => update({ startBond: e.target.value })}
                  onKeyDown={handleKeyDown}
                  className="w-full h-9 px-3 bg-white border border-gray-200 text-xs font-medium focus:border-[#0f172a] rounded-md transition-all"
                  placeholder="100001"
                />
              </div>
              <div className="flex-1">
                <label className="block text-[10px] font-bold uppercase text-gray-400 mb-1 tracking-widest">End</label>
                <input
                  type="number"
                  value={filters.endBond}
                  onChange={(e) => update({ endBond: e.target.value })}
                  onKeyDown={handleKeyDown}
                  className="w-full h-9 px-3 bg-white border border-gray-200 text-xs font-medium focus:border-[#0f172a] rounded-md transition-all"
                  placeholder="100200"
                />
              </div>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex gap-1.5 shrink-0">
          <button
            onClick={onSearch}
            disabled={searchDisabled}
            className="h-9 px-5 bg-[#0f172a] text-white text-[10px] font-bold uppercase tracking-widest rounded-md hover:bg-[#1e293b] shadow-md shadow-[#0f172a]/15 transition-all shrink-0 disabled:opacity-40 disabled:pointer-events-none"
          >
            Search
          </button>
          <button
            onClick={onExportPDF}
            disabled={exportDisabled}
            className="h-9 w-9 border border-gray-200 bg-white hover:bg-gray-50 text-gray-400 hover:text-gray-600 rounded-md flex items-center justify-center transition-all shrink-0 disabled:opacity-40 disabled:pointer-events-none"
            title="Export PDF"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
          </button>
          {hasActiveFilters && (
            <button
              onClick={onReset}
              disabled={resetDisabled}
              className="h-9 w-9 border border-gray-200 bg-white hover:bg-red-50 text-gray-400 hover:text-red-500 rounded-md flex items-center justify-center transition-all shrink-0 disabled:opacity-40 disabled:pointer-events-none"
              title="Clear all filters"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
