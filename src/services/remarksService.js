import { supabase } from "../lib/supabase";

// ─────────────────────────────────────────────────────────────
// Remarks History (chat-style)
// ─────────────────────────────────────────────────────────────
// Every remark is stored as its own row in public.remarks — never
// overwritten. Callers pass an entityType ("task" | "document") and
// the entity's id; remarks are returned oldest-first so they render
// like a conversation.

function fromDb(row) {
  return {
    id: row.id,
    entityType: row.entity_type,
    entityId: row.entity_id,
    content: row.content,
    authorId: row.author_id || null,
    authorName: row.author_name || "Unknown",
    createdAt: row.created_at,
  };
}

/** Fetch the full remarks thread for one entity, oldest first. */
export async function fetchRemarks(entityType, entityId) {
  const { data, error } = await supabase
    .from("remarks")
    .select("*")
    .eq("entity_type", entityType)
    .eq("entity_id", entityId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data || []).map(fromDb);
}

/**
 * Fetch remarks for many entities of the same type in one round trip
 * (used to hydrate every task/document card at once), grouped by
 * entity id.
 */
export async function fetchRemarksForEntities(entityType, entityIds) {
  const ids = (entityIds || []).filter(Boolean);
  if (ids.length === 0) return {};

  const { data, error } = await supabase
    .from("remarks")
    .select("*")
    .eq("entity_type", entityType)
    .in("entity_id", ids)
    .order("created_at", { ascending: true });
  if (error) throw error;

  return (data || []).reduce((acc, row) => {
    const mapped = fromDb(row);
    if (!acc[mapped.entityId]) acc[mapped.entityId] = [];
    acc[mapped.entityId].push(mapped);
    return acc;
  }, {});
}

/** Append a new remark. Never updates/deletes existing ones. */
export async function addRemark({ entityType, entityId, content, authorId, authorName }) {
  const trimmed = String(content || "").trim();
  if (!trimmed) throw new Error("Remark can't be empty.");

  const payload = {
    entity_type: entityType,
    entity_id: entityId,
    content: trimmed,
    author_id: authorId || null,
    author_name: authorName || "Unknown",
  };

  const { data, error } = await supabase
    .from("remarks")
    .insert(payload)
    .select()
    .single();
  if (error) throw error;
  return fromDb(data);
}

/**
 * Realtime subscription for the remarks table. Fires on every new remark
 * INSERT for either entity type ("task" or "document"), so a remark
 * posted by one user appears instantly — without a page refresh — for
 * every other user currently viewing that same task or document.
 *
 * A single shared channel (rather than one channel per open thread) is
 * used so switching between tasks/documents doesn't leak subscriptions;
 * callers filter by entityType/entityId themselves in the callback.
 */
export function subscribeToRemarks(onInsert) {
  return supabase
    .channel("remarks-realtime")
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "remarks" },
      (payload) => onInsert(fromDb(payload.new))
    )
    .subscribe();
}
