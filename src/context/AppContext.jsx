import { createContext, useContext, useState, useCallback, useEffect, useRef, useMemo } from "react";
import { calendarEmbedUrl } from "../data/calendar";
import {
  signIn as authSignIn,
  signOut as authSignOut,
  getSession,
  getProfile,
  onAuthChange,
  fetchProfiles,
  getEffectiveProfile,
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
import {
  fetchRemarksForEntities,
  addRemark as addRemarkEntry,
  subscribeToRemarks,
} from "../services/remarksService";
import {
  fetchPersonnel,
  updatePersonnelColor as updatePersonnelColorEntry,
  subscribeToPersonnel,
} from "../services/personnelService";
import {
  fetchNotifications,
  createNotificationForRecipients,
  createNotificationsForAdmins,
  createNotificationForUser,
  notifyAdmins,
  notifyUser,
  buildNotification,
  markNotificationRead,
  markAllNotificationsRead,
  deleteNotification,
  deleteAllReadNotifications,
  subscribeToNotifications,
} from "../services/notificationService";

export const AppContext = createContext(null);

// assigned_to is stored in the DB as a JSON-encoded string (see
// serializeAssignedTo in tasksService.js). The initial fetch path
// (tasksService.fromDb) parses this back into an array, but this
// realtime-only mapper didn't — so a task pushed over the
// "tasks-realtime" channel arrived with assignedTo as a raw JSON
// string instead of an array, which could never match a Viewer's
// name/username in TaskPanel's assignment filter. That's the root
// cause of "No tasks assigned yet" showing for a Viewer whose task
// was just created/updated by an Admin, even though a manual page
// refresh (which re-runs the correctly-parsing fetch) shows it fine.
// Mirrors normalizeAssignedTo() in tasksService.js.
function normalizeAssignedToRealtime(value) {
  if (Array.isArray(value)) return value.filter(Boolean);
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return [];
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) return parsed.filter(Boolean);
    } catch {
      return [trimmed];
    }
  }
  return [];
}

function fromDbTask(row) {
  return {
    id: row.id,
    title: row.title,
    description: row.description || "",
    assignedTo: normalizeAssignedToRealtime(row.assigned_to || ""),
    assignedBy: row.assigned_by || "",
    dueDate: row.due_date || "",
    status: row.status || "Pending",
    remarks: row.remarks || "",
    createdAt: row.created_at,
  };
}

function normalizeColorLookupValue(value) {
  return String(value || "").trim().toLowerCase();
}

function addColorAlias(map, value, color) {
  const normalized = normalizeColorLookupValue(value);
  if (!normalized || !color) return;
  map[normalized] = color;
  map[normalized.replace(/\s+/g, "")] = color;
  map[normalized.replace(/[^a-z0-9]+/g, "")] = color;
}

function readStoredColorMap() {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem("cbms-personnel-colors");
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function writeStoredColorMap(map) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem("cbms-personnel-colors", JSON.stringify(map));
  } catch {
    // ignore storage-write failures so the app still works
  }
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
  // Chat-style remarks history, keyed by entity id. Loaded in bulk
  // whenever the tasks/documents list changes so every card/row can
  // render its thread without an extra request each.
  const [remarksByTask,     setRemarksByTask]     = useState({});
  const [remarksByDocument, setRemarksByDocument] = useState({});
  const [remarksLoading, setRemarksLoading] = useState({ tasks: false, documents: false });
  // Personnel + their admin-customizable colors. Loaded once and kept in
  // sync live via the "personnel-realtime" channel, so a color change
  // (or rename/add/remove) shows up immediately everywhere a
  // <PersonnelChip> is rendered, with no page refresh.
  const [personnel, setPersonnel] = useState([]);
  const [profiles, setProfiles] = useState([]);
  // Clicking a notification navigates to its related task/document/event
  // and asks that section to scroll to + highlight the relevant item (and,
  // for remarks, the newest message). Consumers (TaskPanel, DocumentTracking,
  // CalendarCard) watch this and clear it once they've handled it.
  const [focusTarget, setFocusTarget] = useState(null);
  // Set when an assignment can't be matched to a viewer account, so the
  // admin sees why a notification didn't go out instead of it failing
  // silently (see notifyAssignmentToRecipients below).
  const [notificationWarning, setNotificationWarning] = useState(null);

  // ── Loading / error per-entity ────────────────────────────
  const [loading, setLoading] = useState({ events: false, requirements: false, documents: false, tasks: false });
  const [errors,  setErrors]  = useState({ events: null,  requirements: null,  documents: null, tasks: null  });

  const userRef = useRef(user);
  const suppressRealtimeNotificationRef = useRef(false);
  const realtimeNotificationIdsRef = useRef(new Set());
  useEffect(() => { userRef.current = user; }, [user]);

  const embedUrl = calendarEmbedUrl;

  // name (lowercased) -> hex color, built from the personnel table and
  // the linked viewer profiles so the same color is honored for any
  // displayed alias (name, username, full name, etc.).
  const personnelColorMap = useMemo(() => {
    const map = { ...readStoredColorMap() };

    personnel.forEach((p) => {
      if (!p?.name) return;
      const color = p?.color || map[normalizeColorLookupValue(p.name)] || null;
      if (!color) return;
      addColorAlias(map, p.name, color);
    });

    (profiles || []).forEach((profile) => {
      const profileValues = [profile?.name, profile?.username, profile?.full_name, profile?.fullName]
        .map(normalizeColorLookupValue)
        .filter(Boolean);
      const linked = personnel.find((p) => {
        const personnelValues = [p?.name]
          .map(normalizeColorLookupValue)
          .filter(Boolean);
        return profileValues.some(value => personnelValues.includes(value)) || personnelValues.some(value => profileValues.includes(value));
      });
      const color = linked?.color || map[normalizeColorLookupValue(profile?.name)] || map[normalizeColorLookupValue(profile?.username)] || null;
      if (!color) return;
      [profile?.name, profile?.username, profile?.full_name, profile?.fullName, linked?.name].forEach((value) => {
        addColorAlias(map, value, color);
      });
    });

    return map;
  }, [personnel, profiles]);

  const loadPersonnel = useCallback(async () => {
    try {
      setPersonnel(await fetchPersonnel());
    } catch (error) {
      console.error("Failed loading personnel", error);
    }
  }, []);

  const updatePersonnelColor = useCallback(async (id, color) => {
    let updated = null;
    try {
      updated = await updatePersonnelColorEntry(id, color);
    } catch (error) {
      updated = { id, name: personnel.find(p => p.id === id)?.name || "", color: color || null };
    }

    const nextPersonnel = (personnel || []).map(p => p.id === id ? { ...p, ...(updated || {}), color: updated?.color ?? p.color } : p);
    setPersonnel(nextPersonnel);

    if (updated?.name) {
      const nextMap = { ...readStoredColorMap() };
      if (updated.color) {
        addColorAlias(nextMap, updated.name, updated.color);
      } else {
        delete nextMap[normalizeColorLookupValue(updated.name)];
        delete nextMap[normalizeColorLookupValue(updated.name).replace(/\s+/g, "")];
        delete nextMap[normalizeColorLookupValue(updated.name).replace(/[^a-z0-9]+/g, "")];
      }
      writeStoredColorMap(nextMap);
    }

    return updated;
  }, [personnel]);

  const suppressNextRealtimeNotification = useCallback(() => {
    suppressRealtimeNotificationRef.current = true;
    window.setTimeout(() => {
      suppressRealtimeNotificationRef.current = false;
    }, 500);
  }, []);

  const normalizeAssignmentValues = useCallback((value) => {
    if (Array.isArray(value)) {
      return value.filter(Boolean).map(item => String(item).trim()).filter(Boolean);
    }

    if (typeof value === "string") {
      const trimmed = value.trim();
      if (!trimmed) return [];

      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) {
          return parsed.filter(Boolean).map(item => String(item).trim()).filter(Boolean);
        }
      } catch {
        return [trimmed];
      }

      return [trimmed];
    }

    return [];
  }, []);

  const isSameAssignmentSet = useCallback((left = [], right = []) => {
    const leftValues = normalizeAssignmentValues(left)
      .map(item => String(item).trim().toLowerCase())
      .sort();
    const rightValues = normalizeAssignmentValues(right)
      .map(item => String(item).trim().toLowerCase())
      .sort();

    return leftValues.length === rightValues.length && leftValues.every((item, index) => item === rightValues[index]);
  }, [normalizeAssignmentValues]);

  const addNotificationsToState = useCallback((created = []) => {
    const normalized = (created || []).filter(Boolean);
    if (!normalized.length) return;

    normalized.forEach((item) => {
      if (item?.id) realtimeNotificationIdsRef.current.add(item.id);
    });

    setNotifications(prev => [
      ...normalized,
      ...prev.filter(item => !normalized.some(candidate => candidate.id === item.id)),
    ].slice(0, 100));
  }, []);

  const getActorDisplayName = useCallback((actor = userRef.current) => {
    return actor?.name || actor?.full_name || actor?.fullName || actor?.username || actor?.email || "Someone";
  }, []);

  const notifyAssignmentToRecipients = useCallback(async (value, payload = {}) => {
    if (!userRef.current?.id) return [];

    const profiles = await fetchProfiles();
    const normalizedTargets = normalizeAssignmentValues(value)
      .map(item => String(item).trim().toLowerCase())
      .filter(Boolean);

    if (!normalizedTargets.length) return [];

    const profileValueSets = (profiles || []).map(profile => ({
      profile,
      values: [profile?.username, profile?.name, profile?.full_name, profile?.fullName]
        .filter(Boolean)
        .map(item => String(item).trim().toLowerCase()),
    }));

    const matchedTargets = new Set();
    const recipientIds = [...new Set(profileValueSets
      .map(({ profile, values }) => {
        const matchedTarget = normalizedTargets.find(target => values.includes(target));
        if (matchedTarget) matchedTargets.add(matchedTarget);
        return matchedTarget ? profile?.id : null;
      })
      .filter(Boolean))];

    const unmatchedTargets = normalizedTargets.filter(target => !matchedTargets.has(target));

    if (unmatchedTargets.length) {
      // The assigned name(s) don't exactly match any profile's name/username
      // in the database — this is the most common reason "assign"
      // notifications never arrive. Log it for developers AND surface it
      // to the admin in the UI, since a console-only warning is invisible
      // in normal use and the assignment otherwise silently fails to notify.
      console.warn(
        `[notifications] No matching viewer account found for assignee(s): ${unmatchedTargets.join(", ")}. ` +
        `Make sure the "personnel" entry's name exactly matches that user's "name" or "username" in the profiles table.`
      );
      setNotificationWarning({
        id: Date.now(),
        message: unmatchedTargets.length === 1
          ? `"${unmatchedTargets[0]}" isn't linked to a viewer account, so they won't get an assignment notification.`
          : `${unmatchedTargets.length} assigned personnel aren't linked to a viewer account, so they won't get assignment notifications.`,
        detail: `Unmatched: ${unmatchedTargets.join(", ")}. Link them in Personnel Manager so their name/username matches exactly.`,
      });
    }

    if (!recipientIds.length) return [];

    return notify({
      recipients: recipientIds,
      ...payload,
    });
  }, [normalizeAssignmentValues]);

  // ── Initialise: resolve session on mount ─────────────────
  useEffect(() => {
    getSession().then(async (session) => {
      if (session?.user) {
        try {
          const profile = await getEffectiveProfile(session.user.id, session.user);
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
          const profile = await getEffectiveProfile(session.user.id, session.user);
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

  // ── Load profiles and notifications once user is set ─────
  useEffect(() => {
    if (!user?.id) {
      setProfiles([]);
      return;
    }

    let mounted = true;
    async function loadProfiles() {
      try {
        const data = await fetchProfiles();
        if (mounted) setProfiles(data || []);
      } catch (error) {
        console.error("Failed loading profiles", error);
        if (mounted) setProfiles([]);
      }
    }

    loadProfiles();
    return () => { mounted = false; };
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id) return;

    async function loadNotifications() {
      try {
        const data = await fetchNotifications(user.id);
        setNotifications(data);
        (data || []).forEach((item) => {
          if (item?.id) realtimeNotificationIdsRef.current.add(item.id);
        });
      } catch (error) {
        console.error("Failed loading notifications", error);
      }
    }

    loadNotifications();
  }, [user?.id]);


  // ── Load data once user is set ────────────────────────────
  useEffect(() => {
    if (!user) return;
    loadAll();
    loadPersonnel();
  }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

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
          } else if (payload.eventType === "UPDATE") {
            setTasks(prev => prev.map(item => item.id === payload.new.id ? mappedTask : item));
          } else if (payload.eventType === "DELETE") {
            setTasks(prev => prev.filter(item => item.id !== payload.old.id));
          }
        }
      )
      .subscribe();

    const notificationsChannel = subscribeToNotifications(user.id, (event, payload) => {
      if (event === "insert") {
        const id = payload?.id;
        if (!id || realtimeNotificationIdsRef.current.has(id)) {
          if (id) realtimeNotificationIdsRef.current.delete(id);
          return;
        }
        realtimeNotificationIdsRef.current.add(id);
        setNotifications(prev => [payload, ...prev.filter(n => n.id !== payload.id)]);
      } else if (event === "update") {
        setNotifications(prev => prev.map(item => item.id === payload.id ? payload : item));
      } else if (event === "delete") {
        setNotifications(prev => prev.filter(item => item.id !== payload.id));
      }
    });

    // Schedule & Events: live INSERT/UPDATE/DELETE sync. calendar_events
    // rows are simple enough to refetch-on-change (rather than hand-merge
    // the JSON-encoded assigned_personnel column) without meaningfully
    // affecting perceived latency.
    const eventsChannel = supabase
      .channel("events-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "calendar_events" },
        () => loadEvents()
      )
      .subscribe();

    // Document assignments/tracking updates: same refetch-on-change
    // approach, since documents are loaded together with their joined
    // document_history rows (see documentsService.fetchDocuments).
    const documentsChannel = supabase
      .channel("documents-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "documents" },
        () => loadDocuments()
      )
      .subscribe();

    const requirementsChannel = supabase
      .channel("requirements-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "requirements" },
        () => loadRequirements()
      )
      .subscribe();

    // Real-Time Remarks (chat-style): a remark posted by anyone appears
    // instantly for every other user currently viewing that task/document,
    // without a page refresh. Dedupe against remarks this same tab already
    // appended optimistically in addTaskRemark/addDocumentRemark.
    const remarksChannel = subscribeToRemarks((remark) => {
      if (remark.entityType === "task") {
        setRemarksByTask(prev => {
          const existing = prev[remark.entityId] || [];
          if (existing.some(r => r.id === remark.id)) return prev;
          return { ...prev, [remark.entityId]: [...existing, remark] };
        });
      } else if (remark.entityType === "document") {
        setRemarksByDocument(prev => {
          const existing = prev[remark.entityId] || [];
          if (existing.some(r => r.id === remark.id)) return prev;
          return { ...prev, [remark.entityId]: [...existing, remark] };
        });
      }
    });

    // Personnel Color Chips: an Administrator's color change (or a
    // rename/add/remove) reflects immediately in every chip anywhere in
    // the app for every connected user.
    const personnelChannel = subscribeToPersonnel((eventType, row, oldRow) => {
      if (eventType === "INSERT") {
        setPersonnel(prev => [...prev, row].sort((a, b) => a.name.localeCompare(b.name)));
      } else if (eventType === "UPDATE") {
        setPersonnel(prev => prev.map(p => p.id === row.id ? row : p));
      } else if (eventType === "DELETE") {
        setPersonnel(prev => prev.filter(p => p.id !== oldRow.id));
      }
    });

    return () => {
      supabase.removeChannel(tasksChannel);
      supabase.removeChannel(notificationsChannel);
      supabase.removeChannel(eventsChannel);
      supabase.removeChannel(documentsChannel);
      supabase.removeChannel(requirementsChannel);
      supabase.removeChannel(remarksChannel);
      supabase.removeChannel(personnelChannel);
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
      const docs = await fetchDocuments(user);
      setDocuments(docs);
      setErrors(p => ({ ...p, documents: null }));
      loadDocumentRemarks(docs.map(d => d.id));
    } catch (e) {
      setErrors(p => ({ ...p, documents: e.message }));
    } finally {
      setLoading(p => ({ ...p, documents: false }));
    }
  }

  async function loadTasks() {
    setLoading(p => ({ ...p, tasks: true }));
    try {
      const rows = await fetchTasks(user);
      setTasks(rows);
      setErrors(p => ({ ...p, tasks: null }));
      loadTaskRemarks(rows.map(t => t.id));
    } catch (e) {
      setErrors(p => ({ ...p, tasks: e.message }));
    } finally {
      setLoading(p => ({ ...p, tasks: false }));
    }
  }

  // ── Remarks history (chat-style) ────────────────────────────
  async function loadTaskRemarks(taskIds) {
    setRemarksLoading(p => ({ ...p, tasks: true }));
    try {
      const grouped = await fetchRemarksForEntities("task", taskIds);
      setRemarksByTask(grouped);
    } catch (e) {
      console.error("Failed to load task remarks", e);
    } finally {
      setRemarksLoading(p => ({ ...p, tasks: false }));
    }
  }

  async function loadDocumentRemarks(documentIds) {
    setRemarksLoading(p => ({ ...p, documents: true }));
    try {
      const grouped = await fetchRemarksForEntities("document", documentIds);
      setRemarksByDocument(grouped);
    } catch (e) {
      console.error("Failed to load document remarks", e);
    } finally {
      setRemarksLoading(p => ({ ...p, documents: false }));
    }
  }


  // ── Auth ─────────────────────────────────────────────────
  // login() takes a username (not an email) and password. authSignIn
  // resolves the username to its internal email via RPC, then signs in
  // through real Supabase Auth, returning a normal Supabase session.
  const login = useCallback(async (username, password) => {
    const { session } = await authSignIn(username, password);
    const profile = await getEffectiveProfile(session.user.id, session.user);
    setUser({ ...session.user, ...profile });
  }, []);

  const logout = useCallback(async () => {
    await authSignOut();
    setUser(null);
    setEvents([]);
    setRequirements([]);
    setDocuments([]);
    setTasks([]);
    setNotifications([]);
    setRemarksByTask({});
    setRemarksByDocument({});
  }, []);

  const handleMarkNotificationRead = useCallback(async (id) => {
    if (!userRef.current?.id) return;
    try {
      await markNotificationRead(id, userRef.current.id);
      setNotifications(prev => prev.map(item => item.id === id ? { ...item, read: true } : item));
    } catch (error) {
      console.error("Failed marking notification as read", error);
    }
  }, []);

  const handleMarkAllNotificationsRead = useCallback(async () => {
    if (!userRef.current?.id) return;
    try {
      await markAllNotificationsRead(userRef.current.id);
      setNotifications(prev => prev.map(item => ({ ...item, read: true })));
    } catch (error) {
      console.error("Failed marking notifications as read", error);
    }
  }, []);

  const handleDeleteNotification = useCallback(async (id) => {
    if (!userRef.current?.id) return;
    try {
      await deleteNotification(id, userRef.current.id);
      setNotifications(prev => prev.filter(item => item.id !== id));
    } catch (error) {
      console.error("Failed deleting notification", error);
    }
  }, []);

  const handleDeleteAllReadNotifications = useCallback(async () => {
    if (!userRef.current?.id) return;
    try {
      await deleteAllReadNotifications(userRef.current.id);
      setNotifications(prev => prev.filter(item => !item.read));
    } catch (error) {
      console.error("Failed deleting read notifications", error);
    }
  }, []);

  const notify = useCallback(async (options = {}) => {
    const actor = userRef.current;
    if (!actor?.id) return [];

    const {
      actorId = actor.id,
      recipients = "admins",
      title,
      message,
      section = "General",
      type = "activity",
      entityId = null,
      entityType = null,
      metadata = {},
      action = "system_message",
      actorName = getActorDisplayName(actor),
      actorRole = actor?.role || "viewer",
    } = options;

    const template = buildNotification({
      action,
      actorName,
      actorRole,
      title,
      message,
      section,
      type,
      entityId,
      entityType,
      metadata,
    });

    try {
      let created = [];
      if (recipients === "admins") {
        created = await notifyAdmins({
          actorId,
          actorName: template.actorName,
          actorRole: template.actorRole,
          title: template.title,
          message: template.message,
          section: template.section,
          type: template.type,
          entityId: template.entityId,
          entityType: template.entityType,
          action: template.action,
          metadata: template.metadata,
        }, actorId);
      } else if (recipients === "user") {
        created = [await notifyUser({
          actorId,
          actorName: template.actorName,
          actorRole: template.actorRole,
          title: template.title,
          message: template.message,
          section: template.section,
          type: template.type,
          entityId: template.entityId,
          entityType: template.entityType,
          action: template.action,
          metadata: template.metadata,
        }, actorId)];
      } else if (Array.isArray(recipients)) {
        created = await createNotificationForRecipients({
          actorId,
          actorName: template.actorName,
          actorRole: template.actorRole,
          title: template.title,
          message: template.message,
          section: template.section,
          type: template.type,
          entityId: template.entityId,
          entityType: template.entityType,
          action: template.action,
          metadata: template.metadata,
        }, recipients);
      } else if (recipients) {
        created = [await notifyUser({
          actorId,
          actorName: template.actorName,
          actorRole: template.actorRole,
          title: template.title,
          message: template.message,
          section: template.section,
          type: template.type,
          entityId: template.entityId,
          entityType: template.entityType,
          action: template.action,
          metadata: template.metadata,
        }, recipients)];
      }

      if (created.length) {
        addNotificationsToState(created);
      }

      return created;
    } catch (error) {
      console.error("Failed creating notification", error);
      return [];
    }
  }, [addNotificationsToState]);

  const pushNotification = useCallback(async (notification) => {
    if (!userRef.current?.id) return [];

    const actorId = userRef.current.id;
    const role = String(userRef.current?.role || "viewer").toLowerCase();
    const isAdmin = role === "admin";
    const recipients = notification.recipients || "admins";

    const results = [];

    if (!isAdmin) {
      results.push(await notify({
        actorId,
        recipients: "admins",
        title: notification.title,
        message: notification.message,
        section: notification.section,
        type: notification.type,
        entityId: notification.entityId,
        entityType: notification.entityType,
        action: notification.action,
        metadata: notification.metadata || {},
      }));

      if (notification.confirmToActor !== false) {
        results.push(await notify({
          actorId,
          recipients: "user",
          title: notification.confirmTitle || "Your update was recorded",
          message: notification.confirmMessage || notification.message,
          section: notification.section,
          type: notification.type,
          entityId: notification.entityId,
          entityType: notification.entityType,
          action: notification.action,
          metadata: notification.metadata || {},
        }));
      }
    } else {
      results.push(await notify({
        actorId,
        recipients,
        title: notification.title,
        message: notification.message,
        section: notification.section,
        type: notification.type,
        entityId: notification.entityId,
        entityType: notification.entityType,
        action: notification.action,
        metadata: notification.metadata || {},
      }));
    }

    return results.flat().filter(Boolean);
  }, [notify]);

  // ── Calendar Events ───────────────────────────────────────
  const addEvent = useCallback(async (ev) => {
    const created = await insertEvent(ev, userRef.current?.id);
    setEvents(prev => [...prev, created].sort((a, b) => a.date > b.date ? 1 : -1));

    if (userRef.current?.role === "admin") {
      await notifyAssignmentToRecipients(ev.assignedPersonnel, {
        action: "schedule_assigned",
        section: "Schedule & Events",
        type: "assignment",
        entityId: created?.id,
        entityType: "event",
        metadata: { itemTitle: ev.title || "Schedule", entityName: ev.title || "Schedule" },
      });
    }

    pushNotification({
      action: "schedule_created",
      section: "Schedule & Events",
      type: "event",
      entityId: created?.id,
      entityType: "event",
      metadata: { itemTitle: ev.title || "Schedule", entityName: ev.title || "Schedule" },
    });
    return created;
  }, [getActorDisplayName, notifyAssignmentToRecipients, pushNotification]);

  const updateEvent = useCallback(async (id, changes) => {
    const previousEvent = events.find(event => event.id === id);
    const updated = await patchEvent(id, changes);
    setEvents(prev => prev.map(e => e.id === id ? updated : e));

    const actorIsAdmin = String(userRef.current?.role || "viewer").toLowerCase() === "admin";
    const assignmentChanged = actorIsAdmin && changes.assignedPersonnel !== undefined && !isSameAssignmentSet(previousEvent?.assignedPersonnel || [], changes.assignedPersonnel);
    if (assignmentChanged) {
      await notifyAssignmentToRecipients(changes.assignedPersonnel, {
        action: "schedule_assigned",
        section: "Schedule & Events",
        type: "assignment",
        entityId: updated?.id,
        entityType: "event",
        metadata: { itemTitle: updated?.title || previousEvent?.title || "Schedule", entityName: updated?.title || previousEvent?.title || "Schedule" },
      });
    }

    pushNotification({
      action: "schedule_updated",
      section: "Schedule & Events",
      type: "event",
      entityId: updated?.id,
      entityType: "event",
      metadata: { itemTitle: updated?.title || previousEvent?.title || "Schedule", entityName: updated?.title || previousEvent?.title || "Schedule" },
    });
    return updated;
  }, [events, getActorDisplayName, isSameAssignmentSet, notifyAssignmentToRecipients, pushNotification]);

  const deleteEvent = useCallback(async (id) => {
    await removeEvent(id);
    setEvents(prev => prev.filter(e => e.id !== id));
    pushNotification({
      action: "schedule_deleted",
      section: "Schedule & Events",
      type: "event",
      entityId: id,
      entityType: "event",
      metadata: { itemTitle: "Schedule" },
    });
  }, [pushNotification]);

  const upcomingEvents = [...events]
    .filter(e => new Date((e.endDate || e.date) + "T23:59:59") >= new Date())
    .sort((a, b) => new Date(a.date) - new Date(b.date));

  // ── Requirements ─────────────────────────────────────────
  const addRequirement = useCallback(async (req) => {
    const created = await insertRequirement(req, userRef.current?.id);
    setRequirements(prev => [...prev, created]);

    if (userRef.current?.role === "admin") {
      await notifyAssignmentToRecipients(req.assignedTo, {
        action: "requirement_assigned",
        section: "Requirements",
        type: "assignment",
        entityType: "requirement",
        entityId: created?.id,
        metadata: { itemTitle: req.requirement || "Requirement", entityName: req.requirement || "Requirement" },
      });
    }

    pushNotification({
      action: "requirement_created",
      section: "Requirements",
      type: "requirement",
      entityType: "requirement",
      entityId: created?.id,
      metadata: { itemTitle: req.requirement || "Requirement", entityName: req.requirement || "Requirement" },
    });
    return created;
  }, [getActorDisplayName, notifyAssignmentToRecipients, pushNotification]);

  const updateRequirement = useCallback(async (id, changes) => {
    const previousRequirement = requirements.find(requirement => requirement.id === id);
    const updated = await patchRequirement(id, changes);
    setRequirements(prev => prev.map(r => r.id === id ? updated : r));

    const actorIsAdmin = String(userRef.current?.role || "viewer").toLowerCase() === "admin";
    const assignmentChanged = actorIsAdmin && changes.assignedTo !== undefined && !isSameAssignmentSet(previousRequirement?.assignedTo || [], changes.assignedTo);
    if (assignmentChanged) {
      await notifyAssignmentToRecipients(changes.assignedTo, {
        action: "requirement_assigned",
        section: "Requirements",
        type: "assignment",
        entityType: "requirement",
        entityId: updated?.id,
        metadata: { itemTitle: updated?.requirement || previousRequirement?.requirement || "Requirement", entityName: updated?.requirement || previousRequirement?.requirement || "Requirement" },
      });
    }

    pushNotification({
      action: "requirement_updated",
      section: "Requirements",
      type: "requirement",
      entityType: "requirement",
      entityId: updated?.id,
      metadata: { itemTitle: updated?.requirement || previousRequirement?.requirement || "Requirement", entityName: updated?.requirement || previousRequirement?.requirement || "Requirement" },
    });
    return updated;
  }, [getActorDisplayName, isSameAssignmentSet, notifyAssignmentToRecipients, pushNotification, requirements]);

  const deleteRequirement = useCallback(async (id) => {
    await removeRequirement(id);
    setRequirements(prev => prev.filter(r => r.id !== id));
    pushNotification({
      action: "requirement_deleted",
      section: "Requirements",
      type: "requirement",
      entityType: "requirement",
      entityId: id,
      metadata: { itemTitle: "Requirement" },
    });
  }, [pushNotification]);

  // ── Documents ─────────────────────────────────────────────
  const addDocument = useCallback(async (doc) => {
    suppressNextRealtimeNotification();
    const id = await insertDocument(doc, userRef.current?.id);
    await loadDocuments(); // reload to get full history

    if (userRef.current?.role === "admin") {
      await notifyAssignmentToRecipients(doc.assignedPersonnel, {
        action: "document_assigned",
        section: "Document Tracking",
        type: "assignment",
        entityType: "document",
        entityId: id,
        metadata: { itemTitle: doc.title || "Document", entityName: doc.title || "Document" },
      });
    }

    pushNotification({
      action: "document_uploaded",
      section: "Document Tracking",
      type: "document",
      entityType: "document",
      entityId: id,
      metadata: { itemTitle: doc.title || "Document", entityName: doc.title || "Document", trackingNumber: doc.trackingNumber || null },
    });
    return id;
  }, [getActorDisplayName, notifyAssignmentToRecipients, pushNotification]); // eslint-disable-line react-hooks/exhaustive-deps

  const updateDocument = useCallback(async (id, changes) => {
    suppressNextRealtimeNotification();
    const previousDocument = documents.find(document => document.id === id);
    const updated = await patchDocument(id, changes, userRef.current?.id);
    setDocuments(prev => prev.map(d => d.id === id ? updated : d));
    await loadDocuments();

    const actorIsAdmin = String(userRef.current?.role || "viewer").toLowerCase() === "admin";
    const assignmentChanged = actorIsAdmin && changes.assignedPersonnel !== undefined && !isSameAssignmentSet(previousDocument?.assignedPersonnel || [], changes.assignedPersonnel);
    if (assignmentChanged) {
      await notifyAssignmentToRecipients(changes.assignedPersonnel, {
        action: "document_assigned",
        section: "Document Tracking",
        type: "assignment",
        entityType: "document",
        entityId: updated?.id,
        metadata: { itemTitle: updated?.title || previousDocument?.title || "Document", entityName: updated?.title || previousDocument?.title || "Document" },
      });
    }

    const isTrackingUpdate = changes.trackingNumber !== undefined || changes.currentOffice !== undefined || changes.status !== undefined;
    pushNotification({
      action: isTrackingUpdate ? "document_tracking_updated" : "document_updated",
      section: "Document Tracking",
      type: "document",
      entityType: "document",
      entityId: updated?.id,
      metadata: {
        itemTitle: updated?.title || previousDocument?.title || "Document",
        entityName: updated?.title || previousDocument?.title || "Document",
        trackingNumber: updated?.trackingNumber || previousDocument?.trackingNumber || null,
      },
    });
    return updated;
  }, [documents, getActorDisplayName, isSameAssignmentSet, loadDocuments, notifyAssignmentToRecipients, pushNotification]);

  const deleteDocument = useCallback(async (id) => {
    suppressNextRealtimeNotification();
    await removeDocument(id);
    setDocuments(prev => prev.filter(d => d.id !== id));
    pushNotification({
      action: "document_deleted",
      section: "Document Tracking",
      type: "document",
      entityType: "document",
      entityId: id,
      metadata: { itemTitle: "Document" },
    });
  }, [pushNotification]);

  const isDuplicateTrackingNumber = useCallback(async (num, excludeId = null) => {
    return await checkDuplicateTracking(num, excludeId);
  }, []);

  const addTaskRemark = useCallback(async (taskId, content) => {
    const actor = userRef.current;
    const authorName = actor?.name || actor?.username || "Unknown";
    const created = await addRemarkEntry({
      entityType: "task",
      entityId: taskId,
      content,
      authorId: actor?.id || null,
      authorName,
    });
    setRemarksByTask(prev => ({
      ...prev,
      [taskId]: [...(prev[taskId] || []), created],
    }));

    const relatedTask = tasks.find(t => t.id === taskId);
    const metadata = {
      itemTitle: relatedTask?.title || "this task",
      entityName: relatedTask?.title || "this task",
      remarks: content,
    };

    // Real-Time Remarks Notifications: a Viewer's remark notifies the
    // Admin(s); an Admin's remark notifies the Viewer(s) the task is
    // assigned to. (Falls back to notifying admins if the task has no
    // resolvable assignee, e.g. it's assigned to a name with no linked
    // viewer account, so the update isn't silently dropped.)
    const actorIsAdmin = String(actor?.role || "viewer").toLowerCase() === "admin";
    if (actorIsAdmin) {
      const notified = await notifyAssignmentToRecipients(relatedTask?.assignedTo, {
        action: "task_remarks_updated",
        section: "Tasks",
        type: "activity",
        entityType: "task",
        entityId: taskId,
        metadata,
      });
      if (!notified.length) {
        await notify({ recipients: "admins", action: "task_remarks_updated", section: "Tasks", type: "activity", entityType: "task", entityId: taskId, metadata });
      }
    } else {
      await notify({ recipients: "admins", action: "task_remarks_updated", section: "Tasks", type: "activity", entityType: "task", entityId: taskId, metadata });
    }

    return created;
  }, [notify, notifyAssignmentToRecipients, tasks]);

  const addDocumentRemark = useCallback(async (documentId, content) => {
    const actor = userRef.current;
    const authorName = actor?.name || actor?.username || "Unknown";
    const created = await addRemarkEntry({
      entityType: "document",
      entityId: documentId,
      content,
      authorId: actor?.id || null,
      authorName,
    });
    setRemarksByDocument(prev => ({
      ...prev,
      [documentId]: [...(prev[documentId] || []), created],
    }));

    const relatedDoc = documents.find(d => d.id === documentId);
    const metadata = {
      itemTitle: relatedDoc?.title || "this document",
      entityName: relatedDoc?.title || "this document",
      trackingNumber: relatedDoc?.trackingNumber || null,
    };

    const actorIsAdmin = String(actor?.role || "viewer").toLowerCase() === "admin";
    if (actorIsAdmin) {
      const notified = await notifyAssignmentToRecipients(relatedDoc?.assignedPersonnel, {
        action: "document_tracking_updated",
        section: "Document Tracking",
        type: "activity",
        entityType: "document",
        entityId: documentId,
        metadata,
      });
      if (!notified.length) {
        await notify({ recipients: "admins", action: "document_tracking_updated", section: "Document Tracking", type: "activity", entityType: "document", entityId: documentId, metadata });
      }
    } else {
      await notify({ recipients: "admins", action: "document_tracking_updated", section: "Document Tracking", type: "activity", entityType: "document", entityId: documentId, metadata });
    }

    return created;
  }, [documents, notify, notifyAssignmentToRecipients]);

  const addTask = useCallback(async (task) => {
    suppressNextRealtimeNotification();
    const created = await insertTask(task, userRef.current?.id, userRef.current?.username || userRef.current?.name || "admin");
    setTasks(prev => [created, ...prev]);

    if (userRef.current?.role === "admin") {
      await notifyAssignmentToRecipients(task.assignedTo, {
        action: "task_assigned",
        section: "Tasks",
        type: "assignment",
        entityType: "task",
        entityId: created?.id,
        metadata: { itemTitle: task.title || "Task", entityName: task.title || "Task", dueDate: task.dueDate || null },
      });
    }

    pushNotification({
      action: "task_created",
      section: "Tasks",
      type: "task",
      entityType: "task",
      entityId: created?.id,
      metadata: { itemTitle: task.title || "Task", entityName: task.title || "Task", dueDate: task.dueDate || null },
    });
    return created;
  }, [getActorDisplayName, notifyAssignmentToRecipients, pushNotification]);

  const updateTask = useCallback(async (id, changes) => {
    suppressNextRealtimeNotification();
    const previousTask = tasks.find(task => task.id === id);
    const updated = await patchTask(id, changes);
    setTasks(prev => prev.map(t => t.id === id ? updated : t));
    await loadTasks();

    const actorIsAdmin = String(userRef.current?.role || "viewer").toLowerCase() === "admin";
    const assignedChanged = actorIsAdmin && changes.assignedTo !== undefined && !isSameAssignmentSet(previousTask?.assignedTo || [], changes.assignedTo);
    if (assignedChanged) {
      await notifyAssignmentToRecipients(changes.assignedTo, {
        action: "task_assigned",
        section: "Tasks",
        type: "assignment",
        entityType: "task",
        entityId: updated?.id,
        metadata: { itemTitle: updated?.title || previousTask?.title || "Task", entityName: updated?.title || previousTask?.title || "Task", dueDate: updated?.dueDate || previousTask?.dueDate || null },
      });
    }

    const role = String(userRef.current?.role || "viewer").toLowerCase();
    const isViewerAction = role !== "admin";
    const statusChanged = changes.status !== undefined && changes.status !== previousTask?.status;
    const remarksChanged = changes.remarks !== undefined && changes.remarks !== previousTask?.remarks;
    const progressChanged = changes.progress !== undefined && changes.progress !== previousTask?.progress;
    const completionChanged = changes.completion !== undefined && changes.completion !== previousTask?.completion;

    if (isViewerAction && (statusChanged || remarksChanged || progressChanged || completionChanged)) {
      const taskTitle = updated?.title || previousTask?.title || "this task";
      const action = statusChanged ? "task_status_updated" : remarksChanged ? "task_remarks_updated" : "task_updated";

      await pushNotification({
        action,
        section: "Tasks",
        type: "task",
        entityId: updated?.id,
        entityType: "task",
        metadata: {
          itemTitle: taskTitle,
          entityName: taskTitle,
          oldStatus: previousTask?.status,
          newStatus: updated?.status || changes.status,
          remarks: changes.remarks,
          dueDate: updated?.dueDate || previousTask?.dueDate || null,
        },
        confirmTitle: "You updated the task",
        confirmMessage: `You updated ${taskTitle}.`,
      });
    }

    if (!isViewerAction) {
      pushNotification({
        action: "task_updated",
        section: "Tasks",
        type: "task",
        entityId: updated?.id,
        entityType: "task",
        metadata: {
          itemTitle: updated?.title || previousTask?.title || "Task",
          entityName: updated?.title || previousTask?.title || "Task",
          oldStatus: previousTask?.status,
          newStatus: updated?.status || changes.status,
        },
      });
    }

    return updated;
  }, [getActorDisplayName, isSameAssignmentSet, loadTasks, notifyAssignmentToRecipients, pushNotification, tasks]);

  const deleteTask = useCallback(async (id) => {
    suppressNextRealtimeNotification();
    await removeTask(id);
    setTasks(prev => prev.filter(t => t.id !== id));
    pushNotification({
      action: "task_deleted",
      section: "Tasks",
      type: "task",
      entityType: "task",
      entityId: id,
      metadata: { itemTitle: "Task" },
    });
  }, [pushNotification]);

  // Maps a notification's section to the Dashboard tab id that shows it,
  // so clicking a notification can jump straight to the right screen.
  const SECTION_TO_PAGE = {
    "Tasks": "tasks",
    "Document Tracking": "document-tracking",
    "Schedule & Events": "calendar",
    "Requirements": "checklist",
  };

  // Clicking a notification: mark it read, then set a focus target that
  // the destination section (TaskPanel / DocumentTracking / CalendarCard)
  // picks up to scroll to + highlight that item — and, for remarks,
  // scroll straight to the newest message in the thread.
  const openNotification = useCallback((item) => {
    if (item?.id && !item.read) {
      handleMarkNotificationRead(item.id);
    }
    const page = SECTION_TO_PAGE[item?.section];
    if (page && item?.entityId) {
      setFocusTarget({ page, entityType: item.entityType, entityId: item.entityId, ts: Date.now() });
    }
    return page || null;
  }, [handleMarkNotificationRead]); // eslint-disable-line react-hooks/exhaustive-deps

  const clearFocusTarget = useCallback(() => setFocusTarget(null), []);

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
      // remarks history (chat-style)
      remarksByTask, remarksByDocument, remarksLoading,
      addTaskRemark, addDocumentRemark,
      // personnel + customizable colors
      personnel, personnelColorMap, loadPersonnel, updatePersonnelColor,
      // notifications
      notifications, pushNotification, notify,
      notificationWarning,
      dismissNotificationWarning: () => setNotificationWarning(null),
      markNotificationRead: handleMarkNotificationRead,
      markAllNotificationsRead: handleMarkAllNotificationsRead,
      deleteNotification: handleDeleteNotification,
      deleteAllReadNotifications: handleDeleteAllReadNotifications,
      openNotification, focusTarget, clearFocusTarget,
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
