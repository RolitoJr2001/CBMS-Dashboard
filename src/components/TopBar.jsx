import { useEffect, useState } from "react";
import { MdNotifications, MdSearch, MdShield } from "react-icons/md";
import { useApp } from "../context/AppContext";

// Search keyword → tab id mapping
const SEARCH_MAP = {
  calendar:    "calendar",    schedule:  "calendar",    event:    "calendar",
  checklist:   "checklist",   requirement: "checklist", compliance: "checklist",
  folder:      "folder-directory", drive: "folder-directory",
  monitoring:  "monitoring",  sheet:    "monitoring",
  document:    "document-tracking", tracking: "document-tracking",
  announcement:"announcements",
  analytics:   "analytics",   report:   "analytics",
  link:        "quick-access", access:  "quick-access",
};

function formatNotificationTime(value) {
  const date = value ? new Date(value) : new Date();
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

export default function TopBar({ pageTitle, pageDesc, onNavigate }) {
  const { upcomingEvents, documents, notifications, user } = useApp();
  const isAdmin = user?.role === "admin";
  const currentRole = isAdmin ? "admin" : "viewer";
  const [notifOpen, setNotifOpen] = useState(false);
  const [searchVal, setSearchVal] = useState("");
  const [dismissedIds, setDismissedIds] = useState([]);

  const today = new Date().toLocaleDateString("en-US", {
    weekday: "short", month: "short", day: "numeric", year: "numeric",
  });

  useEffect(() => {
    if (!user) {
      setDismissedIds([]);
      return;
    }

    const storageKey = `cbms-dismissed-notifications:${user.id || "guest"}`;
    try {
      const raw = window.localStorage.getItem(storageKey);
      setDismissedIds(raw ? JSON.parse(raw) : []);
    } catch {
      setDismissedIds([]);
    }
  }, [user?.id]);

  useEffect(() => {
    if (!user) return;

    const storageKey = `cbms-dismissed-notifications:${user.id || "guest"}`;
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(dismissedIds));
    } catch {
      // ignore storage errors
    }
  }, [user?.id, dismissedIds]);

  const urgentEvents = upcomingEvents
    .filter(e => {
      const diff = (new Date(e.date) - new Date()) / 86400000;
      return diff >= 0 && diff <= 7;
    })
    .slice(0, 3);
  const inProcessDocs = documents.filter(d => d.status === "In Process").slice(0, 2);
  const notifItems = [
    ...notifications
      .filter(item => item.recipientRole === "all" || item.recipientRole === currentRole || !item.recipientRole)
      .map(item => ({
        id: item.id,
        type: "activity",
        title: item.title,
        message: item.message,
        actor: item.actorName ? `${item.actorName} • ${item.actorRole}` : null,
        subject: item.subjectName ? `${item.subjectName}` : null,
        time: item.createdAt ? formatNotificationTime(item.createdAt) : null,
        badge: item.section,
        accent: "text-teal-700",
      })),
    ...urgentEvents.map(ev => ({
      id: `event-${ev.id}`,
      type: "event",
      title: ev.title,
      message: `${ev.date} · ${ev.time}`,
      badge: "Upcoming Event",
      accent: "text-teal-700",
    })),
    ...inProcessDocs.map(doc => ({
      id: `doc-${doc.id}`,
      type: "document",
      title: doc.title,
      message: `${doc.trackingNumber} · ${doc.currentOffice}`,
      badge: "Document In Process",
      accent: "text-status-yellow",
    })),
  ];
  const visibleNotifItems = notifItems.filter(item => !dismissedIds.includes(item.id));
  const notifCount = visibleNotifItems.length;

  function dismissItem(id) {
    setDismissedIds(prev => (prev.includes(id) ? prev : [...prev, id]));
  }

  function handleSearch(e) {
    e.preventDefault();
    if (!searchVal.trim()) return;
    const q = searchVal.toLowerCase();
    const localMap = { ...SEARCH_MAP };
    if (!isAdmin) {
      delete localMap.link;
      delete localMap.access;
    }
    const match = Object.entries(localMap).find(([k]) => q.includes(k));
    if (match && onNavigate) onNavigate(match[1]);
    setSearchVal("");
  }

  return (
    <header className="h-16 bg-white border-b border-slate-100 flex items-center justify-end w-full px-6 gap-4 sticky top-0 z-30">

      {/* Right: search + date + notif + user */}
      <div className="ml-auto flex items-center gap-3 shrink-0">
        {/* Search — now switches tabs instead of scrolling */}
        <form onSubmit={handleSearch} className="hidden md:flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5">
          <MdSearch className="text-slate-400 text-base shrink-0" />
          <input
            value={searchVal}
            onChange={e => setSearchVal(e.target.value)}
            placeholder="Search..."
            className="bg-transparent text-sm text-navy-900 placeholder-slate-400 outline-none w-36"
          />
        </form>

        {/* Date */}
        <div className="hidden sm:flex items-center gap-1.5 text-xs text-slate-500 border border-slate-200 rounded-lg px-3 py-1.5 bg-slate-50">
          <span className="text-slate-400 text-[10px] uppercase tracking-wide font-medium">Date</span>
          <span className="font-semibold text-navy-900">{today}</span>
        </div>

        {/* Notifications */}
        <div className="relative">
          <button
            onClick={() => setNotifOpen(v => !v)}
            className="relative w-9 h-9 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-center text-slate-500 hover:text-navy-900 hover:bg-slate-100 transition-colors"
            aria-label="Notifications"
          >
            <MdNotifications className="text-lg" />
            {notifCount > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-status-red text-white text-[9px] font-bold flex items-center justify-center badge-pulse">
                {notifCount}
              </span>
            )}
          </button>

          {notifOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setNotifOpen(false)} />
              <div className="absolute right-0 top-11 z-50 w-80 bg-white rounded-xl border border-slate-100 shadow-cardHover overflow-hidden">
                <div className="px-4 py-3 border-b border-slate-100">
                  <p className="text-sm font-semibold text-navy-900">Notifications</p>
                </div>
                <div className="divide-y divide-slate-50 max-h-72 overflow-y-auto">
                  {visibleNotifItems.map(item => (
                    <div key={item.id} className="px-4 py-3 hover:bg-slate-50 transition-colors flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className={`text-xs font-semibold mb-0.5 ${item.accent}`}>{item.badge}</p>
                        <p className="text-sm text-navy-900">{item.title}</p>
                        {item.actor && <p className="text-[11px] text-slate-500 mt-1">{item.actor}</p>}
                        <p className="text-xs text-slate-400 mt-1">{item.message}</p>
                        {item.subject && <p className="text-[11px] text-slate-400 mt-1">Affected: {item.subject}</p>}
                        {item.time && <p className="text-[11px] text-slate-400 mt-1">{item.time}</p>}
                      </div>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          dismissItem(item.id);
                        }}
                        className="text-slate-400 hover:text-slate-600 transition-colors"
                        aria-label={`Dismiss ${item.title}`}
                      >
                        ×
                      </button>
                    </div>
                  ))}
                  {notifCount === 0 && (
                    <div className="px-4 py-8 text-center text-slate-400 text-sm">No new notifications</div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
