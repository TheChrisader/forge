/**
 * Push notification utilities for browser-side subscription management.
 */

const SW_PATH = "/sw.js";

function getApplicationServerKey(): Uint8Array {
  const vapidKey = document.querySelector('meta[name="vapid-public-key"]')?.getAttribute("content");

  if (vapidKey) {
    return urlBase64ToUint8Array(vapidKey);
  }

  throw new Error("VAPID public key not available. Push notifications may not be configured.");
}

export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!("serviceWorker" in navigator)) {
    return null;
  }

  try {
    return await navigator.serviceWorker.register(SW_PATH, { scope: "/" });
  } catch (err) {
    console.error("Failed to register service worker:", err);
    return null;
  }
}

export async function requestPushPermission(): Promise<boolean> {
  if (!("Notification" in window)) {
    return false;
  }

  if (Notification.permission === "granted") {
    return true;
  }

  if (Notification.permission === "denied") {
    return false;
  }

  const result = await Notification.requestPermission();
  return result === "granted";
}

export interface PushSubscriptionResult {
  success: boolean;
  subscription?: PushSubscription;
  error?: string;
}

export async function subscribeToPush(): Promise<PushSubscriptionResult> {
  const registration = await navigator.serviceWorker.getRegistration(SW_PATH);

  if (!registration) {
    const newReg = await registerServiceWorker();
    if (!newReg) {
      return { success: false, error: "Service worker registration failed" };
    }
    return subscribeWithRegistration(newReg);
  }

  return subscribeWithRegistration(registration);
}

async function subscribeWithRegistration(
  registration: ServiceWorkerRegistration
): Promise<PushSubscriptionResult> {
  const permissionGranted = await requestPushPermission();
  if (!permissionGranted) {
    return { success: false, error: "Notification permission denied" };
  }

  try {
    const applicationServerKey = getApplicationServerKey();
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: applicationServerKey as BufferSource,
    });

    return { success: true, subscription };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to subscribe to push notifications",
    };
  }
}

export async function unsubscribeFromPush(): Promise<boolean> {
  const registration = await navigator.serviceWorker.getRegistration(SW_PATH);
  if (!registration) return false;

  const subscription = await registration.pushManager.getSubscription();
  if (!subscription) return true;

  try {
    await subscription.unsubscribe();
    return true;
  } catch {
    return false;
  }
}

export function getPushPermissionStatus(): NotificationPermission | "unsupported" {
  if (!("Notification" in window)) {
    return "unsupported";
  }
  return Notification.permission;
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");

  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }

  return outputArray;
}
