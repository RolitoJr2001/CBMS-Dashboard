import { useEffect, useRef, useState } from "react";
import { MdNotifications, MdSearch, MdShield } from "react-icons/md";
import { useApp } from "../context/AppContext";
import { useGlobalSearch } from "../hooks/useGlobalSearch";
import PersonnelChip from "./PersonnelChip";
import SearchDropdown from "./SearchDropdown";
import { formatDisplayDateTime, formatDisplayTime } from "../utils/formatters";

// Removed: old SEARCH_MAP - now using global search index

function formatNotificationTime(value) {
  return formatDisplayDateTime(value);
}

function formatRelativeTime(value) {
  if (!value) return "Just now";

  const diffMs = Date.now() - new Date(value).getTime();
  const diffMins = Math.round(diffMs / 60000);
  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;

  const diffHours = Math.round(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;

  const diffDays = Math.round(diffHours / 24);
  return `${diffDays}d ago`;
}

export default function TopBar({ pageTitle, pageDesc, onNavigate }) {
  const {
    upcomingEvents,
    documents,
    notifications,
    notificationWarning,
    dismissNotificationWarning,
    user,
    markNotificationRead,
    markAllNotificationsRead,
    deleteNotification,
    openNotification,
    tasks,
    events,
    requirements,
    personnel,
  } = useApp();

  // Global search setup
  const searchData = {
    tasks,
    documents,
    events,
    requirements,
    personnel,
    announcements: [], // Can add if available in AppContext
    quickLinks: [], // Can add if available in AppContext
    notifications: notifications.slice(0, 10), // Recent notifications only
  };

  const {
    query,
    setQuery,
    results,
    selectedIndex,
    isOpen,
    setIsOpen,
    handleKeyDown,
  } = useGlobalSearch(searchData, 300);

  const searchInputRef = useRef(null);
  const isAdmin = user?.role === "admin";
  const currentRole = isAdmin ? "admin" : "viewer";
  const [notifOpen, setNotifOpen] = useState(false);
  const [dismissedIds, setDismissedIds] = useState([]);

  // Handle search result selection
  function handleSearchSelect(result) {
    // Navigate based on result type
    const pageMap = {
      task: "tasks",
      document: "document-tracking",
      event: "calendar",
      requirement: "checklist",
      personnel: null,
      quicklink: result.metadata?.page || null,
      notification: null,
    };

    const targetPage = pageMap[result.type];
    if (targetPage && onNavigate) {
      onNavigate(targetPage);
    }

    // Scroll to highlight specific items
    if (result.metadata?.taskId) {
      setTimeout(() => {
        const taskElement = document.getElementById(`task-card-${result.metadata.taskId}`);
        if (taskElement) {
          taskElement.scrollIntoView({ behavior: "smooth", block: "center" });
        }
      }, 100);
    }

    // Clear search
    setQuery("");
    setIsOpen(false);
    if (searchInputRef.current) {
      searchInputRef.current.blur();
    }
  }

  const today = new Date().toLocaleDateString("en-US", {
    weekday: "short", month: "short", day: "numeric", year: "numeric",
  });

  useEffect(() => {
    if (!user) {
      setDismissedIds([]);
    }
  }, [user?.id]);

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
        read: Boolean(item.read),
        category: item.type || "activity",
        relativeTime: formatRelativeTime(item.createdAt),
        actorRole: item.actorRole || "system",
        raw: item,
      })),
    ...urgentEvents.map(ev => ({
      id: `event-${ev.id}`,
      type: "event",
      title: ev.title,
      message: `${ev.date} · ${formatDisplayTime(ev.time)}`,
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
  const unreadCount = visibleNotifItems.filter(item => !item.read).length;
  const notifCount = visibleNotifItems.length;

  function dismissItem(id) {
    setDismissedIds(prev => (prev.includes(id) ? prev : [...prev, id]));
  }

  return (
    <>
      {notificationWarning && (
        <div className="sticky top-0 z-40 bg-status-yellowBg border-b border-status-yellow/30 px-6 py-2 flex items-center justify-between gap-3">
          <p className="text-xs text-status-yellow font-medium">
            ⚠ {notificationWarning.message}
            {notificationWarning.detail && <span className="hidden sm:inline text-status-yellow/80"> {notificationWarning.detail}</span>}
          </p>
          <button
            type="button"
            onClick={dismissNotificationWarning}
            className="text-status-yellow hover:text-status-yellow/70 text-xs font-semibold shrink-0"
          >
            Dismiss
          </button>
        </div>
      )}
      <header className="h-16 bg-white border-b border-slate-100 flex items-center justify-end w-full px-6 gap-4 sticky top-0 z-30">

      {/* Right: search + date + notif + user */}
      <div className="ml-auto flex items-center gap-3 shrink-0">
        {/* Global Search with Autocomplete */}
        <div className="hidden md:relative md:flex items-center">
          <div className="relative flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5">
            <MdSearch className="text-slate-400 text-base shrink-0" />
            <input
              ref={searchInputRef}
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              onFocus={() => setIsOpen(true)}
              placeholder="Search..."
              className="bg-transparent text-sm text-navy-900 placeholder-slate-400 outline-none w-48"
            />
          </div>
          {/* Search Results Dropdown */}
          <SearchDropdown
            results={results}
            selectedIndex={selectedIndex}
            isOpen={isOpen}
            onSelect={handleSearchSelect}
            onClose={() => setIsOpen(false)}
          />
        </div>

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
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-status-red text-white text-[9px] font-bold flex items-center justify-center badge-pulse">
                {unreadCount}
              </span>
            )}
          </button>

          {notifOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setNotifOpen(false)} />
              <div className="absolute right-0 top-11 z-50 w-80 bg-white rounded-xl border border-slate-100 shadow-cardHover overflow-hidden">
                <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-navy-900">Notifications</p>
                  {unreadCount > 0 && (
                    <button
                      type="button"
                      className="text-xs text-teal-700 font-medium"
                      onClick={() => markAllNotificationsRead()}
                    >
                      Mark all read
                    </button>
                  )}
                </div>
                <div className="divide-y divide-slate-50 max-h-72 overflow-y-auto">
                  {visibleNotifItems.map(item => (
                    <div
                      key={item.id}
                      className={`px-4 py-3 hover:bg-slate-50 transition-colors flex items-start justify-between gap-2 ${item.read ? "bg-white" : "bg-teal-50/60"}`}
                    >
                      <button
                        type="button"
                        className="min-w-0 flex-1 text-left"
                        onClick={() => {
                          // Clicking a notification opens the related task/
                          // document/schedule item and jumps straight to it
                          // (and, for remarks, scrolls to the newest message)
                          // instead of only marking it read.
                          if (item.raw) {
                            const page = openNotification(item.raw);
                            if (page && onNavigate) {
                              onNavigate(page);
                              setNotifOpen(false);
                            }
                          } else {
                            markNotificationRead(item.id);
                          }
                        }}
                      >
                        <p className={`text-xs font-semibold mb-0.5 ${item.accent}`}>{item.badge}</p>
                        <p className="text-sm text-navy-900">{item.title}</p>
                        {item.raw?.actorName && (
                          <div className="mt-1 flex items-center gap-1.5">
                            <PersonnelChip name={item.raw.actorName} role={item.actorRole} size="xs" />
                          </div>
                        )}
                        <p className="text-xs text-slate-400 mt-1">{item.message}</p>
                        <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-slate-400">
                          <span className="rounded-full bg-slate-100 px-2 py-0.5">{item.category}</span>
                          {item.actorRole && <span className="rounded-full bg-slate-100 px-2 py-0.5 capitalize">{item.actorRole}</span>}
                          {item.relativeTime && <span>{item.relativeTime}</span>}
                        </div>
                        {item.subject && <p className="text-[11px] text-slate-400 mt-1">Affected: {item.subject}</p>}
                        {item.time && <p className="text-[11px] text-slate-400 mt-1">{item.time}</p>}
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteNotification(item.id);
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
    </>
  );
}
