import { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { FaSearch, FaUserCircle, FaBars, FaTimes } from "react-icons/fa";
import { MdShield } from "react-icons/md";
import { useApp } from "../context/AppContext";

const navItems = [
  { label: "Home",                 anchor: null },
  { label: "CBMS Links",           anchor: "quick-access" },
  { label: "Monitoring Dashboard", anchor: "monitoring" },
  { label: "Document Tracking",    anchor: "document-tracking" },
  { label: "Reports",              anchor: "analytics" },
];

function scrollTo(anchor) {
  if (!anchor) { window.scrollTo({ top: 0, behavior: "smooth" }); return; }
  const el = document.getElementById(anchor);
  if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
}

export default function Navbar() {
  const [scrolled, setScrolled]       = useState(false);
  const [open, setOpen]               = useState(false);
  const [searchOpen, setSearchOpen]   = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const searchRef = useRef(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (searchOpen) setTimeout(() => searchRef.current?.focus(), 50);
  }, [searchOpen]);

  const { user } = useApp();
  const isAdmin = user?.role === "admin";

  function handleSearch(e) {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    const q = searchQuery.toLowerCase();
    const sectionMap = {
      calendar: null, schedule: null, activities: null,
      checklist: "checklist", requirements: "checklist", compliance: "checklist", turnover: "checklist",
      monitoring: "monitoring", sheets: "monitoring", folders: null,
      document: "document-tracking", tracking: "document-tracking", incoming: "document-tracking", outgoing: "document-tracking",
      analytics: "analytics", reports: "analytics",
      announcements: "announcements",
      links: "quick-access", access:  "quick-access",
    };
    if (!isAdmin) {
      delete sectionMap.links;
      delete sectionMap.access;
    }
    const match = Object.entries(sectionMap).find(([key]) => q.includes(key));
    if (match) scrollTo(match[1]);
    setSearchOpen(false);
    setSearchQuery("");
  }

  return (
    <header className={`fixed top-0 left-0 right-0 z-50 transition-shadow ${scrolled ? "shadow-lg" : "shadow-none"}`}>
      <div className="bg-navy-900 border-b border-navy-700/60">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-3">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-3 group shrink-0" onClick={() => scrollTo(null)}>
            <span className="flex items-center justify-center w-10 h-10 rounded-full bg-teal-600/20 ring-1 ring-teal-500/40 group-hover:ring-teal-400 transition-colors">
              <MdShield className="text-teal-400 text-xl" />
            </span>
            <div className="leading-tight">
              <p className="text-white font-display font-700 text-base sm:text-lg tracking-wide">
                CBMS Operations Dashboard
              </p>
              <p className="text-[11px] text-teal-300/80 uppercase tracking-[0.15em] hidden sm:block">
                Community-Based Monitoring System
              </p>
            </div>
          </Link>

          {/* Desktop nav */}
          <nav className="hidden lg:flex items-center gap-1">
            {navItems.map((item) => (
              <button
                key={item.label}
                onClick={() => scrollTo(item.anchor)}
                className="px-3 py-2 text-sm font-medium text-slate-200 hover:text-white hover:bg-white/5 rounded-md transition-colors"
              >
                {item.label}
              </button>
            ))}

            {/* Search */}
            <div className="relative ml-2">
              {searchOpen ? (
                <form onSubmit={handleSearch} className="flex items-center gap-1">
                  <input
                    ref={searchRef}
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    placeholder="Search section..."
                    className="w-40 px-3 py-1.5 text-sm rounded-md bg-white/10 text-white placeholder-slate-400 border border-white/20 outline-none focus:bg-white/15"
                    onKeyDown={e => e.key === "Escape" && setSearchOpen(false)}
                  />
                  <button type="submit" className="p-2 rounded-md text-slate-200 hover:text-white hover:bg-white/5">
                    <FaSearch />
                  </button>
                  <button type="button" onClick={() => setSearchOpen(false)} className="p-2 rounded-md text-slate-200 hover:text-white hover:bg-white/5">
                    <FaTimes />
                  </button>
                </form>
              ) : (
                <button
                  aria-label="Search"
                  onClick={() => setSearchOpen(true)}
                  className="p-2 rounded-md text-slate-200 hover:text-white hover:bg-white/5 transition-colors"
                >
                  <FaSearch />
                </button>
              )}
            </div>

            <button
              aria-label="User profile"
              className="ml-1 p-2 rounded-md text-slate-200 hover:text-white hover:bg-white/5 transition-colors"
              onClick={() => alert("User profile: Provincial Statistics Office\nRole: CBMS Operator")}
            >
              <FaUserCircle className="text-xl" />
            </button>
          </nav>

          {/* Mobile toggle */}
          <button
            className="lg:hidden p-2 text-slate-200"
            onClick={() => setOpen((v) => !v)}
            aria-label="Toggle navigation menu"
          >
            {open ? <FaTimes className="text-xl" /> : <FaBars className="text-xl" />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {open && (
        <div className="lg:hidden bg-navy-900 border-b border-navy-700/60 px-4 pb-4 pt-2">
          <nav className="flex flex-col gap-1">
            {navItems.map((item) => (
              <button
                key={item.label}
                onClick={() => { scrollTo(item.anchor); setOpen(false); }}
                className="text-left px-3 py-2.5 text-sm font-medium text-slate-200 hover:text-white hover:bg-white/5 rounded-md transition-colors"
              >
                {item.label}
              </button>
            ))}
            <form onSubmit={handleSearch} className="flex items-center gap-2 px-3 pt-2">
              <FaSearch className="text-slate-300 shrink-0" />
              <input
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search section..."
                className="flex-1 bg-transparent text-sm text-white placeholder-slate-400 outline-none"
              />
              <button type="submit" className="text-xs text-teal-300">Go</button>
            </form>
            <button
              className="flex items-center gap-3 px-3 pt-2 text-slate-300"
              onClick={() => { alert("User profile: Provincial Statistics Office\nRole: CBMS Operator"); setOpen(false); }}
            >
              <FaUserCircle className="text-lg" />
              <span className="text-sm">Profile</span>
            </button>
          </nav>
        </div>
      )}
    </header>
  );
}
