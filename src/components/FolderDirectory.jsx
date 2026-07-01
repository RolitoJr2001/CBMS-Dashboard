import { useMemo, useState } from "react";
import { FaFolder, FaSearch, FaExternalLinkAlt } from "react-icons/fa";
import { folders } from "../data/folders";

export default function FolderDirectory() {
  const [query, setQuery] = useState("");
  const [view, setView] = useState("grid");
  const filtered = useMemo(() => folders.filter(f => f.name.toLowerCase().includes(query.toLowerCase())), [query]);

  return (
    <div className="bg-white rounded-xl border border-slate-100 overflow-hidden flex flex-col h-full">
      <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between gap-3">
        <div className="relative flex-1">
          <FaSearch className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs" />
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search folder..."
            className="w-full pl-7 pr-3 py-1.5 text-sm rounded-lg border border-slate-200 bg-slate-50 focus:bg-white focus:border-teal-400 outline-none"
          />
        </div>
        <div className="flex gap-1 bg-slate-100 rounded-lg p-0.5">
          {["grid","list"].map(v => (
            <button key={v} onClick={() => setView(v)}
              className={`px-2.5 py-1 text-xs rounded-md transition-colors capitalize ${view === v ? "bg-white shadow text-navy-900" : "text-slate-400 hover:text-slate-600"}`}>
              {v}
            </button>
          ))}
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-4">
        {view === "grid" ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {filtered.map(f => (
              <a key={f.id} href={f.link} target="_blank" rel="noopener noreferrer"
                className="group flex flex-col items-center gap-2 p-3 rounded-xl border border-slate-100 hover:border-teal-300 hover:bg-white bg-slate-50/60 transition-all text-center">
                <span className="flex items-center justify-center rounded-xl bg-status-yellowBg text-status-yellow group-hover:scale-105 transition-transform"
                  style={{ width: "clamp(2rem,8vw,3rem)", height: "clamp(2rem,8vw,3rem)", fontSize: "clamp(1rem,4vw,1.5rem)" }}>
                  <FaFolder />
                </span>
                <p className="text-xs font-medium text-navy-900 leading-snug line-clamp-2">{f.name}</p>
                <p className="text-[10px] text-slate-400">{f.items} items</p>
              </a>
            ))}
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {filtered.map(f => (
              <a key={f.id} href={f.link} target="_blank" rel="noopener noreferrer"
                className="group flex items-center gap-3 p-3 rounded-xl border border-slate-100 hover:border-teal-300 bg-slate-50/60 hover:bg-white transition-all">
                <span className="flex items-center justify-center w-9 h-9 rounded-lg bg-status-yellowBg text-status-yellow text-base shrink-0">
                  <FaFolder />
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-navy-900 truncate">{f.name}</p>
                  <p className="text-xs text-slate-400">{f.items} items · {f.updated}</p>
                </div>
                <FaExternalLinkAlt className="text-slate-300 group-hover:text-teal-600 text-xs shrink-0 transition-colors" />
              </a>
            ))}
          </div>
        )}
        {filtered.length === 0 && <p className="py-8 text-center text-slate-400 text-sm">No folders matched.</p>}
      </div>
    </div>
  );
}
