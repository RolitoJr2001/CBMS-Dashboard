import { supabase } from "../lib/supabase";

const VALID_EVENT_TYPES = [
  "Deadline",
  "Meeting",
  "Review",
  "Briefing",
  "Training/Workshop",
  "Leave",
  "Hearing",
  "Seminar",
  "Announcement",
];

function normalizeEventType(value) {
  if (typeof value !== "string") return "Meeting";

  const trimmed = value.trim();
  return VALID_EVENT_TYPES.includes(trimmed) ? trimmed : "Meeting";
}

// ─── Map DB row → app shape ───────────────────────────────────
function normalizeAssignedPersonnel(value) {
  if (Array.isArray(value)) {
    return value.filter(Boolean);
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return [];

    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        return parsed.filter(Boolean);
      }
    } catch {
      // Treat plain text as a single assignee for backward compatibility.
    }

    return [trimmed];
  }

  return [];
}

function serializeAssignedPersonnel(value) {
  const normalized = normalizeAssignedPersonnel(value);
  return normalized.length ? JSON.stringify(normalized) : "";
}

function fromDb(row) {
  return {
    id:                row.id,
    title:             row.title,
    date:              row.date,
    // Multi-day events store an end_date >= date; single-day (legacy)
    // events have no end_date, so fall back to the start date.
    endDate:           row.end_date || row.date,
    time:              row.time,
    type:              normalizeEventType(row.type),
    description:       row.description || "",
    assignedPersonnel: normalizeAssignedPersonnel(row.assigned_personnel || row.assignedPersonnel),
  };
}

function isMissingColumnError(error) {
  const message = error?.message || "";
  return /column .* does not exist|undefined column|schema cache/i.test(message);
}

async function insertWithFallback(payload) {
  const { data, error } = await supabase
    .from("calendar_events")
    .insert(payload)
    .select()
    .single();

  if (!error) return { data, error: null };
  if (!isMissingColumnError(error)) throw error;

  const fallbackPayload = { ...payload };
  delete fallbackPayload.assigned_personnel;
  delete fallbackPayload.end_date;

  const fallbackResult = await supabase
    .from("calendar_events")
    .insert(fallbackPayload)
    .select()
    .single();

  if (fallbackResult.error) throw fallbackResult.error;
  return fallbackResult;
}

async function updateWithFallback(id, payload) {
  const { data, error } = await supabase
    .from("calendar_events")
    .update(payload)
    .eq("id", id)
    .select()
    .single();

  if (!error) return { data, error: null };
  if (!isMissingColumnError(error)) throw error;

  const fallbackPayload = { ...payload };
  delete fallbackPayload.assigned_personnel;
  delete fallbackPayload.end_date;

  const fallbackResult = await supabase
    .from("calendar_events")
    .update(fallbackPayload)
    .eq("id", id)
    .select()
    .single();

  if (fallbackResult.error) throw fallbackResult.error;
  return fallbackResult;
}

// ─── Fetch all events ─────────────────────────────────────────
export async function fetchEvents() {
  const { data, error } = await supabase
    .from("calendar_events")
    .select("*")
    .order("date", { ascending: true });
  if (error) throw error;
  return data.map(fromDb);
}

// An end date before the start date is treated as a data-entry mistake,
// not a multi-day span in reverse — clamp it up to the start date rather
// than silently storing an invalid range.
function normalizeEndDate(date, endDate) {
  if (!endDate) return date || null;
  if (date && endDate < date) return date;
  return endDate;
}

// ─── Add event ────────────────────────────────────────────────
export async function insertEvent(ev, userId) {
  const payload = {
    ...ev,
    created_by: userId,
    type: normalizeEventType(ev?.type),
  };
  delete payload.assignedPersonnel;
  delete payload.endDate;

  if (Object.prototype.hasOwnProperty.call(ev, "assignedPersonnel")) {
    payload.assigned_personnel = serializeAssignedPersonnel(ev.assignedPersonnel);
  }
  payload.end_date = normalizeEndDate(ev?.date, ev?.endDate);

  const { data } = await insertWithFallback(payload);
  return fromDb(data);
}

// ─── Update event ────────────────────────────────────────────
export async function patchEvent(id, changes) {
  const payload = { ...changes };
  if (Object.prototype.hasOwnProperty.call(payload, "type")) {
    payload.type = normalizeEventType(payload.type);
  }
  if (Object.prototype.hasOwnProperty.call(payload, "assignedPersonnel")) {
    payload.assigned_personnel = serializeAssignedPersonnel(payload.assignedPersonnel);
    delete payload.assignedPersonnel;
  }
  if (Object.prototype.hasOwnProperty.call(payload, "endDate") || Object.prototype.hasOwnProperty.call(payload, "date")) {
    payload.end_date = normalizeEndDate(payload.date, payload.endDate ?? payload.date);
    delete payload.endDate;
  }

  const { data } = await updateWithFallback(id, payload);
  return fromDb(data);
}

// ─── Delete event ─────────────────────────────────────────────
export async function removeEvent(id) {
  const { error } = await supabase
    .from("calendar_events")
    .delete()
    .eq("id", id);
  if (error) throw error;
}
