import { useEffect, useMemo, useRef, useState } from "react";
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
  const formRef = useRef(null);

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

  // Auto-scroll to edit form when it opens
  useEffect(() => {
    if (showForm && formRef.current && editTaskId) {
      setTimeout(() => {
        formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 100);
    }
  }, [showForm, editTaskId]);

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
        <div ref={formRef} className="rounded-xl border border-teal-200 bg-teal-50/40 p-4 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-slate-600 mb-0.5">Task Title *</label>
              <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 outline-none focus:border-teal-400 bg-white shadow-sm" />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-slate-600 mb-0.5">Description</label>
              <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={2} className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 outline-none focus:border-teal-400 bg-white shadow-sm resize-none" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-0.5">Status</label>
              <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))} className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 outline-none focus:border-teal-400 bg-white shadow-sm">
                {STATUS_OPTIONS.map(option => <option key={option} value={option}>{option}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-0.5">Priority</label>
              <select value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value }))} className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 outline-none focus:border-teal-400 bg-white shadow-sm">
                {PRIORITY_OPTIONS.map(option => <option key={option} value={option}>{option}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-0.5">Due Date</label>
              <input type="date" value={form.dueDate} onChange={e => setForm(f => ({ ...f, dueDate: e.target.value }))} className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 outline-none focus:border-teal-400 bg-white shadow-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-0.5">Attachment</label>
              <input
                type="file"
                onChange={e => setAttachmentFile(e.target.files?.[0] || null)}
                className="w-full text-xs text-slate-600 file:mr-2 file:px-2.5 file:py-1.5 file:rounded-lg file:border-0 file:bg-teal-50 file:text-teal-700 file:text-[11px] file:font-medium hover:file:bg-teal-100"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-slate-600 mb-0.5">Remarks {editTaskId ? "(adds new remark)" : "(optional)"}</label>
              <textarea value={form.remarks} onChange={e => setForm(f => ({ ...f, remarks: e.target.value }))} rows={2} className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 outline-none focus:border-teal-400 bg-white shadow-sm resize-none" placeholder="Add a remark for this task" />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-slate-600 mb-0.5">Assign To</label>
              <div className="flex gap-2">
                <select
                  value={selectedPersonnelName}
                  onChange={(e) => setSelectedPersonnelName(e.target.value)}
                  disabled={personnelLoading}
                  className="flex-1 px-3 py-2 text-xs rounded-xl border border-slate-200 outline-none focus:border-teal-400 bg-white shadow-sm"
                >
                  <option value="">{personnelLoading ? "Loading..." : "Select person"}</option>
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
                  className="inline-flex items-center justify-center px-3 py-2 rounded-xl bg-teal-600 text-white hover:bg-teal-700 transition-colors shadow-sm shrink-0"
                >
                  <MdAdd className="text-base" />
                </button>
              </div>
              {form.assignedTo.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
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
          </div>
          {attachmentFile && <p className="text-[10px] text-slate-500">Selected: {attachmentFile.name}</p>}
          {editTaskId && !attachmentFile && form.hasAttachment && <p className="text-[10px] text-slate-500">Has existing attachment</p>}
          {uploadingAttachment && <p className="text-xs text-slate-500">Uploading attachment…</p>}
          {saveErr && <p className="text-xs text-status-red">{saveErr}</p>}
          <div className="flex justify-end gap-2 pt-1">
            <button onClick={() => { setShowForm(false); setSaveErr(""); setEditTaskId(null); setAttachmentFile(null); }} className="px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 text-xs font-medium hover:bg-slate-50">Cancel</button>
            <button onClick={handleSave} disabled={saving} className="px-3 py-1.5 rounded-lg bg-navy-900 text-white text-xs font-medium hover:bg-navy-800 disabled:opacity-60">{saving ? "Saving..." : editTaskId ? "Update" : "Create"}</button>
          </div>
        </div>
      )}

      {myTasks.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">No tasks assigned yet.</div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-2.5">
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
                onKeyDown={e => {
                  const target = e.target;
                  const isEditableTarget = target instanceof HTMLElement && target.closest("input, textarea, select, button, [contenteditable='true'], [role='textbox']")
                  if (isEditableTarget) return;
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setSelectedTaskId(task.id);
                  }
                }}
                className={`rounded-lg border p-2.5 space-y-2 transition-shadow cursor-pointer hover:shadow-card ${task.status === "Completed"? "border-status-green bg-status-greenBg/10"
                  : dueStatus.level === "normal"
                        ? "border-slate-100"
                        : dueStatus.borderClass
                  } ${
                    highlightedTaskId === task.id
                      ? "ring-2 ring-teal-400 shadow-card"
                      : ""
                  }`}
              >
                {/* Task title + attachment icon */}
                <div className="flex items-start justify-between gap-2">
                  <h4 className="text-sm font-semibold text-navy-900 truncate flex items-center gap-1.5">
                    {task.title}
                    {task.attachmentPath && <MdAttachFile className="text-slate-400 text-xs shrink-0" title="Has attachment" />}
                  </h4>
                  {isAdmin && (
                    <div className="flex items-center gap-1 shrink-0" onClick={e => e.stopPropagation()}>
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
                        className="inline-flex items-center justify-center rounded p-1 text-slate-600 hover:bg-slate-100 transition-colors shrink-0"
                        aria-label="Edit task"
                      >
                        <MdEdit className="text-xs" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();  
                          handleDelete(task.id)}}      
                        className="inline-flex items-center justify-center rounded p-1 text-status-red hover:bg-status-red/10 transition-colors shrink-0"
                        aria-label="Delete task"
                      >
                        <MdDelete className="text-xs" />
                      </button>
                    </div>
                  )}
                </div>

                {/* Description preview */}
                <p className="text-xs text-slate-600 line-clamp-1">{task.description || "—"}</p>

                {/* Status + Priority on same line */}
                <div className="flex items-center justify-between gap-2">
                  <select value={task.status} onClick={(e) => e.stopPropagation()} onChange={(e) => handleStatusChange(task.id, e.target.value)} className="text-xs px-2 py-1 rounded border border-slate-200 bg-white w-fit max-w-[120px]">
                    {STATUS_OPTIONS.map(option => <option key={option} value={option}>{option}</option>)}
                  </select>
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap shrink-0 ${PRIORITY_BADGE[task.priority] || PRIORITY_BADGE.Medium}`}>
                    <MdFlag className="inline text-[9px] mr-0.5" />{task.priority || "Medium"}
                  </span>
                </div>

                {/* Assigned + Due date on same line */}
                <div className="flex items-center justify-between gap-2 text-[10px] text-slate-500">
                  <div className="flex items-center gap-1 min-w-0">
                    <MdPending className="shrink-0" />
                    <div className="flex flex-wrap gap-1 min-w-0">
                      {assignedList.length ? (
                        assignedList.slice(0, 2).map(person => (
                          <PersonnelChip key={person} name={person} size="xs" />
                        ))
                      ) : "Unassigned"}
                      {assignedList.length > 2 && <span className="text-[9px] text-slate-400">+{assignedList.length - 2}</span>}
                    </div>
                  </div>
                  <div className={`flex items-center gap-1 whitespace-nowrap shrink-0 font-medium ${dueStatus.textClass}`}>
                    <MdHourglassEmpty className="text-[9px]" /> {task.dueDate || "—"}
                    {dueStatus.label && (
                      <span className={`text-[9px] font-semibold px-1 py-0.5 rounded-full whitespace-nowrap ${dueStatus.badgeBg} ${dueStatus.badgeText}`}>
                        {dueStatus.label}
                      </span>
                    )}
                  </div>
                </div>

                {/* Remarks preview - compact */}
                <div onClick={e => e.stopPropagation()} className="pt-1 border-t border-slate-100">
                  <RemarksThread
                    remarks={remarksByTask[task.id] || []}
                    loading={remarksLoading.tasks}
                    onAdd={(content) => addTaskRemark(task.id, content)}
                    autoScrollToLatest={highlightedTaskId === task.id}
                    compact
                  />
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
