function parseDate(value) {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value === "number") return new Date(value);

  const asDate = new Date(value);
  if (Number.isNaN(asDate.getTime())) return null;
  return asDate;
}

function normalizeTimeString(value) {
  const text = String(value || "").trim();
  if (!text) return "";
  if (/AM|PM/i.test(text)) return text.replace(/\s+/g, " ");

  const match = text.match(/^(\d{1,2}):(\d{2})(?::\d{2})?(?:\s*(AM|PM))?$/i);
  if (!match) return text;

  const hour = Number(match[1]);
  const minute = match[2];
  const meridiem = match[3]?.toUpperCase();
  if (meridiem) return `${hour}:${minute} ${meridiem}`;

  const normalizedHour = hour % 24;
  const suffix = normalizedHour >= 12 ? "PM" : "AM";
  const displayHour = normalizedHour % 12 === 0 ? 12 : normalizedHour % 12;
  return `${displayHour}:${minute} ${suffix}`;
}

export function formatDisplayTime(value) {
  if (typeof value === "string") {
    const normalized = normalizeTimeString(value);
    if (normalized !== value) return normalized;
  }

  const date = parseDate(value);
  if (!date) return String(value || "").trim();
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(date);
}

export function formatDisplayDateTime(value) {
  const date = parseDate(value);
  if (!date) return String(value || "").trim();
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(date);
}

export function formatDisplayDate(value) {
  const date = parseDate(value);
  if (!date) return String(value || "").trim();
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(date);
}
