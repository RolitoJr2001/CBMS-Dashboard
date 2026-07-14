import { useEffect, useRef, useState } from "react";
import { MdSend } from "react-icons/md";
import PersonnelChip from "./PersonnelChip";
import { getPersonnelColor } from "../utils/personnelColors";
import { useContext } from "react";
import { AppContext } from "../context/AppContext";
import { formatDisplayDateTime } from "../utils/formatters";

function formatTimestamp(value) {
  return formatDisplayDateTime(value);
}

function initialsFor(name) {
  const trimmed = String(name || "").trim();
  if (!trimmed) return "?";
  const parts = trimmed.split(/\s+/);
  return ((parts[0]?.[0] || "") + (parts[1]?.[0] || "")).toUpperCase() || trimmed[0].toUpperCase();
}

/**
 * Small circular avatar for a remark's author. Falls back to a colored
 * initials badge (using the same color as that person's chip, so it's
 * visually consistent) when no avatar image is available — this is what
 * "User avatar (if available)" means here, since the system doesn't yet
 * collect uploaded profile photos for every account.
 */
function RemarkAvatar({ name }) {
  const ctx = useContext(AppContext);
  const customColor = ctx?.personnelColorMap?.[String(name || "").trim().toLowerCase()];
  const color = getPersonnelColor(name, { customColor });
  const style = color.custom ? { backgroundColor: color.solid } : undefined;
  return (
    <span
      className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-[10px] font-bold text-white shrink-0 ${color.custom ? "" : color.dot}`}
      style={style}
    >
      {initialsFor(name)}
    </span>
  );
}

/**
 * Chat-style remarks history. Renders every past remark (avatar, user,
 * date & time, content) and — if `onAdd` is provided — an input for
 * posting a new one. Previous remarks are never edited or removed; adding
 * a remark always appends a new entry. New remarks (posted by anyone,
 * synced live via Supabase Realtime) automatically scroll into view.
 *
 * Props:
 *  - remarks: array of { id, content, authorName, createdAt }
 *  - onAdd: async (text) => void — called when the user submits
 *  - loading: bool — shows a lightweight loading state
 *  - disabled: bool — hides/disables the composer (e.g. no permission)
 *  - compact: bool — tighter spacing for use inside table cells/cards
 *  - autoScrollToLatest: bool — scroll straight to the newest remark on
 *    mount (used when arriving here via a notification click)
 */
export default function RemarksThread({ remarks = [], onAdd, loading = false, disabled = false, compact = false, autoScrollToLatest = false }) {
  const [draft, setDraft] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const listRef = useRef(null);
  const bottomRef = useRef(null);
  const prevCountRef = useRef(remarks.length);

  // Preserve "modern messaging app" feel: auto-scroll to the newest
  // message whenever the thread grows (a remark I posted, or one that
  // just arrived live from someone else), but don't yank the scroll
  // position around on the very first render unless explicitly asked to.
  useEffect(() => {
    const grew = remarks.length > prevCountRef.current;
    prevCountRef.current = remarks.length;
    if ((grew || autoScrollToLatest) && bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: "smooth", block: "end" });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remarks.length, autoScrollToLatest]);

  async function handleSubmit() {
    const value = draft.trim();
    if (!value || !onAdd) return;
    setSubmitting(true);
    setError("");
    try {
      await onAdd(value);
      setDraft("");
    } catch (err) {
      setError(err.message || "Failed to add remark.");
    } finally {
      setSubmitting(false);
    }
  }

  function handleKeyDown(e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  }

  return (
    <div className="space-y-2">
      <div
        ref={listRef}
        className={`rounded-md border border-slate-100 bg-slate-50 divide-y divide-slate-100 overflow-y-auto ${compact ? "max-h-40" : "max-h-64"}`}
      >
        {loading ? (
          <p className="px-2.5 py-2 text-xs text-slate-400">Loading remarks…</p>
        ) : remarks.length === 0 ? (
          <p className="px-2.5 py-2 text-xs text-slate-400">No remarks yet.</p>
        ) : (
          remarks.map(r => (
            <div key={r.id} data-remark-id={r.id} className="px-2.5 py-2 flex items-start gap-2">
              <RemarkAvatar name={r.authorName} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2 mb-0.5">
                  <PersonnelChip name={r.authorName} size="xs" />
                  <span className="text-[10px] text-slate-400 whitespace-nowrap">{formatTimestamp(r.createdAt)}</span>
                </div>
                {/* whitespace-pre-wrap preserves line breaks, blank lines,
                    and indentation exactly as the author typed them. */}
                <p className="text-xs text-slate-700 whitespace-pre-wrap break-words">{r.content}</p>
              </div>
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>

      {onAdd && !disabled && (
        <div className="flex items-start gap-1.5">
          <textarea
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={compact ? 1 : 2}
            placeholder="Add a remark…"
            className="w-full px-2 py-1.5 text-xs rounded border border-slate-200 bg-white outline-none focus:border-teal-400 resize-none"
          />
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting || !draft.trim()}
            className="shrink-0 inline-flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-medium rounded bg-navy-900 text-white hover:bg-navy-800 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <MdSend className="text-xs" /> {submitting ? "..." : "Post"}
          </button>
        </div>
      )}
      {error && <p className="text-[11px] text-status-red">{error}</p>}
    </div>
  );
}
