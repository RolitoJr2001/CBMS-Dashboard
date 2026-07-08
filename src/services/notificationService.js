import { supabase } from "../lib/supabase";

function normalizeNotification(row = {}) {
  return {
    id: row.id,
    recipientId: row.recipient_id,
    actorId: row.actor_id,
    actorName: row.actor_name || null,
    actorRole: row.actor_role || null,
    title: row.title,
    message: row.message || "",
    section: row.section || "General",
    type: row.type || "activity",
    entityId: row.entity_id ?? null,
    entityType: row.entity_type || null,
    action: row.action || "system_message",
    read: Boolean(row.read),
    createdAt: row.created_at,
    recipientRole: row.recipient_role || null,
    subjectName: row.subject_name || null,
    metadata: row.metadata || {},
  };
}

function isMissingColumnError(error) {
  const message = error?.message || "";
  return /column .* does not exist|undefined column|schema cache/i.test(message);
}

function buildTemplate(action, rawParams = {}) {
  // Callers pass entity details (entityName, itemTitle, dueDate, oldStatus,
  // newStatus, remarks, trackingNumber, assignedTo, etc.) nested inside a
  // `metadata` object rather than as top-level fields. Merge metadata on
  // top so the template below can read those values directly — without
  // this, every notification message fell back to generic placeholders
  // like "this item" instead of the actual task/document/event title.
  const params = { ...rawParams, ...(rawParams.metadata || {}) };
  const actorName = params.actorName || "System";
  const entityName = params.entityName || params.itemTitle || params.title || "this item";
  const statusText = params.oldStatus && params.newStatus
    ? ` Status: ${params.oldStatus} → ${params.newStatus}`
    : "";
  const remarksText = params.remarks ? ` Remarks: ${params.remarks}` : "";
  const dueDateText = params.dueDate ? ` Due: ${params.dueDate}` : "";
  const assignedToText = params.assignedTo ? ` Assigned to: ${params.assignedTo}` : "";
  const trackingText = params.trackingNumber ? ` Tracking No.: ${params.trackingNumber}` : "";

  const templates = {
    task_created: { title: "Task Created", message: `${actorName} created the task "${entityName}".`, section: "Tasks", type: "activity", entityType: "task" },
    task_updated: { title: "Task Updated", message: `${actorName} updated the task "${entityName}".`, section: "Tasks", type: "activity", entityType: "task" },
    task_deleted: { title: "Task Deleted", message: `${actorName} deleted the task "${entityName}".`, section: "Tasks", type: "activity", entityType: "task" },
    task_status_updated: { title: "Task Status Updated", message: `${actorName} updated the task "${entityName}".${statusText}${remarksText}`, section: "Tasks", type: "activity", entityType: "task" },
    task_remarks_updated: { title: "Task Remarks Updated", message: `${actorName} updated remarks on "${entityName}".${remarksText}`, section: "Tasks", type: "activity", entityType: "task" },
    task_assigned: { title: "New Assignment", message: `${actorName} assigned you to "${entityName}".${dueDateText}${assignedToText}`, section: "Tasks", type: "assignment", entityType: "task" },
    document_uploaded: { title: "Document Uploaded", message: `${actorName} uploaded "${entityName}".${trackingText}`, section: "Document Tracking", type: "activity", entityType: "document" },
    document_updated: { title: "Document Updated", message: `${actorName} updated "${entityName}".`, section: "Document Tracking", type: "activity", entityType: "document" },
    document_deleted: { title: "Document Deleted", message: `${actorName} deleted "${entityName}".`, section: "Document Tracking", type: "activity", entityType: "document" },
    document_tracking_updated: { title: "Document Tracking Updated", message: `${actorName} updated tracking for "${entityName}".${trackingText}`, section: "Document Tracking", type: "activity", entityType: "document" },
    document_assigned: { title: "Document Assigned", message: `${actorName} assigned you to "${entityName}".`, section: "Document Tracking", type: "assignment", entityType: "document" },
    schedule_created: { title: "Schedule Created", message: `${actorName} created the schedule "${entityName}".`, section: "Schedule & Events", type: "activity", entityType: "event" },
    schedule_updated: { title: "Schedule Updated", message: `${actorName} updated the schedule "${entityName}".`, section: "Schedule & Events", type: "activity", entityType: "event" },
    schedule_deleted: { title: "Schedule Deleted", message: `${actorName} deleted the schedule "${entityName}".`, section: "Schedule & Events", type: "activity", entityType: "event" },
    schedule_assigned: { title: "Schedule Assigned", message: `${actorName} assigned you to "${entityName}".`, section: "Schedule & Events", type: "assignment", entityType: "event" },
    requirement_created: { title: "Requirement Created", message: `${actorName} created the requirement "${entityName}".`, section: "Requirements", type: "activity", entityType: "requirement" },
    requirement_updated: { title: "Requirement Updated", message: `${actorName} updated the requirement "${entityName}".`, section: "Requirements", type: "activity", entityType: "requirement" },
    requirement_deleted: { title: "Requirement Deleted", message: `${actorName} deleted the requirement "${entityName}".`, section: "Requirements", type: "activity", entityType: "requirement" },
    requirement_assigned: { title: "Requirement Assigned", message: `${actorName} assigned you to "${entityName}".`, section: "Requirements", type: "assignment", entityType: "requirement" },
    viewer_login: { title: "Signed In", message: `${actorName} signed in.`, section: "System", type: "system" },
    viewer_logout: { title: "Signed Out", message: `${actorName} signed out.`, section: "System", type: "system" },
    admin_login: { title: "Admin Signed In", message: `${actorName} signed in.`, section: "System", type: "system" },
    admin_logout: { title: "Admin Signed Out", message: `${actorName} signed out.`, section: "System", type: "system" },
    system_message: { title: "System Notification", message: `${actorName} sent a system notification.`, section: "System", type: "system" },
  };

  const template = templates[action] || templates.system_message;
  return {
    title: params.title || template.title,
    message: params.message || template.message,
    section: params.section || template.section || "General",
    type: params.type || template.type || "activity",
    entityType: params.entityType || template.entityType || null,
    entityId: params.entityId ?? null,
    action,
    metadata: params.metadata || {},
  };
}

export function buildNotification(options = {}) {
  const action = options.action || "system_message";
  const actorName = options.actorName || "System";
  const actorRole = options.actorRole || "admin";
  const template = buildTemplate(action, { ...options, actorName });

  return {
    actorName,
    actorRole,
    title: template.title,
    message: template.message,
    section: template.section,
    type: template.type,
    entityType: template.entityType,
    entityId: template.entityId,
    action: template.action,
    metadata: template.metadata,
  };
}

export async function fetchNotifications(userId) {
  const { data, error } = await supabase
    .from("notifications")
    .select("*")
    .eq("recipient_id", userId)
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) throw error;
  return (data || []).map(normalizeNotification);
}

export async function createNotification(payload = {}, recipientId) {
  const basePayload = {
    recipient_id: recipientId,
    actor_id: payload.actorId || null,
    title: payload.title || "Notification",
    message: payload.message || "",
    section: payload.section || "General",
    type: payload.type || "activity",
    entity_id: payload.entityId ?? null,
    entity_type: payload.entityType || null,
    metadata: payload.metadata || {},
    read: false,
  };

  const fullPayload = {
    ...basePayload,
    actor_name: payload.actorName || null,
    actor_role: payload.actorRole || null,
    action: payload.action || "system_message",
  };

  const { data, error } = await supabase
    .from("notifications")
    .insert(fullPayload)
    .select()
    .single();

  if (!error) return normalizeNotification(data);
  if (!isMissingColumnError(error)) throw error;

  const { data: fallbackData, error: fallbackError } = await supabase
    .from("notifications")
    .insert(basePayload)
    .select()
    .single();

  if (fallbackError) throw fallbackError;
  return normalizeNotification(fallbackData);
}

export async function createNotificationForUser(payload = {}, recipientId) {
  return createNotification(payload, recipientId);
}

export async function notifyAdmins(payload = {}, actorId = null) {
  return createNotificationsForAdmins(payload, actorId);
}

export async function notifyUser(payload = {}, recipientId) {
  return createNotificationForUser(payload, recipientId);
}

export async function notifyAssignment(payload = {}, recipientId) {
  return createNotificationForUser(payload, recipientId);
}

export async function notifySelf(payload = {}, recipientId) {
  return createNotificationForUser(payload, recipientId);
}

export async function createNotificationsForAdmins(payload = {}, actorId = null) {
  const { data: profiles, error } = await supabase
    .from("profiles")
    .select("id, role");

  if (error) throw error;

  const isAdminProfile = (profile) => {
    const role = String(profile?.role || "").trim().toLowerCase();
    return role === "admin" || role === "administrator";
  };

  const adminRecipients = (profiles || []).filter(isAdminProfile).map((profile) => profile.id).filter(Boolean);

  const created = [];
  for (const recipientId of adminRecipients) {
    if (!recipientId) continue;
    created.push(await createNotification({ ...payload, actorId }, recipientId));
  }

  return created;
}

export async function createNotificationForRecipients(payload = {}, recipientIds = []) {
  const targets = Array.isArray(recipientIds)
    ? recipientIds.filter(Boolean)
    : [recipientIds].filter(Boolean);

  const created = [];
  for (const recipientId of targets) {
    created.push(await createNotification(payload, recipientId));
  }
  return created;
}

export async function insertNotification(notification = {}, userId) {
  return createNotificationForUser(notification, userId);
}

export async function markNotificationRead(id, userId) {
  const { error } = await supabase
    .from("notifications")
    .update({ read: true })
    .eq("id", id)
    .eq("recipient_id", userId);

  if (error) throw error;
}

export async function markAllNotificationsRead(userId) {
  const { error } = await supabase
    .from("notifications")
    .update({ read: true })
    .eq("recipient_id", userId);

  if (error) throw error;
}

export async function deleteNotification(id, userId) {
  const { error } = await supabase
    .from("notifications")
    .delete()
    .eq("id", id)
    .eq("recipient_id", userId);

  if (error) throw error;
}

export async function deleteAllReadNotifications(userId) {
  const { error } = await supabase
    .from("notifications")
    .delete()
    .eq("recipient_id", userId)
    .eq("read", true);

  if (error) throw error;
}

export function subscribeToNotifications(userId, onNotification) {
  return supabase
    .channel(`notifications:${userId}`)
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "notifications",
        filter: `recipient_id=eq.${userId}`,
      },
      (payload) => onNotification("insert", normalizeNotification(payload.new))
    )
    .on(
      "postgres_changes",
      {
        event: "UPDATE",
        schema: "public",
        table: "notifications",
        filter: `recipient_id=eq.${userId}`,
      },
      (payload) => onNotification("update", normalizeNotification(payload.new))
    )
    .on(
      "postgres_changes",
      {
        event: "DELETE",
        schema: "public",
        table: "notifications",
        filter: `recipient_id=eq.${userId}`,
      },
      (payload) => onNotification("delete", payload.old)
    )
    .subscribe();
}