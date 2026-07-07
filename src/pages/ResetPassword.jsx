import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { MdLockOutline, MdVpnKey, MdVisibility, MdVisibilityOff } from "react-icons/md";
import { supabase } from "../lib/supabase";
import cbmsLogo from "../../Logos/DASMO_OFFICIAL LOGO.png";

export default function ResetPassword() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  async function handleReset(e) {
    e.preventDefault();
    setMessage("");
    setLoading(true);

    try {
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) {
        setMessage(updateError.message || "Unable to update your password.");
        return;
      }

      await supabase.auth.signOut({ scope: "global" });
      await supabase.auth.getSession();

      setMessage("Password updated successfully. Please sign in again.");
      setPassword("");
      navigate("/login", { replace: true });
    } catch (err) {
      setMessage(err.message || "Unable to update your password.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-card">
        <div className="flex items-center justify-center mb-4">
          <img
            src={cbmsLogo}
            alt="DASMO CBMS logo"
            className="w-24 h-24 sm:w-28 sm:h-25 object-contain rounded-xl bg-white"
          />
        </div>

        <h1 className="text-2xl font-semibold text-navy-900">Reset Password</h1>
        <p className="mt-2 text-sm text-slate-500">
          Enter a new password to continue accessing the CBMS Operations Dashboard.
        </p>

        <form onSubmit={handleReset} className="mt-6 space-y-4">
          <label className="block">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">New Password</span>
            <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
              <MdVpnKey className="text-slate-400" />
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-transparent outline-none text-sm text-navy-900"
                placeholder="Enter new password"
                autoComplete="new-password"
                disabled={loading}
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                className="text-slate-400 hover:text-slate-600"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <MdVisibilityOff /> : <MdVisibility />}
              </button>
            </div>
          </label>

          {message && (
            <p className={`text-sm ${message.includes("success") ? "text-teal-600" : "text-red-500"}`}>
              {message}
            </p>
          )}

          <button
            type="submit"
            disabled={loading || !password.trim()}
            className="w-full rounded-lg bg-teal-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-teal-700 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                Updating…
              </>
            ) : "Update Password"}
          </button>
        </form>

        <div className="mt-6 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">
          <p className="font-semibold text-navy-900">Need help?</p>
          <p className="mt-1 text-xs text-slate-500">
            If you are still having trouble signing in, contact the DASMO-CBMS administrator.
          </p>
        </div>
      </div>
    </div>
  );
}