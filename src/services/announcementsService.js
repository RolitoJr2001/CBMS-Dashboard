import { supabase } from "../lib/supabase";

function fromDb(row) {
  return {
    id:        row.id,
    title:     row.title,
    body:      row.body,
    type:      row.type,
    author:    row.author,
    createdAt: row.created_at,
  };
}

export async function fetchAnnouncements() {
  const { data, error } = await supabase
    .from("announcements")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data.map(fromDb);
}

export async function insertAnnouncement(ann, userId) {
  const { data, error } = await supabase
    .from("announcements")
    .insert({ ...ann, created_by: userId })
    .select()
    .single();
  if (error) throw error;
  return fromDb(data);
}

export async function patchAnnouncement(id, changes) {
  const { data, error } = await supabase
    .from("announcements")
    .update(changes)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return fromDb(data);
}

export async function removeAnnouncement(id) {
  const { error } = await supabase
    .from("announcements")
    .delete()
    .eq("id", id);
  if (error) throw error;
}
