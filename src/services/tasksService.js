import { supabase } from "../lib/supabase";

function getUserFilterValues(user) {
  return [user?.username, user?.name, user?.full_name, user?.fullName]
    .filter(Boolean)
    .map(value => String(value).trim().toLowerCase());
}

function normalizeAssignedTo(value) {
  if (Array.isArray(value)) return value.filter(Boolean);
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return [];
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) return parsed.filter(Boolean);
    } catch {
      return [trimmed];
    }
  }
  return [];
}

function serializeAssignedTo(value) {
  const normalized = normalizeAssignedTo(value);
  return normalized.length ? JSON.stringify(normalized) : "";
}

function fromDb(row) {
  return {
    id: row.id,
    title: row.title,
    description: row.description || "",
    assignedTo: normalizeAssignedTo(row.assigned_to || ""),
    assignedBy: row.assigned_by || "",
    dueDate: row.due_date || "",
    status: row.status || "Pending",
    priority: row.priority || "Medium",
    remarks: row.remarks || "",
    attachmentPath: row.attachment_url || null,
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
      const assignedValues = normalizeAssignedTo(task.assigned_to || "");
      return assignedValues.some(assigned => values.includes(String(assigned).trim().toLowerCase()));
    })
    .map(fromDb);
}

export async function insertTask(task, userId, currentUsername) {
  const payload = {
    title: task.title,
    description: task.description || "",
    assigned_to: serializeAssignedTo(task.assignedTo),
    assigned_by: currentUsername || "",
    due_date: task.dueDate || null,
    status: task.status || "Pending",
    priority: task.priority || "Medium",
    remarks: task.remarks || "",
    attachment_url: task.attachmentPath || null,
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
  if (Object.prototype.hasOwnProperty.call(payload, "assignedTo")) {
    payload.assigned_to = serializeAssignedTo(payload.assignedTo);
    delete payload.assignedTo;
  }
  if (Object.prototype.hasOwnProperty.call(payload, "dueDate")) {
    payload.due_date = payload.dueDate || null;
    delete payload.dueDate;
  }
  if (Object.prototype.hasOwnProperty.call(payload, "attachmentPath")) {
    payload.attachment_url = payload.attachmentPath || null;
    delete payload.attachmentPath;
  }
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

// ─── Task attachments ──────────────────────────────────────────
// Mirrors documentsService.js's uploadAttachment/getAttachmentUrl:
// the bucket is private, so we store the storage *path* on the task
// row (task.attachment_url) and mint a fresh signed URL — valid for
// 1 hour — every time it needs to be viewed/downloaded.

export async function uploadTaskAttachment(file, taskId) {
  const ext  = file.name.split(".").pop();
  const path = `${taskId}/${Date.now()}.${ext}`;
  const { error } = await supabase.storage
    .from("task-attachments")
    .upload(path, file, { upsert: true });
  if (error) throw error;
  return path;
}

export async function getTaskAttachmentUrl(path) {
  if (!path) return null;
  const { data, error } = await supabase.storage
    .from("task-attachments")
    .createSignedUrl(path, 3600);
  if (error) throw error;
  return data.signedUrl;
}
