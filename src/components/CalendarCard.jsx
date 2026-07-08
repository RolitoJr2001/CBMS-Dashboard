import { useEffect, useState } from "react";
import { FaPlus, FaEdit, FaTrash, FaTimes, FaCheck, FaSpinner } from "react-icons/fa";
import { useApp } from "../context/AppContext";
import { fetchProfiles } from "../services/authService";

const typeColors = {
  Deadline: "bg-[#fce8e6] text-[#c5221f] border-[#f4c7c3]",
  Meeting:  "bg-[#e8f0fe] text-[#1a73e8] border-[#cfe1fb]",
  Review:   "bg-[#fef7e0] text-[#b06000] border-[#fce8b2]",
  Briefing: "bg-[#e6f4ea] text-[#188038] border-[#b7e1c5]",
  "Training/Workshop": "bg-[#f3e8ff] text-[#7c3aed] border-[#ddd6fe]",
  Leave: "bg-[#f1f5f9] text-[#475569] border-[#e2e8f0]",
  Hearing: "bg-[#ffe4e6] text-[#be185d] border-[#fbcfe8]",
  Seminar: "bg-[#ede9fe] text-[#6d28d9] border-[#d8b4fe]",
  Announcement: "bg-[#e0f2fe] text-[#0369a1] border-[#bae6fd]",
};
const EVENT_TYPES = ["Deadline", "Meeting", "Review", "Briefing", "Training/Workshop", "Leave", "Hearing", "Seminar", "Announcement"];
const EMPTY = { title: "", date: "", time: "", type: "Meeting", description: "", assignedPersonnel: [] };

function fmtDate(s) {
  const d = new Date(s + "T00:00:00");
  return { mo: d.toLocaleDateString("en-US", { month: "short" }), day: d.getDate() };
}

function formatAssignedPersonnel(value) {
  if (Array.isArray(value)) {
    return value.filter(Boolean).join(", ");
  }
  if (typeof value === "string") {
    return value;
  }
  return "";
}

export default function CalendarCard() {
  const { upcomingEvents, embedUrl, addEvent, updateEvent, deleteEvent, user } = useApp();
  const isAdmin = user?.role === "admin";
  const [showForm, setShowForm] = useState(false);
  const [editId,   setEditId]   = useState(null);
  const [form,     setForm]     = useState(EMPTY);
  const [errors,   setErrors]   = useState({});
  const [saving,   setSaving]   = useState(false);
  const [saveErr,  setSaveErr]  = useState("");
  const [personnel, setPersonnel] = useState([]);
  const [selectedPersonnelName, setSelectedPersonnelName] = useState("");

  useEffect(() => {
    let mounted = true;
    fetchProfiles()
      .then((data) => {
        if (mounted) {
          setPersonnel(
            (data || []).map(profile => ({
              id: profile.id,
              name: profile.name?.trim() || profile.username?.trim() || "Unnamed profile",
            }))
          );
        }
      })
      .catch(() => {});
    return () => { mounted = false; };
  }, []);

  function openAdd()  { setEditId(null); setForm(EMPTY); setErrors({}); setSaveErr(""); setSelectedPersonnelName(""); setShowForm(true); }
  function openEdit(ev) {
    setEditId(ev.id);
    setForm({
      title: ev.title,
      date: ev.date,
      time: ev.time,
      type: ev.type,
      description: ev.description || "",
      assignedPersonnel: Array.isArray(ev.assignedPersonnel)
        ? ev.assignedPersonnel
        : (ev.assignedPersonnel ? [ev.assignedPersonnel] : []),
    });
    setErrors({});
    setSaveErr("");
    setSelectedPersonnelName("");
    setShowForm(true);
  }

  function validate() {
    const e = {};
    if (!form.title.trim()) e.title = "Required";
    if (!form.date) e.date = "Required";
    if (!form.time.trim()) e.time = "Required";
    setErrors(e); return !Object.keys(e).length;
  }

  async function handleSave() {
    if (!isAdmin) return;
    if (!validate()) return;
    setSaving(true); setSaveErr("");
    try {
      if (editId) { await updateEvent(editId, form); }
      else        { await addEvent(form); }
      setShowForm(false);
    } catch (err) {
      setSaveErr(err.message || "Failed to save.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id) {
    if (!isAdmin) return;
    if (!window.confirm("Delete this event?")) return;
    try { await deleteEvent(id); }
    catch (err) { alert("Error: " + err.message); }
  }

  return (
    // Calendar widget section on the dashboard
    <div className="bg-white rounded-xl border border-slate-100 overflow-hidden flex flex-col">
      {/* Embedded calendar */}
      <div className="relative w-full" style={{ paddingBottom: "50%" }}>
        <iframe
          title="CBMS Google Calendar"
          src={embedUrl}
          className="absolute inset-0 w-full h-full border-0"
          loading="lazy"
        />
      </div>

      {/* Upcoming list */}
      <div className="flex-1 px-5 pb-5 pt-4">
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-semibold text-navy-900">Upcoming ({upcomingEvents.length})</p>
          {isAdmin && (
            <button onClick={openAdd} className="flex items-center gap-1 text-xs font-medium px-3 py-1.5 rounded-lg bg-teal-600 text-white hover:bg-teal-700 transition-colors">
              <FaPlus className="text-[10px]" /> Add
            </button>
          )}
        </div>

        {showForm && (
          <div className="rounded-xl border border-teal-200 bg-teal-50/40 p-4 mb-4 space-y-3">
            <p className="text-sm font-semibold text-navy-900">{editId ? "Edit" : "New"} Event</p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-6">
              <div className="sm:col-span-6">
                <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Title *"
                  className={`w-full px-4 py-3 text-sm rounded-2xl border outline-none focus:border-teal-400 bg-white shadow-sm ${errors.title ? "border-red-400" : "border-slate-200"}`} />
                {errors.title && <p className="mt-1 text-xs text-status-red">{errors.title}</p>}
              </div>
              <div className="sm:col-span-3">
                <input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
                  className={`w-full px-4 py-3 text-sm rounded-2xl border outline-none focus:border-teal-400 bg-white shadow-sm ${errors.date ? "border-red-400" : "border-slate-200"}`} />
              </div>
              <div className="sm:col-span-3">
                <input type="time" value={form.time} onChange={e => setForm(f => ({ ...f, time: e.target.value }))}
                  className={`w-full px-4 py-3 text-sm rounded-2xl border outline-none focus:border-teal-400 bg-white shadow-sm ${errors.time ? "border-red-400" : "border-slate-200"}`} />
              </div>
              <div className="sm:col-span-3">
                <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}
                  className="w-full px-4 py-3 text-sm rounded-2xl border border-slate-200 outline-none focus:border-teal-400 bg-white shadow-sm">
                  {EVENT_TYPES.map(t => <option key={t}>{t}</option>)}
                </select>
              </div>
              <div className="sm:col-span-3">
                <div className="flex gap-2">
                  <select
                    value={selectedPersonnelName}
                    onChange={(e) => setSelectedPersonnelName(e.target.value)}
                    className="flex-1 px-4 py-3 text-sm rounded-2xl border border-slate-200 outline-none focus:border-teal-400 bg-white shadow-sm"
                  >
                    <option value="">Select person</option>
                    {personnel
                      .filter(p => !form.assignedPersonnel.includes(p.name))
                      .map(p => (
                        <option key={p.id} value={p.name}>{p.name}</option>
                      ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => {
                      if (!selectedPersonnelName) return;
                      setForm(f => ({
                        ...f,
                        assignedPersonnel: f.assignedPersonnel.includes(selectedPersonnelName)
                          ? f.assignedPersonnel
                          : [...f.assignedPersonnel, selectedPersonnelName],
                      }));
                      setSelectedPersonnelName("");
                    }}
                    className="inline-flex items-center justify-center px-4 py-3 rounded-2xl bg-teal-600 text-white hover:bg-teal-700 transition-colors shadow-sm"
                  >
                    <FaPlus className="text-sm" />
                  </button>
                </div>
                {form.assignedPersonnel.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {form.assignedPersonnel.map(person => (
                      <span key={person} className="inline-flex items-center gap-2 rounded-full bg-teal-100 text-teal-800 px-3 py-1 text-xs font-medium shadow-sm">
                        {person}
                        <button
                          type="button"
                          onClick={() => setForm(f => ({ ...f, assignedPersonnel: f.assignedPersonnel.filter(item => item !== person) }))}
                          className="text-teal-700 hover:text-teal-900"
                        >
                          <FaTimes className="text-[10px]" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <div className="sm:col-span-6">
                <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Description (optional)"
                  rows={3}
                  className="w-full px-4 py-3 text-sm rounded-2xl border border-slate-200 outline-none focus:border-teal-400 bg-white shadow-sm resize-none" />
              </div>
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

        {upcomingEvents.length === 0 ? (
          <p className="text-sm text-slate-400 py-4 text-center">No upcoming events. Add one above.</p>
        ) : (
          <ul className="divide-y divide-slate-50">
            {upcomingEvents.map(ev => {
              const { mo, day } = fmtDate(ev.date);
              return (
                <li key={ev.id} className="flex items-center gap-3 py-2.5 group">
                  <div className="flex flex-col items-center justify-center w-10 h-10 rounded-lg bg-navy-900 text-white shrink-0">
                    <span className="text-[9px] uppercase leading-none opacity-70">{mo}</span>
                    <span className="text-sm font-bold leading-none">{day}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-navy-900 truncate">{ev.title}</p>
                    <p className="text-xs text-slate-400">
                      {ev.time}
                      {formatAssignedPersonnel(ev.assignedPersonnel) ? ` · Assigned to ${formatAssignedPersonnel(ev.assignedPersonnel)}` : ""}
                      {ev.description ? ` · ${ev.description}` : ""}
                    </p>
                  </div>
                  <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full whitespace-nowrap border ${typeColors[ev.type] || "bg-slate-100 text-slate-600 border-slate-200"}`}>
                    {ev.type}
                  </span>
                  {isAdmin && (
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => openEdit(ev)} className="p-1 rounded text-slate-400 hover:text-teal-600 hover:bg-teal-50">
                        <FaEdit className="text-xs" />
                      </button>
                      <button onClick={() => handleDelete(ev.id)} className="p-1 rounded text-slate-400 hover:text-status-red hover:bg-status-redBg">
                        <FaTrash className="text-xs" />
                      </button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
