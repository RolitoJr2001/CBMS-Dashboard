import { useState, useMemo } from "react";
import {
  FaFileAlt, FaPlus, FaEdit, FaTrash, FaTimes, FaCheck,
  FaSearch, FaFilter, FaHistory, FaInbox, FaPaperPlane,
  FaSpinner, FaCheckCircle, FaExclamationCircle, FaListAlt,
} from "react-icons/fa";
import { useApp } from "../context/AppContext";

const STATUS_OPTIONS   = ["Received", "In Process", "Forwarded", "Released", "Completed", "Returned"];
const CATEGORY_OPTIONS = ["Agreement", "Compliance", "Memorandum", "Letter", "Report", "Order", "Form", "Other"];

const statusStyles = {
  Received:     "bg-navy-50 text-navy-700",
  "In Process": "bg-status-yellowBg text-status-yellow",
  Forwarded:    "bg-teal-50 text-teal-700",
  Released:     "bg-status-greenBg text-status-green",
  Completed:    "bg-status-greenBg text-status-green",
  Returned:     "bg-status-redBg text-status-red",
};

const EMPTY_FORM = {
  trackingNumber: "", title: "", category: "Letter", subject: "",
  dateReceived: new Date().toISOString().split("T")[0], dateReleased: "",
  originatingOffice: "", destinationOffice: "", currentOffice: "",
  assignedPersonnel: "", status: "Received", remarks: "",
};

function DocBadge({ status }) {
  return (
    <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-full whitespace-nowrap ${statusStyles[status] || "bg-slate-100 text-slate-600"}`}>
      {status}
    </span>
  );
}

export default function DocumentTracking() {
  const { documents, addDocument, updateDocument, deleteDocument, isDuplicateTrackingNumber, user } = useApp();
  const isAdmin = user?.role === "admin";

  const [showForm,      setShowForm]      = useState(false);
  const [editId,        setEditId]        = useState(null);
  const [form,          setForm]          = useState(EMPTY_FORM);
  const [errors,        setErrors]        = useState({});
  const [historyId,     setHistoryId]     = useState(null);
  const [search,        setSearch]        = useState("");
  const [filterStatus,  setFilterStatus]  = useState("All");
  const [filterDir,     setFilterDir]     = useState("All");
  const [page,          setPage]          = useState(1);
  const [saving,        setSaving]        = useState(false);
  const [saveErr,       setSaveErr]       = useState("");

  const PER_PAGE = 8;

  const totalIncoming   = documents.length;
  const totalOutgoing   = documents.filter(d => d.dateReleased).length;
  const inProcess       = documents.filter(d => d.status === "In Process").length;
  const completed       = documents.filter(d => d.status === "Completed").length;
  const recent          = [...documents].sort((a, b) => (b.dateReceived > a.dateReceived ? 1 : -1)).slice(0, 3);

  const filtered = useMemo(() => {
    return documents.filter(d => {
      const q = search.toLowerCase();
      const matchSearch = !q || [d.trackingNumber, d.title, d.currentOffice, d.status, d.dateReceived]
        .some(v => v?.toLowerCase().includes(q));
      const matchStatus = filterStatus === "All" || d.status === filterStatus;
      const matchDir = filterDir === "All"
        || (filterDir === "Incoming" && !d.dateReleased)
        || (filterDir === "Outgoing" && !!d.dateReleased);
      return matchSearch && matchStatus && matchDir;
    });
  }, [documents, search, filterStatus, filterDir]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PER_PAGE));
  const paged = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  function openAdd() {
    setEditId(null); setForm(EMPTY_FORM); setErrors({}); setSaveErr(""); setShowForm(true);
  }
  function openEdit(doc) {
    setEditId(doc.id);
    setForm({
      trackingNumber: doc.trackingNumber, title: doc.title, category: doc.category,
      subject: doc.subject, dateReceived: doc.dateReceived, dateReleased: doc.dateReleased || "",
      originatingOffice: doc.originatingOffice, destinationOffice: doc.destinationOffice,
      currentOffice: doc.currentOffice, assignedPersonnel: doc.assignedPersonnel,
      status: doc.status, remarks: doc.remarks,
    });
    setErrors({}); setSaveErr(""); setShowForm(true);
  }

  async function validate() {
    const e = {};
    if (!form.trackingNumber.trim()) e.trackingNumber = "Tracking number is required.";
    else {
      try {
        const isDup = await isDuplicateTrackingNumber(form.trackingNumber, editId);
        if (isDup) e.trackingNumber = "Tracking number already exists.";
      } catch { /* ignore network err in validation */ }
    }
    if (!form.title.trim()) e.title = "Title is required.";
    if (!form.originatingOffice.trim()) e.originatingOffice = "Originating office is required.";
    if (!form.currentOffice.trim()) e.currentOffice = "Current office is required.";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSave() {
    const valid = await validate();
    if (!valid) return;
    setSaving(true); setSaveErr("");
    try {
      if (editId) { await updateDocument(editId, form); }
      else        { await addDocument(form); }
      setShowForm(false); setPage(1);
    } catch (err) {
      setSaveErr(err.message || "Failed to save.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id) {
    if (!window.confirm("Delete this document record?")) return;
    try {
      await deleteDocument(id);
      if (historyId === id) setHistoryId(null);
    } catch (err) {
      alert("Error: " + err.message);
    }
  }

  const historyDoc = historyId ? documents.find(d => d.id === historyId) : null;

  return (
    <section id="document-tracking" className="w-full">
      <div className="bg-white rounded-xl border border-slate-100 overflow-hidden flex flex-col">
        {/* Section header */}
        <div className="px-5 py-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span className="flex items-center justify-center w-9 h-9 rounded-lg bg-teal-50 text-teal-700">
              <FaFileAlt />
            </span>
            <div>
              <h2 className="text-lg font-semibold text-navy-900">Document Tracking System</h2>
              <p className="text-sm text-slate-500">Incoming and outgoing document monitoring</p>
            </div>
          </div>
          {isAdmin && (
            <button
              onClick={openAdd}
              className="flex items-center gap-1.5 text-sm font-medium px-4 py-2 rounded-lg bg-navy-900 text-white hover:bg-navy-800 transition-colors self-start sm:self-auto"
            >
              <FaPlus className="text-xs" /> New Document
            </button>
          )}
        </div>

        <div className="p-5 space-y-6">
          {/* Dashboard stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { label: "Total Incoming", value: totalIncoming, icon: FaInbox,      color: "text-navy-700 bg-navy-50" },
              { label: "Total Outgoing", value: totalOutgoing, icon: FaPaperPlane,  color: "text-teal-700 bg-teal-50" },
              { label: "In Process",     value: inProcess,     icon: FaSpinner,     color: "text-status-yellow bg-status-yellowBg" },
              { label: "Completed",      value: completed,     icon: FaCheckCircle, color: "text-status-green bg-status-greenBg" },
            ].map(c => {
              const Icon = c.icon;
              return (
                <div key={c.label} className="bg-white rounded-2xl border border-slate-100 shadow-card p-4 flex flex-col gap-2">
                  <span className={`flex items-center justify-center w-9 h-9 rounded-lg ${c.color}`}><Icon /></span>
                  <p className="text-2xl font-bold text-navy-900">{c.value}</p>
                  <p className="text-xs text-slate-500">{c.label}</p>
                </div>
              );
            })}
          </div>

          {/* Recently received */}
          {recent.length > 0 && (
            <div className="bg-white rounded-xl border border-slate-100 p-4">
              <p className="text-sm font-semibold text-navy-900 mb-3">Recently Received</p>
              <div className="flex flex-col gap-2">
                {recent.map(d => (
                  <div key={d.id} className="flex items-center justify-between gap-3 py-1.5 border-b border-slate-50 last:border-0">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-navy-900 truncate">{d.title}</p>
                      <p className="text-xs text-slate-500">{d.trackingNumber} · {d.currentOffice}</p>
                    </div>
                    <DocBadge status={d.status} />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Add/Edit form */}
          {showForm && (
            <div className="bg-white rounded-xl border border-teal-200 p-5">
              <p className="text-base font-semibold text-navy-900 mb-4">{editId ? "Edit Document" : "New Document Record"}</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {[
                  { key: "trackingNumber", label: "Tracking Number *", type: "text" },
                  { key: "title", label: "Document Title *", type: "text" },
                  { key: "subject", label: "Subject", type: "text" },
                  { key: "dateReceived", label: "Date Received", type: "date" },
                  { key: "dateReleased", label: "Date Released", type: "date" },
                  { key: "originatingOffice", label: "Originating Office *", type: "text" },
                  { key: "destinationOffice", label: "Destination Office", type: "text" },
                  { key: "currentOffice", label: "Current Office *", type: "text" },
                  { key: "assignedPersonnel", label: "Assigned Personnel", type: "text" },
                ].map(({ key, label, type }) => (
                  <div key={key}>
                    <label className="block text-xs font-medium text-slate-600 mb-1">{label}</label>
                    <input
                      type={type}
                      value={form[key]}
                      onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                      className={`w-full px-3 py-2 text-sm rounded-lg border outline-none focus:border-teal-400 bg-white transition-colors ${errors[key] ? "border-red-400" : "border-slate-200"}`}
                    />
                    {errors[key] && <p className="text-xs text-status-red mt-0.5">{errors[key]}</p>}
                  </div>
                ))}
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Category</label>
                  <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 outline-none focus:border-teal-400 bg-white">
                    {CATEGORY_OPTIONS.map(c => <option key={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Status</label>
                  <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 outline-none focus:border-teal-400 bg-white">
                    {STATUS_OPTIONS.map(s => <option key={s}>{s}</option>)}
                  </select>
                </div>
                <div className="sm:col-span-2 lg:col-span-3">
                  <label className="block text-xs font-medium text-slate-600 mb-1">Remarks</label>
                  <textarea
                    value={form.remarks}
                    onChange={e => setForm(f => ({ ...f, remarks: e.target.value }))}
                    rows={2}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 outline-none focus:border-teal-400 bg-white resize-none"
                  />
                </div>
              </div>
              {saveErr && <p className="text-sm text-status-red mt-2">{saveErr}</p>}
              <div className="flex gap-2 justify-end mt-4">
                <button onClick={() => setShowForm(false)} disabled={saving} className="flex items-center gap-1.5 text-sm font-medium px-4 py-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-50">
                  <FaTimes /> Cancel
                </button>
                <button onClick={handleSave} disabled={saving} className="flex items-center gap-1.5 text-sm font-medium px-4 py-2 rounded-lg bg-navy-900 text-white hover:bg-navy-800 disabled:opacity-60">
                  {saving ? <FaSpinner className="animate-spin text-sm" /> : <FaCheck />} Save Record
                </button>
              </div>
            </div>
          )}

          {/* Routing history panel */}
          {historyDoc && (
            <div className="bg-white rounded-xl border border-navy-100 p-5">
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-semibold text-navy-900">Routing History — {historyDoc.trackingNumber}</p>
                <button onClick={() => setHistoryId(null)} className="text-slate-400 hover:text-slate-600"><FaTimes /></button>
              </div>
              <ol className="relative border-l border-teal-200 ml-3">
                {(historyDoc.history || []).map((h, i) => (
                  <li key={i} className="mb-4 ml-4">
                    <span className="absolute -left-1.5 flex items-center justify-center w-3 h-3 rounded-full bg-teal-500 ring-4 ring-white" />
                    <p className="text-sm font-medium text-navy-900">{h.action} → {h.office}</p>
                    <p className="text-xs text-slate-500">{h.timestamp}</p>
                  </li>
                ))}
                {(!historyDoc.history || historyDoc.history.length === 0) && (
                  <li className="ml-4 text-sm text-slate-400">No history available.</li>
                )}
              </ol>
            </div>
          )}

          {/* Table */}
          <div className="bg-white rounded-xl border border-slate-100 overflow-hidden">
            {/* Search + Filter bar */}
            <div className="px-5 py-4 border-b border-slate-100 flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm" />
                <input
                  type="text"
                  value={search}
                  onChange={e => { setSearch(e.target.value); setPage(1); }}
                  placeholder="Search by tracking no., title, office, status, date..."
                  className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-slate-200 bg-slate-50 focus:bg-white focus:border-teal-400 outline-none"
                />
              </div>
              <div className="flex gap-2 flex-wrap">
                <select
                  value={filterDir}
                  onChange={e => { setFilterDir(e.target.value); setPage(1); }}
                  className="text-sm px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 outline-none focus:border-teal-400"
                >
                  <option value="All">All Documents</option>
                  <option value="Incoming">Incoming</option>
                  <option value="Outgoing">Outgoing</option>
                </select>
                <select
                  value={filterStatus}
                  onChange={e => { setFilterStatus(e.target.value); setPage(1); }}
                  className="text-sm px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 outline-none focus:border-teal-400"
                >
                  <option value="All">All Status</option>
                  {STATUS_OPTIONS.map(s => <option key={s}>{s}</option>)}
                </select>
              </div>
            </div>

            {/* Scrollable table */}
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[800px]">
                <thead>
                  <tr className="text-left text-xs text-slate-500 uppercase tracking-wide border-b border-slate-100 bg-slate-50">
                    <th className="py-3 px-4 font-medium">Tracking No.</th>
                    <th className="py-3 px-4 font-medium">Title / Category</th>
                    <th className="py-3 px-4 font-medium">Current Office</th>
                    <th className="py-3 px-4 font-medium">Date Received</th>
                    <th className="py-3 px-4 font-medium">Status</th>
                    <th className="py-3 px-4 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {paged.map(doc => (
                    <tr key={doc.id} className="hover:bg-slate-50 transition-colors group">
                      <td className="py-3 px-4">
                        <span className="text-xs font-mono text-navy-700 bg-navy-50 px-2 py-0.5 rounded">{doc.trackingNumber}</span>
                      </td>
                      <td className="py-3 px-4">
                        <p className="font-medium text-navy-900 truncate max-w-[200px]">{doc.title}</p>
                        <p className="text-xs text-slate-500">{doc.category} · {doc.subject?.slice(0, 40)}{doc.subject?.length > 40 ? "…" : ""}</p>
                      </td>
                      <td className="py-3 px-4">
                        <p className="text-sm text-navy-900">{doc.currentOffice}</p>
                        <p className="text-xs text-slate-500">Assigned: {doc.assignedPersonnel || "—"}</p>
                      </td>
                      <td className="py-3 px-4 text-sm text-slate-600">{doc.dateReceived}</td>
                      <td className="py-3 px-4"><DocBadge status={doc.status} /></td>
                      <td className="py-3 px-4">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => setHistoryId(historyId === doc.id ? null : doc.id)}
                            className="p-1.5 rounded text-slate-400 hover:text-navy-700 hover:bg-navy-50"
                            title="View routing history"
                          >
                            <FaHistory className="text-xs" />
                          </button>
                          {isAdmin && (
                            <>
                              <button onClick={() => openEdit(doc)} className="p-1.5 rounded text-slate-400 hover:text-teal-600 hover:bg-teal-50" title="Edit">
                                <FaEdit className="text-xs" />
                              </button>
                              <button onClick={() => handleDelete(doc.id)} className="p-1.5 rounded text-slate-400 hover:text-status-red hover:bg-status-redBg" title="Delete">
                                <FaTrash className="text-xs" />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {paged.length === 0 && (
                    <tr>
                      <td colSpan={6} className="py-10 text-center text-slate-400 text-sm">
                        No documents found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="px-5 py-3 border-t border-slate-100 flex items-center justify-between text-sm">
                <p className="text-slate-500 text-xs">
                  Showing {(page - 1) * PER_PAGE + 1}–{Math.min(page * PER_PAGE, filtered.length)} of {filtered.length}
                </p>
                <div className="flex gap-1">
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map(n => (
                    <button
                      key={n}
                      onClick={() => setPage(n)}
                      className={`w-7 h-7 rounded-md text-xs font-medium transition-colors ${n === page ? "bg-navy-900 text-white" : "text-slate-600 hover:bg-slate-100"}`}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
