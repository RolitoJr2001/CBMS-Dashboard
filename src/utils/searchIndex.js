/**
 * Build a searchable index from all app data
 * Returns an array of searchable items with metadata for navigation
 */
export function buildSearchIndex(appData) {
  const items = [];

  // Extract data from appData
  const {
    tasks = [],
    documents = [],
    events = [],
    requirements = [],
    announcements = [],
    quickLinks = [],
    personnel = [],
    notifications = [],
  } = appData;

  // Tasks
  tasks.forEach(task => {
    if (!task?.id) return;
    items.push({
      id: `task-${task.id}`,
      type: "task",
      title: task.title || "",
      description: task.description || "",
      subtitle: `Task${task.status ? ` • ${task.status}` : ""}`,
      searchText: `${task.title || ""} ${task.description || ""} ${task.status || ""} ${(task.assignedTo || []).join(" ")}`.toLowerCase(),
      metadata: { taskId: task.id },
      icon: "📋",
    });
  });

  // Documents
  documents.forEach(doc => {
    if (!doc?.id) return;
    items.push({
      id: `document-${doc.id}`,
      type: "document",
      title: doc.title || "",
      description: `${doc.trackingNumber || ""} • ${doc.currentOffice || ""}`,
      subtitle: `Document${doc.status ? ` • ${doc.status}` : ""}`,
      searchText: `${doc.title || ""} ${doc.trackingNumber || ""} ${doc.currentOffice || ""} ${doc.status || ""} ${doc.description || ""}`.toLowerCase(),
      metadata: { documentId: doc.id },
      icon: "📄",
    });
  });

  // Events
  events.forEach(event => {
    if (!event?.id) return;
    items.push({
      id: `event-${event.id}`,
      type: "event",
      title: event.title || "",
      description: `${event.date || ""} • ${event.time || ""}`,
      subtitle: "Calendar Event",
      searchText: `${event.title || ""} ${event.date || ""} ${event.time || ""} ${event.description || ""} ${(event.assignedPersonnel || []).join(" ")}`.toLowerCase(),
      metadata: { eventId: event.id },
      icon: "📅",
    });
  });

  // Requirements
  requirements.forEach(req => {
    if (!req?.id) return;
    items.push({
      id: `requirement-${req.id}`,
      type: "requirement",
      title: req.requirement || "",
      description: req.office || "",
      subtitle: `Requirement${req.status ? ` • ${req.status}` : ""}`,
      searchText: `${req.requirement || ""} ${req.office || ""} ${req.status || ""} ${(req.assignedTo || []).join(" ")}`.toLowerCase(),
      metadata: { requirementId: req.id },
      icon: "✓",
    });
  });

  // Personnel
  personnel.forEach(person => {
    if (!person?.id) return;
    items.push({
      id: `personnel-${person.id}`,
      type: "personnel",
      title: person.name || "",
      description: person.color ? `Color: ${person.color}` : "Personnel",
      subtitle: "Personnel",
      searchText: `${person.name || ""}`.toLowerCase(),
      metadata: { personnelId: person.id },
      icon: "👤",
    });
  });

  // Quick Links
  quickLinks.forEach((link, idx) => {
    if (!link?.label) return;
    items.push({
      id: `quicklink-${idx}`,
      type: "quicklink",
      title: link.label || "",
      description: link.url || "",
      subtitle: "Quick Link",
      searchText: `${link.label || ""} ${link.description || ""}`.toLowerCase(),
      metadata: { page: link.page },
      icon: "🔗",
    });
  });

  // Notifications
  notifications.slice(0, 20).forEach(notif => {
    if (!notif?.id) return;
    items.push({
      id: `notification-${notif.id}`,
      type: "notification",
      title: notif.title || "",
      description: notif.message || "",
      subtitle: `Notification${notif.type ? ` • ${notif.type}` : ""}`,
      searchText: `${notif.title || ""} ${notif.message || ""} ${notif.type || ""}`.toLowerCase(),
      metadata: { notificationId: notif.id },
      icon: "🔔",
    });
  });

  return items;
}

/**
 * Search the index and return matching results
 * Supports partial word matching and case-insensitive search
 */
export function searchIndex(query, items, limit = 15) {
  if (!query || !query.trim()) return [];

  const searchTerm = query.toLowerCase().trim();
  const results = [];

  items.forEach(item => {
    let relevance = 0;

    // Exact title match gets highest relevance
    if (item.title.toLowerCase() === searchTerm) {
      relevance = 1000;
    }
    // Title starts with search term
    else if (item.title.toLowerCase().startsWith(searchTerm)) {
      relevance = 500;
    }
    // Title contains search term
    else if (item.title.toLowerCase().includes(searchTerm)) {
      relevance = 300;
    }
    // Search text contains term (full field search)
    else if (item.searchText.includes(searchTerm)) {
      relevance = 100;
    }
    // Partial word matching: "bud" matches "Budget"
    else if (matchPartialWords(item.searchText, searchTerm)) {
      relevance = 50;
    }

    if (relevance > 0) {
      results.push({ ...item, relevance });
    }
  });

  // Sort by relevance (descending)
  results.sort((a, b) => b.relevance - a.relevance);

  // Return top N results
  return results.slice(0, limit);
}

/**
 * Match partial words: "sched" matches "schedule"
 */
function matchPartialWords(text, query) {
  const words = text.split(/\s+/);
  return words.some(word => word.startsWith(query));
}

/**
 * Highlight matching text in a string
 * Returns the matching word/phrase, not the entire string
 */
export function getMatchingPhrase(text, query) {
  if (!text || !query) return text;
  const regex = new RegExp(`\\b\\w*${query}\\w*\\b`, "gi");
  const match = text.match(regex);
  return match ? match[0] : text.substring(0, 40);
}
