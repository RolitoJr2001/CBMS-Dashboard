import { useState } from "react";
import { FaPlus, FaEdit, FaTrash, FaTimes, FaCheck, FaSpinner } from "react-icons/fa";
import { useApp } from "../context/AppContext";

const typeColors = {
  Deadline: "bg-status-redBg text-status-red",
  Meeting:  "bg-teal-50 text-teal-700",
  Review:   "bg-status-yellowBg text-status-yellow",
  Briefing: "bg-navy-50 text-navy-700",
};
const EVENT_TYPES = ["Deadline", "Meeting", "Review", "Briefing"];
const EMPTY = { title: "", date: "", time: "", type: "Meeting", description: "" };

function fmtDate(s) {
  const d = new Date(s + "T00:00:00");
  return { mo: d.toLocaleDateString("en-US", { month: "short" }), day: d.getDate() };
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

  function openAdd()  { setEditId(null); setForm(EMPTY); setErrors({}); setSaveErr(""); setShowForm(true); }
  function openEdit(ev) { setEditId(ev.id); setForm({ title: ev.title, date: ev.date, time: ev.time, type: ev.type, description: ev.description || "" }); setErrors({}); setSaveErr(""); setShowForm(true); }

  function validate() {
    const e = {};
    if (!form.title.trim()) e.title = "Required";
    if (!form.date) e.date = "Required";
    if (!form.time.trim()) e.time = "Required";
    setErrors(e); return !Object.keys(e).length;
  }

  async function handleSave() {
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
    if (!window.confirm("Delete this event?")) return;
    try { await deleteEvent(id); }
    catch (err) { alert("Error: " + err.message); }
  }

  return (
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
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div className="sm:col-span-2">
                <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Title *"
                  className={`w-full px-3 py-2 text-sm rounded-lg border outline-none focus:border-teal-400 bg-white ${errors.title ? "border-red-400" : "border-slate-200"}`} />
                {errors.title && <p className="text-xs text-status-red">{errors.title}</p>}
              </div>
              <div>
                <input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
                  className={`w-full px-3 py-2 text-sm rounded-lg border outline-none focus:border-teal-400 bg-white ${errors.date ? "border-red-400" : "border-slate-200"}`} />
              </div>
              <div>
                <input type="time" value={form.time} onChange={e => setForm(f => ({ ...f, time: e.target.value }))}
                  className={`w-full px-3 py-2 text-sm rounded-lg border outline-none focus:border-teal-400 bg-white ${errors.time ? "border-red-400" : "border-slate-200"}`} />
              </div>
              <div>
                <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 outline-none focus:border-teal-400 bg-white">
                  {EVENT_TYPES.map(t => <option key={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Description (optional)"
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 outline-none focus:border-teal-400 bg-white" />
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
                    <p className="text-xs text-slate-400">{ev.time}{ev.description ? ` · ${ev.description}` : ""}</p>
                  </div>
                  <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full whitespace-nowrap ${typeColors[ev.type] || "bg-slate-100 text-slate-600"}`}>
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
