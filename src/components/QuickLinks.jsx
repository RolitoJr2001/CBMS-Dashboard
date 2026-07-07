import { motion } from "framer-motion";
import { quickLinks } from "../data/quickLinks";
import { FaExternalLinkAlt } from "react-icons/fa";
import { useApp } from "../context/AppContext";

export default function QuickLinks() {
  const { user } = useApp();
  const isAdmin = user?.role === "admin";
  const allowedQuickLinks = isAdmin
    ? quickLinks
    : quickLinks.filter(link => ["dashboard", "calendar", "checklist", "monitoring", "announcements"].includes(link.id));
  function handleClick(e, link) {
    if (!link.external && link.href.startsWith("#")) {
      e.preventDefault();
      const el = document.getElementById(link.href.slice(1));
      if (el) el.scrollIntoView({ behavior: "smooth" });
    }
  }
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
      {allowedQuickLinks.map((link, i) => {
        const Icon = link.icon;
        return (
          <motion.a
            key={link.id}
            href={link.href}
            target={link.external ? "_blank" : undefined}
            rel={link.external ? "noopener noreferrer" : undefined}
            onClick={e => handleClick(e, link)}
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.3, delay: i * 0.04 }}
            whileHover={{ y: -3 }}
            className="group bg-white rounded-xl border border-slate-100 p-4 flex flex-col gap-3 hover:shadow-cardHover transition-all cursor-pointer"
          >
            <div className="flex items-center justify-between">
              <span className="flex items-center justify-center w-10 h-10 rounded-lg bg-teal-50 text-teal-700 text-lg group-hover:bg-teal-600 group-hover:text-white transition-colors">
                <Icon />
              </span>
              {link.external && <FaExternalLinkAlt className="text-slate-300 text-xs group-hover:text-teal-500 transition-colors" />}
            </div>
            <div>
              <p className="font-semibold text-navy-900 text-sm">{link.label}</p>
              <p className="text-xs text-slate-400 mt-0.5 leading-snug">{link.description}</p>
            </div>
          </motion.a>
        );
      })}
    </div>
  );
}
