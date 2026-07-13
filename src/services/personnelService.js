import { supabase } from "../lib/supabase";

// Personnel rows now carry an optional `color` (hex string, e.g. "#2563eb")
// set by the Administrator in Personnel Manager. It's nullable — when
// absent, the UI falls back to the deterministic hash-based color so
// nothing breaks for personnel who haven't been given a custom color yet.
// See supabase/migrations/015_personnel_colors_and_realtime.sql.

export async function fetchPersonnel() {
  const { data, error } = await supabase
    .from("personnel")
    .select("id, name, color")
    .order("name", { ascending: true });
  if (error) throw error;
  return data || [];
}

export async function insertPersonnel(person) {
  const name = person?.name?.trim();
  if (!name) throw new Error("Personnel name is required.");

  const { data, error } = await supabase
    .from("personnel")
    .insert({ name, color: person?.color || null })
    .select("id, name, color")
    .single();
  if (error) throw error;
  return data;
}

export async function updatePersonnel(id, name) {
  const trimmed = name?.trim();
  if (!trimmed) throw new Error("Personnel name is required.");

  const { data, error } = await supabase
    .from("personnel")
    .update({ name: trimmed })
    .eq("id", id)
    .select("id, name, color")
    .single();
  if (error) throw error;
  return data;
}

/**
 * Set (or clear, by passing null) a personnel's custom color. Every chip
 * for this person, anywhere in the app, picks this up immediately via the
 * "personnel-realtime" Supabase channel — no page refresh needed.
 */
export async function updatePersonnelColor(id, color) {
  const { data, error } = await supabase
    .from("personnel")
    .update({ color: color || null })
    .eq("id", id)
    .select("id, name, color")
    .single();
  if (error) throw error;
  return data;
}

export async function removePersonnel(id) {
  const { error } = await supabase
    .from("personnel")
    .delete()
    .eq("id", id);
  if (error) throw error;
}

/**
 * Realtime subscription for the personnel table: fires whenever any
 * personnel row is added, renamed, recolored, or removed, so every
 * connected client's chip colors and personnel lists stay in sync
 * without a manual refresh.
 */
export function subscribeToPersonnel(onChange) {
  return supabase
    .channel("personnel-realtime")
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "personnel" },
      (payload) => onChange(payload.eventType, payload.new, payload.old)
    )
    .subscribe();
}
