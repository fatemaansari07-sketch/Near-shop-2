// Supabase Edge Function: send-order-push
// Called by the app (user JWT). Pushes "naya order" to the shop team, or order status to the customer.
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
    const { order_id, event } = await req.json();
    if (!["new", "status"].includes(event)) return reply({ error: "bad event" }, 400);
    const auth = req.headers.get("Authorization") || "";
    const url = Deno.env.get("SUPABASE_URL")!;
    // 1) caller's own JWT decides whether this push is allowed
    const asUser = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: auth } } });
    const { data: ok } = await asUser.rpc("order_push_authorize", { p_order: order_id, p_event: event });
    if (ok !== true) return reply({ error: "Not allowed" }, 403);
    // 2) service role fetches tokens
    const db = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: rows } = await db.rpc("order_push_targets", { p_order: order_id, p_event: event });
    if (!rows?.length) return reply({ sent: 0 });
    const sa = JSON.parse(Deno.env.get("FCM_SERVICE_ACCOUNT")!);
    const at = await accessToken(sa);
    let sent = 0; const dead: string[] = [];
    await Promise.all(rows.map(async (r: any) => {
      const x = await fetch(`https://fcm.googleapis.com/v1/projects/${sa.project_id}/messages:send`, {
        method: "POST", headers: { Authorization: `Bearer ${at}`, "Content-Type": "application/json" },
        body: JSON.stringify({ message: { token: r.token, data: { title: r.title, body: r.body, url: "/" } } }),
      });
      if (x.ok) sent++; else { const j = await x.json().catch(() => ({})); if (["UNREGISTERED", "INVALID_ARGUMENT", "NOT_FOUND"].includes(j?.error?.status)) dead.push(r.token); }
    }));
    if (dead.length) await db.from("user_devices").update({ revoked_at: new Date().toISOString() }).in("token", dead);
    return reply({ sent, removed_invalid: dead.length });
  } catch (e) {
    return reply({ error: String((e as Error).message || e) }, 500);
  }
});
