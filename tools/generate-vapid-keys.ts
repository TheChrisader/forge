/**
 * Generate VAPID key pairs for web push notifications.
 *
 * Usage: npx tsx tools/generate-vapid-keys.ts
 *
 * Output: VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT
 * Add these to your .env file.
 */
import webpush from "web-push";

const vapidKeys = webpush.generateVAPIDKeys();

console.log("=== VAPID Key Pair ===\n");
console.log(`VAPID_PUBLIC_KEY=${vapidKeys.publicKey}`);
console.log(`VAPID_PRIVATE_KEY=${vapidKeys.privateKey}`);
console.log(`VAPID_SUBJECT=mailto:admin@forge.dev\n`);
console.log("Add these values to your .env file.");
