import { supabase } from "../lib/supabase";

// ─── Sign in with username + password ─────────────────────────
// The login screen only ever collects a username (never an email).
// We resolve that username to its internal synthetic email via the
// get_email_for_username() RPC, then authenticate normally through
// Supabase Auth. No credentials are hardcoded anywhere in this file.
export async function signIn(username, password) {
  if (!username || !password) {
    throw new Error("Username and password are required.");
  }

  const { data: email, error: lookupError } = await supabase.rpc(
    "get_email_for_username",
    { p_username: username.trim().toLowerCase() }
  );

  if (lookupError || !email) {
    // Same generic message whether the username doesn't exist or the
    // lookup failed — never reveal which usernames are valid.
    throw new Error("Invalid username or password.");
  }

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    throw new Error("Invalid username or password.");
  }
  return data;
}

// ─── Sign out ────────────────────────────────────────────────
export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

// ─── Get current session ─────────────────────────────────────
export async function getSession() {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  return data.session;
}

// ─── Get all profiles for assignee dropdowns ─────────────────
export async function fetchProfiles() {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, name, username")
    .order("name", { ascending: true });
  if (error) throw error;
  return data || [];
}

// ─── Get full profile for a user id ──────────────────────────
export async function getProfile(userId) {
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .single();
  if (error) throw error;
  return data;
}

export async function getEffectiveProfile(userId, sessionUser = null) {
  let profile = null;

  try {
    profile = await getProfile(userId);
  } catch {
    profile = null;
  }

  const explicitRole = sessionUser?.user_metadata?.role || sessionUser?.app_metadata?.role || profile?.role || "viewer";
  const normalizedRole = String(explicitRole).trim().toLowerCase();

  if (profile && normalizedRole && profile.role !== normalizedRole) {
    try {
      await updateProfile(userId, { role: normalizedRole });
    } catch {
      // Ignore update failures and continue using the resolved role.
    }
  }

  return { ...(profile || {}), role: normalizedRole };
}

// ─── Update profile ──────────────────────────────────────────
export async function updateProfile(userId, changes) {
  const { data, error } = await supabase
    .from("profiles")
    .update(changes)
    .eq("id", userId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

// ─── Listen for auth state changes ───────────────────────────
export function onAuthChange(callback) {
  const { data } = supabase.auth.onAuthStateChange((_event, session) => {
    callback(session);
  });
  return data.subscription;
}

function isSyntheticInternalEmail(email) {
  if (!email) return false;
  const normalized = String(email).trim().toLowerCase();
  return normalized.endsWith(".local") || normalized.includes("cbms.local") || normalized.includes("username.cbms");
}

// ─── Password reset (username-based wrapper) ───────────────────
// This dashboard uses Supabase Auth accounts whose email addresses are
// synthetic/internal values. Because of that, standard password-reset
// emails are not a reliable delivery path for end users, so the app
// now surfaces a clear fallback message and points users to the admin.
export async function sendPasswordReset(username) {
  const normalizedUsername = username?.trim().toLowerCase();
  if (!normalizedUsername) {
    throw new Error("Username is required.");
  }

  const { data: email, error: lookupError } = await supabase.rpc(
    "get_email_for_username",
    { p_username: normalizedUsername }
  );
  if (lookupError || !email) {
    throw new Error("If that username exists, a reset link has been processed.");
  }

  if (isSyntheticInternalEmail(email)) {
    throw new Error(
      "This dashboard uses internal Supabase accounts, so password reset emails cannot be delivered to the synthetic address on file. Please contact your DASMO-CBMS administrator to reset your password from the Supabase dashboard."
    );
  }

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/reset-password`,
  });
  if (error) {
    if (error.message?.includes("User not found") || error.message?.includes("not found")) {
      throw new Error("No account was found for that username.");
    }
    throw new Error("Unable to send a reset link right now. Please contact your administrator.");
  }
  return true;
}

