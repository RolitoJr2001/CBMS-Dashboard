import { supabase } from "../lib/supabase";

function getUserFilterValues(user) {
  return [user?.username, user?.name, user?.full_name, user?.fullName]
    .filter(Boolean)
    .map(value => String(value).trim().toLowerCase());
}

function fromDb(row) {
  return {
    id: row.id,
    title: row.title,
    description: row.description || "",
    assignedTo: row.assigned_to || "",
    assignedBy: row.assigned_by || "",
    dueDate: row.due_date || "",
    status: row.status || "Pending",
    remarks: row.remarks || "",
    createdAt: row.created_at,
  };
}

export async function fetchTasks(user = null) {
  const { data, error } = await supabase
    .from("tasks")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;

  if (!user || user.role === "admin") return (data || []).map(fromDb);

  const values = getUserFilterValues(user);
  return (data || [])
    .filter(task => {
      const assignedValue = String(task.assigned_to || "").trim().toLowerCase();
      return values.includes(assignedValue);
    })
    .map(fromDb);
}

export async function insertTask(task, userId, currentUsername) {
  const payload = {
    title: task.title,
    description: task.description || "",
    assigned_to: task.assignedTo || "",
    assigned_by: currentUsername || "",
    due_date: task.dueDate || null,
    status: task.status || "Pending",
    remarks: task.remarks || "",
    created_by: userId || null,
  };

  const { data, error } = await supabase
    .from("tasks")
    .insert(payload)
    .select()
    .single();
  if (error) throw error;
  return fromDb(data);
}

export async function patchTask(id, changes) {
  const payload = { ...changes };
  const { data, error } = await supabase
    .from("tasks")
    .update(payload)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return fromDb(data);
}

export async function removeTask(id) {
  const { error } = await supabase
    .from("tasks")
    .delete()
    .eq("id", id);
  if (error) throw error;
}
