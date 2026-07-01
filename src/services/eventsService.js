import { supabase } from "../lib/supabase";

// ─── Map DB row → app shape ───────────────────────────────────
function fromDb(row) {
  return {
    id:          row.id,
    title:       row.title,
    date:        row.date,
    time:        row.time,
    type:        row.type,
    description: row.description || "",
  };
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
  const { data, error } = await supabase
    .from("calendar_events")
    .insert({ ...ev, created_by: userId })
    .select()
    .single();
  if (error) throw error;
  return fromDb(data);
}

// ─── Update event ────────────────────────────────────────────
export async function patchEvent(id, changes) {
  const { data, error } = await supabase
    .from("calendar_events")
    .update(changes)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
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
