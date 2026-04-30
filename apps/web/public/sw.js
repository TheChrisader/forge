/* global self, fetch */
self.addEventListener("push", (event) => {
  let data = {
    title: "Forge Alert",
    body: "You have a new notification",
    level: "INFO",
  };

  if (event.data) {
    try {
      data = event.data.json();
    } catch {
      data.body = event.data.text();
    }
  }

  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: "/forge-icon.svg",
      badge: "/forge-icon.svg",
      tag: `forge-alert-${Date.now()}`,
      data: {
        url: data.data?.url || "/alerts",
      },
      vibrate: data.level === "ERROR" || data.level === "WARNING" ? [200, 100, 200] : undefined,
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const targetUrl = event.notification.data?.url || "/alerts";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(targetUrl) && "focus" in client) {
          return client.focus();
        }
      }
      return self.clients.openWindow(targetUrl);
    })
  );
});

self.addEventListener("pushsubscriptionchange", (event) => {
  // Re-subscribe when the subscription expires or changes
  event.waitUntil(
    self.registration.pushManager
      .subscribe({ userVisibleOnly: true })
      .then((subscription) => {
        return fetch("/api/push/subscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(subscription.toJSON()),
        });
      })
      .catch(() => {
        // TODO: log error when resubscription fails
      })
  );
});
