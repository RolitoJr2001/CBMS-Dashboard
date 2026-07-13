// ─────────────────────────────────────────────────────────────
// Due Date Status Colors
// ─────────────────────────────────────────────────────────────
// Rules:
//   Normal            -> default color
//   Due Soon (<=3 d)  -> orange
//   Due Today/Overdue -> red
//
// Completed items are always "normal" — a finished task/requirement
// shouldn't look urgent just because its due date has passed.

const NORMAL = {
  level: "normal",
  label: "",
  textClass: "text-slate-500",
  borderClass: "border-slate-100",
  badgeBg: "bg-slate-100",
  badgeText: "text-slate-600",
  dot: "bg-slate-400",
};

const SOON = {
  level: "soon",
  label: "Due Soon",
  textClass: "text-orange-600",
  borderClass: "border-orange-300",
  badgeBg: "bg-orange-100",
  badgeText: "text-orange-700",
  dot: "bg-orange-500",
};

const OVERDUE = {
  level: "overdue",
  label: "Overdue",
  textClass: "text-status-red",
  borderClass: "border-status-red",
  badgeBg: "bg-status-redBg",
  badgeText: "text-status-red",
  dot: "bg-status-red",
};

const DUE_TODAY = {
  ...OVERDUE,
  label: "Due Today",
};

function startOfDay(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * Computes the due-date urgency status for a task/requirement/document.
 * @param {string|null} dueDate - ISO date string (YYYY-MM-DD) or falsy.
 * @param {string} [status] - Current status label; "Completed" always normal.
 * @returns {object} style descriptor with level, label, and Tailwind classes.
 */
export function getDueDateStatus(dueDate, status) {
  if (!dueDate) return NORMAL;
  if (String(status || "").toLowerCase() === "completed") return NORMAL;

  const today = startOfDay(new Date());
  const due = startOfDay(`${dueDate}T00:00:00`);
  const diffDays = Math.round((due - today) / 86400000);

  if (diffDays < 0) return OVERDUE;
  if (diffDays === 0) return DUE_TODAY;
  if (diffDays <= 3) return SOON;
  return NORMAL;
}
