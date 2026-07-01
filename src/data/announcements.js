// Notice board announcements
export const announcements = [
  {
    id: 1,
    title: "Deadline for Data Turnover",
    date: "2026-06-30",
    category: "Deadline",
    priority: "High",
    excerpt:
      "All municipal offices must submit finalized CBMS turnover documents on or before June 30, 2026.",
  },
  {
    id: 2,
    title: "New Monitoring Sheet Uploaded",
    date: "2026-06-21",
    category: "Update",
    priority: "Normal",
    excerpt:
      "The 2026 Division Monitoring Sheet has been refreshed with the latest submission status from all municipalities.",
  },
  {
    id: 3,
    title: "Privacy Assessment Reminder",
    date: "2026-06-19",
    category: "Compliance",
    priority: "High",
    excerpt:
      "Offices with pending Privacy Impact Assessment items are reminded to coordinate with the Data Protection Office this week.",
  },
  {
    id: 4,
    title: "Upcoming Coordination Meeting",
    date: "2026-06-25",
    category: "Meeting",
    priority: "Normal",
    excerpt:
      "Provincial and municipal focal persons will convene to align on Q3 turnover targets and GIS mapping progress.",
  },
];

export const priorityColors = {
  High: { text: "text-status-red", bg: "bg-status-redBg" },
  Normal: { text: "text-teal-700", bg: "bg-teal-50" },
  Low: { text: "text-navy-700", bg: "bg-slate-100" },
};
