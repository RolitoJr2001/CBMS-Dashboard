import { useState } from "react";
import { useApp } from "../context/AppContext";
import {
  AreaChart, Area, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer,
} from "recharts";
import {
  MdCalendarToday, MdChecklist, MdBarChart, MdCampaign,
  MdDescription, MdLink, MdTrendingUp, MdCheckCircle, MdPending,
  MdSchedule, MdOutlineOpenInNew, MdAdd,
} from "react-icons/md";
import { FaInbox } from "react-icons/fa";
import CalendarCard     from "../components/CalendarCard";
import ChecklistCard    from "../components/ChecklistCard";
import FolderDirectory  from "../components/FolderDirectory";
import MonitoringTable  from "../components/MonitoringTable";
import QuickLinks       from "../components/QuickLinks";
import Analytics        from "../components/Analytics";
import Announcements    from "../components/Announcements";
import DocumentTracking from "../components/DocumentTracking";
import TaskPanel        from "../components/TaskPanel";
import PersonnelManager from "../components/PersonnelManager";
import PersonnelChip    from "../components/PersonnelChip";
import TopBar           from "../components/TopBar";
import Sidebar          from "../components/Sidebar";
import { formatDisplayTime } from "../utils/formatters";

// ─── Constants ───────────────────────────────────────────────
const STATUS_COLORS = {
  Completed:    "#1f9d55",
  Ongoing:      "#c79a12",
  Pending:      "#d23c3c",
  "For Review": "#0e2c4f",
  Returned:     "#d23c3c",
};

const trendData = [
  { month: "Jan", requirements: 2 },
  { month: "Feb", requirements: 4 },
  { month: "Mar", requirements: 5 },
  { month: "Apr", requirements: 7 },
  { month: "May", requirements: 8 },
  { month: "Jun", requirements: 10 },
];

// Main dashboard page that renders the website sections and widgets
export const PAGE_META = {
  dashboard:           { title: "Dashboard",            desc: "Track CBMS operations, compliance, and document activity in one place." },
  calendar:            { title: "Schedule & Events",    desc: "Monthly calendar · deadlines · meetings" },
  checklist:           { title: "Requirements",         desc: "CBMS Data Turnover compliance checklist" },
  monitoring:          { title: "Monitoring Workspace", desc: "Shared folders and live tracking sheets" },
  "document-tracking": { title: "Document Tracking",    desc: "Incoming and outgoing document monitoring" },
  "quick-access":      { title: "Quick Links",          desc: "Jump straight to the tools you use most" },
  announcements:       { title: "Announcements",        desc: "Notice board for offices and field staff" },
  tasks:               { title: "Tasks",                 desc: "Assigned work and follow-up items" },
  analytics:           { title: "Analytics",            desc: "Provincewide CBMS turnover progress" },
  personnel:           { title: "Manage Personnel",     desc: "Link viewer accounts so assignments and notifications reach them" },
};

// ─── Sub-components ──────────────────────────────────────────
function StatCard({ label, value, sub, icon: Icon, color, trend }) {
  return (
    <div className="stat-card bg-white rounded-xl border border-slate-100 p-5 flex flex-col gap-3 cursor-default">
      <div className="flex items-start justify-between">
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${color}`}>
          <Icon className="text-lg" />
        </div>
        {trend !== undefined && (
          <span className="text-[11px] font-medium text-status-green bg-status-greenBg px-2 py-0.5 rounded-full flex items-center gap-0.5">
            <MdTrendingUp /> {trend}
          </span>
        )}
      </div>
      <div>
        <p className="text-2xl font-bold text-navy-900 leading-none">{value}</p>
        <p className="text-xs font-semibold text-navy-800 mt-1">{label}</p>
        <p className="text-xs text-slate-400 mt-0.5">{sub}</p>
      </div>
    </div>
  );
}

// ─── Tab content panels ──────────────────────────────────────
// Each panel is only rendered when its tab is active.

function DashboardHome({ setActivePage, requirements, events, upcomingEvents, documents, user }) {
  const totalReqs     = requirements.length;
  const completed     = requirements.filter(r => r.status === "Completed").length;
  const ongoing       = requirements.filter(r => r.status === "Ongoing").length;
  const pending       = requirements.filter(r => r.status === "Pending").length;
  const compPct       = totalReqs ? Math.round((completed / totalReqs) * 100) : 0;
  const totalDocs     = documents.length;
  const inProcessDocs = documents.filter(d => d.status === "In Process").length;
  const completedDocs = documents.filter(d => d.status === "Completed").length;
  const displayName = user?.name || user?.full_name || user?.fullName || user?.username || user?.email || "User";
  const dashboardTitle = `${displayName} Dashboard`;

  const pieData = [
    { name: "Completed", value: completed },
    { name: "Ongoing",   value: ongoing   },
    { name: "Pending",   value: pending   },
  ].filter(d => d.value > 0);

  return (
    <div className="space-y-8">
      {/* Overview banner */}
      <section className="rounded-xl bg-gradient-to-r from-teal-900 to-teal-700 p-6 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <p className="text-teal-200 text-xs font-semibold uppercase tracking-widest mb-1">
            Iloilo City Government · DASMO
          </p>
          <h2 className="text-xl sm:text-2xl font-bold leading-tight">
            {dashboardTitle}
          </h2>
          <p className="text-teal-100/80 text-sm mt-1 max-w-lg">
            Centralized portal for schedules, data turnover compliance, monitoring sheets,
            and shared resources across all CBMS field and division offices.
          </p>
        </div>
        <div className="flex gap-2 shrink-0">
          <button
            onClick={() => setActivePage("calendar")}
            className="flex items-center gap-1.5 text-xs font-semibold px-4 py-2 rounded-lg bg-white text-teal-800 hover:bg-teal-50 transition-colors"
          >
            <MdAdd /> Add Event
          </button>
          <button
            onClick={() => setActivePage("document-tracking")}
            className="flex items-center gap-1.5 text-xs font-semibold px-4 py-2 rounded-lg bg-teal-600/40 text-white border border-white/20 hover:bg-teal-600/60 transition-colors"
          >
            <MdDescription /> New Document
          </button>
        </div>
      </section>

      {/* Stat rows */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Requirements" value={totalReqs}        sub="All CBMS requirements"   icon={MdChecklist}    color="bg-navy-50 text-navy-700" />
        <StatCard label="Completed"          value={completed}        sub="Requirements fulfilled"  icon={MdCheckCircle}  color="bg-status-greenBg text-status-green" trend="+2 this week" />
        <StatCard label="Pending / Ongoing"  value={pending + ongoing} sub="Need attention"         icon={MdPending}      color="bg-status-yellowBg text-status-yellow" />
        <StatCard label="Compliance Rate"    value={`${compPct}%`}   sub="Of all requirements"     icon={MdBarChart}     color="bg-teal-50 text-teal-700" />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Documents"  value={totalDocs}            sub="All tracked documents" icon={FaInbox}        color="bg-navy-50 text-navy-700" />
        <StatCard label="In Process"       value={inProcessDocs}        sub="Awaiting action"       icon={MdSchedule}     color="bg-status-yellowBg text-status-yellow" />
        <StatCard label="Completed Docs"   value={completedDocs}        sub="Fully processed"       icon={MdCheckCircle}  color="bg-status-greenBg text-status-green" />
        <StatCard label="Upcoming Events"  value={upcomingEvents.length} sub="In next 30 days"      icon={MdCalendarToday} color="bg-teal-50 text-teal-700" />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-100 p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-semibold text-navy-900">Requirements Trend</h3>
              <p className="text-xs text-slate-400">Cumulative completions — Last 6 months</p>
            </div>
            <span className="text-[11px] font-medium text-slate-400 bg-slate-50 border border-slate-200 px-2.5 py-1 rounded-lg">2026</span>
          </div>
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trendData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="tealGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="10%" stopColor="#178379" stopOpacity={0.18} />
                    <stop offset="95%" stopColor="#178379" stopOpacity={0.01} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 12 }} />
                <Area type="monotone" dataKey="requirements" stroke="#178379" strokeWidth={2} fill="url(#tealGrad)"
                  dot={{ r: 3, fill: "#178379", strokeWidth: 0 }} activeDot={{ r: 5 }} name="Requirements" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-100 p-5">
          <div className="mb-4">
            <h3 className="text-sm font-semibold text-navy-900">Status Distribution</h3>
            <p className="text-xs text-slate-400">Current requirement mix</p>
          </div>
          <div className="h-40">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={pieData} dataKey="value" nameKey="name" innerRadius={42} outerRadius={62} paddingAngle={3}>
                  {pieData.map(entry => (
                    <Cell key={entry.name} fill={STATUS_COLORS[entry.name] || "#94a3b8"} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex flex-col gap-1.5 mt-2">
            {pieData.map(d => (
              <div key={d.name} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ background: STATUS_COLORS[d.name] }} />
                  <span className="text-slate-600">{d.name}</span>
                </div>
                <span className="font-semibold text-navy-900">{d.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Recent activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent documents */}
        <div className="bg-white rounded-xl border border-slate-100 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-navy-900">Recent Documents</h3>
              <p className="text-xs text-slate-400">Latest document movements</p>
            </div>
            <button
              onClick={() => setActivePage("document-tracking")}
              className="text-xs text-teal-600 hover:text-teal-700 font-medium flex items-center gap-1"
            >
              View all <MdOutlineOpenInNew />
            </button>
          </div>
          <div className="divide-y divide-slate-50">
            {documents.slice(0, 4).map(doc => (
              <div key={doc.id} className="tbl-row px-5 py-3 flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
                  <MdDescription className="text-slate-500 text-sm" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-navy-900 truncate">{doc.title}</p>
                  <p className="text-xs text-slate-400">{doc.trackingNumber} · {doc.dateReceived}</p>
                </div>
                {doc.assignedPersonnel && <PersonnelChip name={doc.assignedPersonnel} size="xs" />}
                <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap ${
                  doc.status === "Completed"  ? "bg-status-greenBg text-status-green" :
                  doc.status === "In Process" ? "bg-status-yellowBg text-status-yellow" :
                  doc.status === "Returned"   ? "bg-status-redBg text-status-red" :
                  "bg-teal-50 text-teal-700"
                }`}>{doc.status}</span>
              </div>
            ))}
            {documents.length === 0 && (
              <div className="px-5 py-8 text-center text-slate-400 text-sm">No documents yet.</div>
            )}
          </div>
        </div>

        {/* Upcoming events */}
        <div className="bg-white rounded-xl border border-slate-100 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-navy-900">Upcoming Events</h3>
              <p className="text-xs text-slate-400">Next scheduled activities</p>
            </div>
            <button
              onClick={() => setActivePage("calendar")}
              className="text-xs text-teal-600 hover:text-teal-700 font-medium flex items-center gap-1"
            >
              View all <MdOutlineOpenInNew />
            </button>
          </div>
          <div className="divide-y divide-slate-50">
            {upcomingEvents.slice(0, 4).map(ev => {
              const d = new Date(ev.date + "T00:00:00");
              return (
                <div key={ev.id} className="tbl-row px-5 py-3 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-navy-900 text-white flex flex-col items-center justify-center shrink-0">
                    <span className="text-[9px] uppercase opacity-70 leading-none">
                      {d.toLocaleDateString("en-US", { month: "short" })}
                    </span>
                    <span className="text-sm font-bold leading-none">
                      {d.toLocaleDateString("en-US", { day: "numeric" })}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-navy-900 truncate">{ev.title}</p>
                    <p className="text-xs text-slate-400">{formatDisplayTime(ev.time)}</p>
                  </div>
                  {Array.isArray(ev.assignedPersonnel) && ev.assignedPersonnel.filter(Boolean).length > 0 && (
                    <div className="hidden sm:flex items-center gap-1 shrink-0">
                      {ev.assignedPersonnel.filter(Boolean).slice(0, 2).map(person => (
                        <PersonnelChip key={person} name={person} size="xs" />
                      ))}
                      {ev.assignedPersonnel.filter(Boolean).length > 2 && (
                        <span className="text-[10px] text-slate-400">+{ev.assignedPersonnel.filter(Boolean).length - 2}</span>
                      )}
                    </div>
                  )}
                  <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap ${
                    ev.type === "Deadline" ? "bg-status-redBg text-status-red" :
                    ev.type === "Meeting"  ? "bg-teal-50 text-teal-700" :
                    ev.type === "Review"   ? "bg-status-yellowBg text-status-yellow" :
                    "bg-navy-50 text-navy-700"
                  }`}>{ev.type}</span>
                </div>
              );
            })}
            {upcomingEvents.length === 0 && (
              <div className="px-5 py-8 text-center text-slate-400 text-sm">No upcoming events.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main Dashboard ──────────────────────────────────────────
export default function Dashboard() {
  const { requirements, events, upcomingEvents, documents, user } = useApp();
  const isAdmin = user?.role === "admin";
  const initialPage = isAdmin ? "dashboard" : "document-tracking";
  const [activePage, setActivePage] = useState(initialPage);

  const viewerPages = ["dashboard", "calendar", "checklist", "monitoring", "document-tracking", "quick-access", "announcements", "tasks"];
  const allowedPages = isAdmin ? Object.keys(PAGE_META) : viewerPages;
  const safeActivePage = allowedPages.includes(activePage) ? activePage : "document-tracking";
  const meta = PAGE_META[safeActivePage] || PAGE_META.dashboard;

  // Render the content panel for the active tab
  function renderTab() {
    switch (safeActivePage) {
      case "dashboard":
        return (
          <DashboardHome
            setActivePage={setActivePage}
            requirements={requirements}
            events={events}
            upcomingEvents={upcomingEvents}
            documents={documents}
            user={user}
          />
        );

      case "calendar":
        return (
          <>
            <SectionHeader icon={MdCalendarToday} title="Schedule & Activities" sub="CBMS calendar · Deadlines · Meetings" />
            <CalendarCard />
          </>
        );

      case "checklist":
        return (
          <>
            <SectionHeader icon={MdChecklist} title="CBMS Data Turnover Requirements" sub="Compliance checklist by office" />
            <ChecklistCard />
          </>
        );

      case "monitoring":
        return (
          <>
            <SectionHeader icon={MdBarChart} title="Monitoring Workspace" sub="Shared folders and live tracking sheets" />
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <FolderDirectory />
              <MonitoringTable />
            </div>
          </>
        );

      case "document-tracking":
        return <DocumentTracking />;

      case "quick-access":
        return (
          <>
            <SectionHeader icon={MdLink} title="Quick Links" sub="Jump straight to the tools you use most" />
            <QuickLinks onNavigate={setActivePage} />
          </>
        );

      case "analytics":
        return (
          <>
            <SectionHeader icon={MdBarChart} title="Compliance Analytics" sub="Provincewide CBMS turnover progress" />
            <Analytics />
          </>
        );

      case "announcements":
        return <Announcements />;

      case "tasks":
        return <TaskPanel />;

      case "personnel":
        return <PersonnelManager />;

      default:
        return null;
    }
  }

  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar active={safeActivePage} setActive={setActivePage} />

      <div className="flex-1 flex flex-col min-w-0">
        <TopBar pageTitle={meta.title} pageDesc={meta.desc} onNavigate={setActivePage} />

        <main className="flex-1 p-6">
          {renderTab()}

          <footer className="border-t border-slate-100 mt-8 pt-6 pb-2 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-400">
            <p>&copy; {new Date().getFullYear()} CBMS Operations Dashboard. All rights reserved.</p>
            <p>Built for the Community-Based Monitoring System · Iloilo City Government</p>
          </footer>
        </main>
      </div>
    </div>
  );
}

function SectionHeader({ icon: Icon, title, sub }) {
  return (
    <div className="flex items-center gap-3 mb-4">
      <span className="flex items-center justify-center w-9 h-9 rounded-lg bg-teal-50 text-teal-700 shrink-0">
        <Icon className="text-lg" />
      </span>
      <div>
        <h2 className="text-base font-semibold text-navy-900">{title}</h2>
        <p className="text-xs text-slate-400">{sub}</p>
      </div>
    </div>
  );
}
