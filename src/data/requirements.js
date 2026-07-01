// CBMS Data Turnover Requirements Checklist
// Status values: "Completed" | "Ongoing" | "Pending"

export const requirements = [
  {
    id: 1,
    status: "Completed",
    requirement: "Designation Order of Data Protection Officer",
    office: "Provincial Statistics Office",
    dueDate: "2026-01-15",
  },
  {
    id: 2,
    status: "Completed",
    requirement: "Designation Order of Provincial Statistician",
    office: "Office of the Governor",
    dueDate: "2026-01-20",
  },
  {
    id: 3,
    status: "Ongoing",
    requirement: "Privacy Impact Assessment",
    office: "Data Protection Office",
    dueDate: "2026-07-10",
  },
  {
    id: 4,
    status: "Pending",
    requirement: "NPC Registration",
    office: "Data Protection Office",
    dueDate: "2026-07-31",
  },
  {
    id: 5,
    status: "Completed",
    requirement: "CBMS Database Backup and Encryption Certificate",
    office: "ICT Division",
    dueDate: "2026-02-05",
  },
  {
    id: 6,
    status: "Ongoing",
    requirement: "Municipal Turnover Acceptance Forms (1st Batch)",
    office: "Municipal Planning Offices",
    dueDate: "2026-06-28",
  },
  {
    id: 7,
    status: "Pending",
    requirement: "Data Sharing Agreement with PSA",
    office: "Provincial Statistics Office",
    dueDate: "2026-08-15",
  },
  {
    id: 8,
    status: "Completed",
    requirement: "CBMS Enumerator Training Completion Report",
    office: "CBMS Field Operations",
    dueDate: "2026-01-30",
  },
  {
    id: 9,
    status: "Ongoing",
    requirement: "Data Validation and Cleaning Report",
    office: "ICT Division",
    dueDate: "2026-07-05",
  },
  {
    id: 10,
    status: "Pending",
    requirement: "Geo-tagging and GIS Mapping Submission",
    office: "GIS Unit",
    dueDate: "2026-08-01",
  },
];

export const statusColors = {
  Completed: { text: "text-status-green", bg: "bg-status-greenBg", dot: "bg-status-green" },
  Ongoing: { text: "text-status-yellow", bg: "bg-status-yellowBg", dot: "bg-status-yellow" },
  Pending: { text: "text-status-red", bg: "bg-status-redBg", dot: "bg-status-red" },
};

// Extended status colors (added For Review / Returned)
export const extendedStatusColors = {
  ...statusColors,
  "For Review": { text: "text-navy-700", bg: "bg-navy-50",           dot: "bg-navy-600" },
  "Returned":   { text: "text-status-red", bg: "bg-status-redBg",    dot: "bg-status-red" },
};
