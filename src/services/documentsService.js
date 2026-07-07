import { supabase } from "../lib/supabase";

function getUserFilterValues(user) {
  return [user?.username, user?.name, user?.full_name, user?.fullName]
    .filter(Boolean)
    .map(value => String(value).trim().toLowerCase());
}

function matchesAssignedUser(doc, user) {
  const assignedValue = String(doc?.assignedPersonnel || "").trim().toLowerCase();
  if (!assignedValue) return false;
  const values = getUserFilterValues(user);
  return values.includes(assignedValue);
}

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

// ─── Fetch documents with their history ─────────────────────
export async function fetchDocuments(user = null) {
  const { data: docs, error: docsError } = await supabase
    .from("documents")
    .select("id, tracking_number, title, category, subject, date_received, date_released, originating_office, destination_office, current_office, assigned_personnel, status, remarks, attachment_url")
    .order("date_received", { ascending: false });
  if (docsError) throw docsError;

  const ids = (docs || []).map(doc => doc.id).filter(Boolean);
  let historyByDocumentId = {};

  if (ids.length > 0) {
    const { data: historyRows, error: historyError } = await supabase
      .from("document_history")
      .select("document_id, office, action, timestamp")
      .in("document_id", ids)
      .order("timestamp", { ascending: true });

    if (historyError) throw historyError;

    historyByDocumentId = (historyRows || []).reduce((acc, row) => {
      const key = row.document_id;
      if (!acc[key]) acc[key] = [];
      acc[key].push({
        office: row.office,
        timestamp: row.timestamp
          ? new Date(row.timestamp).toLocaleString("sv-SE").replace("T", " ").slice(0, 16)
          : "",
        action: row.action,
      });
      return acc;
    }, {});
  }

  return (docs || []).map(doc => fromDb({
    ...doc,
    document_history: historyByDocumentId[doc.id] || [],
  }));
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
    .select("id")
    .maybeSingle();
  if (error) throw error;

  const createdId = data?.id;
  if (!createdId) throw new Error("Unable to create the document record.");

  // Insert first history entry
  try {
    await supabase.from("document_history").insert({
      document_id: createdId,
      office:      doc.originatingOffice,
      action:      "Received",
      created_by:  userId,
    });
  } catch (historyError) {
    console.warn("Document history write skipped:", historyError?.message || historyError);
  }

  return createdId;
}

// ─── Update document (+ add history if office changed) ────────
export async function patchDocument(id, changes, userId) {
  // Fetch current to compare office
  const { data: current, error: currentError } = await supabase
    .from("documents")
    .select("current_office, status")
    .eq("id", id)
    .single();
  if (currentError) throw currentError;

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
    .select("id, tracking_number, title, category, subject, date_received, date_released, originating_office, destination_office, current_office, assigned_personnel, status, remarks, attachment_url")
    .maybeSingle();
  if (error) throw error;

  // Add history entry if office changed
  if (changes.currentOffice && current && changes.currentOffice !== current.current_office) {
    try {
      await supabase.from("document_history").insert({
        document_id: id,
        office:      changes.currentOffice,
        action:      changes.status || "Updated",
        created_by:  userId,
      });
    } catch (historyError) {
      console.warn("Document history write skipped:", historyError?.message || historyError);
    }
  }

  const { data: historyRows, error: historyError } = await supabase
    .from("document_history")
    .select("office, action, timestamp")
    .eq("document_id", id)
    .order("timestamp", { ascending: true });
  if (historyError) throw historyError;

  const updatedRow = data || {
    id,
    tracking_number: payload.tracking_number ?? null,
    title: payload.title ?? null,
    category: payload.category ?? null,
    subject: payload.subject ?? null,
    date_received: payload.date_received ?? null,
    date_released: payload.date_released ?? null,
    originating_office: payload.originating_office ?? null,
    destination_office: payload.destination_office ?? null,
    current_office: payload.current_office ?? null,
    assigned_personnel: payload.assigned_personnel ?? null,
    status: payload.status ?? null,
    remarks: payload.remarks ?? null,
    attachment_url: payload.attachment_url ?? null,
  };

  return fromDb({
    ...updatedRow,
    document_history: historyRows || [],
  });
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
