import { useMemo, useState } from "react";
import { FaSearch, FaPlus, FaEdit, FaTrash, FaTimes, FaCheck, FaSpinner } from "react-icons/fa";
import { useApp } from "../context/AppContext";
import { statusColors } from "../data/requirements";

const ALL_FILTERS  = ["All", "Completed", "Ongoing", "Pending", "For Review", "Returned"];
const ALL_STATUSES = ["Completed", "Ongoing", "Pending", "For Review", "Returned"];
const EXT_COLORS   = {
  ...statusColors,
  "For Review": { text: "text-navy-700", bg: "bg-navy-50",        dot: "bg-navy-600" },
  "Returned":   { text: "text-status-red", bg: "bg-status-redBg", dot: "bg-status-red" },
};
const EMPTY = { requirement: "", office: "", dueDate: "", status: "Pending" };

export default function ChecklistCard() {
  const { requirements, addRequirement, updateRequirement, deleteRequirement, user } = useApp();
  const isAdmin = user?.role === "admin";
  const [query,    setQuery]    = useState("");
  const [filter,   setFilter]   = useState("All");
  const [showForm, setShowForm] = useState(false);
  const [editId,   setEditId]   = useState(null);
  const [form,     setForm]     = useState(EMPTY);
  const [errors,   setErrors]   = useState({});
  const [saving,   setSaving]   = useState(false);
  const [saveErr,  setSaveErr]  = useState("");

  const filtered = useMemo(() =>
    requirements.filter(r =>
      (filter === "All" || r.status === filter) &&
      r.requirement.toLowerCase().includes(query.toLowerCase())
    ), [requirements, query, filter]);

  const done = requirements.filter(r => r.status === "Completed").length;
  const pct  = requirements.length ? Math.round((done / requirements.length) * 100) : 0;

  function openAdd() { setEditId(null); setForm(EMPTY); setErrors({}); setSaveErr(""); setShowForm(true); }
  function openEdit(r) { setEditId(r.id); setForm({ requirement: r.requirement, office: r.office, dueDate: r.dueDate || "", status: r.status }); setErrors({}); setSaveErr(""); setShowForm(true); }

  function validate() {
    const e = {};
    if (!form.requirement.trim()) e.requirement = "Required";
    if (!form.office.trim()) e.office = "Required";
    setErrors(e); return !Object.keys(e).length;
  }

  async function handleSave() {
    if (!isAdmin) return;
    if (!validate()) return;
    setSaving(true); setSaveErr("");
    try {
      if (editId) { await updateRequirement(editId, form); }
      else        { await addRequirement(form); }
      setShowForm(false);
    } catch (err) {
      setSaveErr(err.message || "Failed to save.");
    } finally {
      setSaving(false);
    }
  }

  async function handleStatusChange(id, status) {
    if (!isAdmin) return;
    try { await updateRequirement(id, { status }); }
    catch (err) { alert("Error: " + err.message); }
  }

  async function handleDelete(id) {
    if (!isAdmin) return;
    if (!window.confirm("Delete this requirement?")) return;
    try { await deleteRequirement(id); }
    catch (err) { alert("Error: " + err.message); }
  }

  return (
    <div className="bg-white rounded-xl border border-slate-100 overflow-hidden flex flex-col">
      {/* Progress bar */}
      <div className="px-5 pt-4 pb-3 border-b border-slate-100">
        <div className="flex items-center justify-between mb-1.5">
          <p className="text-xs text-slate-500">{done} of {requirements.length} completed</p>
          <span className="text-xs font-bold text-teal-700">{pct}%</span>
        </div>
        <div className="w-full h-1.5 rounded-full bg-slate-100 overflow-hidden">
          <div className="h-full bg-teal-500 rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
        </div>
      </div>

      {/* Search + filter + add */}
      <div className="px-5 py-3 flex flex-col sm:flex-row gap-2 border-b border-slate-100">
        <div className="relative flex-1">
          <FaSearch className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs" />
          <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search..."
            className="w-full pl-7 pr-3 py-1.5 text-sm rounded-lg border border-slate-200 bg-slate-50 focus:bg-white focus:border-teal-400 outline-none" />
        </div>
        <div className="flex gap-1 overflow-x-auto">
          {ALL_FILTERS.map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-2.5 py-1.5 text-xs font-medium rounded-lg whitespace-nowrap transition-colors ${filter === f ? "bg-navy-900 text-white" : "bg-slate-50 text-slate-500 hover:bg-slate-100"}`}>
              {f}
            </button>
          ))}
        </div>
        {isAdmin && (
          <button onClick={openAdd} className="flex items-center gap-1 text-xs font-medium px-3 py-1.5 rounded-lg bg-teal-600 text-white hover:bg-teal-700 shrink-0">
            <FaPlus className="text-[10px]" /> Add
          </button>
        )}
      </div>

      {/* Form */}
      {showForm && (
        <div className="mx-5 mt-4 rounded-xl border border-teal-200 bg-teal-50/40 p-4 space-y-3">
          <p className="text-sm font-semibold text-navy-900">{editId ? "Edit" : "New"} Requirement</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <div className="sm:col-span-2">
              <input value={form.requirement} onChange={e => setForm(f => ({ ...f, requirement: e.target.value }))} placeholder="Requirement name *"
                className={`w-full px-3 py-2 text-sm rounded-lg border outline-none focus:border-teal-400 bg-white ${errors.requirement ? "border-red-400" : "border-slate-200"}`} />
            </div>
            <input value={form.office} onChange={e => setForm(f => ({ ...f, office: e.target.value }))} placeholder="Responsible office *"
              className={`px-3 py-2 text-sm rounded-lg border outline-none focus:border-teal-400 bg-white ${errors.office ? "border-red-400" : "border-slate-200"}`} />
            <input type="date" value={form.dueDate} onChange={e => setForm(f => ({ ...f, dueDate: e.target.value }))}
              className="px-3 py-2 text-sm rounded-lg border border-slate-200 outline-none focus:border-teal-400 bg-white" />
            <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}
              className="px-3 py-2 text-sm rounded-lg border border-slate-200 outline-none focus:border-teal-400 bg-white">
              {ALL_STATUSES.map(s => <option key={s}>{s}</option>)}
            </select>
          </div>
          {saveErr && <p className="text-xs text-status-red">{saveErr}</p>}
          <div className="flex gap-2 justify-end">
            <button onClick={() => setShowForm(false)} disabled={saving} className="flex items-center gap-1 text-xs font-medium px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-50">
              <FaTimes /> Cancel
            </button>
            <button onClick={handleSave} disabled={saving} className="flex items-center gap-1 text-xs font-medium px-3 py-1.5 rounded-lg bg-navy-900 text-white hover:bg-navy-800 disabled:opacity-60">
              {saving ? <FaSpinner className="animate-spin text-xs" /> : <FaCheck />} Save
            </button>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="flex-1 overflow-y-auto px-5 py-3">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-slate-400 uppercase tracking-wide border-b border-slate-100">
              <th className="py-2 pr-3 font-medium w-28">Status</th>
              <th className="py-2 font-medium">Requirement</th>
              <th className="py-2 pl-3 font-medium text-right w-16">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {filtered.map(r => {
              const c = EXT_COLORS[r.status] || statusColors.Pending;
              return (
                <tr key={r.id} className="tbl-row group">
                  <td className="py-2.5 pr-3">
                    <select value={r.status} onChange={e => handleStatusChange(r.id, e.target.value)}
                      className={`text-xs font-semibold px-2 py-0.5 rounded-full border-0 outline-none ${isAdmin ? "cursor-pointer" : "cursor-default pointer-events-none"} ${c.bg} ${c.text}`}>
                      {ALL_STATUSES.map(s => <option key={s}>{s}</option>)}
                    </select>
                  </td>
                  <td className="py-2.5">
                    <p className="text-navy-900 font-medium text-sm">{r.requirement}</p>
                    <p className="text-xs text-slate-400">{r.office}{r.dueDate ? ` · Due: ${r.dueDate}` : ""}</p>
                  </td>
                  <td className="py-2.5 pl-3">
                    {isAdmin ? (
                      <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => openEdit(r)} className="p-1 rounded text-slate-400 hover:text-teal-600 hover:bg-teal-50">
                          <FaEdit className="text-xs" />
                        </button>
                        <button onClick={() => handleDelete(r.id)} className="p-1 rounded text-slate-400 hover:text-status-red hover:bg-status-redBg">
                          <FaTrash className="text-xs" />
                        </button>
                      </div>
                    ) : (
                      <span className="flex justify-end text-xs text-slate-400">View only</span>
                    )}
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr><td colSpan={3} className="py-8 text-center text-slate-400 text-sm">No matching requirements.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
