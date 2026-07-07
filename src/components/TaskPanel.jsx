import { useEffect, useMemo, useState } from "react";
import { MdAssignment, MdAdd, MdCheckCircle, MdPending, MdHourglassEmpty } from "react-icons/md";
import { useApp } from "../context/AppContext";
import { fetchPersonnel } from "../services/personnelService";

const STATUS_OPTIONS = ["Not Started", "Ongoing", "Pending", "Completed"];

const EMPTY_FORM = {
  title: "",
  description: "",
  assignedTo: "",
  dueDate: "",
  status: "Not Started",
  remarks: "",
};

export default function TaskPanel() {
  const { user, tasks, addTask, updateTask, deleteTask } = useApp();
  const isAdmin = String(user?.role || "viewer").toLowerCase() === "admin";
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [saveErr, setSaveErr] = useState("");
  const [personnelOptions, setPersonnelOptions] = useState([]);
  const [personnelLoading, setPersonnelLoading] = useState(false);
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
      if (!task.assignedTo) return true;
      const assignedValue = String(task.assignedTo).trim().toLowerCase();
      return currentUserValues.includes(assignedValue);
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
      await addTask({
        ...form,
        assignedTo: form.assignedTo || user?.username || user?.name || "",
        status: form.status || "Not Started",
        remarks: form.remarks || "",
      });
      setForm(EMPTY_FORM);
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
          <button onClick={() => setShowForm(v => !v)} className="flex items-center gap-1 text-xs font-medium px-3 py-1.5 rounded-lg bg-navy-900 text-white hover:bg-navy-800">
            <MdAdd /> New Task
          </button>
        )}
      </div>

      {showForm && isAdmin && (
        // Task form for creating new assignments
        <div className="rounded-xl border border-teal-200 bg-teal-50/40 p-4 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="md:col-span-2">
              <label className="block text-xs font-medium text-slate-600 mb-1">Task Title *</label>
              <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 bg-white" />
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs font-medium text-slate-600 mb-1">Description</label>
              <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={2} className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 bg-white resize-none" />
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs font-medium text-slate-600 mb-1">Remarks</label>
              <input value={form.remarks} onChange={e => setForm(f => ({ ...f, remarks: e.target.value }))} className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 bg-white" placeholder="Add remarks for this task" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Assign To</label>
              <select value={form.assignedTo} onChange={e => setForm(f => ({ ...f, assignedTo: e.target.value }))} disabled={personnelLoading} className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 bg-white">
                <option value="">{personnelLoading ? "Loading personnel..." : "Select personnel"}</option>
                {personnelOptions.map(person => (
                  <option key={person.id} value={person.name}>{person.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Status</label>
              <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))} className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 bg-white">
                {STATUS_OPTIONS.map(option => <option key={option} value={option}>{option}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Due Date</label>
              <input type="date" value={form.dueDate} onChange={e => setForm(f => ({ ...f, dueDate: e.target.value }))} className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 bg-white" />
            </div>
          </div>
          {saveErr && <p className="text-xs text-status-red">{saveErr}</p>}
          <div className="flex justify-end gap-2">
            <button onClick={() => { setShowForm(false); setSaveErr(""); }} className="px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 text-sm">Cancel</button>
            <button onClick={handleSave} disabled={saving} className="px-3 py-1.5 rounded-lg bg-navy-900 text-white text-sm disabled:opacity-60">{saving ? "Saving..." : "Save Task"}</button>
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
              <span className="flex items-center gap-1"><MdPending /> Assigned to {task.assignedTo || "Unassigned"}</span>
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
              {isAdmin && <div className="flex justify-end"><button onClick={() => handleDelete(task.id)} className="text-xs text-status-red">Delete</button></div>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
