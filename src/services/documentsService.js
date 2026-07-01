import { supabase } from "../lib/supabase";

// ─── Map DB row → app shape ───────────────────────────────────
function fromDb(row) {
  return {
    id:                 row.id,
    trackingNumber:     row.tracking_number,
    title:              row.title,
    category:           row.category,
    subject:            row.subject || "",
    dateReceived:       row.date_received,
    dateReleased:       row.date_released || "",
    originatingOffice:  row.originating_office,
    destinationOffice:  row.destination_office,
    currentOffice:      row.current_office,
    assignedPersonnel:  row.assigned_personnel || "",
    status:             row.status,
    remarks:            row.remarks || "",
    attachmentUrl:      row.attachment_url || null,
    history:            row.document_history
      ? row.document_history.map(h => ({
          office:    h.office,
          timestamp: h.timestamp
            ? new Date(h.timestamp).toLocaleString("sv-SE").replace("T", " ").slice(0, 16)
            : "",
          action:    h.action,
        }))
      : [],
  };
}

// ─── Fetch all documents with their history ───────────────────
export async function fetchDocuments() {
  const { data, error } = await supabase
    .from("documents")
    .select(`*, document_history(office, action, timestamp)`)
    .order("date_received", { ascending: false });
  if (error) throw error;
  return data.map(fromDb);
}

// ─── Check for duplicate tracking number ─────────────────────
export async function checkDuplicateTracking(num, excludeId = null) {
  let query = supabase
    .from("documents")
    .select("id")
    .eq("tracking_number", num);
  if (excludeId) query = query.neq("id", excludeId);
  const { data, error } = await query;
  if (error) throw error;
  return data.length > 0;
}

// ─── Insert document + first history entry ────────────────────
export async function insertDocument(doc, userId) {
  const payload = {
    tracking_number:    doc.trackingNumber,
    title:              doc.title,
    category:           doc.category,
    subject:            doc.subject || "",
    date_received:      doc.dateReceived,
    date_released:      doc.dateReleased || null,
    originating_office: doc.originatingOffice,
    destination_office: doc.destinationOffice,
    current_office:     doc.currentOffice,
    assigned_personnel: doc.assignedPersonnel || "",
    status:             doc.status,
    remarks:            doc.remarks || "",
    attachment_url:     doc.attachmentUrl || null,
    created_by:         userId,
  };
  const { data, error } = await supabase
    .from("documents")
    .insert(payload)
    .select()
    .single();
  if (error) throw error;

  // Insert first history entry
  await supabase.from("document_history").insert({
    document_id: data.id,
    office:      doc.originatingOffice,
    action:      "Received",
    created_by:  userId,
  });

  return data.id;
}

// ─── Update document (+ add history if office changed) ────────
export async function patchDocument(id, changes, userId) {
  // Fetch current to compare office
  const { data: current } = await supabase
    .from("documents")
    .select("current_office, status")
    .eq("id", id)
    .single();

  const payload = {};
  const fieldMap = {
    trackingNumber:    "tracking_number",
    title:             "title",
    category:          "category",
    subject:           "subject",
    dateReceived:      "date_received",
    dateReleased:      "date_released",
    originatingOffice: "originating_office",
    destinationOffice: "destination_office",
    currentOffice:     "current_office",
    assignedPersonnel: "assigned_personnel",
    status:            "status",
    remarks:           "remarks",
    attachmentUrl:     "attachment_url",
  };
  for (const [appKey, dbKey] of Object.entries(fieldMap)) {
    if (changes[appKey] !== undefined) {
      payload[dbKey] = changes[appKey] === "" ? null : changes[appKey];
    }
  }
  // Handle dateReleased empty string → null explicitly
  if (payload.date_released === "") payload.date_released = null;

  const { data, error } = await supabase
    .from("documents")
    .update(payload)
    .eq("id", id)
    .select(`*, document_history(office, action, timestamp)`)
    .single();
  if (error) throw error;

  // Add history entry if office changed
  if (changes.currentOffice && current && changes.currentOffice !== current.current_office) {
    await supabase.from("document_history").insert({
      document_id: id,
      office:      changes.currentOffice,
      action:      changes.status || "Updated",
      created_by:  userId,
    });
  }

  return fromDb(data);
}

// ─── Delete document (cascade deletes history) ────────────────
export async function removeDocument(id) {
  const { error } = await supabase
    .from("documents")
    .delete()
    .eq("id", id);
  if (error) throw error;
}

// ─── Upload file attachment ───────────────────────────────────
export async function uploadAttachment(file, docId) {
  const ext  = file.name.split(".").pop();
  const path = `${docId}/${Date.now()}.${ext}`;
  const { error } = await supabase.storage
    .from("document-attachments")
    .upload(path, file, { upsert: true });
  if (error) throw error;

  // The document-attachments bucket is private, so getPublicUrl()
  // would return a link that 404s. Use a signed URL instead — it
  // expires after 1 hour and must be regenerated on each view/download.
  const { data, error: urlError } = await supabase.storage
    .from("document-attachments")
    .createSignedUrl(path, 3600);
  if (urlError) throw urlError;

  return data.signedUrl;
}

// ─── Get a fresh signed URL for an already-uploaded attachment ─
// Call this whenever you need to display/open an existing attachment,
// since previously-issued signed URLs expire.
export async function getAttachmentUrl(path) {
  const { data, error } = await supabase.storage
    .from("document-attachments")
    .createSignedUrl(path, 3600);
  if (error) throw error;
  return data.signedUrl;
}
