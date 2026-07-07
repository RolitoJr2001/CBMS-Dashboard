import { supabase } from "../lib/supabase";

export async function fetchPersonnel() {
  const { data, error } = await supabase
    .from("personnel")
    .select("id, name")
    .order("name", { ascending: true });
  if (error) throw error;
  return data || [];
}

export async function insertPersonnel(person) {
  const name = person?.name?.trim();
  if (!name) throw new Error("Personnel name is required.");

  const { data, error } = await supabase
    .from("personnel")
    .insert({ name })
    .select("id, name")
    .single();
  if (error) throw error;
  return data;
}
