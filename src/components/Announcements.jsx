import { FaRegCalendarAlt } from "react-icons/fa";
import { useApp } from "../context/AppContext";
import { priorityColors } from "../data/announcements";

function formatDate(s) {
  return new Date(s + "T00:00:00").toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

export default function Announcements() {
  const { upcomingEvents } = useApp();

  const announcements = upcomingEvents.slice(0, 6).map(ev => ({
    id: `cal-${ev.id}`,
    title: ev.title,
    date: ev.date,
    category: ev.type,
    priority: ev.type === "Deadline" ? "High" : "Normal",
    excerpt: ev.description || `Scheduled on ${formatDate(ev.date)} at ${ev.time}.`,
    source: "Schedule & Events",
  }));

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {announcements.length === 0 ? (
        <div className="md:col-span-2 rounded-xl border border-dashed border-slate-200 bg-slate-50 px-6 py-8 text-center text-sm text-slate-500">
          No backend announcements available yet.
        </div>
      ) : (
        announcements.map(a => {
          const pc = priorityColors[a.priority] || priorityColors.Normal;
          return (
            <div
              key={a.id}
              className="bg-white rounded-xl border border-teal-100 p-5 flex flex-col gap-2 hover:shadow-cardHover transition-shadow"
            >
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-teal-700 bg-teal-50 px-2.5 py-1 rounded-full">
                    {a.category}
                  </span>
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-600 bg-slate-100 px-2 py-0.5 rounded-full">
                    {a.source}
                  </span>
                </div>
                <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${pc.bg} ${pc.text}`}>
                  {a.priority}
                </span>
              </div>
              <p className="font-semibold text-navy-900 text-sm">{a.title}</p>
              <p className="text-xs text-slate-500 leading-relaxed">{a.excerpt}</p>
              <div className="flex items-center gap-1.5 text-xs text-slate-400 mt-auto pt-1">
                <FaRegCalendarAlt className="shrink-0" />
                {formatDate(a.date)}
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}
