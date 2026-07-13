import { useState } from "react";
import { COLOR_SWATCHES, isValidHexColor } from "../utils/personnelColors";

/**
 * Compact color picker used by PersonnelManager to let the Administrator
 * customize a personnel's chip color. Offers a curated palette of
 * predefined swatches plus a free-form native color input for any hex
 * value, satisfying "Add a color picker or predefined color selector."
 *
 * Props:
 *  - value: current hex color (or null/undefined for "not set yet")
 *  - onChange: async (hex | null) => void
 *  - disabled: bool
 */
export default function ColorPicker({ value, onChange, disabled = false }) {
  const [open, setOpen] = useState(false);
  const [customHex, setCustomHex] = useState(value || "#2563eb");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  async function apply(hex) {
    setSaving(true);
    setErr("");
    try {
      await onChange(hex);
      setOpen(false);
    } catch (e) {
      setErr(e.message || "Failed to update color.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="relative inline-block">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen(v => !v)}
        className="inline-flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-60"
        title="Customize color"
      >
        <span
          className="w-3 h-3 rounded-full border border-slate-300"
          style={{ backgroundColor: value || "#cbd5e1" }}
        />
        Color
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-9 z-50 w-56 bg-white rounded-xl border border-slate-100 shadow-cardHover p-3 space-y-3">
            <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">Predefined colors</p>
            <div className="grid grid-cols-6 gap-2">
              {COLOR_SWATCHES.map(hex => (
                <button
                  key={hex}
                  type="button"
                  disabled={saving}
                  onClick={() => apply(hex)}
                  className={`w-6 h-6 rounded-full border-2 ${value?.toLowerCase() === hex ? "border-navy-900" : "border-white"} shadow-sm`}
                  style={{ backgroundColor: hex }}
                  aria-label={`Use color ${hex}`}
                />
              ))}
            </div>

            <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">Custom color</p>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={isValidHexColor(customHex) ? customHex : "#2563eb"}
                onChange={e => setCustomHex(e.target.value)}
                className="w-8 h-8 rounded cursor-pointer border border-slate-200"
              />
              <input
                value={customHex}
                onChange={e => setCustomHex(e.target.value)}
                placeholder="#2563eb"
                className="flex-1 px-2 py-1.5 text-xs rounded-lg border border-slate-200 outline-none focus:border-teal-400"
              />
              <button
                type="button"
                disabled={saving || !isValidHexColor(customHex)}
                onClick={() => apply(customHex)}
                className="shrink-0 px-2.5 py-1.5 text-[11px] font-medium rounded-lg bg-navy-900 text-white disabled:opacity-50"
              >
                Set
              </button>
            </div>

            {value && (
              <button
                type="button"
                disabled={saving}
                onClick={() => apply(null)}
                className="text-[11px] text-slate-400 hover:text-status-red"
              >
                Reset to default (auto-assigned) color
              </button>
            )}
            {err && <p className="text-[11px] text-status-red">{err}</p>}
          </div>
        </>
      )}
    </div>
  );
}
