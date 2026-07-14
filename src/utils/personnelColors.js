// ─────────────────────────────────────────────────────────────
// Personnel Color Coding
// ─────────────────────────────────────────────────────────────
// Assigns a stable, consistent color to every personnel name across
// the whole app (task cards, assignment lists, dropdowns, activity
// logs, document assignments) WITHOUT requiring a database change.
//
// How it works:
//  - Admin accounts always get "red" (matches the spec's example).
//  - Every other name is hashed deterministically (same name always
//    produces the same number) and mapped onto a fixed palette, so
//    "Viewer 1" is always blue, "Viewer 2" is always green, etc., as
//    long as the underlying name string doesn't change.
//  - The palette below uses Tailwind's built-in color families only
//    (no custom config needed) and every class name is written out
//    literally so Tailwind's JIT scanner can find it.
//
// NOTE: If you'd rather let admins manually pick/override a
// personnel's color (instead of relying on the deterministic hash),
// add a nullable `color` TEXT column to `public.personnel` /
// `public.profiles` and prefer that value here before falling back
// to getPersonnelColor(). No such column exists today, so none of
// the code below assumes one.

const FALLBACK = { key: "slate", bg: "bg-slate-100", text: "text-slate-600", dot: "bg-slate-400", border: "border-slate-200", ring: "ring-slate-200" };

/**
 * Returns the effective color descriptor for a personnel name.
 * When an Administrator has assigned a custom color, that color is used
 * everywhere. Without a custom assignment, the UI falls back to a neutral
 * default so no fixed viewer-color palette remains in effect.
 */
export function getPersonnelColor(name, opts = {}) {
  const normalized = String(name || "").trim().toLowerCase();
  if (!normalized) return FALLBACK;

  if (opts.customColor && isValidHexColor(opts.customColor)) {
    return hexToChipColor(opts.customColor);
  }

  return FALLBACK;
}

// ─────────────────────────────────────────────────────────────
// Custom (admin-picked) colors
// ─────────────────────────────────────────────────────────────
// Personnel colors can now be overridden per-person via a `color` column
// on `public.personnel` (see supabase/migrations/015_personnel_colors_and_realtime.sql).
// Since the color is an arbitrary hex value chosen at runtime, we can't
// rely on Tailwind's static class scanning (JIT only picks up class names
// that appear literally in source). Instead we build the same shape the
// PALETTE entries use, but backed by inline styles keyed off the hex value.

const HEX_RE = /^#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})$/;

export function isValidHexColor(value) {
  return HEX_RE.test(String(value || "").trim());
}

function normalizeHex(hex) {
  let h = String(hex).trim();
  if (h.length === 4) {
    // #abc -> #aabbcc
    h = "#" + [...h.slice(1)].map(c => c + c).join("");
  }
  return h.toLowerCase();
}

function hexToRgb(hex) {
  const h = normalizeHex(hex).slice(1);
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
}

// Relative luminance (per WCAG) so chip text stays readable regardless of
// which color the admin picks — light backgrounds get dark text, and
// vice versa.
function isLightColor(hex) {
  const { r, g, b } = hexToRgb(hex);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.6;
}

/**
 * Builds a chip-color descriptor (bg/text/dot/border expressed as inline
 * `style` objects rather than Tailwind classes) for an arbitrary hex color.
 */
export function hexToChipColor(hex) {
  const normalized = normalizeHex(hex);
  const light = isLightColor(normalized);
  return {
    key: normalized,
    custom: true,
    style: {
      backgroundColor: `${normalized}1f`, // ~12% alpha tint for the chip background
      color: light ? "#3f3f46" : normalized,
      borderColor: `${normalized}55`,
    },
    dotStyle: { backgroundColor: normalized },
    ringStyle: { boxShadow: `0 0 0 2px ${normalized}33` },
    solid: normalized,
  };
}

// A curated palette of hex swatches offered in the Personnel Manager color
// picker, in addition to a free-form <input type="color"> for any color.
export const COLOR_SWATCHES = [
  "#e11d48", "#2563eb", "#059669", "#7c3aed",
  "#ea580c", "#db2777", "#4f46e5", "#d97706",
  "#0891b2", "#65a30d", "#0f172a", "#64748b",
];

// ─────────────────────────────────────────────────────────────
// Native <select>/<option> color tinting
// ─────────────────────────────────────────────────────────────
// Browsers don't let arbitrary components (like PersonnelChip) render
// inside a native <option>, but most do respect a `style` attribute on
// <option> itself. When an admin has picked a custom color for a
// person, this gives a light background tint so that color still shows
// up in "Assign To" dropdowns — without a full custom-combobox rebuild.
// Falls back to no style (browser default) for people without a custom
// color, since the deterministic hash palette only exists as Tailwind
// classes and can't be expressed as an inline hex value.
export function getPersonnelOptionStyle(customColor) {
  if (!isValidHexColor(customColor)) return undefined;
  return { backgroundColor: `${normalizeHex(customColor)}26` }; // ~15% alpha tint
}

