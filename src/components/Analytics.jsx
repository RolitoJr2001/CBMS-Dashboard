import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from "recharts";
import { useApp } from "../context/AppContext";

const COLORS = { Completed: "#1f9d55", Ongoing: "#c79a12", Pending: "#d23c3c", "For Review": "#0e2c4f" };

export default function Analytics() {
  const { requirements } = useApp();
  const total        = requirements.length;
  const completed    = requirements.filter(r => r.status === "Completed").length;
  const ongoing      = requirements.filter(r => r.status === "Ongoing").length;
  const pending      = requirements.filter(r => r.status === "Pending").length;
  const rate         = total ? Math.round((completed / total) * 100) : 0;

  const pieData = [
    { name: "Completed", value: completed },
    { name: "Ongoing",   value: ongoing   },
    { name: "Pending",   value: pending   },
  ].filter(d => d.value > 0);

  const byOffice = requirements.reduce((acc, r) => {
    acc[r.office] = (acc[r.office] || 0) + 1; return acc;
  }, {});
  const barData = Object.entries(byOffice).map(([o, c]) => ({
    office: o.length > 14 ? o.slice(0, 14) + "…" : o, count: c,
  }));

  return (
    <div className="space-y-5">
      {/* Summary row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { l: "Total",       v: total,     c: "bg-navy-50 text-navy-700" },
          { l: "Completed",   v: completed, c: "bg-status-greenBg text-status-green" },
          { l: "Ongoing",     v: ongoing,   c: "bg-status-yellowBg text-status-yellow" },
          { l: "Pending",     v: pending,   c: "bg-status-redBg text-status-red" },
        ].map(s => (
          <div key={s.l} className="bg-white rounded-xl border border-slate-100 p-4">
            <p className="text-2xl font-bold text-navy-900">{s.v}</p>
            <p className="text-xs text-slate-500 mt-0.5">{s.l}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="bg-white rounded-xl border border-slate-100 p-5">
          <p className="text-sm font-semibold text-navy-900 mb-3">Status Distribution</p>
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={pieData} dataKey="value" nameKey="name" innerRadius={52} outerRadius={75} paddingAngle={3}>
                  {pieData.map(e => <Cell key={e.name} fill={COLORS[e.name] || "#94a3b8"} />)}
                </Pie>
                <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex flex-wrap justify-center gap-3 mt-2">
            {pieData.map(d => (
              <div key={d.name} className="flex items-center gap-1.5 text-xs text-slate-600">
                <span className="w-2 h-2 rounded-full" style={{ background: COLORS[d.name] }} />
                {d.name} ({d.value})
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-100 p-5">
          <p className="text-sm font-semibold text-navy-900 mb-3">Requirements by Office</p>
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={barData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="office" tick={{ fontSize: 10, fill: "#94a3b8" }} interval={0} angle={-20} textAnchor="end" height={45} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: "#94a3b8" }} allowDecimals={false} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 12 }} />
                <Bar dataKey="count" fill="#178379" radius={[4, 4, 0, 0]} name="Requirements" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Progress bar */}
      <div className="bg-white rounded-xl border border-slate-100 p-5">
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm font-semibold text-navy-900">Overall Compliance Progress</p>
          <span className="text-sm font-bold text-teal-700">{rate}%</span>
        </div>
        <div className="w-full h-2.5 rounded-full bg-slate-100 overflow-hidden">
          <div className="h-full bg-gradient-to-r from-teal-500 to-teal-600 rounded-full transition-all duration-700" style={{ width: `${rate}%` }} />
        </div>
        <p className="text-xs text-slate-400 mt-1.5">{completed} of {total} requirements completed</p>
      </div>
    </div>
  );
}
