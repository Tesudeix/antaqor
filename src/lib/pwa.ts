// ─── PWA Utilities ───

export interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

/** Check if app is running in standalone (installed) mode */
export function isInstalled(): boolean {
  if (typeof window === "undefined") return false;
  // Check display-mode media query
  if (window.matchMedia("(display-mode: standalone)").matches) return true;
  // iOS standalone check
  if ((navigator as unknown as { standalone?: boolean }).standalone === true) return true;
  return false;
}

/** Check if running on iOS Safari */
export function isIOS(): boolean {
  if (typeof navigator === "undefined") return false;
  return /iphone|ipad|ipod/i.test(navigator.userAgent) && !(window as unknown as { MSStream?: unknown }).MSStream;
}

/** Check if push notifications are supported */
export function isPushSupported(): boolean {
  if (typeof window === "undefined") return false;
  return "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

/** Get current notification permission */
export function getNotificationPermission(): NotificationPermission | "unsupported" {
  if (typeof Notification === "undefined") return "unsupported";
  return Notification.permission;
}

/** Request notification permission */
export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (typeof Notification === "undefined") return "denied";
  return Notification.requestPermission();
}

/** Subscribe to push notifications */
export async function subscribeToPush(userId: string): Promise<PushSubscription | null> {
  if (!isPushSupported()) return null;

  const reg = await navigator.serviceWorker.ready;

  // Check existing subscription
  let sub = await reg.pushManager.getSubscription();
  if (sub) {
    // Send to backend in case it's new
    await sendSubscriptionToServer(sub, userId);
    return sub;
  }

  // Get VAPID public key from server
  const res = await fetch("/api/push/vapid-key");
  if (!res.ok) return null;
  const { publicKey } = await res.json();
  if (!publicKey) return null;

  // Subscribe
  sub = await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(publicKey).buffer as ArrayBuffer,
  });

  await sendSubscriptionToServer(sub, userId);
  return sub;
}

/** Unsubscribe from push notifications */
export async function unsubscribeFromPush(userId: string): Promise<boolean> {
  if (!isPushSupported()) return false;

  const reg = await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.getSubscription();
  if (!sub) return true;

  const success = await sub.unsubscribe();
  if (success) {
    await fetch("/api/push/subscribe", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ endpoint: sub.endpoint, userId }),
    });
  }
  return success;
}

/** Register service worker and handle updates */
export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!("serviceWorker" in navigator)) return null;

  const reg = await navigator.serviceWorker.register("/sw.js");

  // Listen for updates
  reg.addEventListener("updatefound", () => {
    const newWorker = reg.installing;
    if (!newWorker) return;

    newWorker.addEventListener("statechange", () => {
      if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
        // New version available
        window.dispatchEvent(new CustomEvent("sw-update-available", { detail: { registration: reg } }));
      }
    });
  });

  return reg;
}

/** Tell the waiting service worker to skip waiting */
export function skipWaiting(reg: ServiceWorkerRegistration): void {
  reg.waiting?.postMessage("SKIP_WAITING");
}

// ─── Helpers ───

async function sendSubscriptionToServer(sub: PushSubscription, userId: string): Promise<void> {
  await fetch("/api/push/subscribe", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ subscription: sub.toJSON(), userId }),
  });
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}
