"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import {
  addHistory,
  getHistory,
  clearHistory,
  deleteHistoryEntry,
  type HistoryEntry,
} from "@/lib/history-db";

// ── Types ─────────────────────────────────────────────────

interface WalletBond {
  id: number;
  bondNumber: string;
  label: string | null;
  denomination: number | null;
  addedAt: string;
}

interface WinResult {
  bond_number: string;
  denomination: number;
  draw_date: string;
  prize_position: string;
  prize_amount: number;
}

interface WalletPanelProps {
  getFingerprint: () => string | null;
  onCheckResults?: (bondList: string) => void;
  track: (payload: { event: string; data?: Record<string, unknown> }) => void;
}

type AddMode = "type" | "paste" | "range" | "file";
type ViewTab = "mybonds" | "history";

function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(ts).toLocaleDateString("en-PK", { day: "numeric", month: "short" });
}

// ── Component ─────────────────────────────────────────────

export function WalletPanel({ getFingerprint, onCheckResults, track }: WalletPanelProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [bonds, setBonds] = useState<WalletBond[]>([]);
  const [addMode, setAddMode] = useState<AddMode>("type");
  const [viewTab, setViewTab] = useState<ViewTab>("mybonds");

  // Type mode
  const [typedBond, setTypedBond] = useState("");
  const [bondLabel, setBondLabel] = useState("");

  // Paste mode
  const [pasteText, setPasteText] = useState("");

  // Range mode
  const [rangeFrom, setRangeFrom] = useState("");
  const [rangeTo, setRangeTo] = useState("");

  // File scanner
  const [scanStatus, setScanStatus] = useState<"idle" | "processing" | "done">("idle");
  const [scanProgress, setScanProgress] = useState(0);
  const [scanText, setScanText] = useState("");
  const [scannedBonds, setScannedBonds] = useState<string[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  // State
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(false);
  const [results, setResults] = useState<Record<string, WinResult[]> | null>(null);
  const [stats, setStats] = useState<{ checked: number; winners: number; totalPrizes: number } | null>(null);

  // History
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [historyReady, setHistoryReady] = useState(false);

  // ── Fetch bonds ─────────────────────────────────────────

  const fetchBonds = useCallback(async () => {
    const fp = getFingerprint();
    if (!fp) return;
    try {
      const res = await fetch(`/api/wallet?fp=${fp}`);
      const data = await res.json();
      setBonds(data.bonds ?? []);
    } catch { /* silent */ }
  }, [getFingerprint]);

  useEffect(() => {
    if (isOpen) {
      fetchBonds();
      if (!historyReady) {
        getHistory(50).then((h) => { setHistory(h); setHistoryReady(true); });
      }
    }
  }, [isOpen, fetchBonds, historyReady]);

  // ── Shared add function ─────────────────────────────────

  const saveBonds = async (numbers: string[], label?: string) => {
    const fp = getFingerprint();
    if (!fp || !numbers.length) return;
    setLoading(true);
    try {
      await fetch("/api/wallet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fingerprint: fp, bondNumber: numbers, label: label || null }),
      });
      track({ event: "wallet_add", data: { count: numbers.length, mode: addMode } });
      await fetchBonds();
    } catch { /* silent */ }
    setLoading(false);
  };

  // ── Mode handlers ───────────────────────────────────────

  const handleType = async () => {
    const nums = typedBond.split(/[,\s]+/).map((b) => b.trim()).filter((b) => /^\d{6}$/.test(b));
    if (!nums.length) return;
    await saveBonds(nums, bondLabel);
    setTypedBond("");
    setBondLabel("");
  };

  const handlePaste = async () => {
    const nums = [...new Set(pasteText.split(/[,\s\n\r]+/).map((b) => b.trim()).filter((b) => /^\d{6}$/.test(b)))];
    if (!nums.length) return;
    await saveBonds(nums, bondLabel);
    setPasteText("");
    setBondLabel("");
  };

  const handleRange = async () => {
    const s = parseInt(rangeFrom), e = parseInt(rangeTo);
    if (isNaN(s) || isNaN(e) || s > e) return;
    if (e - s + 1 > 500) { alert("Maximum 500 bonds in one range."); return; }
    const nums: string[] = [];
    for (let i = s; i <= e; i++) nums.push(i.toString().padStart(6, "0"));
    await saveBonds(nums, bondLabel);
    setRangeFrom("");
    setRangeTo("");
    setBondLabel("");
  };

  const handleAddScanned = async () => {
    if (!scannedBonds.length) return;
    await saveBonds(scannedBonds, bondLabel);
    setScannedBonds([]);
    setScanStatus("idle");
    setScanProgress(0);
    setBondLabel("");
  };

  // ── File processing ─────────────────────────────────────

  const processFile = useCallback(async (file: File) => {
    setScanStatus("processing");
    setScanProgress(0);
    try {
      let text = "";
      const name = file.name.toLowerCase();

      if (name.endsWith(".xlsx") || name.endsWith(".xls") || name.endsWith(".xlsb")) {
        setScanText("Reading your Excel file...");
        const XLSX = await import("xlsx");
        const buf = await file.arrayBuffer();
        const wb = XLSX.read(buf, { type: "array" });
        for (const sn of wb.SheetNames) text += XLSX.utils.sheet_to_csv(wb.Sheets[sn]) + "\n";
        setScanProgress(100);
      } else if (name.endsWith(".csv")) {
        setScanText("Reading your CSV...");
        text = await file.text();
        setScanProgress(100);
      } else if (file.type === "application/pdf" || name.endsWith(".pdf")) {
        setScanText("Reading your PDF...");
        const pdfjsLib = await import("pdfjs-dist");
        pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;
        const pdf = await pdfjsLib.getDocument({ data: await file.arrayBuffer() }).promise;
        for (let i = 1; i <= pdf.numPages; i++) {
          const pg = await pdf.getPage(i);
          const c = await pg.getTextContent();
          text += c.items.map((item) => ("str" in item ? item.str : "")).join(" ") + " ";
          setScanProgress(Math.floor((i / pdf.numPages) * 100));
        }
      } else if (file.type === "text/plain" || name.endsWith(".txt")) {
        setScanText("Reading your file...");
        text = await file.text();
        setScanProgress(100);
      } else {
        setScanText("Scanning your image...");
        const Tesseract = await import("tesseract.js");
        const worker = await Tesseract.createWorker("eng", undefined, {
          logger: (m) => { if (m.status === "recognizing text") setScanProgress(Math.floor(m.progress * 100)); },
        });
        await worker.setParameters({ tessedit_char_whitelist: "0123456789" });
        text = (await worker.recognize(file)).data.text;
        await worker.terminate();
      }

      const unique = [...new Set((text.match(/\b\d{6}\b/g) || []))];
      setScannedBonds(unique);
      setScanStatus("done");
      track({ event: "wallet_scan", data: { fileType: name.split(".").pop(), found: unique.length } });
    } catch {
      alert("Could not read this file. Please try another one.");
      setScanStatus("idle");
    }
  }, [track]);

  // ── Remove bond ─────────────────────────────────────────

  const handleRemove = async (bondNumber: string) => {
    const fp = getFingerprint();
    if (!fp) return;
    try {
      await fetch("/api/wallet", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fingerprint: fp, bondNumber }),
      });
      track({ event: "wallet_remove", data: { bondNumber } });
      setBonds((prev) => prev.filter((b) => b.bondNumber !== bondNumber));
      if (results) { const u = { ...results }; delete u[bondNumber]; setResults(u); }
    } catch { /* silent */ }
  };

  // ── Check all ───────────────────────────────────────────

  const handleCheckAll = async () => {
    const fp = getFingerprint();
    if (!fp || !bonds.length) return;
    setChecking(true);
    setResults(null);
    setStats(null);

    try {
      const res = await fetch("/api/wallet", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fingerprint: fp }),
      });
      const data = await res.json();
      const r = data.results ?? {};
      setResults(r);
      const s = { checked: data.checked ?? 0, winners: data.winners ?? 0, totalPrizes: data.totalPrizes ?? 0 };
      setStats(s);
      track({ event: "wallet_check_all", data: { checked: s.checked, winners: s.winners } });

      const totalAmt = Object.values(r as Record<string, WinResult[]>).flat().reduce((sum: number, w: WinResult) => sum + (w.prize_amount || 0), 0);
      await addHistory({
        type: "check",
        timestamp: Date.now(),
        bondsChecked: s.checked,
        winnersFound: s.winners,
        totalAmount: totalAmt,
        bondNumbers: bonds.map((b) => b.bondNumber),
        results: r,
      });
      getHistory(50).then(setHistory);
    } catch { /* silent */ }
    setChecking(false);
  };

  const handleSearchAll = () => {
    if (onCheckResults && bonds.length) {
      onCheckResults(bonds.map((b) => b.bondNumber).join(", "));
      track({ event: "wallet_search_all", data: { count: bonds.length } });
      setIsOpen(false);
    }
  };

  // ── History ─────────────────────────────────────────────

  const handleClearHistory = async () => { await clearHistory(); setHistory([]); track({ event: "wallet_clear_history" }); };
  const handleDeleteEntry = async (id: number) => { await deleteHistoryEntry(id); setHistory((p) => p.filter((h) => h.id !== id)); };

  // ── Derived ─────────────────────────────────────────────

  const totalWin = results ? Object.values(results).flat().reduce((s, w) => s + (w.prize_amount || 0), 0) : 0;
  const rangeCount = (() => { const s = parseInt(rangeFrom), e = parseInt(rangeTo); return (!isNaN(s) && !isNaN(e) && e >= s) ? e - s + 1 : 0; })();
  const pasteCount = pasteText.match(/\b\d{6}\b/g)?.length ?? 0;

  // ── RENDER ──────────────────────────────────────────────

  return (
    <>
      {/* ── Floating Button ──────────────────────────── */}
      <button
        onClick={() => { setIsOpen(true); track({ event: "wallet_open" }); }}
        className="fixed bottom-6 right-6 z-40 h-14 w-14 bg-[#0f172a] text-white rounded-full shadow-lg shadow-[#0f172a]/25 flex items-center justify-center hover:scale-105 active:scale-95 transition-all"
        title="My Bonds"
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M21 12V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2h14a2 2 0 002-2v-5zm-5 1a1 1 0 100-2 1 1 0 000 2z" />
        </svg>
        {bonds.length > 0 && (
          <span className="absolute -top-1 -right-1 h-5 min-w-5 px-1 bg-emerald-500 text-[10px] font-bold rounded-full flex items-center justify-center">
            {bonds.length}
          </span>
        )}
      </button>

      {/* ── Panel ────────────────────────────────────── */}
      {isOpen && (
        <>
          <div className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40" onClick={() => setIsOpen(false)} />

          <div className="fixed right-0 top-0 bottom-0 w-full max-w-md bg-white z-50 shadow-2xl flex flex-col animate-slide-in">

            {/* Header */}
            <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-[#0f172a] text-white">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 bg-white/10 rounded-lg flex items-center justify-center">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M21 12V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2h14a2 2 0 002-2v-5zm-5 1a1 1 0 100-2 1 1 0 000 2z" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-sm font-bold">My Bonds</h2>
                  <p className="text-[11px] text-gray-400">
                    {bonds.length === 0
                      ? "Save your bonds here"
                      : `${bonds.length} bond${bonds.length !== 1 ? "s" : ""} saved`}
                  </p>
                </div>
              </div>
              <button onClick={() => setIsOpen(false)} className="p-2 hover:bg-white/10 rounded-lg transition-colors">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* ── How to add ─────────────────────────── */}
            <div className="border-b border-gray-100">
              <div className="flex">
                {([
                  { key: "type", label: "Type" },
                  { key: "paste", label: "Paste List" },
                  { key: "range", label: "Range" },
                  { key: "file", label: "From File" },
                ] as { key: AddMode; label: string }[]).map((m) => (
                  <button
                    key={m.key}
                    onClick={() => setAddMode(m.key)}
                    className={`flex-1 py-2.5 text-[10px] font-bold uppercase tracking-wider transition-all border-b-2 ${
                      addMode === m.key
                        ? "border-[#0f172a] text-[#0f172a] bg-white"
                        : "border-transparent text-gray-400 hover:text-gray-500 bg-gray-50/50"
                    }`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>

              <div className="p-4">
                {/* TYPE */}
                {addMode === "type" && (
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={typedBond}
                      onChange={(e) => setTypedBond(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleType()}
                      placeholder="Enter your bond number"
                      className="flex-1 h-10 px-3 bg-white border border-gray-200 text-sm rounded-lg transition-all focus:border-[#0f172a] focus:ring-1 focus:ring-[#0f172a]/10"
                    />
                    <button
                      onClick={handleType}
                      disabled={loading || !typedBond.trim()}
                      className="h-10 px-5 bg-[#0f172a] text-white text-xs font-bold rounded-lg hover:bg-[#1e293b] transition-all disabled:opacity-40 shrink-0"
                    >
                      {loading ? "..." : "Save"}
                    </button>
                  </div>
                )}

                {/* PASTE */}
                {addMode === "paste" && (
                  <div>
                    <textarea
                      value={pasteText}
                      onChange={(e) => setPasteText(e.target.value)}
                      placeholder={"Paste all your bond numbers here...\nOne per line or separated by commas"}
                      rows={3}
                      className="w-full px-3 py-2.5 bg-white border border-gray-200 text-sm font-mono rounded-lg transition-all focus:border-[#0f172a] focus:ring-1 focus:ring-[#0f172a]/10 resize-none"
                    />
                    <div className="flex items-center justify-between mt-2">
                      <span className="text-xs text-gray-400">
                        {pasteCount > 0 ? `${pasteCount} bond${pasteCount !== 1 ? "s" : ""} found` : "Waiting for numbers..."}
                      </span>
                      <button
                        onClick={handlePaste}
                        disabled={loading || pasteCount === 0}
                        className="h-8 px-4 bg-[#0f172a] text-white text-xs font-bold rounded-lg hover:bg-[#1e293b] transition-all disabled:opacity-40"
                      >
                        {loading ? "Saving..." : "Save All"}
                      </button>
                    </div>
                  </div>
                )}

                {/* RANGE */}
                {addMode === "range" && (
                  <div>
                    <div className="flex gap-2 items-center">
                      <input
                        type="number"
                        value={rangeFrom}
                        onChange={(e) => setRangeFrom(e.target.value)}
                        placeholder="From e.g. 100001"
                        className="flex-1 h-10 px-3 bg-white border border-gray-200 text-sm font-mono rounded-lg transition-all focus:border-[#0f172a] focus:ring-1 focus:ring-[#0f172a]/10"
                      />
                      <span className="text-gray-300 font-bold text-sm">to</span>
                      <input
                        type="number"
                        value={rangeTo}
                        onChange={(e) => setRangeTo(e.target.value)}
                        placeholder="To e.g. 100050"
                        className="flex-1 h-10 px-3 bg-white border border-gray-200 text-sm font-mono rounded-lg transition-all focus:border-[#0f172a] focus:ring-1 focus:ring-[#0f172a]/10"
                      />
                    </div>
                    <div className="flex items-center justify-between mt-2">
                      <span className={`text-xs ${rangeCount > 500 ? "text-red-500 font-bold" : "text-gray-400"}`}>
                        {rangeCount > 500
                          ? "Too many — max 500 at a time"
                          : rangeCount > 0
                            ? `${rangeCount} bond${rangeCount !== 1 ? "s" : ""} in this range`
                            : "Enter a start and end number"}
                      </span>
                      <button
                        onClick={handleRange}
                        disabled={loading || rangeCount <= 0 || rangeCount > 500}
                        className="h-8 px-4 bg-[#0f172a] text-white text-xs font-bold rounded-lg hover:bg-[#1e293b] transition-all disabled:opacity-40"
                      >
                        {loading ? "Saving..." : "Save Range"}
                      </button>
                    </div>
                  </div>
                )}

                {/* FILE SCAN */}
                {addMode === "file" && (
                  <div>
                    {scanStatus === "idle" && (
                      <div
                        className="border-2 border-dashed border-gray-200 rounded-xl p-6 text-center hover:border-emerald-400 hover:bg-emerald-50/20 transition-all cursor-pointer group"
                        onClick={() => fileRef.current?.click()}
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={(e) => { e.preventDefault(); e.dataTransfer.files[0] && processFile(e.dataTransfer.files[0]); }}
                      >
                        <input
                          ref={fileRef}
                          type="file"
                          className="hidden"
                          accept="image/*,.pdf,.txt,.csv,.xlsx,.xls,.xlsb"
                          onChange={(e) => e.target.files?.[0] && processFile(e.target.files[0])}
                        />
                        <svg className="w-10 h-10 mx-auto mb-2 text-gray-300 group-hover:text-emerald-400 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                        </svg>
                        <p className="text-sm font-medium text-gray-600">Drop a file or tap to browse</p>
                        <p className="text-[11px] text-gray-400 mt-1">
                          Photo, PDF, Excel, CSV, or text file
                        </p>
                      </div>
                    )}

                    {scanStatus === "processing" && (
                      <div className="py-4">
                        <p className="text-sm text-gray-600 mb-2">{scanText}</p>
                        <div className="w-full bg-gray-100 h-2 rounded-full overflow-hidden">
                          <div className="bg-emerald-500 h-full rounded-full transition-all duration-300" style={{ width: `${scanProgress}%` }} />
                        </div>
                        <p className="text-xs text-gray-400 mt-1">{scanProgress}%</p>
                      </div>
                    )}

                    {scanStatus === "done" && (
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-sm font-medium text-gray-700">
                            Found {scannedBonds.length} bond{scannedBonds.length !== 1 ? "s" : ""}
                          </p>
                          <button
                            onClick={() => { setScanStatus("idle"); setScannedBonds([]); }}
                            className="text-xs text-gray-400 hover:text-gray-600 underline"
                          >
                            Try another file
                          </button>
                        </div>
                        <div className="bg-gray-50 rounded-lg p-3 flex flex-wrap gap-1.5 max-h-24 overflow-y-auto scrollbar-thin border border-gray-100">
                          {scannedBonds.length === 0 ? (
                            <span className="text-sm text-gray-400">No bond numbers found in this file.</span>
                          ) : (
                            scannedBonds.map((n) => (
                              <span key={n} className="px-2 py-0.5 bg-white border border-gray-200 rounded text-xs font-mono font-bold">{n}</span>
                            ))
                          )}
                        </div>
                        {scannedBonds.length > 0 && (
                          <button
                            onClick={handleAddScanned}
                            disabled={loading}
                            className="w-full mt-3 h-10 bg-[#0f172a] text-white text-xs font-bold rounded-lg hover:bg-[#1e293b] transition-all disabled:opacity-40"
                          >
                            {loading ? "Saving..." : `Save ${scannedBonds.length} Bonds`}
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Optional label — all modes except file */}
                {addMode !== "file" && (
                  <input
                    type="text"
                    value={bondLabel}
                    onChange={(e) => setBondLabel(e.target.value)}
                    placeholder="Add a note (optional) — e.g. Abba's bonds"
                    className="w-full h-8 mt-2.5 px-3 bg-gray-50 border border-gray-200 text-xs text-gray-500 rounded-lg transition-all focus:border-[#0f172a] focus:ring-1 focus:ring-[#0f172a]/10"
                  />
                )}
              </div>
            </div>

            {/* ── View Tabs ──────────────────────────── */}
            <div className="flex border-b border-gray-100">
              <button
                onClick={() => setViewTab("mybonds")}
                className={`flex-1 py-2.5 text-xs font-bold transition-all border-b-2 ${
                  viewTab === "mybonds" ? "border-[#0f172a] text-[#0f172a]" : "border-transparent text-gray-400"
                }`}
              >
                My Bonds{bonds.length > 0 && ` (${bonds.length})`}
              </button>
              <button
                onClick={() => setViewTab("history")}
                className={`flex-1 py-2.5 text-xs font-bold transition-all border-b-2 ${
                  viewTab === "history" ? "border-[#0f172a] text-[#0f172a]" : "border-transparent text-gray-400"
                }`}
              >
                Past Checks{history.length > 0 && ` (${history.length})`}
              </button>
            </div>

            {/* ── Quick Actions ──────────────────────── */}
            {viewTab === "mybonds" && bonds.length > 0 && (
              <div className="p-3 border-b border-gray-100 flex gap-2">
                <button
                  onClick={handleCheckAll}
                  disabled={checking}
                  className="flex-1 h-10 bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-bold rounded-lg hover:bg-emerald-100 transition-all disabled:opacity-40 flex items-center justify-center gap-2"
                >
                  {checking ? (
                    <>
                      <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      Checking...
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      Did I Win?
                    </>
                  )}
                </button>
                <button
                  onClick={handleSearchAll}
                  className="h-10 px-4 border border-gray-200 bg-white text-gray-600 text-xs font-bold rounded-lg hover:bg-gray-50 transition-all flex items-center gap-1.5"
                  title="View all bonds in main results"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  View All
                </button>
              </div>
            )}

            {/* ── Results Banner ─────────────────────── */}
            {viewTab === "mybonds" && stats && (
              <div className={`mx-4 mt-3 p-3.5 rounded-xl border ${stats.winners > 0 ? "bg-emerald-50 border-emerald-200" : "bg-gray-50 border-gray-200"}`}>
                <div className="flex items-center gap-3">
                  {stats.winners > 0 ? (
                    <>
                      <div className="h-10 w-10 rounded-full bg-emerald-500 text-white flex items-center justify-center shrink-0">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                      <div>
                        <p className="text-sm font-bold text-emerald-800">
                          Congratulations! You won!
                        </p>
                        <p className="text-xs text-emerald-600 mt-0.5">
                          {stats.totalPrizes} prize{stats.totalPrizes !== 1 ? "s" : ""} worth Rs. {totalWin.toLocaleString()}
                        </p>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="h-10 w-10 rounded-full bg-gray-200 text-gray-500 flex items-center justify-center shrink-0">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                        </svg>
                      </div>
                      <div>
                        <p className="text-sm font-bold text-gray-700">No wins this time</p>
                        <p className="text-xs text-gray-500 mt-0.5">
                          Checked {stats.checked} bond{stats.checked !== 1 ? "s" : ""} — better luck next draw!
                        </p>
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}

            {/* ── Scrollable Content ─────────────────── */}
            <div className="flex-1 overflow-y-auto scrollbar-thin">

              {/* MY BONDS */}
              {viewTab === "mybonds" && (
                <div className="p-4 space-y-2">
                  {bonds.length === 0 ? (
                    <div className="text-center py-16 text-gray-400">
                      <svg className="w-16 h-16 mx-auto mb-4 text-gray-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M21 12V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2h14a2 2 0 002-2v-5zm-5 1a1 1 0 100-2 1 1 0 000 2z" />
                      </svg>
                      <p className="text-sm font-medium text-gray-500">No bonds saved yet</p>
                      <p className="text-xs mt-1.5 max-w-[220px] mx-auto leading-relaxed">
                        Add your prize bond numbers above and we&apos;ll check them against every draw for you
                      </p>
                    </div>
                  ) : (
                    bonds.map((bond) => {
                      const wins = results?.[bond.bondNumber];
                      const isWinner = wins && wins.length > 0;
                      const winCount = wins?.length ?? 0;
                      const winTotal = wins?.reduce((s, w) => s + (w.prize_amount || 0), 0) ?? 0;

                      return (
                        <div
                          key={bond.id}
                          className={`p-3.5 rounded-xl border transition-all ${
                            isWinner
                              ? "bg-emerald-50 border-emerald-200 ring-1 ring-emerald-300"
                              : results && !isWinner
                                ? "bg-white border-gray-100 opacity-50"
                                : "bg-white border-gray-100 hover:border-gray-200 hover:shadow-sm"
                          }`}
                        >
                          {/* Bond number + badges */}
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="font-mono text-base font-bold tracking-wider shrink-0">
                                {bond.bondNumber}
                              </span>
                              {bond.label && (
                                <span className="text-[11px] text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full truncate max-w-[130px]">
                                  {bond.label}
                                </span>
                              )}
                              {isWinner && winCount === 1 && (
                                <span className="text-[10px] font-bold text-white bg-emerald-500 px-2 py-0.5 rounded-full shrink-0">
                                  WINNER
                                </span>
                              )}
                              {isWinner && winCount > 1 && (
                                <span className="text-[10px] font-bold text-white bg-amber-500 px-2 py-0.5 rounded-full shrink-0">
                                  WON {winCount} TIMES!
                                </span>
                              )}
                            </div>
                            <button
                              onClick={() => handleRemove(bond.bondNumber)}
                              className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors shrink-0"
                              title="Remove"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          </div>

                          {/* Total if multiple wins */}
                          {isWinner && winCount > 1 && (
                            <p className="mt-2 text-xs font-bold text-emerald-800">
                              Total winnings: Rs. {winTotal.toLocaleString()}
                            </p>
                          )}

                          {/* Win timeline — each draw is a row */}
                          {isWinner && (
                            <div className="mt-2 space-y-1.5">
                              {wins.map((w, i) => (
                                <div key={i} className="flex items-center text-xs text-emerald-700 bg-emerald-100/60 px-3 py-2 rounded-lg">
                                  <div className="flex items-center gap-1.5 shrink-0">
                                    <span className="h-5 w-5 rounded-full bg-emerald-500 text-white text-[9px] font-bold flex items-center justify-center">
                                      {winCount > 1 ? i + 1 : "✓"}
                                    </span>
                                  </div>
                                  <div className="ml-2.5 flex items-center gap-2 flex-wrap">
                                    <span className="font-bold">{w.prize_position} Prize</span>
                                    <span className="text-emerald-600">Rs. {w.denomination.toLocaleString()}</span>
                                    <span className="font-bold">Rs. {w.prize_amount.toLocaleString()}</span>
                                  </div>
                                  <span className="text-emerald-500 ml-auto text-[11px] shrink-0">{w.draw_date}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              )}

              {/* HISTORY */}
              {viewTab === "history" && (
                <div className="p-4">
                  {history.length > 0 && (
                    <div className="flex justify-end mb-3">
                      <button
                        onClick={handleClearHistory}
                        className="text-xs text-red-400 hover:text-red-600 flex items-center gap-1 transition-colors"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                        Remove all history
                      </button>
                    </div>
                  )}

                  {history.length === 0 ? (
                    <div className="text-center py-16 text-gray-400">
                      <svg className="w-14 h-14 mx-auto mb-4 text-gray-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <p className="text-sm font-medium text-gray-500">No checks yet</p>
                      <p className="text-xs mt-1.5">Your check history will appear here</p>
                    </div>
                  ) : (
                    <div className="space-y-2.5">
                      {history.map((entry) => {
                        const won = entry.winnersFound > 0;
                        return (
                          <div
                            key={entry.id}
                            className={`p-3.5 rounded-xl border ${won ? "bg-emerald-50/50 border-emerald-200" : "bg-white border-gray-100"}`}
                          >
                            <div className="flex items-start justify-between">
                              <div className="flex items-center gap-2.5">
                                <div className={`h-8 w-8 rounded-full flex items-center justify-center shrink-0 ${won ? "bg-emerald-500 text-white" : "bg-gray-200 text-gray-500"}`}>
                                  {won ? (
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                                    </svg>
                                  ) : (
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                                    </svg>
                                  )}
                                </div>
                                <div>
                                  <p className="text-xs font-bold text-gray-700">
                                    {won
                                      ? `Won Rs. ${entry.totalAmount.toLocaleString()}!`
                                      : "No wins"}
                                  </p>
                                  <p className="text-[11px] text-gray-400">
                                    {entry.bondsChecked} bonds checked · {timeAgo(entry.timestamp)}
                                  </p>
                                </div>
                              </div>
                              <button
                                onClick={() => entry.id && handleDeleteEntry(entry.id)}
                                className="p-1 text-gray-300 hover:text-red-400 transition-colors"
                              >
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                              </button>
                            </div>

                            {won && Object.entries(entry.results).length > 0 && (
                              <div className="mt-2 space-y-1">
                                {Object.entries(entry.results).map(([bn, wins]) =>
                                  wins.map((w, i) => (
                                    <div key={`${bn}-${i}`} className="flex items-center gap-2 text-[11px] text-emerald-600 bg-emerald-100/50 px-2.5 py-1.5 rounded-lg">
                                      <span className="font-mono font-bold">{bn}</span>
                                      <span>{w.prize_position}</span>
                                      <span className="font-bold">Rs. {w.prize_amount.toLocaleString()}</span>
                                    </div>
                                  ))
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-3 border-t border-gray-100 bg-gray-50/50">
              <p className="text-[11px] text-gray-400 text-center">
                Everything is saved on this device — no login needed
              </p>
            </div>
          </div>
        </>
      )}
    </>
  );
}
