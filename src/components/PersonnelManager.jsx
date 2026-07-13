import { useEffect, useMemo, useState } from "react";
import { MdGroup, MdAdd, MdDelete, MdEdit, MdCheck, MdClose, MdLink, MdLinkOff, MdRefresh } from "react-icons/md";
import { fetchProfiles } from "../services/authService";
import PersonnelChip from "./PersonnelChip";
import ColorPicker from "./ColorPicker";
import { useApp } from "../context/AppContext";
import {
  fetchPersonnel,
  insertPersonnel,
  updatePersonnel,
  removePersonnel,
} from "../services/personnelService";

function normalize(value) {
  return String(value || "").trim().toLowerCase();
}

// A profile counts as "linked" to a personnel row when the personnel
// name exactly matches (case-insensitive) that profile's name or
// username — the same rule AppContext uses to route assignment
// notifications. Keeping this identical here is what makes the panel
// a reliable preview of whether notifications will actually arrive.
function findLinkedPersonnel(profile, personnelList) {
  const values = [profile?.name, profile?.username].map(normalize).filter(Boolean);
  if (!values.length) return null;
  return personnelList.find(p => values.includes(normalize(p.name))) || null;
}

export default function PersonnelManager() {
  const { updatePersonnelColor } = useApp();
  const [profiles, setProfiles] = useState([]);
  const [personnel, setPersonnel] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState(null);

  const [customName, setCustomName] = useState("");
  const [addingCustom, setAddingCustom] = useState(false);
  const [customErr, setCustomErr] = useState("");

  const [editId, setEditId] = useState(null);
  const [editValue, setEditValue] = useState("");
  const [editErr, setEditErr] = useState("");

  async function loadAll() {
    setLoading(true);
    setError("");
    try {
      const [profileRows, personnelRows] = await Promise.all([fetchProfiles(), fetchPersonnel()]);
      setProfiles(profileRows || []);
      setPersonnel(personnelRows || []);
    } catch (err) {
      setError(err.message || "Failed to load personnel data.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadAll(); }, []);

  const viewerProfiles = useMemo(
    () => (profiles || []).filter(p => String(p.role || "viewer").toLowerCase() !== "admin"),
    [profiles]
  );

  const unlinkedPersonnel = useMemo(() => {
    const linkedIds = new Set(
      viewerProfiles
        .map(p => findLinkedPersonnel(p, personnel)?.id)
        .filter(Boolean)
    );
    return (personnel || []).filter(p => !linkedIds.has(p.id));
  }, [personnel, viewerProfiles]);

  async function handleLink(profile) {
    const name = (profile.name || profile.username || "").trim();
    if (!name) return;
    setBusyId(`link-${profile.id}`);
    setError("");
    try {
      const created = await insertPersonnel({ name });
      setPersonnel(prev => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)));
    } catch (err) {
      setError(err.message?.includes("duplicate") ? `"${name}" is already in the personnel list.` : (err.message || "Failed to link personnel."));
    } finally {
      setBusyId(null);
    }
  }

  async function handleUnlink(personnelRow) {
    if (!window.confirm(`Remove "${personnelRow.name}" from the assignable personnel list? They'll no longer be selectable in Tasks, Document Tracking, or Schedule & Events, and won't receive assignment notifications.`)) return;
    setBusyId(`unlink-${personnelRow.id}`);
    setError("");
    try {
      await removePersonnel(personnelRow.id);
      setPersonnel(prev => prev.filter(p => p.id !== personnelRow.id));
    } catch (err) {
      setError(err.message || "Failed to remove personnel.");
    } finally {
      setBusyId(null);
    }
  }

  async function handleAddCustom() {
    const name = customName.trim();
    if (!name) {
      setCustomErr("Enter a name first.");
      return;
    }
    setAddingCustom(true);
    setCustomErr("");
    try {
      const created = await insertPersonnel({ name });
      setPersonnel(prev => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)));
      setCustomName("");
    } catch (err) {
      setCustomErr(err.message?.includes("duplicate") ? `"${name}" is already in the personnel list.` : (err.message || "Failed to add personnel."));
    } finally {
      setAddingCustom(false);
    }
  }

  async function handleColorChange(personnelRow, hex) {
    const updated = await updatePersonnelColor(personnelRow.id, hex);
    setPersonnel(prev => prev.map(p => p.id === personnelRow.id ? updated : p));
  }

  function startEdit(personnelRow) {
    setEditId(personnelRow.id);
    setEditValue(personnelRow.name);
    setEditErr("");
  }

  async function submitEdit(personnelRow) {
    const name = editValue.trim();
    if (!name) {
      setEditErr("Name can't be empty.");
      return;
    }
    setBusyId(`edit-${personnelRow.id}`);
    setEditErr("");
    try {
      const updated = await updatePersonnel(personnelRow.id, name);
      setPersonnel(prev => prev.map(p => p.id === personnelRow.id ? updated : p).sort((a, b) => a.name.localeCompare(b.name)));
      setEditId(null);
    } catch (err) {
      setEditErr(err.message?.includes("duplicate") ? `"${name}" is already in the personnel list.` : (err.message || "Failed to rename."));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl border border-slate-100 p-5">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2.5">
            <span className="flex items-center justify-center w-9 h-9 rounded-lg bg-teal-50 text-teal-700">
              <MdGroup />
            </span>
            <div>
              <h3 className="text-sm font-semibold text-navy-900">Viewer Accounts</h3>
              <p className="text-xs text-slate-500">Link each account so they show up in the "Assign To" pickers and receive assignment notifications.</p>
            </div>
          </div>
          <button
            onClick={loadAll}
            disabled={loading}
            className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-60"
          >
            <MdRefresh className={loading ? "animate-spin" : ""} /> Refresh
          </button>
        </div>

        {error && (
          <div className="mt-4 rounded-lg border border-status-red/20 bg-status-redBg px-3 py-2 text-xs text-status-red">
            {error}
          </div>
        )}

        <div className="mt-4 space-y-2">
          {loading ? (
            <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">Loading accounts…</div>
          ) : viewerProfiles.length === 0 ? (
            <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
              No viewer accounts found. Create them first in Supabase Authentication → Users, then refresh.
            </div>
          ) : viewerProfiles.map(profile => {
            const linked = findLinkedPersonnel(profile, personnel);
            const isBusy = busyId === `link-${profile.id}` || busyId === `unlink-${linked?.id}`;
            return (
              <div key={profile.id} className="flex items-center justify-between gap-3 rounded-lg border border-slate-100 px-4 py-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-navy-900 truncate">{profile.name || "(no name set)"}</p>
                  <p className="text-xs text-slate-400 truncate">@{profile.username || "unknown"}</p>
                  <div className="mt-1.5"><PersonnelChip name={profile.name || profile.username} role={profile.role} size="xs" /></div>
                </div>
                {linked ? (
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2.5 py-1 rounded-full bg-status-greenBg text-status-green">
                      <MdLink className="text-sm" /> Linked as "{linked.name}"
                    </span>
                    <ColorPicker
                      value={linked.color}
                      onChange={(hex) => handleColorChange(linked, hex)}
                    />
                    <button
                      onClick={() => handleUnlink(linked)}
                      disabled={isBusy}
                      className="inline-flex items-center justify-center rounded-full p-2 text-status-red hover:bg-status-red/10 transition-colors disabled:opacity-60"
                      aria-label={`Unlink ${profile.name}`}
                      title="Remove from personnel list"
                    >
                      <MdLinkOff className="text-base" />
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => handleLink(profile)}
                    disabled={isBusy}
                    className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg bg-navy-900 text-white hover:bg-navy-800 disabled:opacity-60 shrink-0"
                  >
                    <MdAdd /> {isBusy ? "Adding…" : "Add to Personnel"}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-100 p-5">
        <div className="flex items-center gap-2.5">
          <span className="flex items-center justify-center w-9 h-9 rounded-lg bg-teal-50 text-teal-700">
            <MdEdit />
          </span>
          <div>
            <h3 className="text-sm font-semibold text-navy-900">Other Personnel</h3>
            <p className="text-xs text-slate-500">Names without a dashboard login yet. They can be assigned but won't get in-app notifications.</p>
          </div>
        </div>

        <div className="mt-4 flex gap-2">
          <input
            value={customName}
            onChange={e => { setCustomName(e.target.value); setCustomErr(""); }}
            placeholder="e.g. Field Staff Name"
            className="flex-1 px-4 py-2.5 text-sm rounded-2xl border border-slate-200 outline-none focus:border-teal-400 bg-white shadow-sm"
          />
          <button
            onClick={handleAddCustom}
            disabled={addingCustom}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-2xl bg-teal-600 text-white hover:bg-teal-700 transition-colors shadow-sm disabled:opacity-60 text-sm font-medium"
          >
            <MdAdd /> Add
          </button>
        </div>
        {customErr && <p className="mt-1.5 text-xs text-status-red">{customErr}</p>}

        <div className="mt-4 space-y-2">
          {unlinkedPersonnel.length === 0 ? (
            <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
              No unlinked personnel — every entry is tied to a viewer account.
            </div>
          ) : unlinkedPersonnel.map(p => (
            <div key={p.id} className="flex items-center justify-between gap-3 rounded-lg border border-slate-100 px-4 py-3">
              {editId === p.id ? (
                <div className="flex-1 flex items-center gap-2">
                  <input
                    autoFocus
                    value={editValue}
                    onChange={e => setEditValue(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter") submitEdit(p); if (e.key === "Escape") setEditId(null); }}
                    className="flex-1 px-3 py-1.5 text-sm rounded-lg border border-slate-200 outline-none focus:border-teal-400"
                  />
                  <button onClick={() => submitEdit(p)} disabled={busyId === `edit-${p.id}`} className="inline-flex items-center justify-center rounded-full p-1.5 text-status-green hover:bg-status-greenBg transition-colors"><MdCheck /></button>
                  <button onClick={() => setEditId(null)} className="inline-flex items-center justify-center rounded-full p-1.5 text-slate-500 hover:bg-slate-100 transition-colors"><MdClose /></button>
                </div>
              ) : (
                <>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-navy-900 truncate">{p.name}</p>
                    <div className="mt-1 mb-1"><PersonnelChip name={p.name} size="xs" /></div>
                    <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-400">
                      <MdLinkOff className="text-sm" /> No linked account — notifications won't reach this name
                    </span>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <ColorPicker
                      value={p.color}
                      onChange={(hex) => handleColorChange(p, hex)}
                    />
                    <button
                      onClick={() => startEdit(p)}
                      className="inline-flex items-center justify-center rounded-full p-2 bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors"
                      aria-label={`Rename ${p.name}`}
                    >
                      <MdEdit className="text-base" />
                    </button>
                    <button
                      onClick={() => handleUnlink(p)}
                      disabled={busyId === `unlink-${p.id}`}
                      className="inline-flex items-center justify-center rounded-full p-2 text-status-red hover:bg-status-red/10 transition-colors disabled:opacity-60"
                      aria-label={`Delete ${p.name}`}
                    >
                      <MdDelete className="text-base" />
                    </button>
                  </div>
                </>
              )}
            </div>
          ))}
          {editErr && <p className="text-xs text-status-red">{editErr}</p>}
        </div>
      </div>
    </div>
  );
}
