// ExcelJS is a sizeable dependency (~1MB) that most page loads never
// need — it's dynamically imported inside exportDocumentTrackingToExcel()
// below so it's only fetched the first time someone actually exports,
// keeping the app's initial bundle lean.

// ─────────────────────────────────────────────────────────────
// Document Tracking → Excel Export
// ─────────────────────────────────────────────────────────────
// Client-side only (no backend endpoint needed — this app talks to
// Supabase directly from the browser, so the export is built and
// downloaded entirely in-browser via ExcelJS + a Blob).
//
// Mirrors the columns visible in the Document Tracking table, plus a
// couple of underlying fields (Subject, Date Released, Originating/
// Destination Office) that are part of the same record but only shown
// on hover/expand in the UI — useful in a report, harmless to include.

function getDocumentDirection(doc) {
  return doc?.dateReleased ? "Outgoing" : "Incoming";
}

function latestRemarkFor(doc, remarksByDocument) {
  const thread = remarksByDocument?.[doc.id];
  if (Array.isArray(thread) && thread.length > 0) {
    const last = thread[thread.length - 1];
    return {
      text: last.content || "",
      author: last.authorName || "",
    };
  }
  // Fall back to the document's own `remarks` field (set when the
  // record was first created) if no threaded remarks exist yet.
  return { text: doc.remarks || "", author: "" };
}

function todayStamp() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

const COLUMNS = [
  { header: "Tracking Number",     key: "trackingNumber", width: 22 },
  { header: "Direction",           key: "direction",      width: 12 },
  { header: "Title",               key: "title",          width: 30 },
  { header: "Category",            key: "category",       width: 16 },
  { header: "Subject",             key: "subject",        width: 34 },
  { header: "Originating Office",  key: "originatingOffice", width: 22 },
  { header: "Destination Office",  key: "destinationOffice", width: 22 },
  { header: "Current Office",      key: "currentOffice",  width: 22 },
  { header: "Assigned Personnel",  key: "assignedPersonnel", width: 20 },
  { header: "Date Received",       key: "dateReceived",   width: 16 },
  { header: "Date Released",       key: "dateReleased",   width: 16 },
  { header: "Status",              key: "status",         width: 14 },
  { header: "Latest Remark",       key: "latestRemark",   width: 40 },
  { header: "Remark By",           key: "remarkAuthor",   width: 18 },
];

/**
 * Builds and downloads Document_Tracking_YYYY-MM-DD.xlsx from whatever
 * document rows are passed in. Callers are responsible for passing only
 * the rows that should be exported (i.e. the already search/status/
 * direction-filtered list) — this function doesn't do any filtering of
 * its own, so the export always matches exactly what's on screen.
 */
export async function exportDocumentTrackingToExcel(documents, remarksByDocument = {}) {
  const rows = documents || [];

  const { default: ExcelJS } = await import("exceljs");
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "CBMS Operations Dashboard";
  workbook.created = new Date();

  const sheet = workbook.addWorksheet("Document Tracking", {
    views: [{ state: "frozen", ySplit: 1 }], // keep header row visible while scrolling
  });
  sheet.columns = COLUMNS;

  rows.forEach(doc => {
    const remark = latestRemarkFor(doc, remarksByDocument);
    sheet.addRow({
      trackingNumber:    doc.trackingNumber || "",
      direction:         getDocumentDirection(doc),
      title:             doc.title || "",
      category:          doc.category || "",
      subject:           doc.subject || "",
      originatingOffice: doc.originatingOffice || "",
      destinationOffice: doc.destinationOffice || "",
      currentOffice:     doc.currentOffice || "",
      assignedPersonnel: doc.assignedPersonnel || "",
      dateReceived:      doc.dateReceived || "",
      dateReleased:      doc.dateReleased || "",
      status:            doc.status || "",
      latestRemark:      remark.text,
      remarkAuthor:      remark.author,
    });
  });

  // ── Formatting ──
  // Bold, teal-tinted header row (matches the app's teal/navy palette)
  // with white text for contrast, per the "table-like formatting for
  // readability" requirement.
  const headerRow = sheet.getRow(1);
  headerRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
  headerRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0F534E" } }; // teal-800
  headerRow.alignment = { vertical: "middle" };
  headerRow.height = 20;

  // Thin borders + word-wrap on every populated cell so long titles/
  // remarks stay readable instead of overflowing into neighboring cells.
  sheet.eachRow((row, rowNumber) => {
    row.eachCell({ includeEmpty: true }, cell => {
      cell.border = {
        top: { style: "thin", color: { argb: "FFE2E8F0" } },
        left: { style: "thin", color: { argb: "FFE2E8F0" } },
        bottom: { style: "thin", color: { argb: "FFE2E8F0" } },
        right: { style: "thin", color: { argb: "FFE2E8F0" } },
      };
      if (rowNumber > 1) {
        cell.alignment = { vertical: "top", wrapText: true };
      }
    });
  });

  // Light zebra striping for readability across many rows.
  for (let i = 2; i <= sheet.rowCount; i++) {
    if (i % 2 === 0) {
      sheet.getRow(i).eachCell({ includeEmpty: true }, cell => {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF8FAFC" } };
      });
    }
  }

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });

  const filename = `Document_Tracking_${todayStamp()}.xlsx`;
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);

  return filename;
}
