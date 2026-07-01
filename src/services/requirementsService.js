import { supabase } from "../lib/supabase";

// ─── Map DB row → app shape ───────────────────────────────────
function fromDb(row) {
  return {
    id:          row.id,
    requirement: row.requirement,
    office:      row.office,
    dueDate:     row.due_date || "",
    status:      row.status,
  };
}

// ─── Fetch all requirements ───────────────────────────────────
export async function fetchRequirements() {
  const { data, error } = await supabase
    .from("requirements")
    .select("*")
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data.map(fromDb);
}

// ─── Add requirement ─────────────────────────────────────────
export async function insertRequirement(req, userId) {
  const payload = {
    requirement: req.requirement,
    office:      req.office,
    due_date:    req.dueDate || null,
    status:      req.status,
    created_by:  userId,
  };
  const { data, error } = await supabase
    .from("requirements")
    .insert(payload)
    .select()
    .single();
  if (error) throw error;
  return fromDb(data);
}

// ─── Update requirement ───────────────────────────────────────
export async function patchRequirement(id, changes) {
  const payload = {};
  if (changes.requirement !== undefined) payload.requirement = changes.requirement;
  if (changes.office      !== undefined) payload.office      = changes.office;
  if (changes.dueDate     !== undefined) payload.due_date    = changes.dueDate || null;
  if (changes.status      !== undefined) payload.status      = changes.status;

  const { data, error } = await supabase
    .from("requirements")
    .update(payload)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return fromDb(data);
}

// ─── Delete requirement ───────────────────────────────────────
export async function removeRequirement(id) {
  const { error } = await supabase
    .from("requirements")
    .delete()
    .eq("id", id);
  if (error) throw error;
}
