import { supabase } from "../supabaseClient";

// Sirf testing/setup ke liye: Vercel env VITE_ALLOW_PHONE_LOGIN=true par purana phone login wapas dikhta hai.
export const PHONE_FALLBACK = import.meta.env.VITE_ALLOW_PHONE_LOGIN === "true";

export async function signInWithGoogle() {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: window.location.origin, queryParams: { prompt: "select_account" } },
  });
  if (error) return { error: /provider|enabled/i.test(error.message) ? "Google login abhi set nahi hua (Supabase → Authentication → Providers → Google)." : error.message };
  return {};
}
export const signOutAll = () => supabase.auth.signOut();

export const mapUserRow = (r) => ({
  id: r.id, name: r.name, phone: r.phone, email: r.email, authId: r.auth_id, points: r.points, streak: r.streak,
  lastCheckIn: r.last_check_in ? new Date(r.last_check_in).getTime() : null, isBlocked: !!r.is_blocked, referralCode: r.referral_code,
});

// Google account -> ShopNear user. Pehle auth_id se, phir email se (purane account jod dene ke liye), warna naya.
export async function resolveUserFromAuth(db, au, makeRef) {
  let { data: row } = await db.from("users").select("*").eq("auth_id", au.id).maybeSingle();
  const email = String(au.email || "").toLowerCase();
  if (!row && email) {
    const { data: byEmail } = await db.from("users").select("*").eq("email", email).is("auth_id", null).maybeSingle();
    if (byEmail) {
      const { data: linked, error } = await db.from("users").update({ auth_id: au.id }).eq("id", byEmail.id).select().single();
      if (error) return { error: error.message };
      row = linked;
    }
  }
  if (!row) {
    const meta = au.user_metadata || {};
    const name = meta.full_name || meta.name || email.split("@")[0] || "Naya User";
    const { data, error } = await db.from("users").insert({ auth_id: au.id, email, name, avatar_url: meta.avatar_url || null, referral_code: makeRef() }).select().single();
    if (error) return { error: error.message };
    row = data;
  }
  if (row.is_blocked) return { blocked: true };
  return { user: mapUserRow(row) };
}
