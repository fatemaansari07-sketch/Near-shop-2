// Supabase Edge Function: send-campaign-push
// Admin-only. Sends a published campaign as FCM push to the campaign's real audience.
// Secrets (supabase secrets set ...): FCM_SERVICE_ACCOUNT (full service-account JSON, one line).
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are provided automatically by Supabase.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Content-Type": "application/json" };
const reply = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: cors });
const b64 = (b: ArrayBuffer | string) => btoa(typeof b === "string" ? b : String.fromCharCode(...new Uint8Array(b))).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");

async function accessToken(sa: any): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const head = b64(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claim = b64(JSON.stringify({ iss: sa.client_email, scope: "https://www.googleapis.com/auth/firebase.messaging", aud: "https://oauth2.googleapis.com/token", iat: now, exp: now + 3600 }));
  const pem = sa.private_key.replace(/-----[^-]+-----/g, "").replace(/\s/g, "");
  const key = await crypto.subtle.importKey("pkcs8", Uint8Array.from(atob(pem), (c) => c.charCodeAt(0)), { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(`${head}.${claim}`));
  const r = await fetch("https://oauth2.googleapis.com/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: `${head}.${claim}.${b64(sig)}` }) });
  const j = await r.json();
  if (!j.access_token) throw new Error("FCM auth failed");
  return j.access_token;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const { campaign_id, admin_password, resend } = await req.json();
    const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: ok } = await db.rpc("nearshop_admin_ok", { p_password: admin_password });
    if (ok !== true) return reply({ error: "Admin verification failed" }, 401);

    const { data: c } = await db.from("admin_campaigns").select("*").eq("id", campaign_id).maybeSingle();
    if (!c) return reply({ error: "Campaign nahi mili" }, 404);
    if (c.status !== "published") return reply({ error: "Pehle campaign Publish karein" }, 400);
    if (!c.push_enabled) return reply({ error: "Is campaign me Push band hai" }, 400);
    if (c.push_sent_at && !resend) return reply({ error: "Push pehle hi bheja ja chuka hai. Dobara bhejna ho to resend karein." }, 409);

    const { data: rows } = await db.rpc("campaign_push_targets", { p_campaign: campaign_id });
    const tokens: string[] = (rows || []).map((r: any) => r.token);
    if (!tokens.length) return reply({ sent: 0, failed: 0, targeted: 0, note: "Is audience me kisi ne notification allow nahi kiya." });

    const sa = JSON.parse(Deno.env.get("FCM_SERVICE_ACCOUNT")!);
    const at = await accessToken(sa);
    const link = c.primary_url && /^https:\/\//i.test(c.primary_url) ? c.primary_url : "/";
    let sent = 0, failed = 0; const dead: string[] = [];
    for (let i = 0; i < tokens.length; i += 20) {
      await Promise.all(tokens.slice(i, i + 20).map(async (t) => {
        const r = await fetch(`https://fcm.googleapis.com/v1/projects/${sa.project_id}/messages:send`, {
          method: "POST", headers: { Authorization: `Bearer ${at}`, "Content-Type": "application/json" },
          body: JSON.stringify({ message: { token: t, data: { title: String(c.title).slice(0, 100), body: String(c.body).slice(0, 240), url: link, campaign_id: c.id, image: c.image_url && /^https:\/\//i.test(c.image_url) ? c.image_url : "" } } }),
        });
        if (r.ok) sent++; else { failed++; const j = await r.json().catch(() => ({})); if (["UNREGISTERED", "INVALID_ARGUMENT", "NOT_FOUND"].includes(j?.error?.status)) dead.push(t); }
      }));
    }
    await db.rpc("campaign_push_done", { p_campaign: campaign_id, p_dead: dead });
    return reply({ targeted: tokens.length, sent, failed, removed_invalid: dead.length });
  } catch (e) {
    return reply({ error: String((e as Error).message || e) }, 500);
  }
});
