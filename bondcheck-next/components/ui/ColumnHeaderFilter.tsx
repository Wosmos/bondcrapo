"use client";

import { useState, useEffect, useRef } from "react";

interface SelectFilterProps {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
  sortKey?: string;
  sortBy?: string;
  sortOrder?: "ASC" | "DESC" | null;
  onSort?: () => void;
}

interface InputFilterProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  sortKey?: string;
  sortBy?: string;
  sortOrder?: "ASC" | "DESC" | null;
  onSort?: () => void;
}

function SortIcon({ direction }: { direction: "ASC" | "DESC" | null }) {
  return (
    <svg
      className={`w-3 h-3 ml-0.5 shrink-0 transition-colors ${direction ? "text-emerald-600" : "text-gray-300"}`}
      viewBox="0 0 12 12"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
    >
      {direction === "ASC" ? (
        <path d="M6 9V3M3.5 5.5L6 3l2.5 2.5" />
      ) : direction === "DESC" ? (
        <path d="M6 3v6M3.5 6.5L6 9l2.5-2.5" />
      ) : (
        <>
          <path d="M4 4.5L6 2.5l2 2" />
          <path d="M4 7.5L6 9.5l2-2" />
        </>
      )}
    </svg>
  );
}

export function SelectColumnFilter({
  label,
  value,
  options,
  onChange,
  sortKey,
  sortBy,
  sortOrder,
  onSort,
}: SelectFilterProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const active = value !== "";
  const isSorted = sortKey && sortBy === sortKey;
  const displayLabel = active ? options.find((o) => o.value === value)?.label : "All";

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    if (open) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <div className="flex items-center gap-1.5" ref={ref}>
      <button
        type="button"
        onClick={onSort}
        className="flex items-center text-gray-500 font-bold uppercase text-[0.65rem] tracking-wider hover:text-gray-900 transition-colors cursor-pointer select-none whitespace-nowrap"
      >
        {label}
        {onSort && <SortIcon direction={isSorted ? (sortOrder ?? null) : null} />}
      </button>
      <div className="relative">
        <button
          type="button"
          onClick={() => setOpen(!open)}
          className={`flex items-center gap-1 text-[10px] h-5 rounded-full px-2 font-semibold transition-all cursor-pointer whitespace-nowrap ${
            active
              ? "bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100"
              : "bg-gray-50 text-gray-400 border border-gray-200 hover:bg-gray-100 hover:text-gray-600"
          }`}
        >
          {displayLabel}
          <svg className="w-2.5 h-2.5 shrink-0" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
            <path d={open ? "M2.5 6.5L5 4l2.5 2.5" : "M2.5 4L5 6.5L7.5 4"} />
          </svg>
          {active && (
            <span
              onClick={(e) => { e.stopPropagation(); onChange(""); setOpen(false); }}
              className="ml-0.5 hover:text-red-500 cursor-pointer"
            >
              &times;
            </span>
          )}
        </button>
        {open && (
          <div className="absolute top-6 left-0 z-50 bg-white border border-gray-200 rounded-lg shadow-lg py-1 min-w-[100px] max-h-48 overflow-y-auto scrollbar-none">
            {options.map((o) => (
              <button
                key={o.value}
                type="button"
                onClick={() => { onChange(o.value); setOpen(false); }}
                className={`block w-full text-left px-3 py-1.5 text-[11px] font-medium transition-colors ${
                  o.value === value
                    ? "bg-emerald-50 text-emerald-700"
                    : "text-gray-600 hover:bg-gray-50"
                }`}
              >
                {o.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export function InputColumnFilter({
  label,
  value,
  onChange,
  placeholder = "Min",
  sortKey,
  sortBy,
  sortOrder,
  onSort,
}: InputFilterProps) {
  const [local, setLocal] = useState(value);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();
  const isSorted = sortKey && sortBy === sortKey;
  const active = !!local;

  useEffect(() => {
    setLocal(value);
  }, [value]);

  const handleChange = (v: string) => {
    setLocal(v);
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => onChange(v), 300);
  };

  return (
    <div className="flex items-center gap-1.5">
      <button
        type="button"
        onClick={onSort}
        className="flex items-center text-gray-500 font-bold uppercase text-[0.65rem] tracking-wider hover:text-gray-900 transition-colors cursor-pointer select-none whitespace-nowrap"
      >
        {label}
        {onSort && <SortIcon direction={isSorted ? (sortOrder ?? null) : null} />}
      </button>
      <div className="relative">
        <input
          type="number"
          value={local}
          onChange={(e) => handleChange(e.target.value)}
          placeholder={placeholder}
          className={`text-[10px] h-5 w-[72px] rounded-full px-2 font-semibold focus:outline-none focus:ring-1 focus:ring-emerald-400 transition-all ${
            active
              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
              : "bg-gray-50 text-gray-400 border border-gray-200 placeholder:text-gray-300"
          }`}
        />
        {active && (
          <button
            type="button"
            onClick={() => { setLocal(""); onChange(""); }}
            className="absolute right-1.5 top-1 text-[10px] text-gray-400 hover:text-red-500"
          >
            &times;
          </button>
        )}
      </div>
    </div>
  );
}

export function SortableHeader({
  label,
  sortKey,
  sortBy,
  sortOrder,
  onSort,
}: {
  label: string;
  sortKey?: string;
  sortBy?: string;
  sortOrder?: "ASC" | "DESC" | null;
  onSort?: () => void;
}) {
  const isSorted = sortKey && sortBy === sortKey;

  return (
    <div className="flex items-center gap-1.5">
      <button
        type="button"
        onClick={onSort}
        className="flex items-center text-gray-500 font-bold uppercase text-[0.65rem] tracking-wider hover:text-gray-900 transition-colors cursor-pointer select-none whitespace-nowrap"
      >
        {label}
        {onSort && <SortIcon direction={isSorted ? (sortOrder ?? null) : null} />}
      </button>
    </div>
  );
}
