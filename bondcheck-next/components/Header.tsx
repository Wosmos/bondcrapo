"use client";

export function Header({ onRefresh, refreshDisabled }: { onRefresh: () => void; refreshDisabled: boolean }) {
  return (
    <header className="flex justify-between items-center mb-10 border-b border-gray-100 pb-6">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 bg-[#0f172a] flex items-center justify-center rounded-sm">
          <svg className="w-4.5 h-4.5" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 7a2 2 0 012-2h14a2 2 0 012 2v3a2 2 0 000 4v3a2 2 0 01-2 2H5a2 2 0 01-2-2v-3a2 2 0 000-4V7z" />
            <path d="M9 12l2 2 4-4" />
          </svg>
        </div>
        <h1 className="text-xl font-bold tracking-tight">
          BondCheck{" "}
          <span className="text-gray-400 font-normal">PRO</span>
        </h1>
      </div>
      <div className="flex items-center gap-4">
        <button
          onClick={onRefresh}
          disabled={refreshDisabled}
          className="p-2 text-gray-400 hover:text-[#0f172a] transition-colors rounded-full hover:bg-gray-100 disabled:opacity-30 disabled:pointer-events-none"
          title={refreshDisabled ? "Loading..." : "Reload Data"}
        >
          <svg className={`w-5 h-5 transition-transform${refreshDisabled ? " animate-spin" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        </button>
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-xs font-medium uppercase tracking-wide text-gray-500">
            System Online
          </span>
        </div>
      </div>
    </header>
  );
}
