import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { MdLockOutline, MdPerson, MdVpnKey, MdVisibility, MdVisibilityOff } from "react-icons/md";
import { useApp } from "../context/AppContext";
import { sendPasswordReset } from "../services/authService";
import cbmsLogo from "../../Logos/DASMO_OFFICIAL LOGO.png";

const APP_VERSION = "v1.0.0";

export default function Login() {
  const navigate = useNavigate();
  const { login } = useApp();
  const [form, setForm]     = useState({ username: "", password: "" });
  const [error, setError]   = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setSuccess("");
    setLoading(true);
    try {
      await login(form.username.trim(), form.password);
      navigate("/", { replace: true });
    } catch (err) {
      setError(err.message || "Invalid username or password.");
    } finally {
      setLoading(false);
    }
  }

  async function handleForgotPassword() {
    const username = form.username.trim();
    if (!username) {
      setError("Enter your username first.");
      return;
    }

    setError("");
    setSuccess("");
    setResetLoading(true);
    try {
      await sendPasswordReset(username);
      setSuccess("Password reset email sent. Please check your inbox.");
    } catch (err) {
      setError(err.message || "Unable to send reset email.");
    } finally {
      setResetLoading(false);
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
        <h1 className="text-2xl font-semibold text-navy-900">Welcome to CBMS</h1>
        <p className="mt-2 text-sm text-slate-500">
          Enter your CBMS Operations Dashboard credentials to continue.
        </p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <label className="block">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Username</span>
            <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
              <MdPerson className="text-slate-400" />
              <input
                value={form.username}
                onChange={(e) => setForm((prev) => ({ ...prev, username: e.target.value }))}
                className="w-full bg-transparent outline-none text-sm text-navy-900"
                placeholder=""
                autoComplete="username"
                disabled={loading}
              />
            </div>
          </label>

          <label className="block">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Password</span>
            <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
              <MdVpnKey className="text-slate-400" />
              <input
                type={showPassword ? "text" : "password"}
                value={form.password}
                onChange={(e) => setForm((prev) => ({ ...prev, password: e.target.value }))}
                className="w-full bg-transparent outline-none text-sm text-navy-900"
                placeholder=""
                autoComplete="current-password"
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

          {error && <p className="text-sm text-red-500">{error}</p>}
          {success && <p className="text-sm text-teal-600">{success}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-teal-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-teal-700 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                Signing in…
              </>
            ) : "Sign in"}
          </button>
        </form>

        <div className="mt-4 text-center">
          <button
            type="button"
            onClick={handleForgotPassword}
            disabled={resetLoading}
            className="text-sm font-medium text-teal-600 hover:text-teal-700 disabled:opacity-60"
          >
            {resetLoading ? "Sending..." : "Forgot password?"}
          </button>
        </div>

        <div className="mt-6 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">
          <p className="font-semibold text-navy-900">Need access?</p>
          <p className="mt-1 text-xs text-slate-500">
            Contact your DASMO-CBMS administrator to create your account in the dashboard.
          </p>
        </div>
      </div>
      {/* Version - Bottom Right */}
      <div className="fixed bottom-4 right-4 text-right select-none">
        <p className="text-[11px] text-slate-300">
          CBMS Dashboard {APP_VERSION}
        </p>
      </div>
    </div>
  );
}
