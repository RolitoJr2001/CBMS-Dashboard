import { FaExternalLinkAlt, FaDownload } from "react-icons/fa";
import { monitoringSheets } from "../data/folders";

const statusStyles = {
  Active: "bg-status-greenBg text-status-green",
  Updated: "bg-teal-50 text-teal-700",
  "Needs Review": "bg-status-yellowBg text-status-yellow",
};

export default function MonitoringTable() {
  return (
    <div className="bg-white rounded-xl border border-slate-100 overflow-hidden flex flex-col h-full">
      <div className="flex-1 overflow-y-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-slate-400 uppercase tracking-wide border-b border-slate-100 sticky top-0 bg-slate-50">
              <th className="py-2.5 px-5 font-medium">Sheet Name</th>
              <th className="py-2.5 px-3 font-medium hidden sm:table-cell">Status</th>
              <th className="py-2.5 px-5 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {monitoringSheets.map(sheet => (
              <tr key={sheet.id} className="tbl-row">
                <td className="py-2.5 px-5">
                  <p className="font-medium text-navy-900 text-sm">{sheet.name}</p>
                  <p className="text-xs text-slate-400">{sheet.type}</p>
                </td>
                <td className="py-2.5 px-3 hidden sm:table-cell">
                  <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${statusStyles[sheet.status] || "bg-slate-100 text-slate-600"}`}>
                    {sheet.status}
                  </span>
                </td>
                <td className="py-2.5 px-5">
                  <div className="flex items-center justify-end gap-2">
                    <a href={sheet.link} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-1 text-xs font-medium px-2.5 py-1.5 rounded-lg bg-navy-900 text-white hover:bg-navy-800 transition-colors">
                      <FaExternalLinkAlt className="text-[10px]" /> Open
                    </a>
                    <a href={sheet.link} download
                      className="flex items-center gap-1 text-xs font-medium px-2.5 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors">
                      <FaDownload className="text-[10px]" /> DL
                    </a>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
