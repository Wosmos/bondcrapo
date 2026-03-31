"use client";

import { useState, useCallback, useRef } from "react";

interface ScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onBondsFound: (bonds: string[]) => void;
}

export function ScannerModal({ isOpen, onClose, onBondsFound }: ScannerModalProps) {
  const [status, setStatus] = useState<"idle" | "processing" | "done">("idle");
  const [progressText, setProgressText] = useState("");
  const [progressPercent, setProgressPercent] = useState(0);
  const [foundBonds, setFoundBonds] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const reset = () => {
    setStatus("idle");
    setProgressText("");
    setProgressPercent(0);
    setFoundBonds([]);
  };

  const processFile = useCallback(async (file: File) => {
    setStatus("processing");
    try {
      let text = "";

      if (file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")) {
        setProgressText("Extracting PDF Text...");
        const pdfjsLib = await import("pdfjs-dist");
        pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const content = await page.getTextContent();
          text += content.items.map((item) => ("str" in item ? item.str : "")).join(" ") + " ";
          setProgressPercent(Math.floor((i / pdf.numPages) * 100));
        }
      } else if (file.type === "text/plain" || file.name.toLowerCase().endsWith(".txt")) {
        setProgressText("Reading Text File...");
        text = await file.text();
        setProgressPercent(100);
      } else {
        // OCR
        setProgressText("Running AI OCR...");
        const Tesseract = await import("tesseract.js");
        const worker = await Tesseract.createWorker("eng", undefined, {
          logger: (m) => {
            if (m.status === "recognizing text") {
              setProgressPercent(Math.floor(m.progress * 100));
            }
          },
        });
        await worker.setParameters({ tessedit_char_whitelist: "0123456789" });
        const result = await worker.recognize(file);
        text = result.data.text;
        await worker.terminate();
      }

      const matches = text.match(/\b\d{6}\b/g) || [];
      const unique = [...new Set(matches)];
      setFoundBonds(unique);
      setStatus("done");
    } catch (err) {
      console.error("Extraction Error", err);
      alert("Failed to process file.");
      reset();
    }
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const file = e.dataTransfer.files[0];
      if (file) processFile(file);
    },
    [processFile]
  );

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-[#0f172a]/60 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden border border-gray-100">
        {/* Header */}
        <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
          <h3 className="text-xs font-bold uppercase tracking-widest text-gray-600 flex items-center gap-2">
            <svg className="w-4 h-4 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
            AI Bond Vision
          </h3>
          <button
            onClick={() => { onClose(); reset(); }}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-8">
          {/* Drop Zone */}
          {status === "idle" && (
            <div
              className="border-2 border-dashed border-gray-200 rounded-lg p-10 text-center hover:border-emerald-400 hover:bg-emerald-50/30 transition-all cursor-pointer group"
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDrop}
            >
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                accept="image/*,.pdf,.txt"
                onChange={(e) => e.target.files?.[0] && processFile(e.target.files[0])}
              />
              <div className="w-16 h-16 bg-emerald-50 text-emerald-500 rounded-full flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform">
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                </svg>
              </div>
              <p className="text-sm font-semibold text-gray-700">Drop Image, PDF, or Text File</p>
              <p className="text-[10px] text-gray-400 uppercase tracking-widest mt-2">Supports JPG, PNG, PDF, TXT</p>
            </div>
          )}

          {/* Progress */}
          {status === "processing" && (
            <div className="mt-0">
              <div className="flex justify-between items-end mb-2">
                <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-600">
                  {progressText}
                </span>
                <span className="text-xs font-mono text-emerald-600">{progressPercent}%</span>
              </div>
              <div className="w-full bg-gray-100 h-1.5 rounded-full overflow-hidden">
                <div
                  className="bg-emerald-500 h-full transition-all duration-300"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>
          )}

          {/* Results */}
          {status === "done" && (
            <div className="mt-0">
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">
                Extraction Complete
              </p>
              <div className="bg-gray-50 rounded-lg p-4 border border-gray-100 flex flex-wrap gap-2 max-h-60 overflow-y-auto scrollbar-thin shadow-inner">
                {foundBonds.length === 0 ? (
                  <span className="text-xs text-gray-500 italic">No 6-digit numbers found.</span>
                ) : (
                  foundBonds.map((num) => (
                    <span
                      key={num}
                      className="px-2 py-1 bg-white border border-gray-200 rounded text-xs font-mono font-bold text-[#0f172a] shadow-sm"
                    >
                      {num}
                    </span>
                  ))
                )}
              </div>
              <button
                onClick={() => {
                  onBondsFound(foundBonds);
                  onClose();
                  reset();
                }}
                className="w-full mt-6 h-12 bg-[#0f172a] text-white rounded-md font-bold text-[11px] uppercase tracking-widest hover:bg-black transition-all shadow-lg shadow-[#0f172a]/10"
              >
                Add to Search List
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
