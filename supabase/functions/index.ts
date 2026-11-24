// Supabase Edge Function: send-order-push
// Deploy as: supabase/functions/send-order-push/index.ts
// Required Supabase Function secret: FCM_SERVICE_ACCOUNT (full Firebase service-account JSON).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};
const reply = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: cors });
const b64url = (input: ArrayBuffer | Uint8Array | string) => {
  const bytes = typeof input === "string" ? new TextEncoder().encode(input) :
    input instanceof Uint8Array ? input : new Uint8Array(input);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
};
async function getAccessToken(sa: any): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const h = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const c = b64url(JSON.stringify({
    iss: sa.client_email,
    scope: "https://www.googleapis.com/auth/firebase.messaging",
    aud: "https://oauth2.googleapis.com/token",
    iat: now, exp: now + 3600,
  }));
  const pem = String(sa.private_key || "").replace(/-----[^-]+-----/g, "").replace(/\s/g, "");
  const key = await crypto.subtle.importKey("pkcs8", Uint8Array.from(atob(pem), x => x.charCodeAt(0)),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(`${h}.${c}`));
  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: `${h}.${c}.${b64url(sig)}` }),
  });
  const j = await r.json();
  if (!r.ok || !j.access_token) throw new Error("Firebase access token nahi mila.");
  return j.access_token;
}

Deno.serve(async req => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return reply({ error: "Method not allowed" }, 405);
  try {
    const { order_id, event } = await req.json();
    if (!order_id || !["new", "status"].includes(event)) return reply({ error: "Bad request" }, 400);
    const url = Deno.env.get("SUPABASE_URL")!;
    const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const auth = req.headers.get("Authorization") || "";
    const userDb = createClient(url, anon, { global: { headers: { Authorization: auth } }, auth: { persistSession: false } });
    const { data: allowed, error: authError } = await userDb.rpc("order_push_authorize", { p_order: order_id, p_event: event });
    if (authError || allowed !== true) return reply({ error: "Not allowed" }, 403);

    const db = createClient(url, service, { auth: { persistSession: false } });
    const { data: rows, error: rowsError } = await db.rpc("order_push_targets", { p_order: order_id, p_event: event });
    if (rowsError) throw new Error(rowsError.message);
    if (!rows?.length) return reply({ sent: 0, targeted: 0 });

    const raw = Deno.env.get("FCM_SERVICE_ACCOUNT");
    if (!raw) throw new Error("Supabase secret FCM_SERVICE_ACCOUNT set nahi hai.");
    const sa = JSON.parse(raw);
    const token = await getAccessToken(sa);
    let sent = 0;
    let failed = 0;
    const dead: string[] = [];
    for (let i = 0; i < rows.length; i += 40) {
      const batch = rows.slice(i, i + 40);
      const result = await Promise.all(batch.map(async (row: any) => {
        const response = await fetch(`https://fcm.googleapis.com/v1/projects/${sa.project_id}/messages:send`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            message: {
              token: row.token,
              data: { title: String(row.title || "NearShop"), body: String(row.body || ""), url: "/" },
              webpush: { headers: { Urgency: "high", TTL: "86400" } },
            },
          }),
        });
        if (response.ok) return true;
        const detail = await response.json().catch(() => ({}));
        if (["UNREGISTERED", "NOT_FOUND"].includes(detail?.error?.status)) dead.push(row.token);
        return false;
      }));
      sent += result.filter(Boolean).length;
      failed += result.length - result.filter(Boolean).length;
    }
    const { error: doneError } = await db.rpc("order_push_done", {
      p_order: order_id, p_event: event, p_sent: sent, p_dead: dead,
    });
    if (doneError) throw new Error(doneError.message);
    return reply({ sent, failed, targeted: rows.length, removed_invalid: dead.length });
  } catch (error) {
    return reply({ error: String((error as Error)?.message || error) }, 500);
  }
});
