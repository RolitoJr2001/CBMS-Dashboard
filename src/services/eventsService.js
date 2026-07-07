import { supabase } from "../lib/supabase";

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
    time:              row.time,
    type:              row.type,
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

// ─── Add event ────────────────────────────────────────────────
export async function insertEvent(ev, userId) {
  const payload = {
    ...ev,
    created_by: userId,
  };
  delete payload.assignedPersonnel;

  if (Object.prototype.hasOwnProperty.call(ev, "assignedPersonnel")) {
    payload.assigned_personnel = serializeAssignedPersonnel(ev.assignedPersonnel);
  }

  const { data } = await insertWithFallback(payload);
  return fromDb(data);
}

// ─── Update event ────────────────────────────────────────────
export async function patchEvent(id, changes) {
  const payload = { ...changes };
  if (Object.prototype.hasOwnProperty.call(payload, "assignedPersonnel")) {
    payload.assigned_personnel = serializeAssignedPersonnel(payload.assignedPersonnel);
    delete payload.assignedPersonnel;
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
