// Supabase Edge Function: send-campaign-push
// Deploy as: supabase/functions/send-campaign-push/index.ts
// Required Supabase Function secret: FCM_SERVICE_ACCOUNT (full Firebase service-account JSON).
// VITE_FIREBASE_* and VITE_FIREBASE_VAPID_KEY remain public web-app config in Vercel.
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
  const bytes = typeof input === "string"
    ? new TextEncoder().encode(input)
    : input instanceof Uint8Array
      ? input
      : new Uint8Array(input);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
};

async function getFcmAccessToken(serviceAccount: any): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claim = b64url(JSON.stringify({
    iss: serviceAccount.client_email,
    scope: "https://www.googleapis.com/auth/firebase.messaging",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  }));
  const pem = String(serviceAccount.private_key || "").replace(/-----[^-]+-----/g, "").replace(/\s/g, "");
  if (!pem || !serviceAccount.client_email || !serviceAccount.project_id) {
    throw new Error("Firebase service-account JSON incomplete hai.");
  }
  const key = await crypto.subtle.importKey(
    "pkcs8",
    Uint8Array.from(atob(pem), c => c.charCodeAt(0)),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    key,
    new TextEncoder().encode(`${header}.${claim}`),
  );
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: `${header}.${claim}.${b64url(signature)}`,
    }),
  });
  const json = await response.json();
  if (!response.ok || !json.access_token) {
    throw new Error("Firebase access token nahi mila.");
  }
  return json.access_token;
}

function campaignClickUrl(c: any): string {
  if (c.shop_id && c.product_id) return `/?campaign=${encodeURIComponent(c.id)}`;
  for (const value of [c.primary_url, c.video_url]) {
    try {
      const url = new URL(String(value || ""));
      if (url.protocol === "https:") return url.href;
    } catch {}
  }
  return "/";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return reply({ error: "Method not allowed" }, 405);

  try {
    const { campaign_id, admin_password, resend = false } = await req.json();
    if (!campaign_id || !/^[0-9a-f-]{36}$/i.test(String(campaign_id)) || !admin_password) {
      return reply({ error: "Campaign ID ya admin password missing hai." }, 400);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !anonKey || !serviceKey) {
      throw new Error("Supabase function environment incomplete hai.");
    }

    // Validate the admin password using the same existing password-gated RPC as Admin Center.
    const authHeader = req.headers.get("Authorization") || "";
    const caller = createClient(supabaseUrl, anonKey, {
      global: { headers: authHeader ? { Authorization: authHeader } : {} },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: adminRows, error: adminError } = await caller.rpc("admin_list_campaigns", {
      p_password: String(admin_password),
    });
    if (adminError || !Array.isArray(adminRows)) {
      return reply({ error: "Admin verification failed." }, 403);
    }
    if (!adminRows.some((row: any) => String(row.id) === String(campaign_id))) {
      return reply({ error: "Campaign nahi mili." }, 404);
    }

    const db = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: campaign, error: campaignError } = await db
      .from("admin_campaigns")
      .select("id,title,body,image_url,video_url,primary_url,button_text,status,push_enabled,start_at,end_at,push_sent_at,shop_id,product_id")
      .eq("id", campaign_id)
      .maybeSingle();
    if (campaignError || !campaign) return reply({ error: "Campaign data load nahi hua." }, 404);

    const now = Date.now();
    if (campaign.status !== "published" || !campaign.push_enabled ||
        new Date(campaign.start_at).getTime() > now ||
        (campaign.end_at && new Date(campaign.end_at).getTime() <= now)) {
      return reply({ error: "Campaign published, active aur push-enabled honi chahiye." }, 409);
    }
    if (campaign.push_sent_at && !resend) {
      return reply({ error: "Is campaign ka push pehle bheja ja chuka hai. Dobara bhejne ke liye resend confirm karein." }, 409);
    }

    const { data: targets, error: targetError } = await db.rpc("campaign_push_targets", {
      p_campaign: campaign_id,
    });
    if (targetError) throw new Error(`Push audience load nahi hui: ${targetError.message}`);
    const tokens = [...new Set((targets || []).map((row: any) => row.token).filter((token: any) => typeof token === "string" && token.length > 20))];
    if (!tokens.length) {
      return reply({ sent: 0, failed: 0, targeted: 0, note: "Abhi is audience mein kisi user ka push token registered nahi hai." });
    }

    const serviceAccountText = Deno.env.get("FCM_SERVICE_ACCOUNT");
    if (!serviceAccountText) {
      throw new Error("Supabase Edge Function secret FCM_SERVICE_ACCOUNT set nahi hai.");
    }
    const serviceAccount = JSON.parse(serviceAccountText);
    const accessToken = await getFcmAccessToken(serviceAccount);
    const url = campaignClickUrl(campaign);
    let sent = 0;
    let failed = 0;
    const deadTokens: string[] = [];

    // Keep batches small to avoid overloading the Edge Function and FCM endpoint.
    for (let offset = 0; offset < tokens.length; offset += 40) {
      const batch = tokens.slice(offset, offset + 40);
      const results = await Promise.all(batch.map(async (token: string) => {
        const response = await fetch(
          `https://fcm.googleapis.com/v1/projects/${serviceAccount.project_id}/messages:send`,
          {
            method: "POST",
            headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
            body: JSON.stringify({
              message: {
                token,
                data: {
                  title: String(campaign.title || "NearShop Update").slice(0, 120),
                  body: String(campaign.body || "").slice(0, 1000),
                  image: String(campaign.image_url || ""),
                  url,
                  campaign_id: String(campaign.id),
                },
                webpush: { headers: { Urgency: "high", TTL: "86400" } },
              },
            }),
          },
        );
        if (response.ok) return { ok: true };
        const errorJson = await response.json().catch(() => ({}));
        const status = errorJson?.error?.status;
        if (status === "UNREGISTERED" || status === "NOT_FOUND") deadTokens.push(token);
        return { ok: false };
      }));
      sent += results.filter(result => result.ok).length;
      failed += results.length - results.filter(result => result.ok).length;
    }

    if (sent > 0 || deadTokens.length > 0) {
      const { error: doneError } = await db.rpc("campaign_push_done", {
        p_campaign: campaign_id,
        p_dead: deadTokens,
      });
      if (doneError) throw new Error(`Push status update nahi hua: ${doneError.message}`);
    }

    return reply({
      sent,
      failed,
      targeted: tokens.length,
      removed_invalid: deadTokens.length,
      note: sent === 0 ? "Koi push deliver nahi hua; Firebase project/token settings check karein." : "",
    });
  } catch (error) {
    return reply({ error: String((error as Error)?.message || error) }, 500);
  }
});
