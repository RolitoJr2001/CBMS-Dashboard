import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  MdClose, MdAssignment, MdHourglassEmpty, MdFlag, MdPerson,
  MdAttachFile, MdOpenInNew, MdDownload,
} from "react-icons/md";
import PersonnelChip from "./PersonnelChip";
import RemarksThread from "./RemarksThread";
import { getDueDateStatus } from "../utils/dueDateStatus";
import { getTaskAttachmentUrl } from "../services/tasksService";

const PRIORITY_STYLES = {
  Urgent: "bg-status-redBg text-status-red",
  High:   "bg-orange-100 text-orange-700",
  Medium: "bg-status-yellowBg text-status-yellow",
  Low:    "bg-slate-100 text-slate-600",
};

function formatDate(value) {
  if (!value) return "No due date";
  try {
    return new Date(`${value}T00:00:00`).toLocaleDateString("en-US", {
      month: "long", day: "numeric", year: "numeric",
    });
  } catch {
    return value;
  }
}

/**
 * Full-detail popup for a Task Card. Shows every field the card only
 * summarizes (untruncated description, full remarks history, priority,
 * attachment) without hiding or compressing anything.
 *
 * Closing: X button, clicking the dark overlay, or Escape — all three
 * are wired up here so callers don't have to re-implement them.
 * Background interaction is blocked by the fixed, full-screen overlay
 * sitting above the page content while the modal is open.
 */
export default function TaskDetailsModal({
  task, remarks = [], remarksLoading = false, onAddRemark, onClose,
}) {
  const [attachmentUrl, setAttachmentUrl] = useState(null);
  const [attachmentErr, setAttachmentErr] = useState("");
  const [resolvingAttachment, setResolvingAttachment] = useState(false);

  // Close on Escape, and lock background scroll while the modal is open.
  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKeyDown);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose]);

  // The attachment is stored as a private storage path, so a fresh
  // signed URL has to be minted whenever the modal opens (a previously
  // issued one may have already expired).
  useEffect(() => {
    let mounted = true;
    if (!task?.attachmentPath) {
      setAttachmentUrl(null);
      return;
    }
    setResolvingAttachment(true);
    setAttachmentErr("");
    getTaskAttachmentUrl(task.attachmentPath)
      .then(url => { if (mounted) setAttachmentUrl(url); })
      .catch(err => { if (mounted) setAttachmentErr(err.message || "Couldn't load attachment."); })
      .finally(() => { if (mounted) setResolvingAttachment(false); });
    return () => { mounted = false; };
  }, [task?.attachmentPath]);

  if (!task) return null;

  const dueStatus = getDueDateStatus(task.dueDate, task.status);
  const assignedList = Array.isArray(task.assignedTo) ? task.assignedTo.filter(Boolean) : [task.assignedTo].filter(Boolean);
  const priority = task.priority || "Medium";
  const attachmentName = task.attachmentPath ? task.attachmentPath.split("/").slice(1).join("/") || task.attachmentPath : null;

  return (
    <AnimatePresence>
      <motion.div
        key="task-modal-overlay"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.15 }}
        className="fixed inset-0 z-[100] bg-navy-950/50 backdrop-blur-sm flex items-center justify-center p-4"
        onClick={onClose}
        role="presentation"
      >
        <motion.div
          key="task-modal-panel"
          initial={{ opacity: 0, y: 16, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 12, scale: 0.98 }}
          transition={{ duration: 0.18 }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="task-modal-title"
          onClick={e => e.stopPropagation()}
          className="w-full max-w-2xl max-h-[85vh] bg-white rounded-2xl shadow-cardHover border border-slate-100 flex flex-col overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-start justify-between gap-3 px-6 py-4 border-b border-slate-100 shrink-0">
            <div className="flex items-start gap-3 min-w-0">
              <span className="flex items-center justify-center w-9 h-9 rounded-lg bg-teal-50 text-teal-700 shrink-0 mt-0.5">
                <MdAssignment />
              </span>
              <div className="min-w-0">
                <h3 id="task-modal-title" className="text-base font-semibold text-navy-900 break-words">{task.title}</h3>
                <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap ${task.status === "Completed" ? "bg-status-greenBg text-status-green" : task.status === "Ongoing" || task.status === "In Progress" ? "bg-status-yellowBg text-status-yellow" : task.status === "Pending" ? "bg-status-redBg text-status-red" : "bg-slate-100 text-slate-600"}`}>
                    {task.status}
                  </span>
                  <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap ${PRIORITY_STYLES[priority] || PRIORITY_STYLES.Medium}`}>
                    <MdFlag className="text-xs" /> {priority} Priority
                  </span>
                </div>
              </div>
            </div>
            <button
              onClick={onClose}
              aria-label="Close task details"
              className="shrink-0 inline-flex items-center justify-center w-8 h-8 rounded-full text-slate-400 hover:text-navy-900 hover:bg-slate-100 transition-colors"
            >
              <MdClose className="text-lg" />
            </button>
          </div>

          {/* Scrollable body */}
          <div className="overflow-y-auto px-6 py-5 space-y-5">
            {/* Description */}
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 mb-1.5">Description</p>
              <p className="text-sm text-slate-700 whitespace-pre-wrap break-words">
                {task.description?.trim() ? task.description : "No description provided."}
              </p>
            </div>

            {/* Assigned / Due date / Assigned by */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 mb-1.5 flex items-center gap-1"><MdPerson /> Assigned Personnel</p>
                {assignedList.length ? (
                  <div className="flex flex-wrap gap-1.5">
                    {assignedList.map(person => <PersonnelChip key={person} name={person} />)}
                  </div>
                ) : (
                  <p className="text-sm text-slate-400">Unassigned</p>
                )}
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 mb-1.5 flex items-center gap-1"><MdHourglassEmpty /> Due Date</p>
                <p className={`text-sm font-medium ${dueStatus.textClass}`}>
                  {formatDate(task.dueDate)}
                  {dueStatus.label && (
                    <span className={`ml-2 text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${dueStatus.badgeBg} ${dueStatus.badgeText}`}>
                      {dueStatus.label}
                    </span>
                  )}
                </p>
              </div>
            </div>

            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 mb-1.5">Assigned By</p>
              <p className="text-sm text-slate-700">{task.assignedBy || "Admin"}</p>
            </div>

            {/* Attachment — only rendered when one actually exists */}
            {task.attachmentPath && (
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 mb-1.5 flex items-center gap-1"><MdAttachFile /> Attachment</p>
                {resolvingAttachment ? (
                  <p className="text-xs text-slate-400">Loading attachment link…</p>
                ) : attachmentErr ? (
                  <p className="text-xs text-status-red">{attachmentErr}</p>
                ) : attachmentUrl ? (
                  <a
                    href={attachmentUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border border-slate-200 text-teal-700 hover:bg-teal-50 transition-colors"
                  >
                    <MdDownload className="text-sm" /> {attachmentName || "Download attachment"} <MdOpenInNew className="text-xs opacity-60" />
                  </a>
                ) : null}
              </div>
            )}

            {/* Remarks History — full thread, not compact */}
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 mb-1.5">Remarks History</p>
              <RemarksThread
                remarks={remarks}
                loading={remarksLoading}
                onAdd={onAddRemark}
                autoScrollToLatest
              />
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
