import { useContext } from "react";
import { AppContext } from "../context/AppContext";
import { getPersonnelColor } from "../utils/personnelColors";

function buildLookupKeys(value) {
  const base = String(value || "").trim().toLowerCase();
  if (!base) return [];
  return [base, base.replace(/\s+/g, ""), base.replace(/[^a-z0-9]+/g, "")].filter(Boolean);
}
/**
 * Colored chip/tag for a personnel name. Used consistently across
 * Task cards, Assignment lists, Activity logs, Document assignments,
 * Schedule & Events, Notifications, and Remarks history — so the same
 * person always reads the same color everywhere in the app.
 *
 * Color resolution order:
 *  1. An Administrator-picked custom color for this name (read from
 *     AppContext's personnelColorMap, sourced from personnel.color in
 *     the database) — this is what makes colors customizable and lets
 *     an update apply instantly everywhere via realtime sync.
 *  2. "admin" role forces red, per the spec's example.
 *  3. A deterministic hash of the name, so colors still stay stable
 *     and consistent even before an admin has customized anything.
 *
 * PersonnelChip reads from AppContext directly (rather than requiring
 * every caller to pass a color down) so any existing call site picks
 * up custom colors automatically, with no prop changes needed.
 */
export default function PersonnelChip({ name, role, size = "sm", onRemove, className = "" }) {
  const label = String(name || "").trim();
  // useContext(AppContext) directly (not the useApp() hook) so this
  // component never throws if it's ever rendered outside <AppProvider>
  // (e.g. in isolation/tests) — it just falls back to the hash palette.
  const ctx = useContext(AppContext);
  if (!label) return null;

  const lookupKeys = buildLookupKeys(label);
  const customColor = lookupKeys
    .map(key => ctx?.personnelColorMap?.[key])
    .find(Boolean) || ctx?.personnel?.find((person) => {
      const values = [person?.name, person?.username, person?.full_name, person?.fullName]
        .map(value => String(value || "").trim().toLowerCase())
        .filter(Boolean);
      return values.some(value => lookupKeys.includes(value) || lookupKeys.includes(value.replace(/\s+/g, "")) || lookupKeys.includes(value.replace(/[^a-z0-9]+/g, "")));
    })?.color;
  const color = getPersonnelColor(label, { role, customColor });

  const sizeClasses = size === "xs"
    ? "px-1.5 py-0.5 text-[10px] gap-1"
    : "px-2.5 py-1 text-xs gap-1.5";

  const isCustom = Boolean(color.custom);

  return (
    <span
      className={`inline-flex items-center rounded-full font-medium border ${isCustom ? "" : `${color.bg} ${color.text} ${color.border}`} ${sizeClasses} ${className}`}
      style={isCustom ? color.style : undefined}
      title={label}
    >
      <span
        className={`inline-block rounded-full ${isCustom ? "" : color.dot} ${size === "xs" ? "w-1.5 h-1.5" : "w-2 h-2"}`}
        style={isCustom ? color.dotStyle : undefined}
      />
      <span className="truncate max-w-[140px]">{label}</span>
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          className="ml-0.5 opacity-70 hover:opacity-100"
          aria-label={`Remove ${label}`}
        >
          ×
        </button>
      )}
    </span>
  );
}
