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

const AppContext = createContext(null);

export function AppProvider({ children }) {
  // ── Auth state ────────────────────────────────────────────
  const [user, setUser]               = useState(null);
  const [authLoading, setAuthLoading] = useState(true);

  // ── Data state ───────────────────────────────────────────
  const [events,       setEvents]       = useState([]);
  const [requirements, setRequirements] = useState([]);
  const [documents,    setDocuments]    = useState([]);
  const [notifications, setNotifications] = useState([]);

  // ── Loading / error per-entity ────────────────────────────
  const [loading, setLoading] = useState({ events: false, requirements: false, documents: false });
  const [errors,  setErrors]  = useState({ events: null,  requirements: null,  documents: null  });

  const userRef = useRef(user);
  useEffect(() => { userRef.current = user; }, [user]);

  const embedUrl = calendarEmbedUrl;

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
      }
    });
    return () => sub?.unsubscribe();
  }, []);

  // ── Load data once user is set ────────────────────────────
  useEffect(() => {
    if (!user) return;
    loadAll();
  }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  async function loadAll() {
    loadEvents();
    loadRequirements();
    loadDocuments();
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
      setDocuments(await fetchDocuments());
      setErrors(p => ({ ...p, documents: null }));
    } catch (e) {
      setErrors(p => ({ ...p, documents: e.message }));
    } finally {
      setLoading(p => ({ ...p, documents: false }));
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
    setNotifications([]);
  }, []);

  const pushNotification = useCallback((notification) => {
    setNotifications(prev => [{ id: `${Date.now()}-${Math.random()}`, createdAt: new Date().toISOString(), ...notification }, ...prev].slice(0, 12));
  }, []);

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
    const id = await insertDocument(doc, userRef.current?.id);
    await loadDocuments(); // reload to get full history
    pushNotification({
      title: "Document added",
      message: doc.title || "A document was added.",
      section: "Document Tracking",
      type: "document",
    });
    return id;
  }, [pushNotification]); // eslint-disable-line react-hooks/exhaustive-deps

  const updateDocument = useCallback(async (id, changes) => {
    const updated = await patchDocument(id, changes, userRef.current?.id);
    setDocuments(prev => prev.map(d => d.id === id ? updated : d));
    // Reload to get fresh history from DB
    await loadDocuments();
    pushNotification({
      title: "Document updated",
      message: changes.title || "A document was updated.",
      section: "Document Tracking",
      type: "document",
    });
    return updated;
  }, [pushNotification]); // eslint-disable-line react-hooks/exhaustive-deps

  const deleteDocument = useCallback(async (id) => {
    await removeDocument(id);
    setDocuments(prev => prev.filter(d => d.id !== id));
    pushNotification({
      title: "Document removed",
      message: "A document was removed.",
      section: "Document Tracking",
      type: "document",
    });
  }, [pushNotification]);

  const isDuplicateTrackingNumber = useCallback(async (num, excludeId = null) => {
    return await checkDuplicateTracking(num, excludeId);
  }, []);

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
