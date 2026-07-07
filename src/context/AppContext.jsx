import { createContext, useContext, useState, useCallback, useEffect, useRef } from "react";
import { calendarEmbedUrl } from "../data/calendar";
import {
  signIn as authSignIn,
  signOut as authSignOut,
  getSession,
  getProfile,
  onAuthChange,
} from "../services/authService";
import {
  fetchEvents,
  insertEvent,
  patchEvent,
  removeEvent,
} from "../services/eventsService";
import {
  fetchRequirements,
  insertRequirement,
  patchRequirement,
  removeRequirement,
} from "../services/requirementsService";
import {
  fetchDocuments,
  insertDocument,
  patchDocument,
  removeDocument,
  checkDuplicateTracking,
} from "../services/documentsService";
import {
  fetchTasks,
  insertTask,
  patchTask,
  removeTask,
} from "../services/tasksService";
import { supabase } from "../lib/supabase";

const AppContext = createContext(null);

function fromDbTask(row) {
  return {
    id: row.id,
    title: row.title,
    description: row.description || "",
    assignedTo: row.assigned_to || "",
    assignedBy: row.assigned_by || "",
    dueDate: row.due_date || "",
    status: row.status || "Pending",
    remarks: row.remarks || "",
    createdAt: row.created_at,
  };
}

export function AppProvider({ children }) {
  // ── Auth state ────────────────────────────────────────────
  const [user, setUser]               = useState(null);
  const [authLoading, setAuthLoading] = useState(true);

  // ── Data state ───────────────────────────────────────────
  const [events,       setEvents]       = useState([]);
  const [requirements, setRequirements] = useState([]);
  const [documents,    setDocuments]    = useState([]);
  const [tasks,         setTasks]         = useState([]);
  const [notifications, setNotifications] = useState([]);

  // ── Loading / error per-entity ────────────────────────────
  const [loading, setLoading] = useState({ events: false, requirements: false, documents: false, tasks: false });
  const [errors,  setErrors]  = useState({ events: null,  requirements: null,  documents: null, tasks: null  });

  const userRef = useRef(user);
  const suppressRealtimeNotificationRef = useRef(false);
  useEffect(() => { userRef.current = user; }, [user]);

  const getNotificationStorageKey = useCallback((profile) => {
    const userId = profile?.id || profile?.user?.id;
    return userId ? `cbms-notifications:${userId}` : "cbms-notifications:guest";
  }, []);

  const readStoredNotifications = useCallback((profile) => {
    if (typeof window === "undefined") return [];
    try {
      const key = getNotificationStorageKey(profile);
      const raw = window.localStorage.getItem(key);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }, [getNotificationStorageKey]);

  const writeStoredNotifications = useCallback((profile, items) => {
    if (typeof window === "undefined") return;
    try {
      const key = getNotificationStorageKey(profile);
      window.localStorage.setItem(key, JSON.stringify(items));
    } catch {
      // ignore storage errors
    }
  }, [getNotificationStorageKey]);

  const embedUrl = calendarEmbedUrl;

  const suppressNextRealtimeNotification = useCallback(() => {
    suppressRealtimeNotificationRef.current = true;
    window.setTimeout(() => {
      suppressRealtimeNotificationRef.current = false;
    }, 500);
  }, []);

  // ── Initialise: resolve session on mount ─────────────────
  useEffect(() => {
    getSession().then(async (session) => {
      if (session?.user) {
        try {
          const profile = await getProfile(session.user.id);
          setUser({ ...session.user, ...profile });
        } catch {
          setUser(session.user);
        }
      }
      setAuthLoading(false);
    }).catch(() => setAuthLoading(false));

    // Listen for auth changes (logout from another tab, token refresh, etc.)
    const sub = onAuthChange(async (session) => {
      if (session?.user) {
        try {
          const profile = await getProfile(session.user.id);
          setUser({ ...session.user, ...profile });
        } catch {
          setUser(session.user);
        }
      } else {
        setUser(null);
        setEvents([]);
        setRequirements([]);
        setDocuments([]);
        setTasks([]);
      }
    });
    return () => sub?.unsubscribe();
  }, []);

  // ── Load data once user is set ────────────────────────────
  useEffect(() => {
    if (!user) return;
    loadAll();
  }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!user) return;

    const stored = readStoredNotifications(user);
    setNotifications(stored);
  }, [user?.id, readStoredNotifications, getNotificationStorageKey]);

  useEffect(() => {
    if (!user) return;
    writeStoredNotifications(user, notifications);
  }, [user?.id, notifications, writeStoredNotifications]);

  useEffect(() => {
    if (!user) return undefined;

    const tasksChannel = supabase
      .channel("tasks-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "tasks" },
        (payload) => {
          if (suppressRealtimeNotificationRef.current) {
            suppressRealtimeNotificationRef.current = false;
            return;
          }

          const mappedTask = payload.new ? fromDbTask(payload.new) : null;
          if (payload.eventType === "INSERT") {
            setTasks(prev => [mappedTask, ...prev.filter(item => item.id !== mappedTask.id)]);
            pushNotification({
              title: "Task updated",
              message: payload.new?.title || "A task was updated.",
              section: "Tasks",
              type: "task",
            });
          } else if (payload.eventType === "UPDATE") {
            setTasks(prev => prev.map(item => item.id === payload.new.id ? mappedTask : item));
            pushNotification({
              title: "Task updated",
              message: payload.new?.title || "A task was updated.",
              section: "Tasks",
              type: "task",
            });
          } else if (payload.eventType === "DELETE") {
            setTasks(prev => prev.filter(item => item.id !== payload.old.id));
            pushNotification({
              title: "Task removed",
              message: payload.old?.title || "A task was removed.",
              section: "Tasks",
              type: "task",
            });
          }
        }
      )
      .subscribe();

    const documentsChannel = supabase
      .channel("documents-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "documents" },
        (payload) => {
          if (suppressRealtimeNotificationRef.current) {
            suppressRealtimeNotificationRef.current = false;
            return;
          }

          if (payload.eventType === "INSERT") {
            loadDocuments();
            pushNotification({
              title: "Document added",
              message: payload.new?.title || "A document was added.",
              section: "Document Tracking",
              type: "document",
            });
          } else if (payload.eventType === "UPDATE") {
            loadDocuments();
            pushNotification({
              title: "Document updated",
              message: payload.new?.title || "A document was updated.",
              section: "Document Tracking",
              type: "document",
            });
          } else if (payload.eventType === "DELETE") {
            loadDocuments();
            pushNotification({
              title: "Document removed",
              message: payload.old?.title || "A document was removed.",
              section: "Document Tracking",
              type: "document",
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(tasksChannel);
      supabase.removeChannel(documentsChannel);
    };
  }, [user?.id]);

  async function loadAll() {
    loadEvents();
    loadRequirements();
    loadDocuments();
    loadTasks();
  }

  async function loadEvents() {
    setLoading(p => ({ ...p, events: true }));
    try {
      setEvents(await fetchEvents());
      setErrors(p => ({ ...p, events: null }));
    } catch (e) {
      setErrors(p => ({ ...p, events: e.message }));
    } finally {
      setLoading(p => ({ ...p, events: false }));
    }
  }

  async function loadRequirements() {
    setLoading(p => ({ ...p, requirements: true }));
    try {
      setRequirements(await fetchRequirements());
      setErrors(p => ({ ...p, requirements: null }));
    } catch (e) {
      setErrors(p => ({ ...p, requirements: e.message }));
    } finally {
      setLoading(p => ({ ...p, requirements: false }));
    }
  }

  async function loadDocuments() {
    setLoading(p => ({ ...p, documents: true }));
    try {
      setDocuments(await fetchDocuments(user));
      setErrors(p => ({ ...p, documents: null }));
    } catch (e) {
      setErrors(p => ({ ...p, documents: e.message }));
    } finally {
      setLoading(p => ({ ...p, documents: false }));
    }
  }

  async function loadTasks() {
    setLoading(p => ({ ...p, tasks: true }));
    try {
      setTasks(await fetchTasks(user));
      setErrors(p => ({ ...p, tasks: null }));
    } catch (e) {
      setErrors(p => ({ ...p, tasks: e.message }));
    } finally {
      setLoading(p => ({ ...p, tasks: false }));
    }
  }

  // ── Auth ─────────────────────────────────────────────────
  // login() takes a username (not an email) and password. authSignIn
  // resolves the username to its internal email via RPC, then signs in
  // through real Supabase Auth, returning a normal Supabase session.
  const login = useCallback(async (username, password) => {
    const { session } = await authSignIn(username, password);
    const profile = await getProfile(session.user.id);
    setUser({ ...session.user, ...profile });
  }, []);

  const logout = useCallback(async () => {
    await authSignOut();
    setUser(null);
    setEvents([]);
    setRequirements([]);
    setDocuments([]);
    setTasks([]);
  }, []);

  const formatNotificationTime = useCallback((value) => {
    const date = value ? new Date(value) : new Date();
    return new Intl.DateTimeFormat("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }).format(date);
  }, []);

  const getDisplayName = useCallback((profile) => {
    return profile?.full_name || profile?.fullName || profile?.name || profile?.username || "System";
  }, []);

  const getRoleLabel = useCallback((profile) => {
    return String(profile?.role || "viewer").toLowerCase() === "admin" ? "admin" : "viewer";
  }, []);

  const pushNotification = useCallback((notification) => {
    const entry = {
      id: `${Date.now()}-${Math.random()}`,
      createdAt: new Date().toISOString(),
      recipientRole: "all",
      ...notification,
    };

    setNotifications(prev => [entry, ...prev]
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, 20));
  }, []);

  const notifyActivity = useCallback((payload) => {
    const actor = payload.actor || userRef.current;
    const actorName = getDisplayName(actor);
    const actorRole = getRoleLabel(actor);
    const subjectTypeLabel = payload.subjectType === "task" ? "Task" : "Document";
    const actionLabel = payload.action || "updated";
    const subjectLabel = payload.subjectName ? `“${payload.subjectName}”` : subjectTypeLabel;
    const recipients = payload.recipients || [actorRole === "admin" ? "viewer" : "admin", actorRole];
    const uniqueRecipients = [...new Set(recipients.filter(Boolean))];

    const baseNotification = {
      title: `${subjectTypeLabel} ${actionLabel}`,
      message: `${actorName} (${actorRole}) ${actionLabel} ${subjectTypeLabel.toLowerCase()} ${subjectLabel}`.trim(),
      section: payload.section,
      type: payload.type,
      actorName,
      actorRole,
      action: actionLabel,
      subjectType: payload.subjectType,
      subjectName: payload.subjectName,
      createdAt: new Date().toISOString(),
    };

    uniqueRecipients.forEach((recipientRole) => {
      pushNotification({ ...baseNotification, recipientRole });
    });
  }, [getDisplayName, getRoleLabel, pushNotification]);

  // ── Calendar Events ───────────────────────────────────────
  const addEvent = useCallback(async (ev) => {
    const created = await insertEvent(ev, userRef.current?.id);
    setEvents(prev => [...prev, created].sort((a, b) => a.date > b.date ? 1 : -1));
    pushNotification({
      title: "New schedule added",
      message: ev.title || "A new schedule was added.",
      section: "Schedule & Events",
      type: "event",
    });
    return created;
  }, [pushNotification]);

  const updateEvent = useCallback(async (id, changes) => {
    const updated = await patchEvent(id, changes);
    setEvents(prev => prev.map(e => e.id === id ? updated : e));
    pushNotification({
      title: "Schedule updated",
      message: changes.title || "A schedule was updated.",
      section: "Schedule & Events",
      type: "event",
    });
    return updated;
  }, [pushNotification]);

  const deleteEvent = useCallback(async (id) => {
    await removeEvent(id);
    setEvents(prev => prev.filter(e => e.id !== id));
    pushNotification({
      title: "Schedule removed",
      message: "A schedule was removed.",
      section: "Schedule & Events",
      type: "event",
    });
  }, [pushNotification]);

  const upcomingEvents = [...events]
    .filter(e => new Date(e.date + "T23:59:59") >= new Date())
    .sort((a, b) => new Date(a.date) - new Date(b.date));

  // ── Requirements ─────────────────────────────────────────
  const addRequirement = useCallback(async (req) => {
    const created = await insertRequirement(req, userRef.current?.id);
    setRequirements(prev => [...prev, created]);
    pushNotification({
      title: "Requirement added",
      message: req.title || "A requirement was added.",
      section: "Requirements",
      type: "requirement",
    });
    return created;
  }, [pushNotification]);

  const updateRequirement = useCallback(async (id, changes) => {
    const updated = await patchRequirement(id, changes);
    setRequirements(prev => prev.map(r => r.id === id ? updated : r));
    pushNotification({
      title: "Requirement updated",
      message: changes.title || "A requirement was updated.",
      section: "Requirements",
      type: "requirement",
    });
    return updated;
  }, [pushNotification]);

  const deleteRequirement = useCallback(async (id) => {
    await removeRequirement(id);
    setRequirements(prev => prev.filter(r => r.id !== id));
    pushNotification({
      title: "Requirement removed",
      message: "A requirement was removed.",
      section: "Requirements",
      type: "requirement",
    });
  }, [pushNotification]);

  // ── Documents ─────────────────────────────────────────────
  const addDocument = useCallback(async (doc) => {
    suppressNextRealtimeNotification();
    const id = await insertDocument(doc, userRef.current?.id);
    await loadDocuments(); // reload to get full history
    notifyActivity({
      action: "created",
      subjectType: "document",
      subjectName: doc.title || "Untitled document",
      section: "Document Tracking",
      type: "document",
    });
    return id;
  }, [notifyActivity]); // eslint-disable-line react-hooks/exhaustive-deps

  const updateDocument = useCallback(async (id, changes) => {
    suppressNextRealtimeNotification();
    const updated = await patchDocument(id, changes, userRef.current?.id);
    setDocuments(prev => prev.map(d => d.id === id ? updated : d));
    await loadDocuments();

    const action = changes?.status
      ? (changes.status === "Completed" || changes.status === "Released" ? "submitted" : "changed status")
      : changes?.remarks !== undefined
        ? "updated remarks"
        : "updated";

    notifyActivity({
      action,
      subjectType: "document",
      subjectName: updated?.title || changes?.title || "Untitled document",
      section: "Document Tracking",
      type: "document",
    });
    return updated;
  }, [loadDocuments, notifyActivity]);

  const deleteDocument = useCallback(async (id) => {
    suppressNextRealtimeNotification();
    await removeDocument(id);
    setDocuments(prev => prev.filter(d => d.id !== id));
    notifyActivity({
      action: "deleted",
      subjectType: "document",
      subjectName: "A document",
      section: "Document Tracking",
      type: "document",
    });
  }, [notifyActivity]);

  const isDuplicateTrackingNumber = useCallback(async (num, excludeId = null) => {
    return await checkDuplicateTracking(num, excludeId);
  }, []);

  const addTask = useCallback(async (task) => {
    suppressNextRealtimeNotification();
    const created = await insertTask(task, userRef.current?.id, userRef.current?.username || userRef.current?.name || "admin");
    setTasks(prev => [created, ...prev]);
    notifyActivity({
      action: "created",
      subjectType: "task",
      subjectName: task.title || "Untitled task",
      section: "Tasks",
      type: "task",
    });
    return created;
  }, [notifyActivity]);

  const updateTask = useCallback(async (id, changes) => {
    suppressNextRealtimeNotification();
    const updated = await patchTask(id, changes);
    setTasks(prev => prev.map(t => t.id === id ? updated : t));
    await loadTasks();

    const action = changes?.status
      ? (changes.status === "Completed" ? "submitted" : "changed status")
      : changes?.remarks !== undefined
        ? "updated remarks"
        : "updated";

    notifyActivity({
      action,
      subjectType: "task",
      subjectName: updated?.title || "Untitled task",
      section: "Tasks",
      type: "task",
    });
    return updated;
  }, [loadTasks, notifyActivity]);

  const deleteTask = useCallback(async (id) => {
    suppressNextRealtimeNotification();
    await removeTask(id);
    setTasks(prev => prev.filter(t => t.id !== id));
    notifyActivity({
      action: "deleted",
      subjectType: "task",
      subjectName: "A task",
      section: "Tasks",
      type: "task",
    });
  }, [notifyActivity]);

  return (
    <AppContext.Provider value={{
      // auth
      user, authLoading, login, logout,
      // calendar
      events, upcomingEvents, embedUrl,
      addEvent, updateEvent, deleteEvent,
      // checklist
      requirements, addRequirement, updateRequirement, deleteRequirement,
      // documents
      documents, addDocument, updateDocument, deleteDocument, isDuplicateTrackingNumber,
      // tasks
      tasks, addTask, updateTask, deleteTask,
      // notifications
      notifications, pushNotification,
      // loading / error states
      loading, errors, reload: loadAll,
    }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}
