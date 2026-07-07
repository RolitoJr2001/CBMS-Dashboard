import { useEffect, useMemo, useState } from "react";
import { MdAssignment, MdAdd, MdClose, MdEdit, MdDelete, MdPending, MdHourglassEmpty } from "react-icons/md";
import { useApp } from "../context/AppContext";
import { fetchPersonnel } from "../services/personnelService";

const STATUS_OPTIONS = ["Not Started", "Ongoing", "Pending", "Completed"];

function formatAssignedPersonnel(value) {
  if (Array.isArray(value)) {
    return value.filter(Boolean).join(", ");
  }
  return typeof value === "string" ? value : "";
}

const EMPTY_FORM = {
  title: "",
  description: "",
  assignedTo: [],
  dueDate: "",
  status: "Not Started",
  remarks: "",
};

export default function TaskPanel() {
  const { user, tasks, addTask, updateTask, deleteTask } = useApp();
  const isAdmin = String(user?.role || "viewer").toLowerCase() === "admin";
  const [showForm, setShowForm] = useState(false);
  const [editTaskId, setEditTaskId] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [saveErr, setSaveErr] = useState("");
  const [personnelOptions, setPersonnelOptions] = useState([]);
  const [personnelLoading, setPersonnelLoading] = useState(false);
  const [selectedPersonnelName, setSelectedPersonnelName] = useState("");
  const [remarkDrafts, setRemarkDrafts] = useState({});

  useEffect(() => {
    let mounted = true;
    async function loadPersonnel() {
      setPersonnelLoading(true);
      try {
        const data = await fetchPersonnel();
        if (mounted) setPersonnelOptions(data || []);
      } catch (err) {
        if (mounted) setPersonnelOptions([]);
      } finally {
        if (mounted) setPersonnelLoading(false);
      }
    }
    loadPersonnel();
    return () => { mounted = false; };
  }, []);

  const currentUserValues = useMemo(() => {
    return [user?.username, user?.name, user?.full_name, user?.fullName]
      .filter(Boolean)
      .map(value => String(value).trim().toLowerCase());
  }, [user?.username, user?.name, user?.full_name, user?.fullName]);

  const myTasks = useMemo(() => {
    if (isAdmin) return tasks || [];

    return (tasks || []).filter(task => {
      const assigned = Array.isArray(task.assignedTo) ? task.assignedTo : [task.assignedTo];
      if (!assigned.length || !assigned[0]) return true;
      return assigned.some(assignedPerson => currentUserValues.includes(String(assignedPerson).trim().toLowerCase()));
    });
  }, [isAdmin, tasks, currentUserValues]);

  useEffect(() => {
    setRemarkDrafts(prev => {
      const next = {};
      (tasks || []).forEach(task => {
        next[task.id] = prev[task.id] ?? "";
      });
      return next;
    });
  }, [tasks]);

  async function handleSave() {
    if (!isAdmin) {
      setSaveErr("Only admins can create tasks.");
      return;
    }
    if (!form.title.trim()) {
      setSaveErr("Task title is required.");
      return;
    }
    setSaving(true);
    setSaveErr("");
    try {
      if (editTaskId) {
        await updateTask(editTaskId, {
          ...form,
          assignedTo: form.assignedTo.length ? form.assignedTo : [user?.username || user?.name || ""],
          status: form.status || "Not Started",
          remarks: form.remarks || "",
        });
      } else {
        await addTask({
          ...form,
          assignedTo: form.assignedTo.length ? form.assignedTo : [user?.username || user?.name || ""],
          status: form.status || "Not Started",
          remarks: form.remarks || "",
        });
      }
      setForm(EMPTY_FORM);
      setSelectedPersonnelName("");
      setEditTaskId(null);
      setShowForm(false);
    } catch (err) {
      setSaveErr(err.message || "Failed to save task.");
    } finally {
      setSaving(false);
    }
  }

  async function handleStatusChange(id, status) {
    try {
      await updateTask(id, { status });
    } catch (err) {
      console.error("Failed to update task status", err);
    }
  }

  async function handleDelete(id) {
    if (!window.confirm("Delete this task?")) return;
    await deleteTask(id);
  }

  function handleRemarksDraft(id, value) {
    setRemarkDrafts(prev => ({ ...prev, [id]: value }));
  }

  async function handleRemarksSubmit(id) {
    try {
      const value = (remarkDrafts[id] || "").trim();
      await updateTask(id, { remarks: value });
      setRemarkDrafts(prev => ({ ...prev, [id]: "" }));
    } catch (err) {
      console.error("Failed to save task remark", err);
    }
  }

  return (
    // Task management section shown on the dashboard page
    <div className="bg-white rounded-xl border border-slate-100 p-5 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="flex items-center justify-center w-9 h-9 rounded-lg bg-teal-50 text-teal-700">
            <MdAssignment />
          </span>
          <div>
            <h3 className="text-sm font-semibold text-navy-900">Tasks</h3>
            <p className="text-xs text-slate-500">Assigned work and follow-ups</p>
          </div>
        </div>
        {isAdmin && (
          <button onClick={() => {
            setEditTaskId(null);
            setForm(EMPTY_FORM);
            setSelectedPersonnelName("");
            setShowForm(v => !v);
          }} className="flex items-center gap-1 text-xs font-medium px-3 py-1.5 rounded-lg bg-navy-900 text-white hover:bg-navy-800">
            <MdAdd /> New Task
          </button>
        )}
      </div>
      {showForm && isAdmin && (
        <div className="rounded-xl border border-teal-200 bg-teal-50/40 p-4 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-slate-600 mb-1">Task Title *</label>
              <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} className="w-full px-4 py-3 text-sm rounded-2xl border border-slate-200 outline-none focus:border-teal-400 bg-white shadow-sm" />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-slate-600 mb-1">Description</label>
              <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={3} className="w-full px-4 py-3 text-sm rounded-2xl border border-slate-200 outline-none focus:border-teal-400 bg-white shadow-sm resize-none" />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-slate-600 mb-1">Remarks</label>
              <input value={form.remarks} onChange={e => setForm(f => ({ ...f, remarks: e.target.value }))} className="w-full px-4 py-3 text-sm rounded-2xl border border-slate-200 outline-none focus:border-teal-400 bg-white shadow-sm" placeholder="Add remarks for this task" />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-slate-600 mb-1">Assign To</label>
              <div className="flex gap-2">
                <select
                  value={selectedPersonnelName}
                  onChange={(e) => setSelectedPersonnelName(e.target.value)}
                  disabled={personnelLoading}
                  className="flex-1 px-4 py-3 text-sm rounded-2xl border border-slate-200 outline-none focus:border-teal-400 bg-white shadow-sm"
                >
                  <option value="">{personnelLoading ? "Loading personnel..." : "Select personnel"}</option>
                  {personnelOptions
                    .filter(person => !form.assignedTo.includes(person.name))
                    .map(person => (
                      <option key={person.id} value={person.name}>{person.name}</option>
                    ))}
                </select>
                <button
                  type="button"
                  onClick={() => {
                    if (!selectedPersonnelName) return;
                    setForm(f => ({
                      ...f,
                      assignedTo: f.assignedTo.includes(selectedPersonnelName)
                        ? f.assignedTo
                        : [...f.assignedTo, selectedPersonnelName],
                    }));
                    setSelectedPersonnelName("");
                  }}
                  className="inline-flex items-center justify-center px-4 py-3 rounded-2xl bg-teal-600 text-white hover:bg-teal-700 transition-colors shadow-sm"
                >
                  <MdAdd className="text-base" />
                </button>
              </div>
              {form.assignedTo.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {form.assignedTo.map(person => (
                    <span key={person} className="inline-flex items-center gap-2 rounded-full bg-teal-100 text-teal-800 px-3 py-1 text-xs font-medium shadow-sm">
                      {person}
                      <button
                        type="button"
                        onClick={() => setForm(f => ({ ...f, assignedTo: f.assignedTo.filter(item => item !== person) }))}
                        className="text-teal-700 hover:text-teal-900"
                      >
                        <MdClose className="text-[14px]" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Status</label>
              <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))} className="w-full px-4 py-3 text-sm rounded-2xl border border-slate-200 outline-none focus:border-teal-400 bg-white shadow-sm">
                {STATUS_OPTIONS.map(option => <option key={option} value={option}>{option}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Due Date</label>
              <input type="date" value={form.dueDate} onChange={e => setForm(f => ({ ...f, dueDate: e.target.value }))} className="w-full px-4 py-3 text-sm rounded-2xl border border-slate-200 outline-none focus:border-teal-400 bg-white shadow-sm" />
            </div>
          </div>
          {saveErr && <p className="text-xs text-status-red">{saveErr}</p>}
          <div className="flex justify-end gap-2">
            <button onClick={() => { setShowForm(false); setSaveErr(""); setEditTaskId(null); }} className="px-3 py-1.5 rounded-2xl border border-slate-200 text-slate-600 text-sm">Cancel</button>
            <button onClick={handleSave} disabled={saving} className="px-3 py-1.5 rounded-2xl bg-navy-900 text-white text-sm disabled:opacity-60">{saving ? "Saving..." : editTaskId ? "Update Task" : "Save Task"}</button>
          </div>
        </div>
      )}

      <div className="space-y-3">
        {myTasks.length === 0 ? (
          <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">No tasks assigned yet.</div>
        ) : myTasks.map(task => (
          <div key={task.id} className="rounded-xl border border-slate-100 p-4 space-y-2">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-sm font-semibold text-navy-900">{task.title}</p>
                <p className="text-xs text-slate-500">{task.description || "No description provided."}</p>
              </div>
              <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${task.status === "Completed" ? "bg-status-greenBg text-status-green" : task.status === "Ongoing" || task.status === "In Progress" ? "bg-status-yellowBg text-status-yellow" : task.status === "Pending" ? "bg-status-redBg text-status-red" : "bg-slate-100 text-slate-600"}`}>
                {task.status}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
              <span className="flex items-center gap-1"><MdPending /> Assigned to {formatAssignedPersonnel(task.assignedTo) || "Unassigned"}</span>
              <span className="flex items-center gap-1"><MdPending /> Assigned by {task.assignedBy || "Admin"}</span>
              <span className="flex items-center gap-1"><MdHourglassEmpty /> {task.dueDate || "No due date"}</span>
            </div>
            <div className="flex flex-col gap-2 pt-1">
              <select value={task.status} onChange={(e) => handleStatusChange(task.id, e.target.value)} className="text-sm px-2 py-1 rounded border border-slate-200 bg-white w-fit">
                {STATUS_OPTIONS.map(option => <option key={option} value={option}>{option}</option>)}
              </select>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={remarkDrafts[task.id] ?? ""}
                    onChange={(e) => handleRemarksDraft(task.id, e.target.value)}
                    placeholder="Add remark"
                    className="w-full px-2 py-1.5 text-sm rounded border border-slate-200 bg-white"
                  />
                  <button
                    onClick={() => handleRemarksSubmit(task.id)}
                    className="px-2.5 py-1.5 text-xs font-medium rounded bg-navy-900 text-white hover:bg-navy-800"
                  >
                    Submit
                  </button>
                </div>
                <div className="rounded-md border border-slate-100 bg-slate-50 px-2.5 py-2">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Remarks</p>
                  <p className="mt-1 text-sm text-slate-700 whitespace-pre-wrap">
                    {(task.remarks || "").trim() ? task.remarks : "No remarks yet."}
                  </p>
                </div>
              </div>
              <div className="flex justify-between items-center gap-2">
                {isAdmin && (
                  <button
                    onClick={() => {
                      setEditTaskId(task.id);
                      setForm({
                        title: task.title,
                        description: task.description || "",
                        assignedTo: Array.isArray(task.assignedTo) ? task.assignedTo : [task.assignedTo].filter(Boolean),
                        dueDate: task.dueDate || "",
                        status: task.status || "Not Started",
                        remarks: task.remarks || "",
                      });
                      setSelectedPersonnelName("");
                      setShowForm(true);
                    }}
                    className="inline-flex items-center justify-center rounded-full p-2 bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors"
                    aria-label="Edit task"
                  >
                    <MdEdit className="text-base" />
                  </button>
                )}
                {isAdmin && (
                  <button
                    onClick={() => handleDelete(task.id)}
                    className="inline-flex items-center justify-center rounded-full p-2 text-status-red hover:bg-status-red/10 transition-colors"
                    aria-label="Delete task"
                  >
                    <MdDelete className="text-base" />
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
