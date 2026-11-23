// Web push registration via Firebase Cloud Messaging. Needs VITE_FIREBASE_* env vars on Vercel.
// Without them pushSupported() is false and the UI stays hidden (nothing breaks).
import { supabase } from "../supabaseClient";

const env = import.meta.env;
const cfg = {
  apiKey: env.VITE_FIREBASE_API_KEY, authDomain: env.VITE_FIREBASE_AUTH_DOMAIN, projectId: env.VITE_FIREBASE_PROJECT_ID,
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID, appId: env.VITE_FIREBASE_APP_ID,
};
export const pushSupported = () =>
  !!(cfg.apiKey && cfg.projectId && cfg.messagingSenderId && cfg.appId && env.VITE_FIREBASE_VAPID_KEY) &&
  typeof window !== "undefined" && "Notification" in window && "serviceWorker" in navigator && "PushManager" in window;
export const pushPermission = () => (typeof Notification === "undefined" ? "denied" : Notification.permission);

export async function enablePush() {
  if (!pushSupported()) throw new Error("Push abhi is app me set up nahi hai.");
  const perm = await Notification.requestPermission();
  if (perm !== "granted") throw new Error("Notification permission allow nahi hui.");
  const [{ initializeApp, getApps }, { getMessaging, getToken }] = await Promise.all([import("firebase/app"), import("firebase/messaging")]);
  const app = getApps()[0] || initializeApp(cfg);
  const reg = await navigator.serviceWorker.ready;
  const token = await getToken(getMessaging(app), { vapidKey: env.VITE_FIREBASE_VAPID_KEY, serviceWorkerRegistration: reg });
  if (!token) throw new Error("Device token nahi mila.");
  const { data, error } = await supabase.rpc("register_device_token", { p_token: token, p_platform: "web" });
  if (error || !data) throw new Error("Token save nahi hua. Login check karein.");
  try { localStorage.setItem("ns_push_token", token); } catch {}
  return token;
}
