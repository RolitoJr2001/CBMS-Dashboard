import { useState } from "react";
import { MdShield, MdDashboard, MdCalendarToday, MdChecklist,
         MdBarChart, MdCampaign, MdDescription, MdLink, MdClose, MdMenu, MdLogout, MdAssignment, MdGroup } from "react-icons/md";
import { useApp } from "../context/AppContext";
import cbmsLogo from "../../Logos/DASMO_OFFICIAL LOGO.png";

const ALL_NAV = [
  { id: "dashboard",         label: "Dashboard",         icon: MdDashboard    },
  { id: "calendar",          label: "Schedule & Events", icon: MdCalendarToday },
  { id: "tasks",             label: "Tasks",             icon: MdAssignment   },
  { id: "document-tracking", label: "Document Tracking", icon: MdDescription  },
  { id: "checklist",         label: "Requirements",      icon: MdChecklist    },
  { id: "monitoring",        label: "Monitoring",        icon: MdBarChart     },
  { id: "personnel",         label: "Manage Personnel",  icon: MdGroup        },
  { id: "quick-access",      label: "Quick Links",       icon: MdLink         },
  { id: "announcements",     label: "Announcements",     icon: MdCampaign     },
];

export default function Sidebar({ active, setActive }) {
  const [mobileOpen,   setMobileOpen]   = useState(false);
  const [loggingOut,   setLoggingOut]   = useState(false);
  const { user, logout } = useApp();
  const isAdmin = user?.role === "admin";
  const viewerNavIds = ["dashboard", "calendar", "tasks", "document-tracking", "checklist", "monitoring", "announcements"];
  const NAV = isAdmin
    ? ALL_NAV
    : ALL_NAV.filter(item => viewerNavIds.includes(item.id));

  function nav(id) { setActive(id); setMobileOpen(false); }

  async function handleLogout() {
    setLoggingOut(true);
    try { await logout(); }
    catch { /* ignore */ }
    finally { setLoggingOut(false); }
  }

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="flex items-center gap-3 px-5 py-5 border-b border-slate-100">
        <img
          src={cbmsLogo}
          alt="DASMO CBMS logo"
          className="w-10 h-10 rounded-xl object-contain shrink-0 bg-white"
        />
        <div className="leading-tight">
          <p className="text-navy-900 font-semibold text-sm tracking-tight">DASMO-CBMSD</p>
          <p className="text-[10px] text-slate-400 uppercase tracking-widest">Operations Dashboard</p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-0.5">
        {NAV.map(item => {
          const Icon = item.icon;
          const isActive = active === item.id;
          return (
            <button
              key={item.id}
              onClick={() => nav(item.id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left text-sm font-medium transition-all ${
                isActive
                  ? "sidebar-item-active text-teal-700"
                  : "text-slate-500 hover:text-navy-900 hover:bg-slate-100"
              }`}
            >
              <Icon className={`text-lg shrink-0 ${isActive ? "text-teal-600" : "text-slate-400"}`} />
              {item.label}
            </button>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="px-4 py-4 border-t border-slate-100">
        <button
          onClick={handleLogout}
          disabled={loggingOut}
          className="flex w-full items-center justify-between rounded-lg border border-slate-200 px-3 py-2.5 text-left transition-colors hover:bg-slate-50 disabled:opacity-60"
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-full bg-teal-600 flex items-center justify-center text-white text-xs font-bold shrink-0">
              {user?.name?.split(" ").map(part => part[0]).join("").slice(0,2).toUpperCase() || "U"}
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-navy-900 truncate">{user?.name || user?.email || "User"}</p>
              <p className="text-[10px] text-slate-400">{user?.role === "admin" ? "Administrator" : "Viewer"}</p>
            </div>
          </div>
          <MdLogout className={`text-slate-400 text-lg shrink-0 ${loggingOut ? "animate-pulse" : ""}`} />
        </button>
      </div>
    </div>
  );

  return (
    // Main navigation sidebar for website sections
    <>
      {/* Desktop sidebar — sticky, full-height */}
      <aside className="sidebar hidden lg:flex flex-col bg-white border-r border-slate-100 h-screen sticky top-0">
        <SidebarContent />
      </aside>

      {/* Mobile FAB toggle */}
      <button
        className="lg:hidden fixed bottom-5 right-5 z-50 w-12 h-12 rounded-full bg-teal-600 text-white shadow-lg flex items-center justify-center"
        onClick={() => setMobileOpen(v => !v)}
        aria-label="Toggle menu"
      >
        {mobileOpen ? <MdClose className="text-xl" /> : <MdMenu className="text-xl" />}
      </button>

      {/* Mobile drawer */}
      {mobileOpen && (
        <>
          <div
            className="lg:hidden fixed inset-0 z-40 bg-navy-900/40 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="lg:hidden fixed left-0 top-0 bottom-0 z-50 w-64 bg-white shadow-xl">
            <SidebarContent />
          </aside>
        </>
      )}
    </>
  );
}
