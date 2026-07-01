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

// ─── Password reset (username-based wrapper) ───────────────────
// NOTE: Since the email on file is a synthetic, non-deliverable
// placeholder, Supabase's reset email will not reach a real inbox
// unless that domain is actually configured to forward somewhere.
// For this internal dashboard, password resets are expected to be
// done manually via Supabase Dashboard -> Authentication -> Users
// -> select user -> Reset password. This function is kept for
// completeness but the UI does not need to expose it.
export async function sendPasswordReset(username) {
  const { data: email, error: lookupError } = await supabase.rpc(
    "get_email_for_username",
    { p_username: username.trim().toLowerCase() }
  );
  if (lookupError || !email) {
    throw new Error("If that username exists, a reset link has been processed.");
  }
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/reset-password`,
  });
  if (error) throw error;
}
