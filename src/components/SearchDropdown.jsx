import { useEffect, useRef } from "react";

/**
 * Search results dropdown
 * Displays search results with icons, titles, and subtitles
 * Supports keyboard navigation highlighting
 */
export default function SearchDropdown({
  results = [],
  selectedIndex = -1,
  isOpen = false,
  onSelect,
  onClose,
}) {
  const dropdownRef = useRef(null);
  const selectedItemRef = useRef(null);

  // Auto-scroll selected item into view
  useEffect(() => {
    if (selectedItemRef.current && selectedIndex >= 0) {
      selectedItemRef.current.scrollIntoView({
        block: "nearest",
        behavior: "smooth",
      });
    }
  }, [selectedIndex]);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        onClose();
      }
    }

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [isOpen, onClose]);

  if (!isOpen || results.length === 0) {
    return null;
  }

  return (
    <div
      ref={dropdownRef}
      className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg z-50 max-h-96 overflow-y-auto"
    >
      {results.length === 0 ? (
        <div className="px-4 py-6 text-center text-sm text-slate-400">
          No results found
        </div>
      ) : (
        <div className="divide-y divide-slate-100">
          {results.map((result, idx) => (
            <button
              key={result.id}
              ref={selectedIndex === idx ? selectedItemRef : null}
              onClick={() => onSelect(result)}
              onMouseEnter={() => {
                // Optional: highlight on hover
              }}
              className={`w-full text-left px-4 py-3 hover:bg-slate-50 transition-colors flex items-start gap-3 group ${
                selectedIndex === idx ? "bg-teal-50 border-l-2 border-teal-500" : ""
              }`}
            >
              {/* Icon */}
              <span className="text-lg shrink-0 mt-0.5">{result.icon}</span>

              {/* Content */}
              <div className="flex-1 min-w-0">
                {/* Title */}
                <p className="text-sm font-semibold text-navy-900 truncate">
                  {result.title || "Untitled"}
                </p>

                {/* Description/Details */}
                {result.description && (
                  <p className="text-xs text-slate-600 truncate mt-0.5">
                    {result.description}
                  </p>
                )}

                {/* Subtitle (module type) */}
                <p className="text-[10px] text-slate-400 mt-1 font-medium">
                  {result.subtitle}
                </p>
              </div>

              {/* Keyboard hint (for selected) */}
              {selectedIndex === idx && (
                <span className="text-xs text-teal-600 font-semibold shrink-0 mt-0.5">
                  ⏎
                </span>
              )}
            </button>
          ))}
        </div>
      )}

      {/* Footer hint */}
      <div className="px-4 py-2 bg-slate-50 border-t border-slate-100 text-[10px] text-slate-400 flex items-center gap-2">
        <span>↑ ↓</span>
        <span>Navigate</span>
        <span className="mx-1">•</span>
        <span>⏎</span>
        <span>Select</span>
        <span className="mx-1">•</span>
        <span>Esc</span>
        <span>Close</span>
      </div>
    </div>
  );
}
