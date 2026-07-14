import { useContext, useEffect, useRef, useState } from "react";
import { MdSend } from "react-icons/md";
import PersonnelChip from "./PersonnelChip";
import { getPersonnelColor } from "../utils/personnelColors";
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

function normalizeText(value) {
  return String(value ?? "").trim().toLowerCase();
}

function isOwnRemark(remark, currentUser) {
  if (!remark || !currentUser) return false;

  const currentIds = [currentUser.id, currentUser.user_id, currentUser.userId, currentUser.uid, currentUser.authId]
    .map(normalizeText)
    .filter(Boolean);
  const remarkIds = [remark.authorId, remark.author_id, remark.userId, remark.user_id, remark.createdBy, remark.created_by]
    .map(normalizeText)
    .filter(Boolean);

  if (currentIds.length && remarkIds.some(id => currentIds.includes(id))) {
    return true;
  }

  const currentValues = [
    currentUser.name,
    currentUser.full_name,
    currentUser.fullName,
    currentUser.username,
    currentUser.email,
    currentUser.user_metadata?.full_name,
    currentUser.user_metadata?.name,
  ].map(normalizeText).filter(Boolean);

  const remarkValues = [
    remark.authorName,
    remark.author_name,
    remark.author?.name,
    remark.author?.full_name,
    remark.author?.fullName,
    remark.author?.username,
    remark.author?.email,
  ].map(normalizeText).filter(Boolean);

  return currentValues.some(value => remarkValues.includes(value));
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
  const ctx = useContext(AppContext);
  const currentUser = ctx?.user ?? null;
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
        className={`rounded-xl border border-slate-200 bg-slate-50/70 overflow-y-auto px-2.5 py-2.5 ${compact ? "max-h-40" : "max-h-72"}`}
      >
        {loading ? (
          <p className="px-2.5 py-2 text-xs text-slate-400">Loading remarks…</p>
        ) : remarks.length === 0 ? (
          <p className="px-2.5 py-2 text-xs text-slate-400">No remarks yet.</p>
        ) : (
          <div className="flex flex-col gap-2.5">
            {remarks.map(r => {
              const fromMe = isOwnRemark(r, currentUser);
              return (
                <div key={r.id} data-remark-id={r.id} className={`flex ${fromMe ? "justify-end" : "justify-start"}`}>
                  <div className={`flex max-w-[85%] items-end gap-2 ${fromMe ? "flex-row-reverse" : "flex-row"}`}>
                    {!fromMe && (
                      <div className="shrink-0">
                        <RemarkAvatar name={r.authorName} />
                      </div>
                    )}
                    <div className={`min-w-0 ${fromMe ? "text-right" : "text-left"}`}>
                      {!fromMe && (
                        <div className="mb-1.5 flex items-center gap-1.5">
                          <PersonnelChip name={r.authorName} size="xs" />
                        </div>
                      )}
                      <div className={`rounded-2xl px-3 py-1 shadow-sm border ${fromMe ? "bg-sky-500 text-white border-sky-500" : "bg-white border-slate-200 text-slate-700"}`}>
                        {/* whitespace-pre-wrap preserves line breaks, blank lines,
                            and indentation exactly as the author typed them. */}
                        <p className="text-xs whitespace-pre-wrap break-words">{r.content}</p>
                      </div>
                      <div className={`mt-1 text-[10px] ${fromMe ? "text-right text-slate-400" : "text-left text-slate-400"}`}>
                        {formatTimestamp(r.createdAt)}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
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
