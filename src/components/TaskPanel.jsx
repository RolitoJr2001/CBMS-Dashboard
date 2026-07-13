import { useEffect, useMemo, useState } from "react";
import { MdAssignment, MdAdd, MdEdit, MdDelete, MdPending, MdHourglassEmpty, MdFlag, MdAttachFile } from "react-icons/md";
import { useApp } from "../context/AppContext";
import { fetchProfiles } from "../services/authService";
import PersonnelChip from "./PersonnelChip";
import RemarksThread from "./RemarksThread";
import TaskDetailsModal from "./TaskDetailsModal";
import { getDueDateStatus } from "../utils/dueDateStatus";
import { getPersonnelOptionStyle } from "../utils/personnelColors";
import { uploadTaskAttachment } from "../services/tasksService";

const STATUS_OPTIONS = ["Not Started", "Ongoing", "Pending", "Completed"];
const PRIORITY_OPTIONS = ["Low", "Medium", "High", "Urgent"];
const PRIORITY_BADGE = {
  Urgent: "bg-status-redBg text-status-red",
  High:   "bg-orange-100 text-orange-700",
  Medium: "bg-status-yellowBg text-status-yellow",
  Low:    "bg-slate-100 text-slate-600",
};

const EMPTY_FORM = {
  title: "",
  description: "",
  assignedTo: [],
  dueDate: "",
  status: "Not Started",
  priority: "Medium",
  remarks: "",
};

export default function TaskPanel() {
  const {
    user, tasks, addTask, updateTask, deleteTask,
    remarksByTask, remarksLoading, addTaskRemark,
    focusTarget, clearFocusTarget, personnelColorMap,
  } = useApp();
  const isAdmin = String(user?.role || "viewer").toLowerCase() === "admin";
  const [showForm, setShowForm] = useState(false);
  const [editTaskId, setEditTaskId] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [saveErr, setSaveErr] = useState("");
  const [personnelOptions, setPersonnelOptions] = useState([]);
  const [personnelLoading, setPersonnelLoading] = useState(false);
  const [selectedPersonnelName, setSelectedPersonnelName] = useState("");
  const [attachmentFile, setAttachmentFile] = useState(null);
  const [uploadingAttachment, setUploadingAttachment] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useState(null);

  useEffect(() => {
    let mounted = true;
    async function loadPersonnel() {
      setPersonnelLoading(true);
      try {
        const data = await fetchProfiles();
        if (mounted) {
          setPersonnelOptions(
            (data || []).map(profile => ({
              id: profile.id,
              name: profile.name?.trim() || profile.username?.trim() || "Unnamed profile",
            }))
          );
        }
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

  const [highlightedTaskId, setHighlightedTaskId] = useState(null);

  useEffect(() => {
    if (!focusTarget || focusTarget.entityType !== "task") return;
    const el = document.getElementById(`task-card-${focusTarget.entityId}`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
    }
    setHighlightedTaskId(focusTarget.entityId);
    const timeout = setTimeout(() => setHighlightedTaskId(null), 3000);
    clearFocusTarget();
    return () => clearTimeout(timeout);
  }, [focusTarget, clearFocusTarget]);

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
      const initialRemark = (form.remarks || "").trim();
      const { hasAttachment, ...taskPayload } = form;
      let taskId = editTaskId;
      if (editTaskId) {
        await updateTask(editTaskId, {
          ...taskPayload,
          assignedTo: form.assignedTo.length ? form.assignedTo : [user?.username || user?.name || ""],
          status: form.status || "Not Started",
          priority: form.priority || "Medium",
        });
        if (initialRemark) await addTaskRemark(editTaskId, initialRemark);
      } else {
        const created = await addTask({
          ...taskPayload,
          assignedTo: form.assignedTo.length ? form.assignedTo : [user?.username || user?.name || ""],
          status: form.status || "Not Started",
          priority: form.priority || "Medium",
        });
        taskId = created?.id || null;
        if (initialRemark && taskId) await addTaskRemark(taskId, initialRemark);
      }

      if (attachmentFile && taskId) {
        setUploadingAttachment(true);
        try {
          const path = await uploadTaskAttachment(attachmentFile, taskId);
          await updateTask(taskId, { attachmentPath: path });
        } catch (uploadErr) {
          setSaveErr(uploadErr.message || "Task saved, but the attachment failed to upload.");
        } finally {
          setUploadingAttachment(false);
        }
      }

      setForm(EMPTY_FORM);
      setSelectedPersonnelName("");
      setAttachmentFile(null);
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
              <label className="block text-xs font-medium text-slate-600 mb-1">Remarks {editTaskId ? "(adds a new remark to the history)" : "(optional first remark)"}</label>
              <textarea value={form.remarks} onChange={e => setForm(f => ({ ...f, remarks: e.target.value }))} rows={3} className="w-full px-4 py-3 text-sm rounded-2xl border border-slate-200 outline-none focus:border-teal-400 bg-white shadow-sm resize-none" placeholder="Add a remark for this task" />
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
                  <option value="">{personnelLoading ? "Loading profiles..." : "Select person"}</option>
                  {personnelOptions
                    .filter(person => !form.assignedTo.includes(person.name))
                    .map(person => (
                      <option
                        key={person.id}
                        value={person.name}
                        style={getPersonnelOptionStyle(personnelColorMap?.[person.name.trim().toLowerCase()])}
                      >
                        {person.name}
                      </option>
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
                    <PersonnelChip
                      key={person}
                      name={person}
                      onRemove={() => setForm(f => ({ ...f, assignedTo: f.assignedTo.filter(item => item !== person) }))}
                    />
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
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Priority</label>
              <select value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value }))} className="w-full px-4 py-3 text-sm rounded-2xl border border-slate-200 outline-none focus:border-teal-400 bg-white shadow-sm">
                {PRIORITY_OPTIONS.map(option => <option key={option} value={option}>{option}</option>)}
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-slate-600 mb-1">Attachment (optional)</label>
              <input
                type="file"
                onChange={e => setAttachmentFile(e.target.files?.[0] || null)}
                className="w-full text-xs text-slate-600 file:mr-3 file:px-3 file:py-2 file:rounded-xl file:border-0 file:bg-teal-50 file:text-teal-700 file:text-xs file:font-medium hover:file:bg-teal-100"
              />
              {attachmentFile && <p className="mt-1 text-[11px] text-slate-500">Selected: {attachmentFile.name}</p>}
              {editTaskId && !attachmentFile && form.hasAttachment && <p className="mt-1 text-[11px] text-slate-500">This task already has an attachment. Choose a file to replace it.</p>}
            </div>
          </div>
          {uploadingAttachment && <p className="text-xs text-slate-500">Uploading attachment…</p>}
          {saveErr && <p className="text-xs text-status-red">{saveErr}</p>}
          <div className="flex justify-end gap-2">
            <button onClick={() => { setShowForm(false); setSaveErr(""); setEditTaskId(null); setAttachmentFile(null); }} className="px-3 py-1.5 rounded-2xl border border-slate-200 text-slate-600 text-sm">Cancel</button>
            <button onClick={handleSave} disabled={saving} className="px-3 py-1.5 rounded-2xl bg-navy-900 text-white text-sm disabled:opacity-60">{saving ? "Saving..." : editTaskId ? "Update Task" : "Save Task"}</button>
          </div>
        </div>
      )}

      {myTasks.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">No tasks assigned yet.</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {myTasks.map(task => {
            const dueStatus = getDueDateStatus(task.dueDate, task.status);
            const assignedList = Array.isArray(task.assignedTo) ? task.assignedTo.filter(Boolean) : [task.assignedTo].filter(Boolean);
            return (
              <div
                key={task.id}
                id={`task-card-${task.id}`}
                role="button"
                tabIndex={0}
                onClick={() => setSelectedTaskId(task.id)}
                onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setSelectedTaskId(task.id); } }}
                className={`rounded-xl border p-3.5 space-y-2 transition-shadow cursor-pointer hover:shadow-cardHover ${dueStatus.level === "normal" ? "border-slate-100" : dueStatus.borderClass} ${highlightedTaskId === task.id ? "ring-2 ring-teal-400 shadow-cardHover" : ""}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-navy-900 truncate flex items-center gap-1.5">
                      {task.title}
                      {task.attachmentPath && <MdAttachFile className="text-slate-400 text-sm shrink-0" title="Has an attachment" />}
                    </p>
                    <p className="text-xs text-slate-500 line-clamp-2">{task.description || "No description provided."}</p>
                  </div>
                  <div className="shrink-0 flex flex-col items-end gap-1">
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap ${task.status === "Completed" ? "bg-status-greenBg text-status-green" : task.status === "Ongoing" || task.status === "In Progress" ? "bg-status-yellowBg text-status-yellow" : task.status === "Pending" ? "bg-status-redBg text-status-red" : "bg-slate-100 text-slate-600"}`}>
                      {task.status}
                    </span>
                    <span className={`inline-flex items-center gap-0.5 text-[10px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap ${PRIORITY_BADGE[task.priority] || PRIORITY_BADGE.Medium}`}>
                      <MdFlag className="text-[10px]" /> {task.priority || "Medium"}
                    </span>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[11px] text-slate-500">
                  <span className="flex items-center gap-1"><MdPending />
                    {assignedList.length ? (
                      <span className="flex flex-wrap gap-1">
                        {assignedList.map(person => (
                          <PersonnelChip key={person} name={person} role={isAdmin && assignedList.length === 1 && person === user?.name ? "admin" : undefined} size="xs" />
                        ))}
                      </span>
                    ) : "Unassigned"}
                  </span>
                  <span className={`flex items-center gap-1 font-medium ${dueStatus.textClass}`}>
                    <MdHourglassEmpty /> {task.dueDate || "No due date"}
                    {dueStatus.label && (
                      <span className={`ml-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${dueStatus.badgeBg} ${dueStatus.badgeText}`}>
                        {dueStatus.label}
                      </span>
                    )}
                  </span>
                </div>
                <div className="flex flex-col gap-2 pt-1">
                  <select value={task.status} onClick={(e) => e.stopPropagation()} onChange={(e) => handleStatusChange(task.id, e.target.value)} className="text-xs px-2 py-1 rounded border border-slate-200 bg-white w-fit">
                    {STATUS_OPTIONS.map(option => <option key={option} value={option}>{option}</option>)}
                  </select>
                  <div onClick={e => e.stopPropagation()}>
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 mb-1">Remarks</p>
                    <RemarksThread
                      remarks={remarksByTask[task.id] || []}
                      loading={remarksLoading.tasks}
                      onAdd={(content) => addTaskRemark(task.id, content)}
                      autoScrollToLatest={highlightedTaskId === task.id}
                      compact
                    />
                  </div>
                  <div className="flex justify-between items-center gap-2">
                    <p className="text-[10px] text-slate-400 truncate">By {task.assignedBy || "Admin"}</p>
                    <div className="flex items-center gap-1">
                      {isAdmin && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditTaskId(task.id);
                            setForm({
                              title: task.title,
                              description: task.description || "",
                              assignedTo: Array.isArray(task.assignedTo) ? task.assignedTo : [task.assignedTo].filter(Boolean),
                              dueDate: task.dueDate || "",
                              status: task.status || "Not Started",
                              priority: task.priority || "Medium",
                              remarks: "",
                              hasAttachment: Boolean(task.attachmentPath),
                            });
                            setSelectedPersonnelName("");
                            setAttachmentFile(null);
                            setShowForm(true);
                          }}
                          className="inline-flex items-center justify-center rounded-full p-1.5 bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors"
                          aria-label="Edit task"
                        >
                          <MdEdit className="text-sm" />
                        </button>
                      )}
                      {isAdmin && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();  
                            handleDelete(task.id)}}      
                          className="inline-flex items-center justify-center rounded-full p-1.5 text-status-red hover:bg-status-red/10 transition-colors"
                          aria-label="Delete task"
                        >
                          <MdDelete className="text-sm" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {selectedTaskId && (() => {
        const selectedTask = myTasks.find(t => t.id === selectedTaskId);
        if (!selectedTask) return null;
        return (
          <TaskDetailsModal
            task={selectedTask}
            remarks={remarksByTask[selectedTask.id] || []}
            remarksLoading={remarksLoading.tasks}
            onAddRemark={(content) => addTaskRemark(selectedTask.id, content)}
            onClose={() => setSelectedTaskId(null)}
          />
        );
      })()}
    </div>
  );
}
